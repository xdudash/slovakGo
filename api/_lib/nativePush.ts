import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connect } from 'node:http2';
import { importPKCS8, SignJWT } from 'jose';
import { exec, query, requireUid, respond, fail, nowIso, safeJson, type Arg } from './core';

export async function ensureNativePushTable(): Promise<void> {
  await exec(`CREATE TABLE IF NOT EXISTS native_push_tokens (
    token TEXT NOT NULL, environment TEXT NOT NULL, user_id TEXT NOT NULL,
    updated_at TEXT NOT NULL, PRIMARY KEY (token, environment))`);
}

export function apnsConfigured(): boolean {
  return Boolean(process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_PRIVATE_KEY && process.env.APNS_TOPIC);
}

export async function handleNativePushToken(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  const token = String(body.token ?? '').toLowerCase();
  const environment = body.environment;
  if (!/^[a-f\d]{32,512}$/.test(token) || token.length % 2 || !['sandbox', 'production'].includes(String(environment)) || typeof body.enabled !== 'boolean') {
    return fail(res, 'Invalid native push registration', 422);
  }
  if (body.enabled && !apnsConfigured()) return fail(res, 'iOS push is not configured', 503);
  await ensureNativePushTable();
  if (!body.enabled) {
    await exec('DELETE FROM native_push_tokens WHERE token = ? AND environment = ? AND user_id = ?', [token, String(environment), uid]);
  } else {
    await exec(`INSERT INTO native_push_tokens (token, environment, user_id, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(token, environment) DO UPDATE SET user_id = excluded.user_id, updated_at = excluded.updated_at`,
    [token, String(environment), uid, nowIso()]);
  }
  respond(res, { ok: true });
}

export function nativePushPayload(title: string, body: string): string {
  const payload = JSON.stringify({ aps: { alert: { title, body }, sound: 'default' }, route: '/app/path' });
  if (Buffer.byteLength(payload, 'utf8') > 4096) throw new Error('iOS push exceeds the 4096-byte APNs payload limit');
  return payload;
}

let cachedToken: { value: string; expires: number } | undefined;
async function providerToken(): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now()) return cachedToken.value;
  const key = await importPKCS8(process.env.APNS_PRIVATE_KEY!.replace(/\\n/g, '\n'), 'ES256');
  const value = await new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: process.env.APNS_KEY_ID! })
    .setIssuer(process.env.APNS_TEAM_ID!).setIssuedAt().sign(key);
  cachedToken = { value, expires: Date.now() + 50 * 60_000 };
  return value;
}

type PushResult = { ok: boolean; reason?: string };
function send(token: string, environment: string, authorization: string, payload: string): Promise<PushResult> {
  return new Promise(resolve => {
    const host = environment === 'sandbox' ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com';
    const client = connect(host);
    let finished = false;
    const finish = (result: PushResult) => {
      if (finished) return;
      finished = true;
      client.destroy();
      resolve(result);
    };
    client.setTimeout(10_000, () => finish({ ok: false, reason: 'Timeout' }));
    client.on('error', () => finish({ ok: false, reason: 'ConnectionError' }));
    const request = client.request({
      ':method': 'POST', ':path': `/3/device/${token}`,
      authorization: `bearer ${authorization}`, 'apns-topic': process.env.APNS_TOPIC!,
      'apns-push-type': 'alert', 'apns-priority': '5',
      'apns-expiration': String(Math.floor(Date.now() / 1000) + 86400),
    });
    let status = 0;
    let response = '';
    request.on('response', headers => { status = Number(headers[':status']); });
    request.setEncoding('utf8');
    request.on('data', chunk => { response += String(chunk); });
    request.on('error', () => finish({ ok: false, reason: 'RequestError' }));
    request.on('end', () => finish({ ok: status === 200, reason: safeJson<{ reason?: string }>(response, {}).reason }));
    request.end(payload);
  });
}

/** Existing admin broadcasts can reach APNs devices as well as web FCM tokens. */
export async function sendNativeBroadcast(title: string, body: string, target: string): Promise<{ sent: number; warning?: string }> {
  if (!apnsConfigured()) return { sent: 0 };
  await ensureNativePushTable();
  let sql = 'SELECT nt.*, u.settings_j FROM native_push_tokens nt JOIN users u ON u.id = nt.user_id WHERE u.is_blocked = 0';
  const args: Arg[] = [];
  if (target === 'students') sql += " AND u.role = 'student'";
  else if (target === 'plus') sql += " AND u.sub_status = 'plus'";
  else if (target.startsWith('level:')) { sql += ' AND u.level = ?'; args.push(target.slice(6)); }
  const rows = (await query(sql, args)).filter(row => safeJson<{ notificationsEnabled?: boolean }>(String(row.settings_j), {}).notificationsEnabled === true);
  if (!rows.length) return { sent: 0 };
  let payload: string;
  try { payload = nativePushPayload(title, body); }
  catch (error) { return { sent: 0, warning: (error as Error).message }; }
  const authorization = await providerToken();
  let sent = 0;
  // Bounded concurrency prevents a broadcast from opening thousands of sockets.
  for (let offset = 0; offset < rows.length; offset += 10) {
    await Promise.all(rows.slice(offset, offset + 10).map(async row => {
      const result = await send(String(row.token), String(row.environment), authorization, payload);
      if (result.ok) sent++;
      else if (result.reason === 'Unregistered' || result.reason === 'BadDeviceToken') {
        // Do not delete a newer registration that arrived while sending.
        await exec('DELETE FROM native_push_tokens WHERE token = ? AND environment = ? AND updated_at = ?', [String(row.token), String(row.environment), String(row.updated_at)]);
      } else console.warn('[apns] notification rejected:', result.reason ?? 'Unknown');
    }));
  }
  return { sent };
}
