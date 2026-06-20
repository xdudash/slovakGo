/**
 * Integration tests for api/[...path].ts (Node.js Vercel backend)
 *
 * Uses a real SQLite file via @libsql/client so every test hits actual SQL.
 * Schema is set up in beforeAll; DB file is removed in afterAll.
 * env vars are set before any handler call (getDb() reads them lazily).
 */
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { createClient } from "@libsql/client";
import { SignJWT } from "jose";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { unlinkSync } from "node:fs";

// ─── env setup (must precede handler import side-effects) ─────────────────────
const TEST_DB = `/tmp/sl-api-${Date.now()}.db`;
process.env.TURSO_DATABASE_URL = `file:${TEST_DB}`;
process.env.JWT_SECRET          = "vitest-secret-key-do-not-use-in-prod-abc123";
process.env.NODE_ENV            = "test";

// Stripe is only used in billing routes which we don't test here — stub it out
vi.mock("stripe", () => ({
  default: vi.fn(() => ({
    checkout:     { sessions: { create: vi.fn().mockResolvedValue({ url: "https://checkout.stripe.com/test" }) } },
    billingPortal:{ sessions: { create: vi.fn().mockResolvedValue({ url: "https://billing.stripe.com/test" }) } },
    webhooks:     { constructEvent: vi.fn() },
  })),
}));

// Handler is imported AFTER env vars are set
import handler from "../../api/[...path]";

// ─── Schema ───────────────────────────────────────────────────────────────────
const SCHEMA_STMTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, pw_hash TEXT NOT NULL DEFAULT '',
    name_text TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT 'student',
    level TEXT NOT NULL DEFAULT 'A0', goal TEXT, avatar TEXT, country TEXT,
    sub_status TEXT NOT NULL DEFAULT 'trial', trial_ends TEXT,
    stripe_customer_id TEXT, stripe_sub_id TEXT,
    ob_done INTEGER NOT NULL DEFAULT 0, is_blocked INTEGER NOT NULL DEFAULT 0,
    referred_by TEXT, settings_j TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS progress (
    user_id TEXT PRIMARY KEY, xp_total INTEGER NOT NULL DEFAULT 0,
    xp_weekly INTEGER NOT NULL DEFAULT 0, xp_daily_j TEXT NOT NULL DEFAULT '{}',
    week_id TEXT NOT NULL DEFAULT '', hearts INTEGER NOT NULL DEFAULT 5,
    max_hearts INTEGER NOT NULL DEFAULT 5, streak_days INTEGER NOT NULL DEFAULT 0,
    last_prac TEXT, freeze_cnt INTEGER NOT NULL DEFAULT 0,
    coins INTEGER NOT NULL DEFAULT 0, completed_j TEXT NOT NULL DEFAULT '[]',
    mistakes_j TEXT NOT NULL DEFAULT '[]', updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS lessons (
    id TEXT PRIMARY KEY, data_json TEXT NOT NULL,
    published INTEGER NOT NULL DEFAULT 0, created_by TEXT, updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS user_words (
    user_id TEXT NOT NULL, word_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new',
    mistakes INTEGER NOT NULL DEFAULT 0, corrects INTEGER NOT NULL DEFAULT 0,
    favorite INTEGER NOT NULL DEFAULT 0, last_seen TEXT,
    PRIMARY KEY (user_id, word_id)
  )`,
  `CREATE TABLE IF NOT EXISTS fcm_tokens (
    token TEXT PRIMARY KEY, user_id TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'web', created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sync_log (
    mutation_id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT '', processed_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT NOT NULL, attempted_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL,
    created_at TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS client_errors (
    id TEXT PRIMARY KEY, user_id TEXT, message TEXT NOT NULL, stack TEXT,
    url TEXT, user_agent TEXT, ip TEXT, created_at TEXT NOT NULL
  )`,
];

// ─── Mock helpers ─────────────────────────────────────────────────────────────
interface MockRes {
  _status: number;
  _body: unknown;
  _headers: Record<string, string | string[]>;
  status(code: number): MockRes;
  json(data: unknown): void;
  setHeader(key: string, value: string | string[]): void;
  end(): void;
}

function makeRes(): MockRes {
  const res: MockRes = {
    _status: 200,
    _body: undefined,
    _headers: {},
    status(code) { res._status = code; return res; },
    json(data)   { res._body = data; },
    setHeader(k, v) { res._headers[k] = v; },
    end()        {},
  };
  return res;
}

function makeReq(
  method: string,
  path: string[],
  opts: { body?: object; cookie?: string; query?: Record<string, string> } = {}
): VercelRequest {
  const bodyBuf = opts.body ? Buffer.from(JSON.stringify(opts.body)) : null;
  const req = {
    method,
    query: { path, ...(opts.query ?? {}) },
    headers: {
      "content-type": opts.body ? "application/json" : "text/plain",
      "cookie":        opts.cookie ?? "",
      "x-forwarded-for": "127.0.0.1",
      "user-agent":    "vitest",
    },
    on(event: string, cb: (d?: Buffer) => void) {
      if (event === "data" && bodyBuf) cb(bodyBuf);
      if (event === "end") cb();
      return req;
    },
  } as unknown as VercelRequest;
  return req;
}

async function call(method: string, path: string[], opts: Parameters<typeof makeReq>[2] = {}) {
  const req = makeReq(method, path, opts);
  const res = makeRes();
  await handler(req, res as unknown as VercelResponse);
  return { status: res._status, body: res._body as Record<string, unknown>, headers: res._headers };
}

async function makeCookie(uid: string) {
  const key = new TextEncoder().encode(process.env.JWT_SECRET!);
  const token = await new SignJWT({ uid }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(key);
  return `sl_session=${token}`;
}

// ─── Global setup / teardown ─────────────────────────────────────────────────
beforeAll(async () => {
  const db = createClient({ url: `file:${TEST_DB}` });
  for (const stmt of SCHEMA_STMTS) {
    await db.execute(stmt);
  }
  // Seed a published lesson and an admin user for admin-route tests
  await db.execute(
    `INSERT INTO users (id, email, pw_hash, name_text, role, sub_status, created_at, updated_at)
     VALUES ('admin-1', 'admin@test.com', 'DEV:skip', 'Admin', 'admin', 'plus',
             datetime('now'), datetime('now'))`
  );
  await db.execute(
    `INSERT INTO progress (user_id, updated_at) VALUES ('admin-1', datetime('now'))`
  );
  await db.execute(
    `INSERT INTO lessons (id, data_json, published, updated_at)
     VALUES ('lesson-1', '{"id":"lesson-1","title":"Test Lesson","exercises":[]}', 1, datetime('now'))`
  );
});

afterAll(() => {
  try { unlinkSync(TEST_DB); } catch { /* ignore */ }
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Health", () => {
  it("GET / returns ok", async () => {
    const { status, body } = await call("GET", []);
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(typeof body.updatedAt).toBe("string");
  });

  it("OPTIONS returns 204 (CORS preflight)", async () => {
    const req = makeReq("OPTIONS", []);
    const res = makeRes();
    await handler(req, res as unknown as VercelResponse);
    expect(res._status).toBe(204);
  });

  it("unknown route returns 404", async () => {
    const { status } = await call("GET", ["not", "a", "route"]);
    expect(status).toBe(404);
  });
});

// ─── Auth ─────────────────────────────────────────────────────────────────────
describe("POST /auth/register", () => {
  it("creates user and returns 201 with cookie", async () => {
    const { status, body, headers } = await call("POST", ["auth", "register"], {
      body: { email: "new@example.com", password: "secret123", name: "Тест", goal: "A1" },
    });
    expect(status).toBe(201);
    expect(body.ok).toBe(true);
    const user = body.user as Record<string, unknown>;
    expect(user.email).toBe("new@example.com");
    expect(user.name).toBe("Тест");
    expect(user.role).toBe("student");
    expect(user.subscriptionStatus).toBe("trial");
    const setCookie = String(headers["Set-Cookie"] ?? "");
    expect(setCookie).toContain("sl_session=");
    expect(setCookie).toContain("HttpOnly");
  });

  it("returns 409 for duplicate email", async () => {
    const opts = { body: { email: "dup@example.com", password: "secret123", name: "A" } };
    await call("POST", ["auth", "register"], opts);
    const { status, body } = await call("POST", ["auth", "register"], opts);
    expect(status).toBe(409);
    expect(body.ok).toBe(false);
  });

  it("returns 422 for invalid email", async () => {
    const { status, body } = await call("POST", ["auth", "register"], {
      body: { email: "not-an-email", password: "secret123" },
    });
    expect(status).toBe(422);
    expect(body.ok).toBe(false);
  });

  it("returns 422 for short password", async () => {
    const { status } = await call("POST", ["auth", "register"], {
      body: { email: "short@example.com", password: "abc" },
    });
    expect(status).toBe(422);
  });

  it("accepts pre-generated client id", async () => {
    const { status, body } = await call("POST", ["auth", "register"], {
      body: { id: "client-generated-id-1", email: "withid@example.com", password: "secret123" },
    });
    expect(status).toBe(201);
    expect((body.user as Record<string, unknown>).id).toBe("client-generated-id-1");
  });
});

describe("POST /auth/login", () => {
  const email = "login-test@example.com";
  const password = "loginpass1";

  beforeAll(async () => {
    await call("POST", ["auth", "register"], { body: { email, password, name: "Логін" } });
  });

  it("returns 200 + cookie on valid credentials", async () => {
    const { status, body, headers } = await call("POST", ["auth", "login"], {
      body: { email, password },
    });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(String(headers["Set-Cookie"] ?? "")).toContain("sl_session=");
  });

  it("returns 401 on wrong password", async () => {
    const { status, body } = await call("POST", ["auth", "login"], {
      body: { email, password: "wrongpassword" },
    });
    expect(status).toBe(401);
    expect(body.ok).toBe(false);
  });

  it("returns 401 for unknown email", async () => {
    const { status } = await call("POST", ["auth", "login"], {
      body: { email: "nobody@example.com", password: "whatever" },
    });
    expect(status).toBe(401);
  });
});

describe("POST /auth/logout", () => {
  it("clears cookie", async () => {
    const { status, headers } = await call("POST", ["auth", "logout"]);
    expect(status).toBe(200);
    const cookie = String(headers["Set-Cookie"] ?? "");
    expect(cookie).toContain("Max-Age=0");
  });
});

// ─── Sync pull ────────────────────────────────────────────────────────────────
describe("GET /sync/pull", () => {
  it("returns 401 without auth", async () => {
    const { status, body } = await call("GET", ["sync", "pull"]);
    expect(status).toBe(401);
    expect(body.ok).toBe(false);
  });

  it("returns full user + progress + lessons for authenticated user", async () => {
    // Register a fresh user
    const { body: regBody, headers: regHeaders } = await call("POST", ["auth", "register"], {
      body: { email: "pull-test@example.com", password: "secret123", name: "Pull" },
    });
    const cookie = String(regHeaders["Set-Cookie"] ?? "").split(";")[0];
    const uid = (regBody.user as Record<string, unknown>).id as string;
    expect(uid).toBeTruthy();

    const { status, body } = await call("GET", ["sync", "pull"], { cookie });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);

    const user = body.user as Record<string, unknown>;
    expect(user.email).toBe("pull-test@example.com");

    const progress = body.progress as Record<string, unknown>;
    expect(progress.xpTotal).toBe(0);
    expect(progress.hearts).toBe(5);
    expect(progress.streakDays).toBe(0);
    expect(Array.isArray(progress.completedLessons)).toBe(true);

    expect(Array.isArray(body.lessons)).toBe(true);
    expect((body.lessons as unknown[]).length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(body.userWords)).toBe(true);
  });
});

// ─── Sync push / mutations ────────────────────────────────────────────────────
describe("POST /sync/push", () => {
  let cookie: string;

  beforeAll(async () => {
    const { headers } = await call("POST", ["auth", "register"], {
      body: { email: "push-test@example.com", password: "secret123", name: "Push" },
    });
    cookie = String(headers["Set-Cookie"] ?? "").split(";")[0];
  });

  it("returns 401 without auth", async () => {
    const { status } = await call("POST", ["sync", "push"], {
      body: { mutations: [] },
    });
    expect(status).toBe(401);
  });

  it("applies profile.update mutation", async () => {
    const { body } = await call("POST", ["sync", "push"], {
      cookie,
      body: {
        mutations: [{
          id: "mut-profile-1",
          type: "profile.update",
          payload: { name: "Оновлене Імʼя", goal: "B1" },
        }],
      },
    });
    expect(body.ok).toBe(true);
    expect(body.applied).toBe(1);

    // Verify via pull
    const { body: pullBody } = await call("GET", ["sync", "pull"], { cookie });
    expect((pullBody.user as Record<string, unknown>).name).toBe("Оновлене Імʼя");
    expect((pullBody.user as Record<string, unknown>).goal).toBe("B1");
  });

  it("applies lesson.complete — increments XP and streak", async () => {
    const { body } = await call("POST", ["sync", "push"], {
      cookie,
      body: {
        mutations: [{
          id: "mut-lesson-1",
          type: "lesson.complete",
          payload: {
            lessonId: "lesson-1",
            answers: [
              { exerciseId: "ex-1", correct: true },
              { exerciseId: "ex-2", correct: true },
              { exerciseId: "ex-3", correct: false },
            ],
          },
        }],
      },
    });
    expect(body.applied).toBe(1);

    const { body: pullBody } = await call("GET", ["sync", "pull"], { cookie });
    const progress = pullBody.progress as Record<string, unknown>;
    expect(Number(progress.xpTotal)).toBeGreaterThan(0);
    expect(Number(progress.streakDays)).toBe(1);
    expect((progress.completedLessons as string[])).toContain("lesson-1");
  });

  it("applies exercise.wrong — decrements hearts", async () => {
    // Get baseline hearts
    const { body: before } = await call("GET", ["sync", "pull"], { cookie });
    const heartsBefore = Number((before.progress as Record<string, unknown>).hearts);

    await call("POST", ["sync", "push"], {
      cookie,
      body: {
        mutations: [{
          id: "mut-wrong-1",
          type: "exercise.wrong",
          payload: { lessonId: "lesson-1", exerciseId: "ex-1", answer: "wrong" },
        }],
      },
    });

    const { body: after } = await call("GET", ["sync", "pull"], { cookie });
    const heartsAfter = Number((after.progress as Record<string, unknown>).hearts);
    expect(heartsAfter).toBe(heartsBefore - 1);
  });

  it("mutation is idempotent — same id applied twice counts once", async () => {
    const mutation = { id: "mut-idempotent-1", type: "profile.update", payload: { goal: "C1" } };

    const { body: first } = await call("POST", ["sync", "push"], {
      cookie,
      body: { mutations: [mutation] },
    });
    expect(first.applied).toBe(1);

    const { body: second } = await call("POST", ["sync", "push"], {
      cookie,
      body: { mutations: [mutation] },
    });
    expect(second.applied).toBe(0);
  });

  it("applies word.update — marks word as favourite", async () => {
    await call("POST", ["sync", "push"], {
      cookie,
      body: {
        mutations: [{
          id: "mut-word-1",
          type: "word.update",
          payload: { wordId: "word-abc", favorite: true, status: "practicing" },
        }],
      },
    });

    const { body: pullBody } = await call("GET", ["sync", "pull"], { cookie });
    const words = pullBody.userWords as Record<string, unknown>[];
    const word = words.find(w => w.wordId === "word-abc");
    expect(word).toBeTruthy();
    expect(word!.favorite).toBe(true);
    expect(word!.status).toBe("practicing");
  });

  it("applies practice.complete — adds XP", async () => {
    const { body: before } = await call("GET", ["sync", "pull"], { cookie });
    const xpBefore = Number((before.progress as Record<string, unknown>).xpTotal);

    await call("POST", ["sync", "push"], {
      cookie,
      body: {
        mutations: [{
          id: "mut-practice-1",
          type: "practice.complete",
          payload: {
            results: [
              { wordId: "word-abc", correct: true },
              { wordId: "word-def", correct: false },
            ],
          },
        }],
      },
    });

    const { body: after } = await call("GET", ["sync", "pull"], { cookie });
    expect(Number((after.progress as Record<string, unknown>).xpTotal)).toBe(xpBefore + 5);
  });

  it("applies hearts.restore — resets hearts to max", async () => {
    await call("POST", ["sync", "push"], {
      cookie,
      body: {
        mutations: [{ id: "mut-restore-1", type: "hearts.restore", payload: {} }],
      },
    });
    const { body } = await call("GET", ["sync", "pull"], { cookie });
    const progress = body.progress as Record<string, unknown>;
    expect(Number(progress.hearts)).toBe(Number(progress.maxHearts));
  });
});

// ─── User endpoints ───────────────────────────────────────────────────────────
describe("POST /user/password", () => {
  let cookie: string;

  beforeAll(async () => {
    const { headers } = await call("POST", ["auth", "register"], {
      body: { email: "pwchange@example.com", password: "oldpass1", name: "PwChange" },
    });
    cookie = String(headers["Set-Cookie"] ?? "").split(";")[0];
  });

  it("returns 422 on wrong current password", async () => {
    const { status, body } = await call("POST", ["user", "password"], {
      cookie,
      body: { currentPassword: "wrongoldpass", newPassword: "newpass123" },
    });
    expect(status).toBe(422);
    expect(body.ok).toBe(false);
  });

  it("changes password with correct current password", async () => {
    const { status, body } = await call("POST", ["user", "password"], {
      cookie,
      body: { currentPassword: "oldpass1", newPassword: "newpass123" },
    });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);

    // Old password no longer works
    const { status: s401 } = await call("POST", ["auth", "login"], {
      body: { email: "pwchange@example.com", password: "oldpass1" },
    });
    expect(s401).toBe(401);

    // New password works
    const { status: s200 } = await call("POST", ["auth", "login"], {
      body: { email: "pwchange@example.com", password: "newpass123" },
    });
    expect(s200).toBe(200);
  });
});

describe("POST /user/email", () => {
  let cookie: string;

  beforeAll(async () => {
    const { headers } = await call("POST", ["auth", "register"], {
      body: { email: "emailchange@example.com", password: "secret123", name: "EmailChange" },
    });
    cookie = String(headers["Set-Cookie"] ?? "").split(";")[0];
  });

  it("changes email to a new unique address", async () => {
    const { status, body } = await call("POST", ["user", "email"], {
      cookie,
      body: { email: "newemail@example.com" },
    });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);

    const { body: pullBody } = await call("GET", ["sync", "pull"], { cookie });
    expect((pullBody.user as Record<string, unknown>).email).toBe("newemail@example.com");
  });

  it("returns 422 for invalid email", async () => {
    const { status } = await call("POST", ["user", "email"], {
      cookie,
      body: { email: "not-valid" },
    });
    expect(status).toBe(422);
  });
});

describe("POST /user/fcm-token", () => {
  it("saves FCM token for authenticated user", async () => {
    const { headers } = await call("POST", ["auth", "register"], {
      body: { email: "fcm@example.com", password: "secret123", name: "FCM" },
    });
    const cookie = String(headers["Set-Cookie"] ?? "").split(";")[0];

    const { status, body } = await call("POST", ["user", "fcm-token"], {
      cookie,
      body: { token: "fcm-test-token-xyz", platform: "web" },
    });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("returns 401 without auth", async () => {
    const { status } = await call("POST", ["user", "fcm-token"], {
      body: { token: "abc" },
    });
    expect(status).toBe(401);
  });
});

// ─── Error reporting ──────────────────────────────────────────────────────────
describe("POST /errors", () => {
  it("accepts error report without auth", async () => {
    const { status, body } = await call("POST", ["errors"], {
      body: { message: "Test error", stack: "Error: test\n  at foo.ts:1", url: "/app/path" },
    });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
  });
});

// ─── Admin ────────────────────────────────────────────────────────────────────
describe("GET /admin/stats", () => {
  it("returns 403 for non-admin user", async () => {
    const { headers } = await call("POST", ["auth", "register"], {
      body: { email: "student-admin-check@example.com", password: "secret123", name: "S" },
    });
    const cookie = String(headers["Set-Cookie"] ?? "").split(";")[0];

    const { status, body } = await call("GET", ["admin", "stats"], { cookie });
    expect(status).toBe(403);
    expect(body.ok).toBe(false);
  });

  it("returns 401 without auth", async () => {
    const { status } = await call("GET", ["admin", "stats"]);
    expect(status).toBe(401);
  });

  it("returns stats for admin user", async () => {
    const adminCookie = await makeCookie("admin-1");

    const { status, body } = await call("GET", ["admin", "stats"], { cookie: adminCookie });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);

    const summary = body.summary as Record<string, unknown>;
    expect(typeof summary.totalUsers).toBe("number");
    expect(summary.totalUsers).toBeGreaterThanOrEqual(1);
    expect(typeof summary.avgXP).toBe("number");
    expect(Array.isArray(body.dailyRegistrations)).toBe(true);
    expect(typeof body.levels).toBe("object");
  });
});

describe("GET /admin/errors", () => {
  it("returns error list for admin", async () => {
    const adminCookie = await makeCookie("admin-1");
    const { status, body } = await call("GET", ["admin", "errors"], { cookie: adminCookie });
    expect(status).toBe(200);
    expect(Array.isArray(body.errors)).toBe(true);
    expect(typeof body.total).toBe("number");
  });
});

// ─── JWT edge cases ───────────────────────────────────────────────────────────
describe("JWT auth", () => {
  it("expired token is rejected", async () => {
    const key = new TextEncoder().encode(process.env.JWT_SECRET!);
    const expired = await new SignJWT({ uid: "some-user" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("-1s")
      .sign(key);

    const { status } = await call("GET", ["sync", "pull"], {
      cookie: `sl_session=${expired}`,
    });
    expect(status).toBe(401);
  });

  it("tampered token is rejected", async () => {
    const { status } = await call("GET", ["sync", "pull"], {
      cookie: "sl_session=totally.fake.token",
    });
    expect(status).toBe(401);
  });
});
