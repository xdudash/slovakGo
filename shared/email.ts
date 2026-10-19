/**
 * Registration email check shared by the browser and the API.
 * Catches the typos seen in real sign-ups (e.g. "name.gmail.com@gmail.com",
 * "gmail.con") and throwaway inboxes, which can never receive lesson reminders.
 */
export type EmailCheck =
  | { ok: true; email: string }
  | { ok: false; email: string; error: string; suggestion?: string };

const FORMAT = /^[a-z0-9._%+-]+@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;

// Only long, unambiguous domains: short ones (i.ua, azet.sk) match real names.
const GLUE_CHECK = ["gmail.com", "icloud.com", "ukr.net", "outlook.com", "hotmail.com", "yahoo.com"];

const TYPOS: Record<string, string> = {
  "gmail.con": "gmail.com", "gmail.co": "gmail.com", "gmail.cm": "gmail.com", "gmail.om": "gmail.com",
  "gmail.ru": "gmail.com", "gmail.ua": "gmail.com", "gmail.sk": "gmail.com", "gmail.comm": "gmail.com",
  "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gamil.com": "gmail.com", "gmaill.com": "gmail.com",
  "gnail.com": "gmail.com", "gmal.com": "gmail.com", "gmali.com": "gmail.com", "gmeil.com": "gmail.com",
  "gimail.com": "gmail.com", "gmsil.com": "gmail.com", "glail.com": "gmail.com",
  "icloud.co": "icloud.com", "icloud.con": "icloud.com", "iclod.com": "icloud.com", "icoud.com": "icloud.com",
  "ukr.ne": "ukr.net", "ukr.nt": "ukr.net", "urk.net": "ukr.net", "ukr.com": "ukr.net",
  "outlok.com": "outlook.com", "outlook.co": "outlook.com", "hotmail.co": "hotmail.com", "hotmial.com": "hotmail.com",
  "yahoo.co": "yahoo.com", "yaho.com": "yahoo.com",
};

const DISPOSABLE = new Set([
  "proguidex.com", "mailinator.com", "yopmail.com", "guerrillamail.com", "sharklasers.com",
  "10minutemail.com", "tempmail.com", "temp-mail.org", "tempmail.dev", "dispostable.com",
  "trashmail.com", "getnada.com", "maildrop.cc", "mohmal.com", "emailondeck.com", "fakeinbox.com",
  "throwawaymail.com", "mintemail.com", "mailnesia.com", "spamgourmet.com", "tmpmail.org",
]);

export function checkEmail(raw: string): EmailCheck {
  const email = String(raw ?? "").trim().toLowerCase();
  if (!FORMAT.test(email) || email.includes("..") || email.startsWith(".") || email.includes(".@")) {
    return { ok: false, email, error: "Перевір email: схоже, в адресі помилка." };
  }
  const at = email.lastIndexOf("@");
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  // "ivanna167gmail.com@gmail.com" — the domain was typed into the name part.
  const glued = GLUE_CHECK.find((d) => local.endsWith(d) && local.length > d.length);
  if (glued) {
    const fixedLocal = local.slice(0, -glued.length).replace(/[.@]+$/, "");
    if (fixedLocal) {
      const suggestion = `${fixedLocal}@${domain}`;
      return { ok: false, email, suggestion, error: `Схоже, адреса набрана з помилкою. Можливо, ${suggestion}?` };
    }
  }

  const fixedDomain = TYPOS[domain];
  if (fixedDomain) {
    const suggestion = `${local}@${fixedDomain}`;
    return { ok: false, email, suggestion, error: `Схоже, адреса набрана з помилкою. Можливо, ${suggestion}?` };
  }

  if (DISPOSABLE.has(domain)) {
    return { ok: false, email, error: "Тимчасові поштові скриньки не підтримуються. Вкажи свою постійну пошту." };
  }

  return { ok: true, email };
}
