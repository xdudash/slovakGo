import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Meta Pixel consent and conversion integrity", () => {
  let storage: Map<string, string>;
  let doc: { cookie: string; getElementById: ReturnType<typeof vi.fn>; createElement: ReturnType<typeof vi.fn>; head: { appendChild: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    vi.resetModules();
    storage = new Map();
    doc = { cookie: "", getElementById: vi.fn().mockReturnValue(null), createElement: vi.fn().mockReturnValue({}), head: { appendChild: vi.fn() } };
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });
    vi.stubGlobal("document", doc);
    vi.stubGlobal("location", { hostname: "app.slovakgo.sk", pathname: "/register", protocol: "https:" });
    vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("makes no request and records no conversion before consent or after declining", async () => {
    const { trackMeta, setMarketingConsent } = await import("../../shared/metaPixel");
    expect(trackMeta("Purchase", { value: 3 }, "invoice1")).toBe(false);
    setMarketingConsent("denied");
    expect(trackMeta("Purchase", { value: 3 }, "invoice1")).toBe(false);
    expect(doc.head.appendChild).not.toHaveBeenCalled();
    expect(storage.size).toBe(0);
  });

  it("loads exactly one asynchronous script and deduplicates pageviews and conversions", async () => {
    const { trackMeta, trackMetaPage, setMarketingConsent } = await import("../../shared/metaPixel");
    setMarketingConsent("granted");
    trackMetaPage(); // React StrictMode replay
    expect(trackMeta("CompleteRegistration", {}, "registration:user1")).toBe(true);
    expect(trackMeta("CompleteRegistration", {}, "registration:user1")).toBe(false);
    expect(doc.head.appendChild).toHaveBeenCalledTimes(1);
    expect(doc.head.appendChild).toHaveBeenCalledWith(expect.objectContaining({ async: true, src: "https://connect.facebook.net/en_US/fbevents.js" }));
    const queue = window.fbq!.queue;
    expect(queue.filter(args => args[0] === "init")).toEqual([["init", "1339268801708445"]]);
    expect(queue.filter(args => args[2] === "PageView")).toHaveLength(1);
    expect(queue.filter(args => args[2] === "CompleteRegistration")).toHaveLength(1);
    location.pathname = "/onboarding";
    trackMetaPage();
    expect(queue.filter(args => args[2] === "PageView")).toHaveLength(2);
    expect(doc.cookie).toContain("Domain=slovakgo.sk");
  });

  it("keeps conversion deduplication across page loads", async () => {
    doc.cookie = "slovakgo_meta_consent_v1=granted";
    storage.set("slovakgo.meta-events.v1", JSON.stringify(["purchase:in_1"]));
    const { trackMeta } = await import("../../shared/metaPixel");
    expect(trackMeta("Purchase", { value: 3, currency: "EUR" }, "purchase:in_1")).toBe(false);
    expect(trackMeta("Purchase", { value: 20, currency: "EUR" }, "purchase:in_2")).toBe(true);
    expect(window.fbq!.queue.filter(args => args[2] === "Purchase")).toEqual([
      ["trackSingle", "1339268801708445", "Purchase", { value: 20, currency: "EUR" }, { eventID: "purchase:in_2" }],
    ]);
  });

  it("revokes consent and stops subsequent events", async () => {
    const { trackMeta, setMarketingConsent } = await import("../../shared/metaPixel");
    setMarketingConsent("granted");
    setMarketingConsent("denied");
    expect(window.fbq!.queue).toContainEqual(["consent", "revoke"]);
    expect(trackMeta("StartTrial", {}, "sub_1")).toBe(false);
    setMarketingConsent("granted");
    expect(trackMeta("StartTrial", {}, "sub_1")).toBe(true);
  });

  it.each(["/reset-password", "/auth/google/callback", "/admin/stats", "/teacher/lessons"])("does not load Meta on sensitive/internal path %s", async path => {
    location.pathname = path;
    doc.cookie = "slovakgo_meta_consent_v1=granted";
    const { trackMetaPage } = await import("../../shared/metaPixel");
    trackMetaPage();
    expect(doc.head.appendChild).not.toHaveBeenCalled();
  });

  it("does not pollute the production pixel with local or preview traffic", async () => {
    location.hostname = "localhost";
    doc.cookie = "slovakgo_meta_consent_v1=granted";
    const { trackMeta } = await import("../../shared/metaPixel");
    expect(trackMeta("Purchase", { value: 3 })).toBe(false);
    expect(doc.head.appendChild).not.toHaveBeenCalled();
  });
});
