import { beforeEach, describe, expect, it, vi } from "vitest";
import { markPlusOfferSeen, plusOfferSeen, safeNextPath } from "./plusOffer";

describe("plusOffer", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
    });
  });

  it("remembers per learner that the onboarding offer was shown", () => {
    expect(plusOfferSeen("u1")).toBe(false);
    markPlusOfferSeen("u1");
    expect(plusOfferSeen("u1")).toBe(true);
    expect(plusOfferSeen("u2")).toBe(false);
  });

  it("only follows in-app next paths", () => {
    expect(safeNextPath("/app/lesson/a0-u01-l01-abeceda")).toBe("/app/lesson/a0-u01-l01-abeceda");
    expect(safeNextPath("/app/path")).toBe("/app/path");
    expect(safeNextPath("https://evil.example/app/")).toBe("/app/path");
    expect(safeNextPath("//evil.example/app/x")).toBe("/app/path");
    expect(safeNextPath("/app/../login")).toBe("/app/path");
    expect(safeNextPath(null)).toBe("/app/path");
  });
});
