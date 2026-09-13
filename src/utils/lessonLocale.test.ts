import { describe, expect, it } from "vitest";
import { resolveStatementText, resolveWordExampleTranslation, resolveWordTranslation } from "./lessonLocale";

describe("multilingual lesson support text", () => {
  const tx = (value: string | Record<string, string> | undefined, lang: string) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    return value[lang] ?? value.uk ?? "";
  };

  it("resolves a word translation in the active language", () => {
    const word = { uk: "будинок", translation: { uk: "будинок", ru: "дом", en: "house" } };
    expect(resolveWordTranslation(word, (v) => tx(v as Record<string,string>, "ru"))).toBe("дом");
    expect(resolveWordTranslation(word, (v) => tx(v as Record<string,string>, "en"))).toBe("house");
  });

  it("resolves a word example translation in the active language", () => {
    const word = {
      exampleUk: "Це будинок.",
      example: { sk: "To je dom.", translation: { uk: "Це будинок.", ru: "Это дом.", en: "This is a house." } },
    };
    expect(resolveWordExampleTranslation(word, (v) => tx(v as Record<string,string>, "ru"))).toBe("Это дом.");
    expect(resolveWordExampleTranslation(word, (v) => tx(v as Record<string,string>, "en"))).toBe("This is a house.");
  });

  it("resolves localized true-false-list statements while preserving legacy Slovak", () => {
    expect(resolveStatementText({ text: { uk: "Так", ru: "Да", en: "Yes" }, correct: true }, (v) => tx(v as Record<string,string>, "en"))).toBe("Yes");
    expect(resolveStatementText({ sk: "Je to pravda.", correct: true }, (v) => tx(v as Record<string,string>, "en"))).toBe("Je to pravda.");
  });
});
