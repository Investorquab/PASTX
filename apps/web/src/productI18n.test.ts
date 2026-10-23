import { describe, expect, it } from "vitest";
import { languageNames, type LanguageCode } from "./i18n";
import { landingTextFor, workspaceTextFor } from "./productI18n";

const languages: LanguageCode[] = ["en", "fr", "es", "pt", "id", "vi", "zh"];

describe("PASTX product localization", () => {
  it("provides landing-page copy in all advertised languages", () => {
    for (const language of languages) {
      const copy = landingTextFor(language);
      expect(copy.heroLine1.length).toBeGreaterThan(3);
      expect(copy.heroDescription.length).toBeGreaterThan(20);
      expect(copy.productBody1.length).toBeGreaterThan(20);
      expect(copy.resourcesTitle1.length).toBeGreaterThan(3);
    }
    expect(landingTextFor("id").heroLine1).not.toBe(landingTextFor("en").heroLine1);
    expect(landingTextFor("vi").heroLine1).not.toBe(landingTextFor("en").heroLine1);
    expect(landingTextFor("zh").heroLine1).not.toBe(landingTextFor("en").heroLine1);
  });

  it("localizes the market, portfolio and bridge workspace copy", () => {
    for (const language of languages) {
      const copy = workspaceTextFor(language);
      expect(copy.navMarkets.length).toBeGreaterThan(2);
      expect(copy.placeBuy.length).toBeGreaterThan(3);
      expect(copy.bridgeTitle.length).toBeGreaterThan(5);
      expect(copy.simulationWarningTitle.length).toBeGreaterThan(10);
    }
    expect(workspaceTextFor("id").bridgeTitle).not.toBe(workspaceTextFor("en").bridgeTitle);
    expect(workspaceTextFor("vi").placeBuy).not.toBe(workspaceTextFor("en").placeBuy);
    expect(workspaceTextFor("zh").navMarkets).not.toBe(workspaceTextFor("en").navMarkets);
  });

  it("exposes the intended language menu without Hausa or Yoruba", () => {
    expect(Object.keys(languageNames)).toEqual(["en", "fr", "es", "pt", "id", "vi", "zh"]);
    expect(languageNames.id).toBe("Bahasa Indonesia");
    expect(languageNames.vi).toBe("Tiếng Việt");
    expect(languageNames.zh).toBe("中文（简体）");
  });
});
