import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { MARKET_INSTRUMENTS, isCandleInterval, type ApiError, type MarketInstrument } from "@pastx/shared";
import { MarketDataError, TwelveDataAdapter } from "@pastx/market-data";
import { probePortaldotEvm, type ChainProbeResult } from "@pastx/chain-adapter";

export type AppOptions = {
  marketDataApiKey?: string;
  marketDataDisplayEnabled?: boolean;
  logger?: boolean;
  marketData?: TwelveDataAdapter;
  chainRpcUrl?: string;
  chainExpectedChainId?: number;
  chainProbe?: () => Promise<ChainProbeResult>;
};

function apiError(code: ApiError["error"]["code"], message: string, requestId?: string): ApiError {
  return { error: { code, message, ...(requestId ? { requestId } : {}) } };
}

function configuredChainId(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return 420420777;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error("PORTALDOT_EVM_CHAIN_ID must be a positive safe integer.");
  return parsed;
}

function findInstrument(symbol: string): MarketInstrument | undefined {
  const normalized = symbol.trim().toUpperCase();
  return MARKET_INSTRUMENTS.find((instrument) => instrument.symbol === normalized);
}

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? true, requestIdHeader: "x-request-id" });
  const marketData = options.marketData ?? new TwelveDataAdapter(options.marketDataApiKey ?? process.env.MARKET_DATA_API_KEY);
  const chainExpectedChainId = options.chainExpectedChainId ?? configuredChainId(process.env.PORTALDOT_EVM_CHAIN_ID);
  if (!Number.isSafeInteger(chainExpectedChainId) || chainExpectedChainId <= 0) throw new Error("PORTALDOT_EVM_CHAIN_ID must be a positive safe integer.");
  const chainProbe = options.chainProbe ?? (() => probePortaldotEvm(options.chainRpcUrl ?? process.env.PORTALDOT_EVM_RPC_URL, undefined, chainExpectedChainId));
  const marketDataDisplayEnabled = options.marketDataDisplayEnabled ?? process.env.MARKET_DATA_DISPLAY_ENABLED === "true";
  const marketDataConfigured = Boolean((options.marketDataApiKey ?? process.env.MARKET_DATA_API_KEY)?.trim());

  await app.register(helmet);
  await app.register(rateLimit, { max: 60, timeWindow: "1 minute" });

  app.get("/api/health", async () => ({
    status: "ok",
    service: "pastx-api",
    marketDataConfigured,
    marketDataDisplayEnabled,
    tradingEnabled: false
  }));

  // The capability document gives clients one authoritative, explicit feature
  // contract. "Implemented" does not mean externally enabled or production-ready.
  app.get("/api/capabilities", async () => ({
    service: "pastx-api",
    capabilities: {
      referenceCatalogue: { implemented: true, enabled: true },
      marketQuotes: { implemented: true, enabled: marketDataDisplayEnabled && marketDataConfigured },
      marketCandles: { implemented: true, enabled: marketDataDisplayEnabled && marketDataConfigured },
      chainIdentityProbe: { implemented: true, enabled: true, verificationScope: "chain_id_only" },
      walletConnection: { implemented: false, enabled: false },
      onchainBalances: { implemented: false, enabled: false },
      orderPreview: { implemented: true, enabled: true, execution: false },
      orderSubmission: { implemented: false, enabled: false },
      transactionHistory: { implemented: false, enabled: false },
      atomicSettlement: { implemented: false, enabled: false }
    },
    safety: {
      tradingEnabled: false,
      externalStockQuotesAreReferenceData: true,
      marketDataDisplayRequiresProviderPermission: true
    }
  }));

  app.get("/api/chain/status", async () => ({ item: await chainProbe() }));

  app.get("/api/markets", async () => ({
    items: MARKET_INSTRUMENTS,
    count: MARKET_INSTRUMENTS.length,
    classification: "reference catalogue; not proof of tokenized equity or executable market"
  }));

  app.get<{ Params: { symbol: string } }>("/api/markets/:symbol", async (request, reply) => {
    const instrument = findInstrument(request.params.symbol);
    if (!instrument) return reply.code(404).send(apiError("NOT_FOUND", "Market instrument was not found.", request.id));
    return { item: instrument };
  });

  app.get<{ Params: { symbol: string } }>("/api/markets/:symbol/quote", async (request, reply) => {
    const instrument = findInstrument(request.params.symbol);
    if (!instrument) return reply.code(404).send(apiError("NOT_FOUND", "Market instrument was not found.", request.id));
    if (!marketDataConfigured) return reply.code(503).send(apiError("PROVIDER_NOT_CONFIGURED", "Market data provider is not configured.", request.id));
      if (!marketDataDisplayEnabled) return reply.code(403).send(apiError("MARKET_DATA_DISPLAY_DISABLED", "Live market-data display is disabled until provider terms are verified.", request.id));
    try {
      return { item: await marketData.getQuote(instrument) };
    } catch (error) {
      if (error instanceof MarketDataError) {
        return reply.code(error.statusCode).send(apiError(error.code, error.message, request.id));
      }
      request.log.error({ err: error }, "Unexpected market quote error");
      return reply.code(500).send(apiError("INTERNAL_ERROR", "Unable to retrieve market quote.", request.id));
    }
  });

  app.get<{ Params: { symbol: string }; Querystring: { interval?: string; outputsize?: string } }>(
    "/api/markets/:symbol/candles",
    async (request, reply) => {
      const instrument = findInstrument(request.params.symbol);
      if (!instrument) return reply.code(404).send(apiError("NOT_FOUND", "Market instrument was not found.", request.id));

      const interval = request.query.interval ?? "1day";
      if (!isCandleInterval(interval)) {
        return reply.code(400).send(apiError("INVALID_INPUT", "Unsupported candle interval.", request.id));
      }

      const rawSize = request.query.outputsize ?? "30";
      if (!/^\d+$/.test(rawSize)) {
        return reply.code(400).send(apiError("INVALID_INPUT", "outputsize must be an integer between 1 and 500.", request.id));
      }
      const outputsize = Number(rawSize);
      if (!Number.isInteger(outputsize) || outputsize < 1 || outputsize > 500) {
        return reply.code(400).send(apiError("INVALID_INPUT", "outputsize must be an integer between 1 and 500.", request.id));
      }

      if (!marketDataConfigured) return reply.code(503).send(apiError("PROVIDER_NOT_CONFIGURED", "Market data provider is not configured.", request.id));
    if (!marketDataDisplayEnabled) return reply.code(403).send(apiError("MARKET_DATA_DISPLAY_DISABLED", "Live market-data display is disabled until provider terms are verified.", request.id));
      try {
        return { symbol: instrument.symbol, interval, items: await marketData.getCandles(instrument, interval, outputsize) };
      } catch (error) {
        if (error instanceof MarketDataError) {
          return reply.code(error.statusCode).send(apiError(error.code, error.message, request.id));
        }
        request.log.error({ err: error }, "Unexpected candle history error");
        return reply.code(500).send(apiError("INTERNAL_ERROR", "Unable to retrieve candle history.", request.id));
      }
    }
  );

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send(apiError("NOT_FOUND", "Route was not found.", request.id));
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.statusCode === 429) {
      return reply.code(429).send(apiError("RATE_LIMITED", "Too many requests. Please retry later.", request.id));
    }
    request.log.error({ err: error }, "Unhandled API error");
    return reply.code(500).send(apiError("INTERNAL_ERROR", "An unexpected server error occurred.", request.id));
  });

  return app;
}
