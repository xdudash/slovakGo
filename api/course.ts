/**
 * Dedicated function for the admin course deploy. It is the only function that
 * bundles the course files (vercel.json includeFiles), so the main API keeps a
 * small bundle and fast cold starts.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleAdminCourse } from "./_lib/course";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET" && req.method !== "POST") { res.status(405).json({ ok: false, error: "Method not allowed" }); return; }
  const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
  await handleAdminCourse(req, res, body);
}
