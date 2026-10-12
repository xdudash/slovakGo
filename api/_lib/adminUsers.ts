import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Arg } from "./core";
import { query, queryOne, requireUid, checkRole, fail, respond } from "./core";
import { closeIdleSessions } from "./activity";
import { ensureEmailPreferences } from "./emailPreferences";

const joins = `FROM users u LEFT JOIN progress p ON p.user_id=u.id
 LEFT JOIN (SELECT user_id, SUM(active_seconds) AS active_seconds, COUNT(*) AS session_count,
 SUM(visits) AS visits, MAX(last_active_at) AS last_active_at FROM activity_sessions GROUP BY user_id) a ON a.user_id=u.id
 LEFT JOIN email_preferences ep ON ep.user_id=u.id`;
const lastActive = "MAX(COALESCE(a.last_active_at,''),COALESCE(p.last_prac,''),u.created_at)";
const completed = "COALESCE(json_array_length(p.completed_j),0)";
export function userFilters(params: Record<string, unknown>) {
  const clauses: string[] = [];
  const args: Arg[] = [];
  const search = String(params.search ?? "").trim();
  if (search) { clauses.push("(u.email LIKE ? OR u.name_text LIKE ?)"); args.push(`%${search}%`, `%${search}%`); }
  for (const [key, col] of [["role", "u.role"], ["sub", "u.sub_status"], ["level", "u.level"]]) {
    const value = String(params[key] ?? "");
    if (value && value !== "all") { clauses.push(`${col} = ?`); args.push(value); }
  }
  const days = Math.min(3650, Math.max(1, Number(params.inactiveDays) || 7));
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
  if (params.activity === "inactive" || params.activity === "active") {
    clauses.push(`${lastActive} ${params.activity === "inactive" ? "<" : ">="} ?`); args.push(cutoff);
  }
  if (params.progress === "none") clauses.push(`${completed} = 0`);
  if (params.progress === "started") clauses.push(`${completed} BETWEEN 1 AND 9`);
  if (params.progress === "ten_plus") clauses.push(`${completed} >= 10`);
  if (params.marketing === "consented") clauses.push("ep.marketing_consent = 1 AND u.is_blocked=0");
  return { where: clauses.length ? "WHERE " + clauses.join(" AND ") : "", args };
}
export function csvCell(value: unknown): string {
  let str = String(value ?? "");
  if (/^[\s]*[=+@\-\t\r]/.test(str)) str = "'" + str;
  return `"${str.replace(/"/g, '""')}"`;
}
export async function handleAdminUsers(req: VercelRequest, res: VercelResponse): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  if (!(await checkRole(uid, "admin"))) return fail(res, "Недостатньо прав", 403);
  await closeIdleSessions(); await ensureEmailPreferences();
  const { where, args } = userFilters(req.query);
  const select = `SELECT u.id, u.email, u.name_text, u.role, u.level, u.avatar, u.country,
    u.sub_status, u.is_blocked, u.created_at, u.updated_at,
    COALESCE(p.xp_total,0) AS xp_total, COALESCE(p.streak_days,0) AS streak_days,
    ${completed} AS completed_count, COALESCE(a.active_seconds,0) AS active_seconds,
    COALESCE(a.session_count,0) AS session_count, COALESCE(a.visits,0) AS visits,
    COALESCE(a.last_active_at,p.last_prac) AS last_active_at, COALESCE(ep.marketing_consent,0) AS marketing_consent ${joins}`;
  if (req.query.format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="slovakgo-users.csv"');
    res.setHeader("Cache-Control", "no-store");
    res.write("\uFEFF" + ["Email", "Ім'я", "Роль", "Рівень", "Підписка", "XP", "Уроків завершено", "Активний час (с)", "Сеансів", "Відвідувань", "Остання активність", "Згода на маркетинг", "Заблоковано"].map(csvCell).join(",") + "\r\n");
    let afterId = "";
    for (;;) {
      const rows = await query(`${select} ${where ? where + " AND" : "WHERE"} u.id > ? ORDER BY u.id LIMIT 500`, [...args, afterId]);
      for (const r of rows) {
        const line = [r.email, r.name_text, r.role, r.level, r.sub_status, r.xp_total, r.completed_count, r.active_seconds, r.session_count, r.visits, r.last_active_at, r.marketing_consent, r.is_blocked];
        if (!res.write(line.map(csvCell).join(",") + "\r\n")) await new Promise<void>(resolve => res.once("drain", resolve));
      }
      if (rows.length < 500) break;
      afterId = String(rows[rows.length - 1].id);
    }
    res.end(); return;
  }
  const limit = Math.min(500, Math.max(1, Math.floor(Number(req.query.limit) || 100)));
  const offset = Math.max(0, Math.floor(Number(req.query.offset) || 0));
  const [rows, total] = await Promise.all([
    query(`${select} ${where} ORDER BY u.created_at DESC,u.id LIMIT ? OFFSET ?`, [...args, limit, offset]),
    queryOne(`SELECT COUNT(*) AS c ${joins} ${where}`, args),
  ]);
  respond(res, { ok: true, total: Number(total?.c ?? 0), users: rows.map(r => ({
    id: String(r.id), email: String(r.email), name: String(r.name_text), role: String(r.role), level: String(r.level),
    avatar: r.avatar ? String(r.avatar) : null, country: String(r.country ?? ""), subscriptionStatus: String(r.sub_status),
    isBlocked: Boolean(r.is_blocked), createdAt: String(r.created_at), updatedAt: String(r.updated_at),
    lastSeenAt: r.last_active_at ? String(r.last_active_at) : null, xpTotal: Number(r.xp_total), streakDays: Number(r.streak_days),
    completedCount: Number(r.completed_count), activeSeconds: Number(r.active_seconds), sessionCount: Number(r.session_count),
    visits: Number(r.visits), marketingConsent: Boolean(r.marketing_consent),
  })) });
}
