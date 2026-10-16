export type RuntimeConfig = {
  port: number;
  host: string;
};

const DEFAULT_PORT = 4000;
const DEFAULT_HOST = "0.0.0.0";

export function readRuntimeConfig(env: Record<string, string | undefined> = process.env): RuntimeConfig {
  const rawPort = env.PORT ?? String(DEFAULT_PORT);
  if (!/^\d+$/.test(rawPort)) {
    throw new Error("PORT must be a decimal integer between 1 and 65535.");
  }

  const port = Number(rawPort);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a decimal integer between 1 and 65535.");
  }

  const host = (env.HOST ?? DEFAULT_HOST).trim();
  if (!host) {
    throw new Error("HOST must be a non-empty hostname or IP address.");
  }

  return { port, host };
}
