/**
 * One-time Turso schema setup — run once after creating a new Turso database:
 *   npx tsx scripts/migrate.ts
 *
 * Idempotent (uses CREATE TABLE IF NOT EXISTS). Safe to re-run.
 * Uses TURSO_DATABASE_URL + TURSO_AUTH_TOKEN from .env.local (loaded by tsx via dotenv).
 */
import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const db = createClient({
  url:       process.env.TURSO_DATABASE_URL ?? "file:./private/slovakgo.sqlite",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id                  TEXT PRIMARY KEY,
  email               TEXT UNIQUE NOT NULL,
  pw_hash             TEXT NOT NULL DEFAULT '',
  name_text           TEXT NOT NULL DEFAULT '',
  role                TEXT NOT NULL DEFAULT 'student',
  level               TEXT NOT NULL DEFAULT 'A0',
  goal                TEXT,
  avatar              TEXT,
  country             TEXT,
  sub_status          TEXT NOT NULL DEFAULT 'trial',
  trial_ends          TEXT,
  stripe_customer_id  TEXT,
  stripe_sub_id       TEXT,
  ob_done             INTEGER NOT NULL DEFAULT 0,
  is_blocked          INTEGER NOT NULL DEFAULT 0,
  referred_by         TEXT,
  settings_j          TEXT NOT NULL DEFAULT '{}',
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS progress (
  user_id       TEXT PRIMARY KEY,
  xp_total      INTEGER NOT NULL DEFAULT 0,
  xp_weekly     INTEGER NOT NULL DEFAULT 0,
  xp_daily_j    TEXT    NOT NULL DEFAULT '{}',
  week_id       TEXT    NOT NULL DEFAULT '',
  hearts        INTEGER NOT NULL DEFAULT 5,
  max_hearts    INTEGER NOT NULL DEFAULT 5,
  streak_days   INTEGER NOT NULL DEFAULT 0,
  last_prac     TEXT,
  freeze_cnt    INTEGER NOT NULL DEFAULT 0,
  coins         INTEGER NOT NULL DEFAULT 0,
  completed_j   TEXT    NOT NULL DEFAULT '[]',
  mistakes_j    TEXT    NOT NULL DEFAULT '[]',
  updated_at    TEXT    NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS lessons (
  id          TEXT PRIMARY KEY,
  data_json   TEXT NOT NULL,
  published   INTEGER NOT NULL DEFAULT 0,
  created_by  TEXT,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_words (
  user_id   TEXT    NOT NULL,
  word_id   TEXT    NOT NULL,
  status    TEXT    NOT NULL DEFAULT 'new',
  mistakes  INTEGER NOT NULL DEFAULT 0,
  corrects  INTEGER NOT NULL DEFAULT 0,
  favorite  INTEGER NOT NULL DEFAULT 0,
  last_seen TEXT,
  PRIMARY KEY (user_id, word_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS fcm_tokens (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  platform   TEXT NOT NULL DEFAULT 'web',
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sync_log (
  mutation_id  TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT '',
  processed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ip           TEXT NOT NULL,
  attempted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  created_at TEXT NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS client_errors (
  id         TEXT PRIMARY KEY,
  user_id    TEXT,
  message    TEXT NOT NULL,
  stack      TEXT,
  url        TEXT,
  user_agent TEXT,
  ip         TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email          ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_sub_status     ON users(sub_status);
CREATE INDEX IF NOT EXISTS idx_users_updated_at     ON users(updated_at);
CREATE INDEX IF NOT EXISTS idx_sync_log_user        ON sync_log(user_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip    ON login_attempts(ip, attempted_at);
CREATE INDEX IF NOT EXISTS idx_client_errors_date   ON client_errors(created_at);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user      ON fcm_tokens(user_id);
`;

async function run() {
  console.log("Running migrations against:", process.env.TURSO_DATABASE_URL ?? "file:./private/slovakgo.sqlite");

  for (const stmt of schema.split(";").map(s => s.trim()).filter(Boolean)) {
    await db.execute(stmt + ";");
  }

  console.log("✓ Schema applied");

  const counts = await Promise.all([
    db.execute("SELECT COUNT(*) as c FROM users"),
    db.execute("SELECT COUNT(*) as c FROM lessons"),
  ]);
  console.log(`  users: ${counts[0].rows[0].c}  lessons: ${counts[1].rows[0].c}`);
}

run().catch(err => { console.error(err); process.exit(1); });
