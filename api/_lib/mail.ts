import { randomUUID } from "node:crypto";
import { exec, nowIso } from "./core";
/**
 * Transactional email via Resend.
 *
 * One shared template so lifecycle, billing and support mails stay visually
 * identical — the markup used to live inline in stripe.ts.
 */

export interface EmailContent {
  /** Coloured headline inside the card. */
  title: string;
  /** Paragraphs of the body; plain text, rendered one <p> each. */
  paragraphs: string[];
  ctaText?: string;
  ctaUrl?: string;
  /** Headline colour — defaults to the brand purple; billing errors use red. */
  accent?: string;
  unsubscribeUrl?: string;
}

export function appUrl(): string {
  const fallback = process.env.NODE_ENV === "production" ? "https://app.slovakgo.sk" : "http://localhost:5173";
  return String(process.env.APP_URL ?? fallback).replace(/\/$/, "");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderEmail({ title, paragraphs, ctaText, ctaUrl, accent = "#6c47ff", unsubscribeUrl }: EmailContent): string {
  const body = paragraphs
    .map(p => `<p style="color:#374151;line-height:1.6;margin:0 0 16px;">${escapeHtml(p)}</p>`)
    .join("");
  const cta = ctaText && ctaUrl
    ? `<a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#6c47ff;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px;margin-top:8px;">${escapeHtml(ctaText)} →</a>`
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f7ff;margin:0;padding:40px 20px;">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <h1 style="font-size:22px;font-weight:800;color:#1a1040;margin:0 0 4px;">SlovakGO</h1>
  <p style="color:#9ca3af;margin:0 0 32px;font-size:13px;">Вивчення словацької мови</p>
  <h2 style="font-size:18px;font-weight:700;color:${accent};margin:0 0 12px;">${escapeHtml(title)}</h2>
  ${body}
  ${cta}
  ${unsubscribeUrl ? `<p><a href="${escapeHtml(unsubscribeUrl)}">Відписатися від маркетингових листів</a></p>` : ""}
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
  <p style="color:#d1d5db;font-size:11px;margin:0;">© 2026 SlovakGO</p>
</div></body></html>`;
}

/** Sends one email. Returns false when Resend is not configured or the call failed. */
export async function sendEmail(to: string, subject: string, html: string, options: { idempotencyKey?: string; unsubscribeUrl?: string } = {}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}) },
      body: JSON.stringify({ from: process.env.MAIL_FROM ?? "noreply@slovakgo.sk", to, subject, html,
        ...(options.unsubscribeUrl ? { headers: { "List-Unsubscribe": `<${options.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}) }),
    });
    const result = await r.json().catch(() => ({})) as { id?: string };
    await exec(`CREATE TABLE IF NOT EXISTS email_deliveries (id TEXT PRIMARY KEY, recipient TEXT NOT NULL, subject TEXT NOT NULL, provider_id TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL)`);
    await exec("INSERT INTO email_deliveries (id, recipient, subject, provider_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [randomUUID(), to, subject, result.id ?? null, r.ok && result.id ? "accepted" : `failed:${r.status}`, nowIso()]);
    if (!r.ok) console.error("[resend] send failed:", r.status);
    return r.ok && Boolean(result.id);
  } catch (err) {
    console.error("[resend] send error:", err);
    return false;
  }
}
