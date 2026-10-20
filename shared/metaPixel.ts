/** Shared by the static landing and the app. No marketing requests before opt-in. */
export const META_PIXEL_ID = "1339268801708445";
const CONSENT_COOKIE = "slovakgo_meta_consent_v1";
const LEDGER_KEY = "slovakgo.meta-events.v1";
type Consent = "granted" | "denied";
type Pixel = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][]; push: Pixel; loaded: boolean; version: string;
};
declare global {
  interface Window { fbq?: Pixel; _fbq?: Pixel }
}
let initialized = false;
let started = false;
let lastPage = "";
let memoryConsent: Consent | undefined;
const sent = new Set<string>();

export function marketingAllowed(): boolean {
  if (typeof document === "undefined") return false;
  const value = document.cookie.split("; ").find(c => c.startsWith(`${CONSENT_COOKIE}=`))?.split("=")[1];
  return (value ?? memoryConsent) === "granted";
}

function productionSite(): boolean {
  return ["slovakgo.sk", "www.slovakgo.sk", "app.slovakgo.sk"].includes(location.hostname);
}

function eligiblePage(): boolean {
  // Meta's library reads the current URL. Never load it on password/OAuth callback URLs.
  return !/^\/(reset-password|forgot-password|auth\/google\/callback|admin|teacher)(\/|$)/.test(location.pathname);
}

function loadPixel(): boolean {
  if (!productionSite() || !eligiblePage() || !marketingAllowed()) return false;
  if (initialized) { window.fbq?.("consent", "grant"); return true; }
  if (!window.fbq) {
    const pixel = function (...args: unknown[]) {
      if (pixel.callMethod) pixel.callMethod(...args);
      else pixel.queue.push(args);
    } as Pixel;
    pixel.queue = []; pixel.push = pixel; pixel.loaded = true; pixel.version = "2.0";
    window.fbq = window._fbq = pixel;
  }
  const fbq = window.fbq;
  fbq("consent", "grant");
  // Explicit events only: avoid automatic form/metadata collection.
  fbq("set", "autoConfig", false, META_PIXEL_ID);
  fbq("init", META_PIXEL_ID);
  initialized = true;
  if (!document.getElementById("slovakgo-meta-pixel")) {
    const script = document.createElement("script");
    script.id = "slovakgo-meta-pixel";
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }
  return true;
}

/** Returns false if consent/production gating prevents dispatch. */
export function trackMeta(name: string, params: Record<string, unknown> = {}, onceKey?: string, custom = false): boolean {
  try {
    if (!loadPixel()) return false;
    let ledger: string[] = [];
    try { ledger = JSON.parse(localStorage.getItem(LEDGER_KEY) || "[]"); } catch { /* memory fallback */ }
    if (!Array.isArray(ledger)) ledger = [];
    if (onceKey && (sent.has(onceKey) || ledger.includes(onceKey))) return false;
    const eventID = onceKey || crypto.randomUUID();
    window.fbq!(custom ? "trackSingleCustom" : "trackSingle", META_PIXEL_ID, name, params, { eventID });
    if (onceKey) {
      sent.add(onceKey);
      try { localStorage.setItem(LEDGER_KEY, JSON.stringify([...ledger, onceKey].slice(-100))); } catch { /* memory fallback */ }
    }
    return true;
  } catch { return false; } // Tracking must never interrupt registration, learning or billing.
}

export function trackMetaPage(): void {
  // Deduplicate by path, not by query parameters. Sensitive routes are excluded above.
  const page = location.pathname;
  if (page === lastPage || !eligiblePage()) return;
  if (trackMeta("PageView")) lastPage = page;
}

function cookieSuffix(): string {
  return `; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}${productionSite() ? "; Domain=slovakgo.sk" : ""}`;
}

export function setMarketingConsent(consent: Consent): void {
  memoryConsent = consent;
  document.cookie = `${CONSENT_COOKIE}=${consent}; Max-Age=15552000${cookieSuffix()}`;
  if (consent === "granted") {
    if (initialized) window.fbq?.("consent", "grant");
    trackMetaPage();
  } else {
    window.fbq?.("consent", "revoke");
    lastPage = "";
    for (const name of ["_fbp", "_fbc"]) {
      document.cookie = `${name}=; Max-Age=0${cookieSuffix()}`;
      document.cookie = `${name}=; Max-Age=0; Path=/`;
    }
  }
  document.getElementById("slovakgo-cookie-panel")?.remove();
  window.dispatchEvent(new Event("slovakgo:marketing-consent"));
}

const labels = {
  uk: ["Рекламні cookie", "За вашою згодою Meta Pixel передає Meta перегляди сторінок, реєстрацію та події підписки, щоб вимірювати й покращувати рекламу SlovakGO. Вибір діє також у застосунку. Його можна змінити через кнопку Cookie.", "Дозволити", "Відхилити", "Закрити"],
  ru: ["Рекламные cookie", "С вашего согласия Meta Pixel передаёт Meta просмотры страниц, регистрацию и события подписки для измерения и улучшения рекламы SlovakGO. Выбор действует и в приложении. Его можно изменить кнопкой Cookie.", "Разрешить", "Отклонить", "Закрыть"],
  en: ["Advertising cookies", "With your permission, Meta Pixel shares page views, registration and subscription events with Meta to measure and improve SlovakGO ads. Your choice also applies in the app. Change it anytime using Cookie.", "Allow", "Decline", "Close"],
  sk: ["Reklamné cookies", "S vaším súhlasom Meta Pixel odovzdáva spoločnosti Meta zobrazenia stránok, registráciu a udalosti predplatného na meranie a zlepšovanie reklamy SlovakGO. Voľba platí aj v aplikácii. Zmeníte ju tlačidlom Cookie.", "Povoliť", "Odmietnuť", "Zavrieť"],
};

function showConsent(): void {
  if (document.getElementById("slovakgo-cookie-panel")) return;
  const lang = document.documentElement.lang.split("-")[0] as keyof typeof labels;
  const [title, text, allow, decline, close] = labels[lang] || labels.uk;
  const panel = document.createElement("section");
  panel.id = "slovakgo-cookie-panel";
  panel.setAttribute("aria-label", title);
  const heading = document.createElement("strong"); heading.textContent = title;
  const description = document.createElement("p"); description.textContent = text;
  const privacy = document.createElement("a");
  privacy.href = "https://www.facebook.com/privacy/policy/";
  privacy.textContent = "Meta · Privacy"; privacy.target = "_blank"; privacy.rel = "noopener noreferrer";
  const actions = document.createElement("div");
  for (const [label, consent] of [[decline, "denied"], [allow, "granted"]] as const) {
    const button = document.createElement("button"); button.type = "button"; button.textContent = label;
    button.onclick = () => setMarketingConsent(consent);
    actions.appendChild(button);
  }
  if (document.cookie.includes(`${CONSENT_COOKIE}=`) || memoryConsent) {
    const button = document.createElement("button"); button.type = "button"; button.textContent = close;
    button.onclick = () => panel.remove(); actions.appendChild(button);
  }
  panel.append(heading, description, privacy, actions);
  document.body.appendChild(panel);
}

export function initMetaPixel(): void {
  if (typeof window === "undefined" || started) return;
  started = true;
  const style = document.createElement("style");
  style.textContent = `#slovakgo-cookie-panel{position:fixed;z-index:10000;bottom:16px;left:16px;right:16px;max-width:470px;padding:20px;border:1px solid #d8d2eb;border-radius:16px;background:#fff;color:#211946;box-shadow:0 8px 32px #21194625;font:14px/1.5 system-ui,sans-serif;max-height:75vh;overflow:auto}#slovakgo-cookie-panel p{margin:8px 0}#slovakgo-cookie-panel a{color:#5340b3}#slovakgo-cookie-panel div{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}#slovakgo-cookie-panel button,#slovakgo-cookie-settings{font:inherit;cursor:pointer;border:1px solid #6f57e8;border-radius:8px;background:#fff;color:#352269;padding:9px 16px}#slovakgo-cookie-panel button:focus-visible,#slovakgo-cookie-settings:focus-visible{outline:3px solid #211946;outline-offset:3px}#slovakgo-cookie-settings{position:fixed;z-index:9999;bottom:6px;left:6px;font:11px system-ui,sans-serif;padding:4px 8px}`;
  document.head.appendChild(style);
  const button = document.createElement("button"); button.id = "slovakgo-cookie-settings";
  button.type = "button"; button.textContent = "Cookie"; button.onclick = showConsent;
  document.body.appendChild(button);
  if (!document.cookie.includes(`${CONSENT_COOKIE}=`)) showConsent();
  trackMetaPage();
  // A choice made on the landing is shared with app.slovakgo.sk via the cookie.
  window.addEventListener("focus", () => {
    if (!marketingAllowed()) window.fbq?.("consent", "revoke");
    else trackMetaPage();
  });
}
