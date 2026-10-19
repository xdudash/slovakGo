import { exec, nowIso, queryOne } from "./core";
import { appUrl, renderEmail, sendEmail } from "./mail";

/**
 * Account-created email, sent right after registration to every new learner.
 *
 * It is a service message (confirms the account and where to continue), so it
 * does not depend on marketing consent and carries no promotional content or
 * unsubscribe link. It is logged as `d0_welcome`, so the daily lifecycle cron
 * never sends a second welcome to learners who also opted into marketing.
 * Failures are swallowed: registration must never fail because of email.
 */
export async function sendWelcomeEmail(userId: string, email: string, name: string): Promise<boolean> {
  try {
    await exec(
      `CREATE TABLE IF NOT EXISTS email_log (
         user_id TEXT NOT NULL,
         kind    TEXT NOT NULL,
         sent_at TEXT NOT NULL,
         PRIMARY KEY (user_id, kind)
       )`
    );
    if (await queryOne("SELECT 1 AS x FROM email_log WHERE user_id = ? AND kind = 'd0_welcome' LIMIT 1", [userId])) return false;

    const html = renderEmail({
      title: "Твій акаунт SlovakGO створено",
      paragraphs: [
        `Привіт, ${name || "друже"}! Реєстрація пройшла успішно.`,
        `Вхід — через ${email}. Перші 10 уроків відкриті без оплати й без картки.`,
        "Прогрес зберігається автоматично: якщо закриєш застосунок посеред уроку, продовжиш з того ж місця.",
      ],
      ctaText: "Почати перший урок",
      ctaUrl: `${appUrl()}/`,
    });
    const ok = await sendEmail(email, "Твій акаунт SlovakGO створено ✅", html, { idempotencyKey: `welcome/${userId}` });
    if (ok) await exec("INSERT OR IGNORE INTO email_log (user_id, kind, sent_at) VALUES (?, 'd0_welcome', ?)", [userId, nowIso()]);
    return ok;
  } catch (err) {
    console.error("[welcome] send failed:", err);
    return false;
  }
}
