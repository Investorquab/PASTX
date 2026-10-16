import { describe, expect, it } from "vitest";
import { readRuntimeConfig } from "./runtime-config";

describe("API runtime configuration", () => {
  it("uses safe defaults when no environment values are supplied", () => {
    expect(readRuntimeConfig({})).toEqual({ port: 4000, host: "0.0.0.0" });
  });

  it("accepts a valid decimal port and trims the host", () => {
    expect(readRuntimeConfig({ PORT: "4179", HOST: " 127.0.0.1 " })).toEqual({
      port: 4179,
      host: "127.0.0.1"
    });
  });

  it.each(["", " ", "4e3", "4000.0", "-1", "0", "65536", "999999999999999999999"])(
    "rejects invalid PORT value %j",
    (PORT) => {
      expect(() => readRuntimeConfig({ PORT })).toThrow(
        "PORT must be a decimal integer between 1 and 65535."
      );
    }
  );

  it("rejects a blank HOST instead of failing later during listen", () => {
    expect(() => readRuntimeConfig({ HOST: "   " })).toThrow(
      "HOST must be a non-empty hostname or IP address."
    );
  });
});
