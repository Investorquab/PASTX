import { describe, expect, it } from "vitest";
import { textFor, type LanguageCode } from "./i18n";

describe("terminal translations", () => {
  const languages: LanguageCode[] = ["en", "fr", "es", "pt", "ha", "yo"];
  it("translates core stock-search, quote and trading-preview labels in every supported language", () => {
    for (const language of languages) {
      const text = textFor(language);
      expect(text.searchStocksPlaceholder.length).toBeGreaterThan(5);
      expect(text.marketDataNotConnected.length).toBeGreaterThan(5);
      expect(text.quoteBasedEstimateOnly.length).toBeGreaterThan(10);
      expect(text.submitOrderNotImplemented.length).toBeGreaterThan(5);
    }
    expect(textFor("fr").searchStocksPlaceholder).not.toBe(textFor("en").searchStocksPlaceholder);
    expect(textFor("yo").marketDataNotConnected).not.toBe(textFor("en").marketDataNotConnected);
  });
});
