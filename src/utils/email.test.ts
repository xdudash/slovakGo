import { describe, expect, it } from "vitest";
import { checkEmail } from "../../shared/email";

describe("checkEmail", () => {
  it("accepts normal addresses and normalises case/spaces", () => {
    expect(checkEmail("  Galan.Luda97@Gmail.com ")).toEqual({ ok: true, email: "galan.luda97@gmail.com" });
    expect(checkEmail("jenulya86@ukr.net").ok).toBe(true);
    expect(checkEmail("alvt68@icloud.com").ok).toBe(true);
    expect(checkEmail("info.worldwork.sk@gmail.com").ok).toBe(true);
    expect(checkEmail("stud_e23_18@zfkkt.org.ua").ok).toBe(true);
  });

  it("does not flag local parts that merely end in a short domain-like word", () => {
    expect(checkEmail("vanessa.sk@gmail.com").ok).toBe(true);
    expect(checkEmail("andrii.ua@gmail.com").ok).toBe(true);
  });

  it("catches a domain typed into the name part", () => {
    const r = checkEmail("ivannajr167gmail.com@gmail.com");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.suggestion).toBe("ivannajr167@gmail.com");
  });

  it("suggests fixes for common domain typos", () => {
    const r = checkEmail("olga@gmial.com");
    expect(!r.ok && r.suggestion).toBe("olga@gmail.com");
    expect(checkEmail("olga@gmail.con").ok).toBe(false);
    expect(checkEmail("olga@ukr.ne").ok).toBe(false);
  });

  it("rejects malformed and throwaway addresses", () => {
    for (const bad of ["", "olga", "olga@", "olga@gmail", "ol ga@gmail.com", "olga..k@gmail.com", "olga.@gmail.com", "o@-x.com"]) {
      expect(checkEmail(bad).ok).toBe(false);
    }
    expect(checkEmail("pijeyo9521@proguidex.com").ok).toBe(false);
  });
});
