import { buildApp } from "./app";

const portValue = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

if (!Number.isInteger(portValue) || portValue < 1 || portValue > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const app = await buildApp();
try {
  await app.listen({ port: portValue, host });
} catch (error) {
  app.log.error({ err: error }, "Failed to start PASTX API");
  process.exitCode = 1;
}
