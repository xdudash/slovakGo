const STORAGE_KEY = "slovakgo.attribution";
const PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const MAX_VALUE_LENGTH = 100;

export type Attribution = Partial<Record<(typeof PARAMS)[number], string>>;

/** Remembers the first campaign that brought this browser here. Later visits do not overwrite it. */
export function captureAttribution(search: string = window.location.search): void {
  try {
    if (localStorage.getItem(STORAGE_KEY)) return;
    const query = new URLSearchParams(search);
    const found: Attribution = {};
    for (const key of PARAMS) {
      const value = query.get(key)?.trim();
      if (value) found[key] = value.slice(0, MAX_VALUE_LENGTH);
    }
    if (Object.keys(found).length) localStorage.setItem(STORAGE_KEY, JSON.stringify(found));
  } catch { /* storage can be blocked; attribution is optional */ }
}

export function getAttribution(): Attribution {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as unknown;
    if (!stored || typeof stored !== "object") return {};
    return Object.fromEntries(
      PARAMS.flatMap((key) => {
        const value = (stored as Record<string, unknown>)[key];
        return typeof value === "string" ? [[key, value]] : [];
      })
    );
  } catch {
    return {};
  }
}
