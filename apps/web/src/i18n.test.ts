import { describe, expect, it } from "vitest";
import { textFor, languageNames, type LanguageCode } from "./i18n";

describe("terminal translations", () => {
  const languages: LanguageCode[] = ["en", "fr", "es", "pt", "id", "vi", "zh"];
  it("provides core labels in every supported language", () => {
    for (const language of languages) {
      const text = textFor(language);
      expect(text.searchStocksPlaceholder.length).toBeGreaterThan(5);
      expect(text.marketDataNotConnected.length).toBeGreaterThan(5);
      expect(text.quoteBasedEstimateOnly.length).toBeGreaterThan(10);
      expect(text.submitOrderNotImplemented.length).toBeGreaterThan(5);
    }
    expect(textFor("fr").searchStocksPlaceholder).not.toBe(textFor("en").searchStocksPlaceholder);
    expect(textFor("id").searchStocksPlaceholder).not.toBe(textFor("en").searchStocksPlaceholder);
    expect(textFor("vi").marketDataNotConnected).not.toBe(textFor("en").marketDataNotConnected);
    expect(textFor("zh").marketDataNotConnected).not.toBe(textFor("en").marketDataNotConnected);
  });
  it("offers the intended language set only", () => {
    expect(Object.keys(languageNames)).toEqual(["en", "fr", "es", "pt", "id", "vi", "zh"]);
    expect(Object.values(languageNames)).not.toContain("Hausa");
    expect(Object.values(languageNames)).not.toContain("Yorùbá");
  });
});