import { describe, expect, it } from "vitest";
import { buildApp } from "./app";

describe("API abuse controls", () => {
  it("returns a stable, request-correlated error when the per-client rate limit is exceeded", async () => {
    const app = await buildApp({ logger: false });
    try {
      for (let request = 0; request < 60; request += 1) {
        const response = await app.inject({ method: "GET", url: "/api/health" });
        expect(response.statusCode).toBe(200);
      }

      const limited = await app.inject({
        method: "GET",
        url: "/api/health",
        headers: { "x-request-id": "rate-limit-regression" }
      });

      expect(limited.statusCode).toBe(429);
      expect(limited.json()).toEqual({
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please retry later.",
          requestId: "rate-limit-regression"
        }
      });
    } finally {
      await app.close();
    }
  });
});
