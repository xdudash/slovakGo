/**
 * Vercel Cron — lifecycle emails (runs once a day).
 *
 * Four one-off messages keyed off registration date and practice activity:
 *   d0_welcome    — on signup day: one clear next action.
 *   d1_first      — day 1, still no finished lesson.
 *   d3_inactive   — day 3, no practice at all in the last 3 days.
 *   d7_progress   — day 7: what they achieved + ask for feedback.
 *
 * `email_log (user_id, kind)` is the primary key, so each learner receives every
 * kind at most once even if the cron runs several times a day.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { exec, query, nowIso, safeJson } from "../_lib/core";
import { appUrl, renderEmail, sendEmail } from "../_lib/mail";

type EmailKind = "d0_welcome" | "d1_first" | "d3_inactive" | "d7_progress";

interface Candidate {
  id: string;
  email: string;
  name: string;
  daysSinceSignup: number;
  /** Days since the last practice; falls back to days since signup when never practised. */
  inactiveDays: number;
  completedLessons: number;
  streakDays: number;
  xpTotal: number;
}

function daysBetween(fromIso: string, now: number): number {
  const started = Date.parse(fromIso);
  if (Number.isNaN(started)) return -1;
  return Math.floor((now - started) / 86_400_000);
}

/**
 * Picks the single message a learner should get today, or null.
 * Pure so the schedule can be unit-tested without a database.
 */
export function pickEmail(c: Candidate, sent: Set<EmailKind>): EmailKind | null {
  if (c.daysSinceSignup <= 0 && !sent.has("d0_welcome")) return "d0_welcome";
  if (c.daysSinceSignup >= 1 && c.completedLessons === 0 && !sent.has("d1_first")) return "d1_first";
  if (c.daysSinceSignup >= 3 && c.inactiveDays >= 3 && !sent.has("d3_inactive")) return "d3_inactive";
  if (c.daysSinceSignup >= 7 && c.completedLessons > 0 && !sent.has("d7_progress")) return "d7_progress";
  return null;
}

function compose(kind: EmailKind, c: Candidate): { subject: string; html: string } {
  const base = appUrl();
  switch (kind) {
    case "d0_welcome":
      return {
        subject: "Вітаємо в SlovakGO 🇸🇰",
        html: renderEmail({
          title: "Почнімо зі словацької для життя",
          paragraphs: [
            `Привіт, ${c.name}! Перший розділ уже відкритий — без оплати.`,
            "Один урок займає близько чотирьох хвилин. Після нього ти вже зможеш сказати перші фрази в магазині чи в лікарні.",
          ],
          ctaText: "Пройти перший урок",
          ctaUrl: `${base}/app/path`,
        }),
      };
    case "d1_first":
      return {
        subject: "Твій перший урок за 4 хвилини",
        html: renderEmail({
          title: "Найважчий крок — почати",
          paragraphs: [
            `${c.name}, перший урок ще чекає на тебе.`,
            "Чотири хвилини сьогодні — і словацька перестане бути чужою. Далі буде легше: кожен урок побудований навколо реальної ситуації.",
          ],
          ctaText: "Почати зараз",
          ctaUrl: `${base}/app/path`,
        }),
      };
    case "d3_inactive":
      return {
        subject: "5 фраз, які рятують у лікаря",
        html: renderEmail({
          title: "Забери п'ять фраз для лікаря",
          paragraphs: [
            "Bolí ma hlava — у мене болить голова.",
            "Potrebujem termín u lekára — мені потрібен запис до лікаря.",
            "Mám horúčku — у мене температура.",
            "Som poistený — я застрахований.",
            "Môžete to zopakovať pomalšie? — можете повторити повільніше?",
            "У застосунку такі фрази йдуть у складі ситуацій — щоб ти не просто вивчив, а зміг відповісти.",
          ],
          ctaText: "Продовжити навчання",
          ctaUrl: `${base}/app/path`,
        }),
      };
    case "d7_progress":
      return {
        subject: "Тиждень зі словацькою — ось твій результат",
        html: renderEmail({
          title: "Тиждень позаду",
          paragraphs: [
            `${c.name}, за цей тиждень ти пройшов ${c.completedLessons} урок(ів) і набрав ${c.xpTotal} XP${c.streakDays > 1 ? `, серія — ${c.streakDays} днів` : ""}.`,
            "Напиши у відповідь одним рядком, чого зараз найбільше не вистачає в застосунку — ми читаємо кожен лист.",
          ],
          ctaText: "Продовжити",
          ctaUrl: `${base}/app/path`,
        }),
      };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    res.status(503).json({ ok: false, error: "CRON_SECRET not configured" });
    return;
  }
  if (req.headers["authorization"] !== `Bearer ${cronSecret}`) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }
  if (!process.env.RESEND_API_KEY) {
    res.status(200).json({ ok: true, skipped: "RESEND_API_KEY not configured" });
    return;
  }

  await exec(
    `CREATE TABLE IF NOT EXISTS email_log (
       user_id TEXT NOT NULL,
       kind    TEXT NOT NULL,
       sent_at TEXT NOT NULL,
       PRIMARY KEY (user_id, kind)
     )`
  );

  const now = Date.now();
  // Only the first 8 days matter for this schedule — keep the scan small.
  const since = new Date(now - 9 * 86_400_000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const rows = await query(
    `SELECT u.id, u.email, u.name_text, u.created_at,
            p.completed_j, p.last_prac, p.streak_days, p.xp_total
     FROM users u JOIN progress p ON p.user_id = u.id
     WHERE u.is_blocked = 0 AND u.role = 'student' AND u.created_at >= ?`,
    [since]
  );

  const counts: Record<string, number> = {};
  let sentTotal = 0;

  for (const row of rows) {
    const userId = String(row.id);
    const logged = await query("SELECT kind FROM email_log WHERE user_id = ?", [userId]);
    const sent = new Set(logged.map(r => String(r.kind) as EmailKind));

    const daysSinceSignup = daysBetween(String(row.created_at), now);
    const candidate: Candidate = {
      id: userId,
      email: String(row.email),
      name: String(row.name_text || "друже"),
      daysSinceSignup,
      inactiveDays: row.last_prac ? daysBetween(String(row.last_prac), now) : daysSinceSignup,
      completedLessons: safeJson<string[]>(String(row.completed_j ?? "[]"), []).length,
      streakDays: Number(row.streak_days ?? 0),
      xpTotal: Number(row.xp_total ?? 0),
    };

    const kind = pickEmail(candidate, sent);
    if (!kind) continue;

    const { subject, html } = compose(kind, candidate);
    const ok = await sendEmail(candidate.email, subject, html);
    if (!ok) continue;

    await exec("INSERT OR IGNORE INTO email_log (user_id, kind, sent_at) VALUES (?, ?, ?)", [userId, kind, nowIso()]);
    counts[kind] = (counts[kind] ?? 0) + 1;
    sentTotal++;
  }

  res.status(200).json({ ok: true, scanned: rows.length, sent: sentTotal, byKind: counts });
}
