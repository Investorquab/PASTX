  async getCandles(instrument: MarketInstrument, interval: CandleInterval, outputSize: number): Promise<MarketCandle[]> {
    if (instrument.kind !== "reference" || !instrument.providerSymbol?.trim()) {
      throw new MarketDataError("PROVIDER_INVALID_RESPONSE", "External market data is restricted to explicitly mapped reference instruments.", 400);
    }
    const cacheKey = `${instrument.symbol}:${instrument.providerSymbol.trim().toUpperCase()}:${instrument.currency}:${interval}:${outputSize}`;
    const cached = this.candleCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value.map((candle) => ({ ...candle }));
    if (cached) this.candleCache.delete(cacheKey);

    return (await this.singleFlight(this.candleInflight, cacheKey, async () => {
      const payload = asRecord(await this.request("/time_series", {
        symbol: instrument.providerSymbol ?? instrument.symbol,
        interval,
        outputsize: String(outputSize),
        order: "ASC",
        timezone: "UTC"
      }));
      const meta = asRecord(payload?.meta);
      const responseSymbol = typeof meta?.symbol === "string" ? meta.symbol.trim().toUpperCase() : "";
      const responseInterval = typeof meta?.interval === "string" ? meta.interval.trim() : "";
      const responseCurrency = typeof meta?.currency === "string" ? meta.currency.trim().toUpperCase() : "";
      const expectedSymbol = (instrument.providerSymbol ?? instrument.symbol).trim().toUpperCase();
      const values = payload?.values;
      if (
        responseSymbol !== expectedSymbol ||
        responseInterval !== interval ||
        responseCurrency !== instrument.currency ||
        !Array.isArray(values)
      ) {
        throw new MarketDataError("PROVIDER_INVALID_RESPONSE", "Market data provider returned mismatched or incomplete candle metadata.", 502);
      }

      const candles = values.map((value): MarketCandle => {
        const item = asRecord(value);
        const rawDatetime = typeof item?.datetime === "string" ? item.datetime.trim() : "";
        const datetimeWithZone = !rawDatetime
          ? ""
          : /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(rawDatetime)
            ? rawDatetime
            : /^\d{4}-\d{2}-\d{2}$/.test(rawDatetime)
              ? `${rawDatetime}T00:00:00Z`
              : `${rawDatetime.replace(" ", "T")}Z`;
        const parsedTimestamp = datetimeWithZone ? new Date(datetimeWithZone) : null;
        const timestamp = parsedTimestamp && Number.isFinite(parsedTimestamp.getTime())
          ? parsedTimestamp.toISOString()
          : null;
        const open = parseFiniteNumber(item?.open);
        const high = parseFiniteNumber(item?.high);
        const low = parseFiniteNumber(item?.low);
        const close = parseFiniteNumber(item?.close);
        const volume = parseFiniteNumber(item?.volume);
        if (!timestamp || open === null || high === null || low === null || close === null || open <= 0 || high <= 0 || low <= 0 || close <= 0 || high < Math.max(open, close, low) || low > Math.min(open, close, high) || (item?.volume !== undefined && item.volume !== null && (volume === null || volume < 0))) {
          throw new MarketDataError("PROVIDER_INVALID_RESPONSE", "Market data provider returned a malformed candle.", 502);
        }
        return { timestamp, open, high, low, close, volume };
      });
      this.storeCache(this.candleCache, cacheKey, candles, 60_000);
      return candles;
    })).map((candle) => ({ ...candle }));
  }
}
