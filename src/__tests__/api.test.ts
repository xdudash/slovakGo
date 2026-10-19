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

// Stub Stripe network calls while asserting real checkout parameters.
const stripeChecks = vi.hoisted(() => ({ price: vi.fn(), checkout: vi.fn().mockResolvedValue({ url: "https://checkout.stripe.com/test" }) }));
vi.mock("stripe", () => ({
  default: vi.fn(function () { return {
    checkout: { sessions: { create: stripeChecks.checkout } },
    prices: { retrieve: stripeChecks.price },
    billingPortal:{ sessions: { create: vi.fn().mockResolvedValue({ url: "https://billing.stripe.com/test" }) } },
    webhooks:     { constructEvent: vi.fn() },
  }; }),
}));

// Handler is imported AFTER env vars are set
import handler from "../../api/index";

// ─── Schema ───────────────────────────────────────────────────────────────────
const SCHEMA_STMTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, pw_hash TEXT NOT NULL DEFAULT '',
    name_text TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT 'student',
    level TEXT NOT NULL DEFAULT 'A0', goal TEXT, avatar TEXT, country TEXT,
    sub_status TEXT NOT NULL DEFAULT 'trial', trial_ends TEXT, trial_used INTEGER NOT NULL DEFAULT 0,
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
    mistakes_j TEXT NOT NULL DEFAULT '[]', hearts_restored_at TEXT,
    practice_awarded_at TEXT, updated_at TEXT NOT NULL
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
  getHeader(key: string): string | string[] | undefined;
  writeHead(code: number, headers?: Record<string, string>): void;
  end(): void;
  send(data: string): void;
  write(data: string): boolean;
}

function makeRes(): MockRes {
  const res: MockRes = {
    _status: 200,
    _body: undefined,
    _headers: {},
    status(code) { res._status = code; return res; },
    json(data)   { res._body = data; },
    setHeader(k, v) { res._headers[k] = v; },
    getHeader(k) { return res._headers[k]; },
    writeHead(code, headers) { res._status = code; Object.assign(res._headers, headers ?? {}); },
    end()        {},
    send(data) { res._body = data; },
    write(data) { res._body = String(res._body ?? "") + data; return true; },
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
    url: "/api/" + path.join("/"),
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

/** The IP rate limiter is global to the suite; clear it so a test's own auth
 *  calls are not refused because of how many ran before it. */
async function resetRateLimit() {
  const db = createClient({ url: `file:${TEST_DB}` });
  await db.execute("DELETE FROM login_attempts");
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
     VALUES ('lesson-1', '{"id":"lesson-1","level":"A1","title":"Test Lesson","topic":"Test","description":"","xpReward":12,"estimatedMinutes":5,"isPublished":true,"updatedAt":"2026-09-25T00:00:00Z","words":[{"id":"lesson-word","sk":"ahoj","uk":"привет"}],"exercises":[{"id":"ex-1","lessonId":"lesson-1","type":"single_choice","order":1,"options":[{"id":"a","text":"a","correct":true}]},{"id":"ex-2","lessonId":"lesson-1","type":"single_choice","order":2,"options":[{"id":"a","text":"a","correct":true}]},{"id":"ex-3","lessonId":"lesson-1","type":"single_choice","order":3,"options":[{"id":"a","text":"a","correct":true}]}]}', 1, datetime('now'))`
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
      body: { email: "new@example.com", password: "Secret123", name: "Тест", goal: "A1" },
    });
    expect(status).toBe(201);
    expect(body.ok).toBe(true);
    const user = body.user as Record<string, unknown>;
    expect(user.email).toBe("new@example.com");
    expect(user.name).toBe("Тест");
    expect(user.role).toBe("student");
    expect(user.subscriptionStatus).toBe("free");
    const setCookie = String(headers["Set-Cookie"] ?? "");
    expect(setCookie).toContain("sl_session=");
    expect(setCookie).toContain("HttpOnly");
  });

  it("returns 409 for duplicate email", async () => {
    const opts = { body: { email: "dup@example.com", password: "Secret123", name: "A" } };
    await call("POST", ["auth", "register"], opts);
    const { status, body } = await call("POST", ["auth", "register"], opts);
    expect(status).toBe(409);
    expect(body.ok).toBe(false);
  });

  it("returns 422 for invalid email", async () => {
    const { status, body } = await call("POST", ["auth", "register"], {
      body: { email: "not-an-email", password: "Secret123" },
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
      body: { id: "client-generated-id-1", email: "withid@example.com", password: "Secret123" },
    });
    expect(status).toBe(201);
    expect((body.user as Record<string, unknown>).id).toBe("client-generated-id-1");
  });
});

describe("POST /auth/login", () => {
  const email = "login-test@example.com";
  const password = "Loginpass1";

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
      body: { email, password: "Wrongpassword1" },
    });
    expect(status).toBe(401);
    expect(body.ok).toBe(false);
  });

  it("returns 401 for unknown email", async () => {
    const { status } = await call("POST", ["auth", "login"], {
      body: { email: "nobody@example.com", password: "Whatever123" },
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

  it("rejects an existing blocked user's session", async () => {
    const db = createClient({ url: `file:${TEST_DB}` });
    await db.execute(`INSERT INTO users (id, email, name_text, is_blocked, created_at, updated_at)
      VALUES ('blocked-1', 'blocked@example.com', 'Blocked', 1, datetime('now'), datetime('now'))`);
    const { status, headers } = await call("GET", ["sync", "pull"], { cookie: await makeCookie("blocked-1") });
    expect(status).toBe(401);
    expect(String(headers["Set-Cookie"] ?? "")).toContain("Max-Age=0");
  });

  it("returns full user + progress + lessons for authenticated user", async () => {
    // Register a fresh user
    const { body: regBody, headers: regHeaders } = await call("POST", ["auth", "register"], {
      body: { email: "pull-test@example.com", password: "Secret123", name: "Pull" },
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

  it("can restore a session without sending the lesson catalog", async () => {
    const { headers } = await call("POST", ["auth", "register"], {
      body: { email: "quick-pull@example.com", password: "Secret123", name: "Quick" },
    });
    const cookie = String(headers["Set-Cookie"] ?? "").split(";")[0];
    const { status, body } = await call("GET", ["sync", "pull"], { cookie, query: { includeLessons: "0" } });

    expect(status).toBe(200);
    expect(body.lessons).toBeUndefined();
    expect(typeof body.lessonVersion).toBe("string");
    expect(body.user).toBeTruthy();
    expect(body.progress).toBeTruthy();
  });

  it("only returns lessons when their version changed", async () => {
    const cookie = await makeCookie("admin-1");
    const first = await call("GET", ["lessons"], { cookie });
    expect(first.status).toBe(200);
    expect(first.body.unchanged).toBe(false);
    expect(Array.isArray(first.body.lessons)).toBe(true);

    const second = await call("GET", ["lessons"], {
      cookie,
      query: { version: String(first.body.version) },
    });
    expect(second.status).toBe(200);
    expect(second.body.unchanged).toBe(true);
    expect(second.body.lessons).toBeUndefined();
  });
});

// ─── Sync push / mutations ────────────────────────────────────────────────────
describe("POST /sync/push", () => {
  let cookie: string;

  beforeAll(async () => {
    const { headers } = await call("POST", ["auth", "register"], {
      body: { email: "push-test@example.com", password: "Secret123", name: "Push" },
    });
    cookie = String(headers["Set-Cookie"] ?? "").split(";")[0];
  });

  it("returns 401 without auth", async () => {
    const { status } = await call("POST", ["sync", "push"], {
      body: { mutations: [] },
    });
    expect(status).toBe(401);
  });

  it("rejects auth.register through sync", async () => {
    const { status } = await call("POST", ["sync", "push"], {
      cookie,
      body: { mutations: [{ id: "forged-register", type: "auth.register", payload: { id: "forged", email: "forged@example.com" } }] },
    });
    expect(status).toBe(422);
  });

  it("rejects a mutation owned by a different user", async () => {
    const { status, body } = await call("POST", ["sync", "push"], {
      cookie,
      body: { mutations: [{ id: "wrong-owner", userId: "someone-else", type: "profile.update", payload: { goal: "B2" } }] },
    });
    expect(status).toBe(403);
    expect(body.ok).toBe(false);
  });

  it("skips a stale lesson completion without blocking the rest of the sync batch", async () => {
    const { status, body } = await call("POST", ["sync", "push"], {
      cookie,
      body: {
        mutations: [
          {
            id: "mut-stale-lesson-1",
            type: "lesson.complete",
            payload: { lessonId: "deleted-or-unpublished-lesson", answers: [] },
          },
          {
            id: "mut-after-stale-1",
            type: "profile.update",
            payload: { goal: "B2" },
          },
        ],
      },
    });

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.applied).toBe(1);
    expect(body.skipped).toBe(1);

    const { body: pullBody } = await call("GET", ["sync", "pull"], { cookie });
    expect((pullBody.user as Record<string, unknown>).goal).toBe("B2");
    expect((pullBody.progress as Record<string, unknown>).completedLessons).not.toContain("deleted-or-unpublished-lesson");

    const replay = await call("POST", ["sync", "push"], {
      cookie,
      body: {
        mutations: [{
          id: "mut-stale-lesson-1",
          type: "lesson.complete",
          payload: { lessonId: "deleted-or-unpublished-lesson", answers: [] },
        }],
      },
    });
    expect(replay.status).toBe(200);
    expect(replay.body.applied).toBe(0);
  });

  it("applies profile.update mutation", async () => {
    const { body } = await call("POST", ["sync", "push"], {
      cookie,
      body: {
        mutations: [{
          id: "mut-profile-1",
          type: "profile.update",
          payload: { name: "Оновлене Імʼя", goal: "B1", level: "A1", onboardingDone: true },
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
    expect(Number(progress.xpTotal)).toBe(12);
    expect(Number(progress.streakDays)).toBe(1);
    expect((progress.completedLessons as string[])).toContain("lesson-1");
    expect(String(progress.weekId)).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const lessonWord = (pullBody.userWords as Record<string, unknown>[]).find((word) => word.wordId === "lesson-word");
    expect(lessonWord?.status).toBe("practicing");
    expect(lessonWord?.correctCount).toBe(1);
    expect(typeof lessonWord?.nextReviewAt).toBe("string");
  });

  it("awards reduced XP when repeating an already completed lesson", async () => {
    const { body: before } = await call("GET", ["sync", "pull"], { cookie });
    const xpBefore = Number((before.progress as Record<string, unknown>).xpTotal);

    const { body } = await call("POST", ["sync", "push"], {
      cookie,
      body: {
        mutations: [{
          id: "mut-lesson-repeat",
          type: "lesson.complete",
          payload: { lessonId: "lesson-1", answers: [] },
        }],
      },
    });
    expect(body.applied).toBe(1);

    const { body: after } = await call("GET", ["sync", "pull"], { cookie });
    expect(Number((after.progress as Record<string, unknown>).xpTotal)).toBe(xpBefore + 3);
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

  it("rejects paid practice for a free account", async () => {
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
    expect(Number((after.progress as Record<string, unknown>).xpTotal)).toBe(xpBefore);
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
      body: { email: "pwchange@example.com", password: "Oldpass1", name: "PwChange" },
    });
    cookie = String(headers["Set-Cookie"] ?? "").split(";")[0];
  });

  it("returns 422 on wrong current password", async () => {
    const { status, body } = await call("POST", ["user", "password"], {
      cookie,
      body: { currentPassword: "Wrongoldpass1", newPassword: "Newpass123" },
    });
    expect(status).toBe(422);
    expect(body.ok).toBe(false);
  });

  it("changes password with correct current password", async () => {
    const { status, body } = await call("POST", ["user", "password"], {
      cookie,
      body: { currentPassword: "Oldpass1", newPassword: "Newpass123" },
    });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);

    // Old password no longer works
    const { status: s401 } = await call("POST", ["auth", "login"], {
      body: { email: "pwchange@example.com", password: "Oldpass1" },
    });
    expect(s401).toBe(401);

    // New password works
    const { status: s200 } = await call("POST", ["auth", "login"], {
      body: { email: "pwchange@example.com", password: "Newpass123" },
    });
    expect(s200).toBe(200);
  });
});

describe("POST /user/email", () => {
  let cookie: string;

  beforeAll(async () => {
    const { headers } = await call("POST", ["auth", "register"], {
      body: { email: "emailchange@example.com", password: "Secret123", name: "EmailChange" },
    });
    cookie = String(headers["Set-Cookie"] ?? "").split(";")[0];
  });

  it("changes email to a new unique address", async () => {
    const { status, body } = await call("POST", ["user", "email"], {
      cookie,
      body: { email: "newemail@example.com", currentPassword: "Secret123" },
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

  it("requires the current password", async () => {
    const { status } = await call("POST", ["user", "email"], {
      cookie,
      body: { email: "another@example.com", currentPassword: "wrong" },
    });
    expect(status).toBe(422);
  });
});

describe("POST /user/demo-complete", () => {
  it("awards 50 XP exactly once", async () => {
    const { headers } = await call("POST", ["auth", "register"], {
      body: { email: "demo-reward@example.com", password: "Secret123", name: "Demo" },
    });
    const cookie = String(headers["Set-Cookie"] ?? "").split(";")[0];

    const first = await call("POST", ["user", "demo-complete"], { cookie });
    expect(first.status).toBe(200);
    expect(first.body.awarded).toBe(true);
    const afterFirst = await call("GET", ["sync", "pull"], { cookie, query: { includeLessons: "0" } });
    expect(Number((afterFirst.body.progress as Record<string, unknown>).xpTotal)).toBe(50);

    const second = await call("POST", ["user", "demo-complete"], { cookie });
    expect(second.body.awarded).toBe(false);
    const afterSecond = await call("GET", ["sync", "pull"], { cookie, query: { includeLessons: "0" } });
    expect(Number((afterSecond.body.progress as Record<string, unknown>).xpTotal)).toBe(50);
  });
});

describe("POST /user/fcm-token", () => {
  it("saves FCM token for authenticated user", async () => {
    const { headers } = await call("POST", ["auth", "register"], {
      body: { email: "fcm@example.com", password: "Secret123", name: "FCM" },
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
describe("GET /teacher/stats", () => {
  it("returns real aggregates for a teacher and rejects students", async () => {
    const db = createClient({ url: `file:${TEST_DB}` });
    await db.execute(
      `INSERT INTO users (id, email, pw_hash, name_text, role, sub_status, created_at, updated_at)
       VALUES ('teacher-1', 'teacher@test.com', 'DEV:skip', 'Teacher', 'teacher', 'free', datetime('now'), datetime('now'))`
    );
    await db.execute("INSERT INTO progress (user_id, updated_at) VALUES ('teacher-1', datetime('now'))");

    const teacherCookie = await makeCookie("teacher-1");
    const ok = await call("GET", ["teacher", "stats"], { cookie: teacherCookie });
    expect(ok.status).toBe(200);
    expect((ok.body.summary as Record<string, unknown>).students).toBeGreaterThan(0);
    expect(Array.isArray(ok.body.lessons)).toBe(true);

    const student = await call("POST", ["auth", "register"], {
      body: { email: "teacher-denied@example.com", password: "Secret123", name: "NoTeacher" },
    });
    const studentCookie = String(student.headers["Set-Cookie"] ?? "").split(";")[0];
    expect((await call("GET", ["teacher", "stats"], { cookie: studentCookie })).status).toBe(403);
  });
});

describe("POST /admin/lessons/import", () => {
  it("rejects invalid exercise mechanics server-side", async () => {
    const adminCookie = await makeCookie("admin-1");
    const { status, body } = await call("POST", ["admin", "lessons", "import"], {
      cookie: adminCookie,
      body: {
        mode: "overwrite",
        lessons: [{
          id: "broken-lesson",
          level: "A1",
          title: "Broken",
          words: [],
          exercises: [{ id: "x", type: "not-a-real-type" }],
        }],
      },
    });
    expect(status).toBe(422);
    expect(body.ok).toBe(false);
    expect(String(body.error)).toContain("broken-lesson");
  });
});

describe("GET /admin/stats", () => {
  it("returns 403 for non-admin user", async () => {
    const { headers } = await call("POST", ["auth", "register"], {
      body: { email: "student-admin-check@example.com", password: "Secret123", name: "S" },
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

  it("computes cohort retention from learning activity, not profile edits", async () => {
    const db = createClient({ url: `file:${TEST_DB}` });
    await db.batch([
      "INSERT INTO users (id, email, name_text, role, level, sub_status, created_at, updated_at) VALUES ('ret-1','ret1@ret.test','R1','student','A0','free','2019-03-01T10:00:00Z','2019-03-01T10:00:00Z')",
      "INSERT INTO users (id, email, name_text, role, level, sub_status, created_at, updated_at) VALUES ('ret-2','ret2@ret.test','R2','student','A0','free','2019-03-02T10:00:00Z','2019-03-02T10:00:00Z')",
      "INSERT INTO progress (user_id, last_prac, completed_j, updated_at) VALUES ('ret-1', '2019-03-10', '[\"x\"]', '2019-03-10T12:00:00Z')",
    ], "write");
    db.close();
    const { body } = await call("GET", ["admin", "stats"], { cookie: await makeCookie("admin-1") });
    const march = (body.retention as Record<string, { total: number; d1: number; d7: number; d30: number }>)["2019-03"];
    expect(march).toEqual({ total: 2, d1: 1, d7: 1, d30: 0 });
  });

  it("returns an activation funnel and lesson drop-off for recent students", async () => {
    const db = createClient({ url: `file:${TEST_DB}` });
    const now = new Date().toISOString();
    await db.batch([
      { sql: "INSERT INTO users (id, email, name_text, role, level, sub_status, ob_done, created_at, updated_at) VALUES ('fun-1','fun1@funnel.test','F1','student','A0','free',1,?,?)", args: [now, now] },
      { sql: "INSERT INTO users (id, email, name_text, role, level, sub_status, ob_done, created_at, updated_at) VALUES ('fun-2','fun2@funnel.test','F2','student','A0','free',1,?,?)", args: [now, now] },
      { sql: "INSERT INTO users (id, email, name_text, role, level, sub_status, ob_done, created_at, updated_at) VALUES ('fun-3','fun3@funnel.test','F3','student','A0','free',0,?,?)", args: [now, now] },
      { sql: "INSERT INTO progress (user_id, completed_j, updated_at) VALUES ('fun-1', '[\"funnel-lesson\"]', ?)", args: [now] },
      "CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, name TEXT NOT NULL, props_j TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL)",
      { sql: "INSERT INTO events (user_id, name, props_j, created_at) VALUES ('fun-1','lesson_start','{\"lessonId\":\"funnel-lesson\"}',?), ('fun-1','lesson_complete','{\"lessonId\":\"funnel-lesson\"}',?), ('fun-2','lesson_start','{\"lessonId\":\"funnel-lesson\"}',?)", args: [now, now, now] },
    ], "write");
    db.close();

    const { body } = await call("GET", ["admin", "stats"], { cookie: await makeCookie("admin-1") });
    const funnel = body.funnel as { steps: { key: string; count: number }[]; lessonDropoff: { lessonId: string; started: number; completed: number }[] };
    const step = (k: string) => funnel.steps.find((s) => s.key === k)!.count;
    expect(step("registered")).toBeGreaterThanOrEqual(3);
    expect(step("onboarded")).toBeLessThan(step("registered"));
    expect(step("started")).toBeGreaterThanOrEqual(2);
    expect(step("done1")).toBeGreaterThanOrEqual(1);
    expect(funnel.lessonDropoff).toContainEqual({ lessonId: "funnel-lesson", started: 2, completed: 1 });
  });
});

describe("POST /admin/users/:id", () => {
  /**
   * Regression: the admin panel granted Plus by writing sub_status alone. A
   * learner whose Stripe subscription had lapsed still carried a past
   * sub_expires_at, and handleSyncPull knocks a "plus" with an expired date
   * back to "expired" — so the grant looked applied in the panel while the
   * learner stayed locked out.
   */
  it("keeps a manually granted Plus alive through the next sync pull", async () => {
    const adminCookie = await makeCookie("admin-1");
    await resetRateLimit();

    const { headers } = await call("POST", ["auth", "register"], {
      body: { email: "lapsed@example.com", password: "Secret123", name: "Lapsed" },
    });
    const userCookie = String(headers["Set-Cookie"] ?? "").split(";")[0];

    const db = createClient({ url: `file:${TEST_DB}` });
    const row = await db.execute({
      sql: "SELECT id FROM users WHERE email = ? LIMIT 1",
      args: ["lapsed@example.com"],
    });
    const targetId = String(row.rows[0].id);

    // Simulate the lapsed subscription the panel trips over.
    await db.execute("ALTER TABLE users ADD COLUMN sub_expires_at TEXT").catch(() => { /* exists */ });
    await db.execute({
      sql: "UPDATE users SET sub_status = 'expired', sub_expires_at = ? WHERE id = ?",
      args: ["2020-01-01T00:00:00Z", targetId],
    });

    const patch = await call("POST", ["admin", "users", targetId], {
      cookie: adminCookie,
      body: { subscriptionStatus: "plus" },
    });
    expect(patch.status).toBe(200);

    const pull = await call("GET", ["sync", "pull"], { cookie: userCookie, query: { includeLessons: "0" } });
    expect(pull.status).toBe(200);
    expect((pull.body.user as Record<string, unknown>).subscriptionStatus).toBe("plus");
  });

  it("still applies an unblock", async () => {
    const adminCookie = await makeCookie("admin-1");
    await resetRateLimit();

    const registered = await call("POST", ["auth", "register"], {
      body: { email: "unblock-flow@example.com", password: "Secret123", name: "Blocked" },
    });
    expect(registered.status).toBe(201);

    const db = createClient({ url: `file:${TEST_DB}` });
    const row = await db.execute({
      sql: "SELECT id FROM users WHERE email = ? LIMIT 1",
      args: ["unblock-flow@example.com"],
    });
    const targetId = String(row.rows[0].id);

    await call("POST", ["admin", "users", targetId], { cookie: adminCookie, body: { isBlocked: true } });
    const blocked = await call("POST", ["auth", "login"], {
      body: { email: "unblock-flow@example.com", password: "Secret123" },
    });
    expect(blocked.status).toBeGreaterThanOrEqual(400);

    await call("POST", ["admin", "users", targetId], { cookie: adminCookie, body: { isBlocked: false } });
    const restored = await call("POST", ["auth", "login"], {
      body: { email: "unblock-flow@example.com", password: "Secret123" },
    });
    expect(restored.status).toBe(200);
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

// Real SQL regression coverage for the revised entitlement, exports and activity.
describe("growth and access regressions", () => {
  let cookie: string;
  const db = createClient({ url: `file:${TEST_DB}` });
  const ids = Array.from({ length: 11 }, (_, i) => `preview-${i + 1}`);
  beforeAll(async () => {
    await db.execute(`INSERT INTO users(id,email,name_text,role,level,sub_status,ob_done,created_at,updated_at)
      VALUES ('preview-user','preview@test.com','Preview','student','A0','free',1,'2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')`);
    await db.execute("INSERT INTO progress(user_id,updated_at) VALUES ('preview-user',datetime('now'))");
    for (let i = 0; i < ids.length; i++) {
      const lesson = { id: ids[i], level: "A0", order: i+1, topic: `Single-lesson topic ${i}`, title: ids[i], isPublished: true, xpReward: 10, words: [{id: `secret-word-${i}`, sk:"ahoj"}], exercises: [{ id: `secret-exercise-${i}` }], theoryScreens: [{ content: "protected theory" }], finalSituation: { text: "protected scenario" } };
      await db.execute({sql: "INSERT INTO lessons(id,data_json,published,updated_at) VALUES (?,?,1,?)", args:[ids[i],JSON.stringify(lesson),new Date().toISOString()]});
    }
    cookie = await makeCookie("preview-user");
  });
  it("never leaks paid words, exercises or theory through either catalog endpoint", async () => {
    for (const path of [["lessons"], ["sync","pull"]]) {
      const { body, status } = await call("GET",path,{cookie}); expect(status).toBe(200);
      const lessons = body.lessons as Record<string,unknown>[];
      expect((lessons.find(l => l.id === ids[0])!.exercises as unknown[]).length).toBe(1);
      const paid = lessons.find(l => l.id === ids[10])!;
      expect(paid.exercises).toEqual([]); expect(paid.words).toEqual([]);
      expect(paid.theoryScreens).toBeUndefined(); expect(paid.finalSituation).toBeUndefined();
    }
  });
  it("retains the free catalog when a caller forges a profile level change", async () => {
    await call("POST",["sync","push"],{cookie,body:{mutations:[{id:"forge-level",type:"profile.update",payload:{level:"A1",onboardingDone:true}}]}});
    const { body } = await call("GET",["lessons"],{cookie});
    expect(((body.lessons as Record<string,unknown>[]).find(l => l.id === "lesson-1")!.exercises)).toEqual([]);
    await db.execute("UPDATE users SET level='A0' WHERE id='preview-user'");
  });
  it("keeps preview open after a short topic and rejects an eleventh completion via API", async () => {
    await db.execute({sql:"UPDATE progress SET completed_j=? WHERE user_id='preview-user'",args:[JSON.stringify(ids.slice(0,9))]});
    const push = (id: string, lessonId: string) => call("POST",["sync","push"],{cookie,body:{mutations:[{id,type:"lesson.complete",payload:{lessonId,answers:[]}}]}});
    expect((await push("tenth",ids[9])).body.applied).toBe(1);
    expect((await push("eleventh",ids[10])).body.applied).toBe(0);
    const { body } = await call("GET",["sync","pull"],{cookie});
    expect((body.progress as {completedLessons:string[]}).completedLessons).toHaveLength(10);
    expect((body.user as {subscriptionStatus:string}).subscriptionStatus).toBe("free");
    expect((body.user as {trialEndsAt:unknown}).trialEndsAt).toBeNull();
    expect((await push("repeat-tenth",ids[9])).body.applied).toBe(1);
  });
  it("rejects expired trial access without requiring a previous sync pull", async () => {
    await db.execute("UPDATE users SET sub_status='trial',trial_ends='2020-01-01T00:00:00Z' WHERE id='preview-user'");
    const { body } = await call("GET",["lessons"],{cookie});
    expect(((body.lessons as Record<string,unknown>[]).find(l => l.id === ids[0])!.exercises)).toEqual([]);
    await db.execute("UPDATE users SET sub_status='free',trial_ends=NULL WHERE id='preview-user'");
  });
  it("requires explicit checkout acceptance and validates the Stripe price before checkout", async () => {
    process.env.STRIPE_PRICE_ID = "price-test-monthly";
    const price = { active:true, currency:"eur", unit_amount:300, billing_scheme:"per_unit", recurring:{interval:"month",interval_count:1,usage_type:"licensed"} };
    stripeChecks.price.mockResolvedValue(price); stripeChecks.checkout.mockClear();
    expect((await call("POST",["billing","checkout"],{cookie,body:{}})).status).toBe(422);
    expect(stripeChecks.checkout).not.toHaveBeenCalled();
    expect((await call("POST",["billing","checkout"],{cookie,body:{acceptTerms:true}})).status).toBe(200);
    expect(stripeChecks.checkout.mock.calls[0][0].subscription_data.trial_period_days).toBe(3);
    stripeChecks.price.mockResolvedValue({...price,unit_amount:999});
    expect((await call("POST",["billing","checkout"],{cookie,body:{acceptTerms:true}})).status).toBe(503);
    expect(stripeChecks.checkout).toHaveBeenCalledTimes(1);
    const row = (await db.execute("SELECT sub_status,trial_ends FROM users WHERE id='preview-user'")).rows[0];
    expect(row.sub_status).toBe("free"); expect(row.trial_ends).toBeNull();
    delete process.env.STRIPE_PRICE_ID;
  });
  it("persists opt-in separately and supports a signed unsubscribe without login", async () => {
    expect((await call("GET",["user","email-preferences"],{cookie})).body.marketingConsent).toBe(false);
    await call("POST",["user","email-preferences"],{cookie,body:{marketingConsent:true}});
    expect((await call("GET",["user","email-preferences"],{cookie})).body.marketingConsent).toBe(true);
    const { unsubscribeUrl } = await import("../../api/_lib/emailPreferences");
    const token = new URL(unsubscribeUrl("preview-user")).searchParams.get("token")!;
    expect((await call("GET",["email","unsubscribe"],{query:{token}})).status).toBe(200);
    // Link scanners cannot unsubscribe by fetching the page.
    expect((await call("GET",["user","email-preferences"],{cookie})).body.marketingConsent).toBe(true);
    expect((await call("POST",["email","unsubscribe"],{query:{token}})).status).toBe(200);
    expect((await call("GET",["user","email-preferences"],{cookie})).body.marketingConsent).toBe(false);
    expect((await call("POST",["email","unsubscribe"],{query:{token: token.slice(0,-2)+"00"}})).status).toBe(400);
  });
  it("exports over 500 users, includes all inactive users, and applies filters to the whole database", async () => {
    await db.batch(Array.from({length: 605},(_,i)=>({sql:`INSERT INTO users(id,email,name_text,role,level,sub_status,created_at,updated_at) VALUES (?,?,'=malicious','student','A0','free','2020-01-01T00:00:00Z','2026-10-11T00:00:00Z')`,args:[`csv-${i}`,`csv-${i}@example.com`]})),"write");
    const admin = await makeCookie("admin-1");
    expect((await call("GET",["admin","users"],{cookie,query:{format:"csv"}})).status).toBe(403);
    const result = await call("GET",["admin","users"],{cookie:admin,query:{format:"csv",activity:"inactive",search:"csv-"}});
    expect(result.status).toBe(200);
    const csv = result.body as unknown as string;
    expect(csv.split("\r\n").filter(Boolean)).toHaveLength(606);
    expect(csv).toContain("csv-604@example.com"); expect(csv).toContain("'=malicious");
    const filtered = await call("GET",["admin","users"],{cookie:admin,query:{search:"preview@test.com",progress:"ten_plus",sub:"free"}});
    expect(filtered.body.total).toBe(1);
    expect((await call("GET",["admin","users"],{cookie:admin,query:{search:"csv-",offset:"500",limit:"100"}})).body.users).toHaveLength(100);
  });
  it("deduplicates activity reports, bounds duration and closes abandoned sessions", async () => {
    const id = "session-test-123456";
    const send = (seconds: number) => call("POST",["user","activity"],{cookie,body:{sessionId:id,activeSeconds:seconds,visits:2}});
    await send(0);
    await db.execute({sql:"UPDATE activity_sessions SET started_at=? WHERE id=?",args:[new Date(Date.now()-120000).toISOString(),id]});
    await send(60); await send(60); await send(40);
    const row = (await db.execute({sql:"SELECT * FROM activity_sessions WHERE id=?",args:[id]})).rows[0];
    expect(row.active_seconds).toBe(60); expect(row.visits).toBe(2);
    await send(9999);
    const capped = (await db.execute({sql:"SELECT active_seconds FROM activity_sessions WHERE id=?",args:[id]})).rows[0];
    expect(Number(capped.active_seconds)).toBeLessThanOrEqual(121);
    await db.execute({sql:"UPDATE activity_sessions SET last_active_at=? WHERE id=?",args:[new Date(Date.now()-360000).toISOString(),id]});
    expect((await send(120)).body.closed).toBe(true);
    const admin = await makeCookie("admin-1");
    const detail = await call("GET",["admin","users","preview-user"],{cookie:admin});
    expect((detail.body.activity as {sessionCount:number}).sessionCount).toBe(1);
    expect((detail.body.activity as {sessions:{ended_at:string}[]}).sessions[0].ended_at).toBeTruthy();
  });
});

describe("automatic email delivery", () => {
  it("sends an account-created email to every new registration, once, without blocking sign-up", async () => {
    await resetRateLimit();
    process.env.RESEND_API_KEY = "test-resend";
    const provider = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "welcome-1" }), { status: 200 }));
    try {
      const reg = await call("POST", ["auth", "register"], { body: { email: "welcome@test-mail.com", password: "Secret123", name: "Welcome", marketingConsent: false } });
      expect(reg.status).toBe(201);
      expect(provider).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(String(provider.mock.calls[0][1]!.body));
      expect(payload.to).toBe("welcome@test-mail.com");
      expect(payload.html).not.toContain("Відписатися");
      const uid = String((reg.body.user as Record<string, unknown>).id);
      const { sendWelcomeEmail } = await import("../../api/_lib/welcome");
      expect(await sendWelcomeEmail(uid, "welcome@test-mail.com", "Welcome")).toBe(false);
      expect(provider).toHaveBeenCalledTimes(1);

      provider.mockRejectedValueOnce(new Error("provider down"));
      const second = await call("POST", ["auth", "register"], { body: { email: "welcome2@test-mail.com", password: "Secret123", name: "W2" } });
      expect(second.status).toBe(201);
    } finally { provider.mockRestore(); delete process.env.RESEND_API_KEY; }
  });

  it("sends only with explicit consent, records provider acceptance and does not repeat", async () => {
    const { default: lifecycle } = await import("../../api/cron/lifecycle");
    const { saveConsent } = await import("../../api/_lib/emailPreferences");
    const db = createClient({url:`file:${TEST_DB}`});
    await db.execute({sql:`INSERT INTO users(id,email,name_text,role,sub_status,created_at,updated_at) VALUES ('mail-test','mail@test.com','Mail','student','free',?,?)`,args:[new Date().toISOString(),new Date().toISOString()]});
    await db.execute("INSERT INTO progress(user_id,updated_at) VALUES ('mail-test',datetime('now'))");
    process.env.CRON_SECRET = "test-cron"; process.env.RESEND_API_KEY = "test-resend";
    const provider = vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(JSON.stringify({id:"provider-email-123"}),{status:200}));
    const run = async () => {
      const req = makeReq("GET",["cron","lifecycle"]); req.headers.authorization="Bearer test-cron";
      const res=makeRes(); await lifecycle(req,res as unknown as VercelResponse); return res;
    };
    try {
      expect((await run())._status).toBe(200); expect(provider).not.toHaveBeenCalled();
      await saveConsent("mail-test",true);
      const result=await run(); expect(result._status).toBe(200);
      expect((result._body as {sent:number}).sent).toBe(1);
      const payload = JSON.parse(String(provider.mock.calls[0][1]!.body));
      expect(payload.html).toContain("Відписатися"); expect(payload.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
      const log=(await db.execute("SELECT status,provider_id FROM email_deliveries WHERE recipient='mail@test.com'")).rows[0];
      expect(log.status).toBe("accepted"); expect(log.provider_id).toBe("provider-email-123");
      await run(); expect(provider).toHaveBeenCalledTimes(1);
    } finally { provider.mockRestore(); delete process.env.CRON_SECRET; delete process.env.RESEND_API_KEY; }
  });
});

describe("parallel entitlement requests", () => {
  it("cannot claim two final free slots at once", async () => {
    const db=createClient({url:`file:${TEST_DB}`});
    await db.execute(`INSERT INTO users(id,email,name_text,role,level,sub_status,ob_done,created_at,updated_at) VALUES ('parallel-free','parallel@test.com','Parallel','student','A0','free',1,datetime('now'),datetime('now'))`);
    const completed=[...Array.from({length:8},(_,i)=>`preview-${i+1}`),'legacy-completed'];
    await db.execute({sql:"INSERT INTO progress(user_id,completed_j,updated_at) VALUES ('parallel-free',?,datetime('now'))",args:[JSON.stringify(completed)]});
    const cookie=await makeCookie('parallel-free');
    const results=await Promise.all([9,10].map(i=>call('POST',['sync','push'],{cookie,body:{mutations:[{id:`parallel-${i}`,type:'lesson.complete',payload:{lessonId:`preview-${i}`,answers:[]}}]}})));
    expect(results.every(r=>[200,409].includes(r.status))).toBe(true);
    const row=(await db.execute("SELECT completed_j FROM progress WHERE user_id='parallel-free'")).rows[0];
    expect(JSON.parse(String(row.completed_j))).toHaveLength(10);
  });
});

describe('practice hearts persist through server sync', () => {
  let cookie: string;
  let uid: string;
  beforeAll(async () => {
    await resetRateLimit();
    const registered = await call('POST', ['auth', 'register'], {
      body: {email: 'heart-recovery@example.com', password: 'Secret123', name: 'Heart recovery'},
    });
    uid = String((registered.body.user as Record<string, unknown>).id);
    cookie = await makeCookie(uid);
    const db = createClient({url: `file:${TEST_DB}`});
    await db.execute({sql: "UPDATE users SET sub_status='plus' WHERE id=?", args: [uid]});
    db.close();
  });

  async function practice(id: string, results: unknown[]) {
    return call('POST', ['sync', 'push'], {cookie, body: {mutations: [{id, type: 'practice.complete', payload: {results}}]}});
  }
  async function progress() {
    return (await call('GET', ['sync', 'pull'], {cookie})).body.progress as Record<string, unknown>;
  }

  it('restores 0 to 1, records the real completion day and does not award a replay twice', async () => {
    const db = createClient({url: `file:${TEST_DB}`});
    await db.execute({sql: 'UPDATE progress SET hearts=0 WHERE user_id=?',args:[uid]});
    db.close();
    const results = [{wordId:'lesson-word',correct:true}];
    const before = await progress();
    expect((await practice('heart-practice-1', results)).status).toBe(200);
    const after = await progress();
    expect(after.hearts).toBe(1);
    expect(Number(after.xpTotal)-Number(before.xpTotal)).toBe(8);
    const { learningDay } = await import('../../shared/learningCalendar');
    expect(after.lastPracticeDate).toBe(learningDay());
    await practice('heart-practice-1',results);
    const replay = await progress();
    expect(replay.hearts).toBe(1);
    expect(replay.xpTotal).toBe(after.xpTotal);
  });

  it('refills hearts on every retry, not only once per day', async () => {
    const db = createClient({url: `file:${TEST_DB}`});
    for (const n of [1, 2]) {
      await db.execute({sql: 'UPDATE progress SET hearts=0 WHERE user_id=?', args: [uid]});
      await call('POST', ['sync', 'push'], {cookie, body: {mutations: [{id: `heart-restore-same-day-${n}`, type: 'hearts.restore', payload: {}}]}});
      expect((await progress()).hearts).toBe(5);
    }
    db.close();
  });

  it('caps hearts at five across further completed sessions', async () => {
    const db = createClient({url: `file:${TEST_DB}`});
    await db.execute({sql:'UPDATE progress SET hearts=4 WHERE user_id=?',args:[uid]});
    db.close();
    await practice('heart-practice-2',[{wordId:'lesson-word',correct:false}]);
    expect((await progress()).hearts).toBe(5);
    await practice('heart-practice-3',[{wordId:'lesson-word',correct:true}]);
    expect((await progress()).hearts).toBe(5);
  });

  it('does not award hearts or XP for an empty session', async () => {
    const db = createClient({url:`file:${TEST_DB}`});
    await db.execute({sql:'UPDATE progress SET hearts=0 WHERE user_id=?',args:[uid]});
    db.close();
    const before = await progress();
    await practice('heart-practice-empty',[]);
    const after = await progress();
    expect(after.hearts).toBe(0);
    expect(after.xpTotal).toBe(before.xpTotal);
  });
});
