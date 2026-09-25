import { describe, expect, it } from "vitest";
import uk from "./locales/uk.json";
import ru from "./locales/ru.json";
import sk from "./locales/sk.json";
import en from "./locales/en.json";

function leafKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, child]) => leafKeys(child, prefix ? `${prefix}.${key}` : key));
}

describe("locale contract", () => {
  const required = leafKeys(uk).sort();

  for (const [name, locale] of Object.entries({ ru, sk, en })) {
    it(`${name} contains every Ukrainian locale key`, () => {
      const keys = new Set(leafKeys(locale));
      const missing = required.filter((key) => !keys.has(key));
      expect(missing).toEqual([]);
    });
  }
});
