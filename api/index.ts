/**
 * SlovakGO — Vercel Serverless API Router
 * Delegates logic to /api/_lib/ modules.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { safeJson, respond, nowIso } from "./_lib/core";

import {
  handleRegister, handleLogin, handleLogout, handleForgot, handleReset,
  handleDeleteAccount, handleDeactivate, handleGoogleStart, handleGoogleCallback
} from "./_lib/auth";

import { handleSyncPull, handleSyncPush } from "./_lib/sync";

import {
  handleAdminStats, handleAdminErrors, handleAdminNotify, handleAdminUsers,
  handleAdminUserDetail, handleAdminUserPatch, handleAdminImportLessons
} from "./_lib/admin";

import { handleBillingCheckout, handleBillingPortal, handleBillingWebhook } from "./_lib/stripe";

import {
  handleUserEmail, handleUserPassword, handleFcmToken, handleUserReminder,
  handleUserReferral, handleLeaderboard, handlePostErrors, handlePostEvents, handleSupportSend
} from "./_lib/user";

export const config = { api: { bodyParser: false } };

const isProd = process.env.NODE_ENV === "production";
const PROD_ORIGINS = ["https://www.slovakgo.sk", "https://slovakgo.sk", "https://app.slovakgo.sk", "https://slovak-go.vercel.app"];

function setCors(req: VercelRequest, res: VercelResponse): void {
  const origin  = (req.headers.origin as string) ?? "";
  const devOrigins = isProd ? [] : ["http://localhost:5173", "http://localhost:4173"];
  const envOrigins = (process.env.ALLOWED_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const allowed = [...PROD_ORIGINS, ...devOrigins, ...envOrigins];
  if (allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Requested-With, stripe-signature");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
}

async function readRaw(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function handlePing(res: VercelResponse): Promise<void> {
  respond(res, { ok: true, updatedAt: nowIso() });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCors(req, res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const rawBody  = await readRaw(req);
  const isJson   = (req.headers["content-type"] ?? "").includes("application/json");
  const body: Record<string, unknown> = isJson && rawBody.length ? safeJson(rawBody.toString(), {}) : {};

  const reqUrl = typeof req.url === "string" ? req.url : "/";
  const route = ("/" + reqUrl.replace(/^\/api/, "").split("?")[0].replace(/^\//, "")) || "/";
  const meth  = req.method ?? "GET";

  try {
    if (meth === "GET"  && (route === "/" || route === "/ping")) return await handlePing(res);
    
    // Auth Routes
    if (meth === "POST" && route === "/auth/register")     return await handleRegister(req, res, body);
    if (meth === "POST" && route === "/auth/login")        return await handleLogin(req, res, body);
    if (meth === "POST" && route === "/auth/logout")       return await handleLogout(res);
    if (meth === "POST" && route === "/auth/forgot")       return await handleForgot(req, res, body);
    if (meth === "POST" && route === "/auth/reset")        return await handleReset(req, res, body);
    if (meth === "POST" && route === "/auth/delete")       return await handleDeleteAccount(req, res, body);
    if (meth === "POST" && route === "/auth/deactivate")   return await handleDeactivate(req, res);
    if (meth === "GET"  && route === "/auth/google/start") return await handleGoogleStart(req, res);
    if (meth === "GET"  && route === "/auth/google/callback") return await handleGoogleCallback(req, res);
    
    // Sync Routes
    if (meth === "GET"  && route === "/sync/pull")         return await handleSyncPull(req, res);
    if (meth === "POST" && route === "/sync/push")         return await handleSyncPush(req, res, body);
    
    // User Routes
    if (meth === "POST" && route === "/user/email")        return await handleUserEmail(req, res, body);
    if (meth === "POST" && route === "/user/password")     return await handleUserPassword(req, res, body);
    if (meth === "POST" && route === "/user/fcm-token")    return await handleFcmToken(req, res, body);
    if (meth === "POST" && route === "/user/reminder")     return await handleUserReminder(req, res, body);
    if (meth === "POST" && route === "/user/referral")     return await handleUserReferral(req, res, body);
    if (meth === "GET"  && route === "/leaderboard")       return await handleLeaderboard(req, res);
    if (meth === "POST" && route === "/support/send")      return await handleSupportSend(req, res, body);
    if (meth === "POST" && route === "/errors")            return await handlePostErrors(req, res, isJson ? body : safeJson(rawBody.toString(), {}));
    if (meth === "POST" && route === "/events")            return await handlePostEvents(req, res, isJson ? body : safeJson(rawBody.toString(), {}));
    
    // Stripe Routes
    if (meth === "POST" && route === "/billing/checkout")  return await handleBillingCheckout(req, res);
    if (meth === "POST" && route === "/billing/portal")    return await handleBillingPortal(req, res);
    if (meth === "POST" && (route === "/billing/webhook" || route === "/stripe/webhook")) return await handleBillingWebhook(req, res, rawBody);
    
    // Admin Routes
    if (meth === "GET"  && route === "/admin/stats")            return await handleAdminStats(req, res);
    if (meth === "GET"  && route === "/admin/errors")           return await handleAdminErrors(req, res);
    if (meth === "POST" && route === "/admin/notify")           return await handleAdminNotify(req, res, body);
    if (meth === "POST" && route === "/admin/lessons/import")   return await handleAdminImportLessons(req, res, body);
    if (meth === "GET"  && route === "/admin/users")            return await handleAdminUsers(req, res);
    if (meth === "GET"  && route.startsWith("/admin/users/"))   return await handleAdminUserDetail(req, res, route.slice("/admin/users/".length));
    if (meth === "POST" && route.startsWith("/admin/users/"))   return await handleAdminUserPatch(req, res, route.slice("/admin/users/".length), body);

    res.status(404).json({ ok: false, error: "Not found" });
  } catch (err) {
    console.error("[API Error]", route, err);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
}
