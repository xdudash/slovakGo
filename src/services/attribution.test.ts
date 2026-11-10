import { beforeEach, describe, expect, it } from "vitest";
import { captureAttribution, getAttribution } from "./attribution";

const values = new Map<string, string>();
beforeEach(() => {
  values.clear();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    },
  });
});

describe("attribution", () => {
  it("keeps only known campaign parameters", () => {
    captureAttribution("?utm_source=meta&utm_campaign=doctor&email=private@example.com&lang=ru");
    expect(getAttribution()).toEqual({ utm_source: "meta", utm_campaign: "doctor" });
  });

  it("does not overwrite the first campaign", () => {
    captureAttribution("?utm_source=meta");
    captureAttribution("?utm_source=tiktok");
    expect(getAttribution()).toEqual({ utm_source: "meta" });
  });

  it("stores nothing without campaign parameters and limits long values", () => {
    captureAttribution("?lang=uk");
    expect(getAttribution()).toEqual({});
    captureAttribution(`?utm_content=${"x".repeat(300)}`);
    expect(getAttribution().utm_content).toHaveLength(100);
  });
});
