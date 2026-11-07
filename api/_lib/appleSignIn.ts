import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "node:crypto";
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from "jose";
import { APPLE_BUNDLE_ID } from "./apple";
import {
  defaultSettingsJson, ensureCol, ensureProgress, exec, fail, logEvent, nowIso, queryOne, respond, rowToUser, setCookie, signToken,
} from "./core";
import { sendWelcomeEmail } from "./welcome";

const APPLE_ISSUER = "https://appleid.apple.com";
const appleKeys = createRemoteJWKSet(new URL(`${APPLE_ISSUER}/auth/keys`));

export interface AppleIdentity { sub: string; email: string | null; emailVerified: boolean }

/** Verifies an identity token from the native "Sign in with Apple" sheet. */
export async function verifyAppleIdentityToken(token: string): Promise<AppleIdentity> {
  const { payload } = await jwtVerify(token, appleKeys, { issuer: APPLE_ISSUER, audience: APPLE_BUNDLE_ID });
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("Apple token without subject");
  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
  const verified = payload.email_verified === true || payload.email_verified === "true";
  return { sub: payload.sub, email, emailVerified: verified };
}

// ─── Token revocation (App Store Review Guideline 5.1.1(v)) ──────────────────
// Needs a "Sign in with Apple" key from Certificates, Identifiers & Profiles:
// APPLE_SIWA_KEY_ID and APPLE_SIWA_PRIVATE_KEY (the .p8 contents). Without them
// sign-in still works, but tokens cannot be revoked on account deletion.
const TEAM_ID = process.env.APPLE_TEAM_ID ?? "6TU82NKL53";

async function clientSecret(): Promise<string | null> {
  const keyId = process.env.APPLE_SIWA_KEY_ID;
  const pem = process.env.APPLE_SIWA_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!keyId || !pem) return null;
  const key = await importPKCS8(pem, "ES256");
  return new SignJWT({}).setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(TEAM_ID).setSubject(APPLE_BUNDLE_ID).setAudience(APPLE_ISSUER)
    .setIssuedAt().setExpirationTime("5m").sign(key);
}

async function exchangeAuthorizationCode(code: string): Promise<string | null> {
  const secret = await clientSecret();
  if (!secret) return null;
  const res = await fetch(`${APPLE_ISSUER}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: APPLE_BUNDLE_ID, client_secret: secret, code, grant_type: "authorization_code" }),
  });
  if (!res.ok) throw new Error(`apple_token_exchange_failed:${res.status}`);
  const tokens = await res.json() as { refresh_token?: string };
  return tokens.refresh_token ?? null;
}

/** Revokes the user's Sign in with Apple grant before their account is deleted. */
export async function revokeAppleSignIn(uid: string): Promise<void> {
  await ensureAppleSignInColumns();
  const row = await queryOne("SELECT apple_refresh_token FROM users WHERE id = ? LIMIT 1", [uid]);
  const token = String(row?.apple_refresh_token ?? "");
  if (!token) return;
  const secret = await clientSecret();
  if (!secret) { console.warn("[apple-signin] revocation skipped: APPLE_SIWA_KEY_ID/PRIVATE_KEY not configured"); return; }
  const res = await fetch(`${APPLE_ISSUER}/auth/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: APPLE_BUNDLE_ID, client_secret: secret, token, token_type_hint: "refresh_token" }),
  });
  if (!res.ok) throw new Error(`apple_revoke_failed:${res.status}`);
}

async function ensureAppleSignInColumns(): Promise<void> {
  await ensureCol("users", "apple_sub", "TEXT");
  await ensureCol("users", "apple_refresh_token", "TEXT");
}

/**
 * POST /auth/apple — native Sign in with Apple. Links to an existing account by
 * Apple user ID, then by verified email; otherwise creates a new learner.
 */
export async function handleAppleSignIn(_req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
  const token = typeof body.identityToken === "string" ? body.identityToken : "";
  if (!token || token.length > 10_000) return fail(res, "Missing identity token", 422);
  let identity: AppleIdentity;
  try { identity = await verifyAppleIdentityToken(token); } catch (err) {
    console.error("[apple-signin] invalid token:", err);
    return fail(res, "Не вдалося підтвердити вхід через Apple", 401);
  }
  await ensureAppleSignInColumns();

  let row = await queryOne("SELECT * FROM users WHERE apple_sub = ? LIMIT 1", [identity.sub]);
  if (!row && identity.email && identity.emailVerified) {
    row = await queryOne("SELECT * FROM users WHERE email = ? LIMIT 1", [identity.email]);
    if (row) await exec("UPDATE users SET apple_sub = ?, updated_at = ? WHERE id = ?", [identity.sub, nowIso(), String(row.id)]);
  }
  if (row && Boolean(row.is_blocked)) return fail(res, "Акаунт заблоковано", 403);

  let isNew = false;
  if (!row) {
    if (!identity.email) return fail(res, "Apple не передав email. Увійди через email і пароль.", 422);
    const given = typeof body.givenName === "string" ? body.givenName.trim() : "";
    const family = typeof body.familyName === "string" ? body.familyName.trim() : "";
    const name = `${given} ${family}`.trim().slice(0, 80) || identity.email.split("@")[0];
    const id = `user-${randomUUID()}`;
    const now = nowIso();
    await exec(
      `INSERT INTO users (id, email, pw_hash, name_text, role, level, goal, sub_status, trial_ends, ob_done, settings_j, apple_sub, created_at, updated_at)
       VALUES (?, ?, '', ?, 'student', 'A0', NULL, 'free', NULL, 0, ?, ?, ?, ?)`,
      [id, identity.email, name, defaultSettingsJson(), identity.sub, now, now]
    );
    await ensureProgress(id);
    await sendWelcomeEmail(id, identity.email, name);
    await logEvent(id, "register", { method: "apple" });
    row = await queryOne("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
    isNew = true;
  }

  const code = typeof body.authorizationCode === "string" ? body.authorizationCode : "";
  if (code) {
    try {
      const refresh = await exchangeAuthorizationCode(code);
      if (refresh) await exec("UPDATE users SET apple_refresh_token = ? WHERE id = ?", [refresh, String(row!.id)]);
    } catch (err) { console.error("[apple-signin] code exchange failed:", err); }
  }

  setCookie(res, await signToken(String(row!.id)));
  respond(res, { ok: true, isNew, user: rowToUser(row!) });
}
