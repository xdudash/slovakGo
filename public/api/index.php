<?php
/**
 * Slovak Life API — PHP 8.1 + SQLite3
 * Single-file backend for shared hosting.
 *
 * Routes (PATH_INFO or query-string fallback):
 *   GET  /           — health check
 *   POST /auth/register
 *   POST /auth/login
 *   POST /auth/logout
 *   POST /sync/push  — requires auth; processes mutation queue
 *   GET  /sync/pull  — requires auth; returns user state snapshot
 */
declare(strict_types=1);

// Load .env.local from project root (two levels up from public/api/).
// On production, set env vars via cPanel / server config instead.
(static function (): void {
    $envFile = dirname(__DIR__, 2) . '/.env.local';
    if (!is_file($envFile)) return;
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) continue;
        if (!str_contains($line, '=')) continue;
        [$key, $val] = explode('=', $line, 2);
        $key = trim($key);
        $val = trim($val, " \t\"'");
        if ($key !== '' && getenv($key) === false) {   // don't override real server env
            putenv("$key=$val");
            $_ENV[$key] = $val;
        }
    }
})();

// ══════════════════════════════════════════════════════════════════
// CORS  (runs before everything so OPTIONS pre-flight works)
// ══════════════════════════════════════════════════════════════════

(static function (): void {
    $origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
    $envList = (string)(getenv('ALLOWED_ORIGINS') ?: 'http://localhost:5173,http://localhost:4173,http://localhost:8080');
    $allowed = array_map('trim', explode(',', $envList));
    // Allow explicit list + any HTTPS origin (for production sub-domains)
    if (in_array($origin, $allowed, true) || (str_starts_with($origin, 'https://') && $origin !== '')) {
        header("Access-Control-Allow-Origin: $origin");
        header('Access-Control-Allow-Credentials: true');
    }
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: strict-origin-when-cross-origin');
})();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ══════════════════════════════════════════════════════════════════
// Config
// ══════════════════════════════════════════════════════════════════

const SESSION_COOKIE  = 'sl_session';
const MAX_HEARTS      = 5;
const XP_PER_PRACTICE = 5;

// ══════════════════════════════════════════════════════════════════
// Pure helpers
// ══════════════════════════════════════════════════════════════════

function respond(mixed $payload, int $code = 200): never
{
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $msg, int $code = 400): never
{
    respond(['ok' => false, 'error' => $msg], $code);
}

function body(): array
{
    static $parsed = null;
    if ($parsed !== null) return $parsed;
    $raw    = file_get_contents('php://input') ?: '{}';
    $parsed = json_decode($raw, true);
    if (!is_array($parsed)) fail('Некоректний JSON');
    return $parsed;
}

function client_ip(): string
{
    // Trust X-Forwarded-For only when running behind a known reverse proxy
    if (getenv('TRUSTED_PROXY') && isset($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        return trim(explode(',', (string)$_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
    }
    return (string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
}

function now_iso(): string
{
    return gmdate('Y-m-d\TH:i:s\Z');
}

function today_key(): string
{
    return gmdate('Y-m-d');
}

function current_week_id(): string
{
    // e.g. "2026-W23"
    return gmdate('o') . '-W' . gmdate('W');
}

function gen_uuid(): string
{
    $b    = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}

// ══════════════════════════════════════════════════════════════════
// Database
// ══════════════════════════════════════════════════════════════════

function open_db(): SQLite3
{
    // Prefer location outside web-root; fall back to api/storage/
    $candidates = [
        dirname(__DIR__, 2) . '/private/slovak-life.sqlite',
        __DIR__ . '/storage/slovak-life.sqlite',
    ];
    $dbPath = null;
    foreach ($candidates as $cand) {
        $dir = dirname($cand);
        if (!is_dir($dir)) {
            @mkdir($dir, 0750, true);
        }
        if (is_dir($dir) && is_writable($dir)) {
            $dbPath = $cand;
            break;
        }
    }
    if ($dbPath === null) {
        fail('Сховище недоступне', 500);
    }

    $db = new SQLite3($dbPath);
    $db->enableExceptions(true);
    $db->exec('PRAGMA journal_mode=WAL');
    $db->exec('PRAGMA foreign_keys=ON');
    $db->exec('PRAGMA synchronous=NORMAL');
    $db->exec('PRAGMA busy_timeout=5000');

    migrate($db);
    return $db;
}

function migrate(SQLite3 $db): void
{
    $db->exec(<<<SQL
        CREATE TABLE IF NOT EXISTS users (
            id          TEXT PRIMARY KEY,
            email       TEXT UNIQUE NOT NULL COLLATE NOCASE,
            pw_hash     TEXT NOT NULL DEFAULT 'DEV:skip',
            name_text   TEXT NOT NULL DEFAULT '',
            role        TEXT NOT NULL DEFAULT 'student',
            level       TEXT NOT NULL DEFAULT 'A0',
            goal        TEXT,
            avatar      TEXT,
            country     TEXT,
            sub_status  TEXT NOT NULL DEFAULT 'free',
            trial_ends  TEXT,
            ob_done     INTEGER NOT NULL DEFAULT 0,
            settings_j  TEXT NOT NULL DEFAULT '{}',
            is_blocked  INTEGER NOT NULL DEFAULT 0,
            created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
            updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
        );
        CREATE TABLE IF NOT EXISTS progress (
            user_id     TEXT PRIMARY KEY,
            xp_total    INTEGER NOT NULL DEFAULT 0,
            xp_weekly   INTEGER NOT NULL DEFAULT 0,
            xp_daily_j  TEXT NOT NULL DEFAULT '{}',
            week_id     TEXT NOT NULL DEFAULT '',
            hearts      INTEGER NOT NULL DEFAULT 5,
            max_hearts  INTEGER NOT NULL DEFAULT 5,
            streak_days INTEGER NOT NULL DEFAULT 0,
            last_prac   TEXT NOT NULL DEFAULT '',
            freeze_cnt  INTEGER NOT NULL DEFAULT 1,
            coins       INTEGER NOT NULL DEFAULT 0,
            completed_j TEXT NOT NULL DEFAULT '[]',
            mistakes_j  TEXT NOT NULL DEFAULT '[]',
            updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
        );
        CREATE TABLE IF NOT EXISTS user_words (
            user_id   TEXT NOT NULL,
            word_id   TEXT NOT NULL,
            status    TEXT NOT NULL DEFAULT 'new',
            mistakes  INTEGER NOT NULL DEFAULT 0,
            corrects  INTEGER NOT NULL DEFAULT 0,
            favorite  INTEGER NOT NULL DEFAULT 0,
            last_seen TEXT,
            PRIMARY KEY (user_id, word_id)
        );
        CREATE TABLE IF NOT EXISTS lessons (
            id         TEXT PRIMARY KEY,
            data_json  TEXT NOT NULL,
            published  INTEGER NOT NULL DEFAULT 0,
            created_by TEXT,
            updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
        );
        CREATE TABLE IF NOT EXISTS sync_log (
            mutation_id  TEXT PRIMARY KEY,
            user_id      TEXT NOT NULL,
            type         TEXT NOT NULL,
            processed_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS fcm_tokens (
            token       TEXT PRIMARY KEY,
            user_id     TEXT NOT NULL,
            platform    TEXT NOT NULL DEFAULT 'web',
            created_at  TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_fcm_user     ON fcm_tokens(user_id);
        CREATE INDEX IF NOT EXISTS idx_synclog_user ON sync_log(user_id);
        CREATE INDEX IF NOT EXISTS idx_uwords_user  ON user_words(user_id);
    SQL);

    $db->exec(<<<SQL
        CREATE TABLE IF NOT EXISTS password_resets (
            token_hash  TEXT PRIMARY KEY,
            user_id     TEXT NOT NULL,
            created_at  TEXT NOT NULL,
            used        INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_pw_resets_user ON password_resets(user_id);

        CREATE TABLE IF NOT EXISTS login_attempts (
            ip           TEXT NOT NULL,
            attempted_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_la_ip ON login_attempts(ip, attempted_at);

        CREATE TABLE IF NOT EXISTS client_errors (
            id          TEXT PRIMARY KEY,
            user_id     TEXT,
            message     TEXT NOT NULL,
            stack       TEXT,
            url         TEXT,
            user_agent  TEXT,
            ip          TEXT,
            created_at  TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_cerr_time ON client_errors(created_at);
    SQL);

    // Additive migrations for new columns (safe to run every boot)
    foreach ([
        "ALTER TABLE progress ADD COLUMN last_reminder_date  TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE users    ADD COLUMN referred_by          TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE users    ADD COLUMN stripe_customer_id   TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE users    ADD COLUMN stripe_sub_id        TEXT NOT NULL DEFAULT ''",
    ] as $ddl) {
        try { $db->exec($ddl); } catch (\Exception $e) { /* column already exists — ignore */ }
    }

    // Seed dev accounts (pw_hash = 'DEV:skip' accepts any password)
    $now = now_iso();
    $def = json_encode(['language' => 'uk', 'notificationsEnabled' => true, 'soundEnabled' => true, 'hapticsEnabled' => true]);
    $db->exec(<<<SQL
        INSERT OR IGNORE INTO users (id, email, name_text, role, level, sub_status, ob_done, settings_j, created_at, updated_at)
        VALUES
            ('user-student', 'student@slovaklife.local', 'Олена',    'student', 'A1', 'trial', 1, '$def', '$now', '$now'),
            ('user-teacher', 'teacher@slovaklife.local', 'Викладач', 'teacher', 'B2', 'plus',  1, '$def', '$now', '$now'),
            ('user-admin',   'admin@slovaklife.local',   'Адмін',    'admin',   'C1', 'plus',  1, '$def', '$now', '$now');
        INSERT OR IGNORE INTO progress (user_id, hearts, max_hearts, updated_at)
        VALUES ('user-student', 5, 5, '$now'),
               ('user-teacher', 5, 5, '$now'),
               ('user-admin',   5, 5, '$now');
    SQL);
}

// ══════════════════════════════════════════════════════════════════
// Session / Auth
// ══════════════════════════════════════════════════════════════════

function init_session(): void
{
    if (session_status() !== PHP_SESSION_NONE) return;
    session_name(SESSION_COOKIE);
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => !empty($_SERVER['HTTPS']),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    @session_start();
}

function current_uid(): ?string
{
    init_session();
    return isset($_SESSION['user_id']) ? (string)$_SESSION['user_id'] : null;
}

function require_auth(): string
{
    $uid = current_uid();
    if ($uid === null) fail('Неавторизовано', 401);
    return $uid;
}

function check_role(SQLite3 $db, string $uid, string ...$roles): bool
{
    $stmt = $db->prepare('SELECT role FROM users WHERE id = ? LIMIT 1');
    $stmt->bindValue(1, $uid);
    $res = $stmt->execute();
    $row = $res ? $res->fetchArray(SQLITE3_ASSOC) : false;
    return $row && in_array($row['role'], $roles, true);
}

function require_role(SQLite3 $db, string $uid, string ...$roles): void
{
    if (!check_role($db, $uid, ...$roles)) fail('Недостатньо прав', 403);
}

function verify_password(string $password, string $hash): bool
{
    if (str_starts_with($hash, 'DEV:')) return true; // dev seed accounts
    return password_verify($password, $hash);
}

// ══════════════════════════════════════════════════════════════════
// Router
// ══════════════════════════════════════════════════════════════════

function route_path(): string
{
    // Prefer PATH_INFO (works when PHP is configured to pass it)
    $p = $_SERVER['PATH_INFO'] ?? '';
    if ($p !== '') return '/' . ltrim($p, '/');

    // Fallback: extract sub-path after index.php in REQUEST_URI
    $uri    = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $marker = '/index.php';
    $pos    = strrpos($uri, $marker);
    if ($pos !== false) {
        $sub = substr($uri, $pos + strlen($marker));
        return ($sub === '' || $sub === '/') ? '/' : '/' . ltrim($sub, '/');
    }
    return '/';
}

$db   = open_db();
$path = route_path();
$meth = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// CSRF: require X-Requested-With on all mutating requests (SameSite=Lax + this = defense-in-depth)
// /billing/webhook is exempted — Stripe sends raw HTTP POST without browser headers;
// it is verified instead by HMAC signature inside handle_billing_webhook().
if ($meth === 'POST' && $path !== '/billing/webhook') {
    if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'XMLHttpRequest') {
        fail('Forbidden', 403);
    }
}

if      ($meth === 'GET'  && in_array($path, ['/', '/health'], true)) { handle_ping($db); }
elseif  ($meth === 'POST' && $path === '/auth/register')               { handle_register($db); }
elseif  ($meth === 'POST' && $path === '/auth/login')                  { handle_login($db); }
elseif  ($meth === 'POST' && $path === '/auth/logout')                 { handle_logout(); }
elseif  ($meth === 'POST' && $path === '/sync/push')                   { handle_sync_push($db); }
elseif  ($meth === 'GET'  && $path === '/sync/pull')                   { handle_sync_pull($db); }
elseif  ($meth === 'POST' && $path === '/user/email')                  { handle_user_email($db); }
elseif  ($meth === 'POST' && $path === '/user/password')               { handle_user_password($db); }
elseif  ($meth === 'POST' && $path === '/auth/delete')                 { handle_auth_delete($db); }
elseif  ($meth === 'POST' && $path === '/auth/deactivate')             { handle_auth_deactivate($db); }
elseif  ($meth === 'POST' && $path === '/auth/forgot')                 { handle_auth_forgot($db); }
elseif  ($meth === 'POST' && $path === '/auth/reset')                  { handle_auth_reset($db); }
elseif  ($meth === 'POST' && $path === '/errors')                      { handle_post_errors($db); }
elseif  ($meth === 'GET'  && $path === '/admin/errors')                { handle_admin_errors($db); }
elseif  ($meth === 'GET'  && $path === '/cron/backup')                 { handle_cron_backup($db); }
elseif  ($meth === 'POST' && $path === '/user/fcm-token')              { handle_user_fcm_token($db); }
elseif  ($meth === 'POST' && $path === '/user/reminder')               { handle_user_reminder($db); }
elseif  ($meth === 'POST' && $path === '/user/referral')               { handle_user_referral($db); }
elseif  ($meth === 'POST' && $path === '/admin/notify')                { handle_admin_notify($db); }
elseif  ($meth === 'GET'  && $path === '/admin/stats')                 { handle_admin_stats($db); }
elseif  ($meth === 'GET'  && $path === '/cron/push')                   { handle_cron_push($db); }
elseif  ($meth === 'GET'  && $path === '/cron/weekly')                 { handle_cron_weekly($db); }
elseif  ($meth === 'POST' && $path === '/billing/checkout')            { handle_billing_checkout($db); }
elseif  ($meth === 'POST' && $path === '/billing/portal')              { handle_billing_portal($db); }
elseif  ($meth === 'POST' && $path === '/billing/webhook')             { handle_billing_webhook($db); }
else    fail("Маршрут не знайдено: $path", 404);

// ══════════════════════════════════════════════════════════════════
// Route handlers
// ══════════════════════════════════════════════════════════════════

function handle_ping(SQLite3 $db): never
{
    $count = (int)$db->querySingle('SELECT COUNT(*) FROM users');
    respond(['ok' => true, 'users' => $count, 'updatedAt' => now_iso()]);
}

// ── Admin Stats ───────────────────────────────────────────────────

function handle_admin_stats(SQLite3 $db): never
{
    $uid = require_auth();
    require_role($db, $uid, 'admin');

    $now = time();
    $dayAgo = gmdate('Y-m-d\TH:i:s\Z', $now - 86400);
    $weekAgo = gmdate('Y-m-d\TH:i:s\Z', $now - 7 * 86400);

    // Basic counts
    $totalUsers    = (int)$db->querySingle('SELECT COUNT(*) FROM users');
    $active24h     = (int)$db->querySingle("SELECT COUNT(*) FROM users WHERE updated_at > '$dayAgo'");
    $active7d      = (int)$db->querySingle("SELECT COUNT(*) FROM users WHERE updated_at > '$weekAgo'");
    $plusUsers     = (int)$db->querySingle("SELECT COUNT(*) FROM users WHERE sub_status = 'plus'");

    // Level distribution
    $levels = [];
    $lres = $db->query('SELECT level, COUNT(*) as cnt FROM users GROUP BY level');
    while ($row = $lres->fetchArray(SQLITE3_ASSOC)) {
        $levels[$row['level']] = (int)$row['cnt'];
    }

    // Average progress
    $avgXP = (float)$db->querySingle('SELECT AVG(xp_total) FROM progress');
    $avgStreak = (float)$db->querySingle('SELECT AVG(streak_days) FROM progress');

    // Recent activity (registrations per day for last 7 days)
    $dailyRegs = [];
    for ($i = 6; $i >= 0; $i--) {
        $d = gmdate('Y-m-d', $now - $i * 86400);
        $cnt = (int)$db->querySingle("SELECT COUNT(*) FROM users WHERE created_at LIKE '$d%'");
        $dailyRegs[] = ['date' => $d, 'count' => $cnt];
    }

    respond([
        'ok' => true,
        'summary' => [
            'totalUsers' => $totalUsers,
            'active24h'  => $active24h,
            'active7d'   => $active7d,
            'plusUsers'  => $plusUsers,
            'avgXP'      => round($avgXP, 1),
            'avgStreak'  => round($avgStreak, 1),
        ],
        'levels' => $levels,
        'dailyRegistrations' => $dailyRegs,
        'updatedAt' => now_iso()
    ]);
}

// ── Register ──────────────────────────────────────────────────────

function handle_register(SQLite3 $db): never
{
    init_session();
    $b      = body();
    $email  = strtolower(trim((string)($b['email']    ?? '')));
    $passwd = (string)($b['password'] ?? '');
    $name   = trim((string)($b['name']    ?? 'Студент'));
    $goal   = trim((string)($b['goal']    ?? ''));
    // Client may send its own UUID so both sides agree on the ID
    $cliId  = trim((string)($b['id'] ?? ''));

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Некоректний email', 422);
    if (strlen($passwd) < 6) fail('Пароль занадто короткий', 422);

    $stmt = $db->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $stmt->bindValue(1, $email);
    $res = $stmt->execute();
    if ($res && $res->fetchArray(SQLITE3_ASSOC)) {
        fail('Email вже зареєстрований', 409);
    }

    $id     = ($cliId !== '') ? $cliId : ('user-' . gen_uuid());
    $now    = now_iso();
    $trial  = gmdate('Y-m-d\TH:i:s\Z', time() + 14 * 86400);
    $hash   = password_hash($passwd, PASSWORD_BCRYPT, ['cost' => 11]);
    $defS   = json_encode(['language' => 'uk', 'notificationsEnabled' => true, 'soundEnabled' => true, 'hapticsEnabled' => true]);

    $stmt = $db->prepare(<<<SQL
        INSERT INTO users (id, email, pw_hash, name_text, role, level, goal, sub_status, trial_ends, ob_done, settings_j, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'student', 'A0', ?, 'trial', ?, 0, ?, ?, ?)
    SQL);
    $stmt->bindValue(1, $id);
    $stmt->bindValue(2, $email);
    $stmt->bindValue(3, $hash);
    $stmt->bindValue(4, $name);
    $stmt->bindValue(5, $goal !== '' ? $goal : null, SQLITE3_NULL);
    $stmt->bindValue(6, $trial);
    $stmt->bindValue(7, $defS);
    $stmt->bindValue(8, $now);
    $stmt->bindValue(9, $now);
    $stmt->execute();

    ensure_progress($db, $id);

    $stmt = $db->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
    $stmt->bindValue(1, $id);
    $res = $stmt->execute();
    $row = $res ? $res->fetchArray(SQLITE3_ASSOC) : null;
    if (!$row) fail('Помилка реєстрації', 500);

    $_SESSION['user_id'] = $id;
    respond(['ok' => true, 'user' => row_to_user($row)], 201);
}

// ── Login ─────────────────────────────────────────────────────────

const LOGIN_MAX_ATTEMPTS  = 10;   // per IP
const LOGIN_WINDOW_SEC    = 900;  // 15 minutes
const LOGIN_LOCKOUT_SEC   = 900;  // 15 minutes

function handle_login(SQLite3 $db): never
{
    init_session();
    $ip = client_ip();

    // Purge stale attempts (keeps table small)
    $db->exec("DELETE FROM login_attempts WHERE attempted_at < datetime('now', '-" . LOGIN_WINDOW_SEC . " seconds')");

    // Count recent attempts from this IP
    $cnt = (int)$db->querySingle(
        "SELECT COUNT(*) FROM login_attempts WHERE ip = '" . SQLite3::escapeString($ip) . "'
         AND attempted_at > datetime('now', '-" . LOGIN_WINDOW_SEC . " seconds')"
    );
    if ($cnt >= LOGIN_MAX_ATTEMPTS) {
        http_response_code(429);
        header('Retry-After: ' . LOGIN_LOCKOUT_SEC);
        respond(['ok' => false, 'error' => 'Занадто багато спроб. Спробуй через 15 хвилин.', 'retryAfter' => LOGIN_LOCKOUT_SEC], 429);
    }

    $b      = body();
    $email  = strtolower(trim((string)($b['email']    ?? '')));
    $passwd = (string)($b['password'] ?? '');

    $stmt = $db->prepare('SELECT * FROM users WHERE email = ? AND is_blocked = 0 LIMIT 1');
    $stmt->bindValue(1, $email);
    $res = $stmt->execute();
    $row = $res ? $res->fetchArray(SQLITE3_ASSOC) : false;

    if (!$row || !verify_password($passwd, (string)$row['pw_hash'])) {
        // Record failed attempt
        $ins = $db->prepare('INSERT INTO login_attempts (ip, attempted_at) VALUES (?, ?)');
        $ins->bindValue(1, $ip);
        $ins->bindValue(2, now_iso());
        $ins->execute();
        fail('Невірний email або пароль', 401);
    }

    // Success — clear attempts for this IP
    $del = $db->prepare('DELETE FROM login_attempts WHERE ip = ?');
    $del->bindValue(1, $ip);
    $del->execute();

    $_SESSION['user_id'] = $row['id'];
    respond(['ok' => true, 'user' => row_to_user($row)]);
}

// ── Logout ────────────────────────────────────────────────────────

function handle_logout(): never
{
    init_session();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
    respond(['ok' => true]);
}

// ── Change email ──────────────────────────────────────────────────

function handle_user_email(SQLite3 $db): never
{
    init_session();
    $uid    = require_auth();
    $b      = body();
    $email  = strtolower(trim((string)($b['email'] ?? '')));

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Некоректний email', 422);
    if (strlen($email) > 254) fail('Email занадто довгий', 422);

    // Uniqueness check (exclude current user)
    $chk = $db->prepare('SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1');
    $chk->bindValue(1, $email);
    $chk->bindValue(2, $uid);
    $res = $chk->execute();
    if ($res && $res->fetchArray(SQLITE3_ASSOC)) {
        fail('Email вже використовується', 409);
    }

    $stmt = $db->prepare('UPDATE users SET email = ?, updated_at = ? WHERE id = ?');
    $stmt->bindValue(1, $email);
    $stmt->bindValue(2, now_iso());
    $stmt->bindValue(3, $uid);
    $stmt->execute();
    respond(['ok' => true]);
}

// ── Change password ───────────────────────────────────────────────

function handle_user_password(SQLite3 $db): never
{
    init_session();
    $uid  = require_auth();
    $b    = body();
    $cur  = (string)($b['currentPassword'] ?? '');
    $new  = (string)($b['newPassword']     ?? '');

    if (strlen($new) < 8) fail('Пароль занадто короткий', 422);

    $stmt = $db->prepare('SELECT pw_hash FROM users WHERE id = ? LIMIT 1');
    $stmt->bindValue(1, $uid);
    $res  = $stmt->execute();
    $row  = $res ? $res->fetchArray(SQLITE3_ASSOC) : false;
    if (!$row) fail('Користувача не знайдено', 404);

    if (!verify_password($cur, (string)$row['pw_hash'])) {
        fail('Невірний поточний пароль', 401);
    }

    $hash = password_hash($new, PASSWORD_BCRYPT, ['cost' => 11]);
    $stmt = $db->prepare('UPDATE users SET pw_hash = ?, updated_at = ? WHERE id = ?');
    $stmt->bindValue(1, $hash);
    $stmt->bindValue(2, now_iso());
    $stmt->bindValue(3, $uid);
    $stmt->execute();
    respond(['ok' => true]);
}

// ── Delete account ────────────────────────────────────────────────

function handle_auth_delete(SQLite3 $db): never
{
    init_session();
    $uid   = require_auth();
    $b     = body();
    $email = strtolower(trim((string)($b['confirmEmail'] ?? '')));

    $stmt = $db->prepare('SELECT email FROM users WHERE id = ? LIMIT 1');
    $stmt->bindValue(1, $uid);
    $res  = $stmt->execute();
    $row  = $res ? $res->fetchArray(SQLITE3_ASSOC) : false;
    if (!$row) fail('Користувача не знайдено', 404);
    if ($email !== strtolower((string)$row['email'])) {
        fail('Email не співпадає', 422);
    }

    // Delete all user data
    foreach (['sync_log', 'user_words', 'progress'] as $table) {
        $s = $db->prepare("DELETE FROM $table WHERE user_id = ?");
        $s->bindValue(1, $uid);
        $s->execute();
    }
    $s = $db->prepare('DELETE FROM users WHERE id = ?');
    $s->bindValue(1, $uid);
    $s->execute();

    // Destroy session
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
    respond(['ok' => true]);
}

// ── Deactivate account ────────────────────────────────────────────

function handle_auth_deactivate(SQLite3 $db): never
{
    init_session();
    $uid = require_auth();

    $stmt = $db->prepare('UPDATE users SET is_blocked = 1, updated_at = ? WHERE id = ?');
    $stmt->bindValue(1, now_iso());
    $stmt->bindValue(2, $uid);
    $stmt->execute();

    // Destroy session
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
    respond(['ok' => true]);
}

// ── Forgot password ───────────────────────────────────────────────

function handle_auth_forgot(SQLite3 $db): never
{
    $email = strtolower(trim((string)(body()['email'] ?? '')));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Некоректний email', 422);

    // Always return OK — prevents email enumeration
    $esc = SQLite3::escapeString($email);
    $row = $db->querySingle("SELECT id, name_text FROM users WHERE email = '$esc' AND is_blocked = 0 LIMIT 1", true);
    if (!$row) respond(['ok' => true]);

    // Delete previous unused tokens for this user
    $del = $db->prepare('DELETE FROM password_resets WHERE user_id = ?');
    $del->bindValue(1, (string)$row['id']);
    $del->execute();

    // Generate cryptographically secure token; store only its hash
    $token     = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $token);

    $ins = $db->prepare('INSERT INTO password_resets (token_hash, user_id, created_at, used) VALUES (?, ?, ?, 0)');
    $ins->bindValue(1, $tokenHash);
    $ins->bindValue(2, (string)$row['id']);
    $ins->bindValue(3, now_iso());
    $ins->execute();

    $appUrl   = rtrim((string)(getenv('APP_URL') ?: 'https://slovaklife.app'), '/');
    $resetUrl = "{$appUrl}/reset-password?token={$token}";
    $name     = (string)$row['name_text'];

    $subject = '=?UTF-8?B?' . base64_encode('Відновлення пароля — Slovak Life') . '?=';
    $message = "Привіт, {$name}!\r\n\r\n"
        . "Ми отримали запит на відновлення пароля для твого акаунта Slovak Life.\r\n\r\n"
        . "Перейди за посиланням щоб встановити новий пароль:\r\n{$resetUrl}\r\n\r\n"
        . "Посилання дійсне 1 годину.\r\n\r\n"
        . "Якщо ти не надсилав цей запит — просто ігноруй цього листа.\r\n\r\n"
        . "— Slovak Life";

    $from    = (string)(getenv('MAIL_FROM') ?: 'noreply@slovaklife.app');
    $headers = implode("\r\n", [
        "From: Slovak Life <{$from}>",
        "Reply-To: {$from}",
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        'X-Mailer: PHP/' . PHP_VERSION,
    ]);

    @mail($email, $subject, $message, $headers);
    respond(['ok' => true]);
}

// ── Reset password ────────────────────────────────────────────────

function handle_auth_reset(SQLite3 $db): never
{
    $b        = body();
    $token    = trim((string)($b['token']    ?? ''));
    $password = (string)($b['password'] ?? '');

    if ($token === '')        fail('token обовʼязковий', 422);
    if (strlen($password) < 8) fail('Пароль занадто короткий (мін. 8 символів)', 422);

    $tokenHash = hash('sha256', $token);
    $esc       = SQLite3::escapeString($tokenHash);
    $row       = $db->querySingle("SELECT * FROM password_resets WHERE token_hash = '$esc' AND used = 0 LIMIT 1", true);

    if (!$row) fail('Посилання недійсне або вже використане', 400);

    // 1-hour expiry
    $created = strtotime((string)$row['created_at']);
    if ($created === false || (time() - $created) > 3600) {
        fail('Посилання застаріло. Запроси нове.', 400);
    }

    // Update password and mark token used in one transaction
    $db->exec('BEGIN');
    try {
        $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 11]);
        $upd  = $db->prepare('UPDATE users SET pw_hash = ?, updated_at = ? WHERE id = ?');
        $upd->bindValue(1, $hash);
        $upd->bindValue(2, now_iso());
        $upd->bindValue(3, (string)$row['user_id']);
        $upd->execute();

        $mark = $db->prepare('UPDATE password_resets SET used = 1 WHERE token_hash = ?');
        $mark->bindValue(1, $tokenHash);
        $mark->execute();

        $db->exec('COMMIT');
    } catch (\Exception $e) {
        $db->exec('ROLLBACK');
        fail('Помилка при зміні пароля', 500);
    }

    respond(['ok' => true]);
}

// ── Client error reporting ────────────────────────────────────────

function handle_post_errors(SQLite3 $db): never
{
    $ip = client_ip();

    // Rate limit: max 10 reports per IP per minute
    $recent = (int)$db->querySingle(
        "SELECT COUNT(*) FROM client_errors WHERE ip = '" . SQLite3::escapeString($ip) . "'
         AND created_at > datetime('now', '-60 seconds')"
    );
    if ($recent >= 10) respond(['ok' => true]); // silently drop excess

    $b       = body();
    $message = substr(trim((string)($b['message'] ?? '')), 0, 500);
    if ($message === '') respond(['ok' => true]);

    $stack = substr(trim((string)($b['stack']   ?? '')), 0, 4000);
    $url   = substr(trim((string)($b['url']     ?? '')), 0, 500);
    $ua    = substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 300);
    $uid   = current_uid();

    $stmt = $db->prepare(
        'INSERT INTO client_errors (id, user_id, message, stack, url, user_agent, ip, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->bindValue(1, gen_uuid());
    $stmt->bindValue(2, $uid, $uid === null ? SQLITE3_NULL : SQLITE3_TEXT);
    $stmt->bindValue(3, $message);
    $stmt->bindValue(4, $stack !== '' ? $stack : null, $stack !== '' ? SQLITE3_TEXT : SQLITE3_NULL);
    $stmt->bindValue(5, $url   !== '' ? $url   : null, $url   !== '' ? SQLITE3_TEXT : SQLITE3_NULL);
    $stmt->bindValue(6, $ua    !== '' ? $ua    : null, $ua    !== '' ? SQLITE3_TEXT : SQLITE3_NULL);
    $stmt->bindValue(7, $ip);
    $stmt->bindValue(8, now_iso());
    $stmt->execute();

    // Keep only most recent 500 errors
    $db->exec(
        "DELETE FROM client_errors WHERE id NOT IN
         (SELECT id FROM client_errors ORDER BY created_at DESC LIMIT 500)"
    );

    respond(['ok' => true]);
}

// ── Admin: list client errors ─────────────────────────────────────

function handle_admin_errors(SQLite3 $db): never
{
    $uid = require_auth();
    require_role($db, $uid, 'admin');

    $limit = min((int)($_GET['limit'] ?? 50), 200);

    $res  = $db->query(
        "SELECT id, user_id, message, stack, url, user_agent, ip, created_at
         FROM client_errors ORDER BY created_at DESC LIMIT $limit"
    );
    $rows = [];
    while ($res && ($row = $res->fetchArray(SQLITE3_ASSOC))) {
        $rows[] = [
            'id'        => $row['id'],
            'userId'    => $row['user_id'],
            'message'   => $row['message'],
            'stack'     => $row['stack'],
            'url'       => $row['url'],
            'userAgent' => $row['user_agent'],
            'ip'        => $row['ip'],
            'createdAt' => $row['created_at'],
        ];
    }

    $total = (int)$db->querySingle('SELECT COUNT(*) FROM client_errors');
    respond(['ok' => true, 'errors' => $rows, 'total' => $total]);
}

// ── SQLite backup cron ────────────────────────────────────────────
// Schedule: daily at 03:00 UTC  →  0 3 * * *
// GET https://yourdomain.com/api/index.php/cron/backup?key=YOUR_CRON_SECRET
// Keeps 7 rolling daily backups alongside the main DB file.

function handle_cron_backup(SQLite3 $db): never
{
    $key      = trim((string)($_GET['key'] ?? ''));
    $expected = (string)(getenv('CRON_SECRET') ?: '');
    if ($expected === '' || !hash_equals($expected, $key)) fail('Unauthorized', 401);

    // Locate the live DB file
    $candidates = [
        dirname(__DIR__, 2) . '/private/slovak-life.sqlite',
        __DIR__ . '/storage/slovak-life.sqlite',
    ];
    $dbPath = null;
    foreach ($candidates as $cand) {
        if (file_exists($cand)) { $dbPath = $cand; break; }
    }
    if ($dbPath === null) fail('DB file not found', 500);

    $backupDir = dirname($dbPath) . '/backups';
    if (!is_dir($backupDir) && !@mkdir($backupDir, 0750, true)) {
        fail('Cannot create backup directory', 500);
    }

    // Flush WAL into the main file before copying
    $db->exec('PRAGMA wal_checkpoint(TRUNCATE)');

    $date       = gmdate('Y-m-d');
    $backupPath = "{$backupDir}/slovak-life-{$date}.sqlite";

    if (!copy($dbPath, $backupPath)) fail('copy() failed', 500);

    // Retain only the 7 most recent daily backups
    $files = glob("{$backupDir}/slovak-life-*.sqlite") ?: [];
    rsort($files); // newest first
    foreach (array_slice($files, 7) as $stale) {
        @unlink($stale);
    }

    respond([
        'ok'      => true,
        'file'    => basename($backupPath),
        'bytes'   => filesize($backupPath),
        'backups' => count(glob("{$backupDir}/slovak-life-*.sqlite") ?: []),
    ]);
}

// ── Sync push ─────────────────────────────────────────────────────

function handle_sync_push(SQLite3 $db): never
{
    $uid  = require_auth();
    $b    = body();
    $muts = $b['mutations'] ?? [];
    if (!is_array($muts)) fail('mutations має бути масивом', 422);

    $applied = 0;
    $db->exec('BEGIN');
    try {
        foreach ($muts as $mut) {
            if (!is_array($mut) || empty($mut['id'])) continue;
            $mutId = (string)$mut['id'];

            // Idempotency check
            $chk = $db->prepare('SELECT 1 FROM sync_log WHERE mutation_id = ? LIMIT 1');
            $chk->bindValue(1, $mutId);
            $cres = $chk->execute();
            if ($cres && $cres->fetchArray()) continue;

            process_mutation($db, $uid, $mut);

            $ins = $db->prepare('INSERT OR IGNORE INTO sync_log (mutation_id, user_id, type, processed_at) VALUES (?, ?, ?, ?)');
            $ins->bindValue(1, $mutId);
            $ins->bindValue(2, $uid);
            $ins->bindValue(3, (string)($mut['type'] ?? ''));
            $ins->bindValue(4, now_iso());
            $ins->execute();
            $applied++;
        }
        $db->exec('COMMIT');
    } catch (\Exception $e) {
        $db->exec('ROLLBACK');
        fail('Помилка мутації: ' . $e->getMessage(), 500);
    }

    respond(['ok' => true, 'applied' => $applied]);
}

// ── Sync pull ─────────────────────────────────────────────────────

function handle_sync_pull(SQLite3 $db): never
{
    $uid = require_auth();

    $stmt = $db->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
    $stmt->bindValue(1, $uid);
    $res = $stmt->execute();
    $row = $res ? $res->fetchArray(SQLITE3_ASSOC) : null;
    if (!$row) fail('Користувача не знайдено', 404);

    $prog  = ensure_progress($db, $uid);
    $words = db_get_user_words($db, $uid);
    $role  = (string)$row['role'];

    // Teachers/admins also receive lessons from DB
    $lessons = ($role === 'teacher' || $role === 'admin')
        ? db_get_all_lessons($db)
        : db_get_published_lessons($db);

    $progress = [
        'userId'            => $uid,
        'currentLevel'      => (string)$row['level'],
        'completedLessons'  => json_decode((string)$prog['completed_j'], true) ?? [],
        'xpTotal'           => (int)$prog['xp_total'],
        'xpWeekly'          => (int)$prog['xp_weekly'],
        'xpDailyHistory'    => (object)(json_decode((string)$prog['xp_daily_j'], true) ?? []),
        'hearts'            => (int)$prog['hearts'],
        'maxHearts'         => (int)$prog['max_hearts'],
        'streakDays'        => (int)$prog['streak_days'],
        'lastPracticeDate'  => ($prog['last_prac'] !== '') ? $prog['last_prac'] : null,
        'streakFreezeCount' => (int)$prog['freeze_cnt'],
        'coins'             => (int)$prog['coins'],
        'mistakes'          => json_decode((string)$prog['mistakes_j'], true) ?? [],
        'achievements'      => [],
        'updatedAt'         => (string)$prog['updated_at'],
    ];

    respond([
        'ok'        => true,
        'user'      => row_to_user($row),
        'progress'  => $progress,
        'userWords' => $words,
        'lessons'   => $lessons,
        'updatedAt' => now_iso(),
    ]);
}

// ══════════════════════════════════════════════════════════════════
// Mutation processor
// ══════════════════════════════════════════════════════════════════

function process_mutation(SQLite3 $db, string $uid, array $mut): void
{
    $type    = (string)($mut['type']    ?? '');
    $payload = is_array($mut['payload'] ?? null) ? $mut['payload'] : [];

    switch ($type) {
        case 'auth.register':
            // Server-side registration is preferred via /auth/register endpoint.
            // This handles the offline-first case where the mutation arrives later.
            mut_auth_register($db, $payload);
            break;
        case 'profile.update':
            mut_profile_update($db, $uid, $payload);
            break;
        case 'lesson.complete':
            mut_lesson_complete($db, $uid, $payload);
            break;
        case 'exercise.wrong':
            mut_exercise_wrong($db, $uid, $payload);
            break;
        case 'word.update':
            mut_word_update($db, $uid, $payload);
            break;
        case 'practice.complete':
            mut_practice_complete($db, $uid, $payload);
            break;
        case 'hearts.restore':
            mut_hearts_restore($db, $uid);
            break;
        case 'lesson.upsert':
            require_role($db, $uid, 'teacher', 'admin');
            mut_lesson_upsert($db, $uid, $payload);
            break;
        case 'lesson.delete':
            require_role($db, $uid, 'teacher', 'admin');
            $lessonId = (string)($payload['lessonId'] ?? '');
            if ($lessonId !== '') {
                $s = $db->prepare('DELETE FROM lessons WHERE id = ?');
                $s->bindValue(1, $lessonId);
                $s->execute();
            }
            break;
        case 'admin.user.update':
            require_role($db, $uid, 'admin');
            mut_admin_user_update($db, $payload);
            break;
        // Unknown types are intentionally ignored (forward-compat)
    }
}

// ─── auth.register ───────────────────────────────────────────────

function mut_auth_register(SQLite3 $db, array $p): void
{
    $user = is_array($p['user'] ?? null) ? $p['user'] : $p;
    if (empty($user['id']) || empty($user['email'])) return;

    $id  = (string)$user['id'];
    $now = now_iso();
    $stmt = $db->prepare(<<<SQL
        INSERT OR IGNORE INTO users (id, email, name_text, role, level, goal, sub_status, ob_done, settings_j, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    SQL);
    $stmt->bindValue(1,  $id);
    $stmt->bindValue(2,  strtolower(trim((string)$user['email'])));
    $stmt->bindValue(3,  (string)($user['name']               ?? ''));
    $stmt->bindValue(4,  (string)($user['role']               ?? 'student'));
    $stmt->bindValue(5,  (string)($user['level']              ?? 'A0'));
    $stmt->bindValue(6,  ($user['goal'] ?? '') !== '' ? (string)$user['goal'] : null, SQLITE3_NULL);
    $stmt->bindValue(7,  (string)($user['subscriptionStatus'] ?? 'trial'));
    $stmt->bindValue(8,  empty($user['onboardingDone']) ? 0 : 1, SQLITE3_INTEGER);
    $stmt->bindValue(9,  json_encode($user['settings'] ?? []));
    $stmt->bindValue(10, $now);
    $stmt->bindValue(11, $now);
    $stmt->execute();

    ensure_progress($db, $id);
}

// ─── profile.update ──────────────────────────────────────────────

function mut_profile_update(SQLite3 $db, string $uid, array $p): void
{
    $sets = [];
    $vals = [];

    if (isset($p['name']))            { $sets[] = 'name_text = ?'; $vals[] = [trim((string)$p['name']),         SQLITE3_TEXT]; }
    if (array_key_exists('goal', $p)) { $sets[] = 'goal = ?';      $vals[] = [(string)($p['goal'] ?? ''),       SQLITE3_TEXT]; }
    if (isset($p['level']))           { $sets[] = 'level = ?';     $vals[] = [(string)$p['level'],              SQLITE3_TEXT]; }
    if (isset($p['avatar']))          { $sets[] = 'avatar = ?';    $vals[] = [(string)$p['avatar'],             SQLITE3_TEXT]; }
    if (isset($p['country']))         { $sets[] = 'country = ?';   $vals[] = [(string)$p['country'],            SQLITE3_TEXT]; }
    if (isset($p['onboardingDone'])) {
        $sets[] = 'ob_done = ?';
        $vals[] = [(int)(bool)$p['onboardingDone'], SQLITE3_INTEGER];
    }
    if (isset($p['settings'])) {
        $sets[] = 'settings_j = ?';
        $vals[] = [json_encode($p['settings']), SQLITE3_TEXT];
    }

    if (empty($sets)) return;
    $sets[] = 'updated_at = ?';
    $vals[] = [now_iso(), SQLITE3_TEXT];

    $stmt = $db->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?');
    $i = 1;
    foreach ($vals as [$v, $t]) { $stmt->bindValue($i++, $v, $t); }
    $stmt->bindValue($i, $uid);
    $stmt->execute();
}

// ─── lesson.complete ─────────────────────────────────────────────

function mut_lesson_complete(SQLite3 $db, string $uid, array $p): void
{
    $lessonId = (string)($p['lessonId'] ?? '');
    $answers  = is_array($p['answers']  ?? null) ? $p['answers'] : [];

    $wrong    = 0;
    foreach ($answers as $a) {
        if (is_array($a) && empty($a['correct'])) $wrong++;
    }
    $total    = count($answers);
    $xpEarned = max(10, $total > 0 ? $total * 5 - $wrong * 3 : 10);

    $prog   = ensure_progress($db, $uid);
    $today  = today_key();
    $weekId = current_week_id();

    // Reset weekly XP on new week
    $xpWeekly = ((string)$prog['week_id'] === $weekId) ? (int)$prog['xp_weekly'] : 0;

    // Streak
    $lastPrac   = (string)$prog['last_prac'];
    $streakDays = (int)$prog['streak_days'];
    if ($lastPrac === $today) {
        // already practiced today
    } elseif ($lastPrac === '') {
        $streakDays = 1;
    } else {
        $yesterday  = gmdate('Y-m-d', strtotime('-1 day', strtotime($today)));
        $streakDays = ($lastPrac === $yesterday) ? $streakDays + 1 : 1;
    }

    // Daily XP history
    $xpDaily = json_decode((string)$prog['xp_daily_j'], true);
    if (!is_array($xpDaily)) $xpDaily = [];
    $xpDaily[$today] = ($xpDaily[$today] ?? 0) + $xpEarned;

    // Completed lessons list
    $completed = json_decode((string)$prog['completed_j'], true);
    if (!is_array($completed)) $completed = [];
    if ($lessonId !== '' && !in_array($lessonId, $completed, true)) {
        $completed[] = $lessonId;
    }

    $stmt = $db->prepare(<<<SQL
        UPDATE progress SET
            xp_total    = xp_total + ?,
            xp_weekly   = ?,
            xp_daily_j  = ?,
            week_id     = ?,
            streak_days = ?,
            last_prac   = ?,
            completed_j = ?,
            updated_at  = ?
        WHERE user_id = ?
    SQL);
    $stmt->bindValue(1, $xpEarned,                   SQLITE3_INTEGER);
    $stmt->bindValue(2, $xpWeekly + $xpEarned,       SQLITE3_INTEGER);
    $stmt->bindValue(3, json_encode($xpDaily));
    $stmt->bindValue(4, $weekId);
    $stmt->bindValue(5, $streakDays,                  SQLITE3_INTEGER);
    $stmt->bindValue(6, $today);
    $stmt->bindValue(7, json_encode($completed));
    $stmt->bindValue(8, now_iso());
    $stmt->bindValue(9, $uid);
    $stmt->execute();
}

// ─── exercise.wrong ──────────────────────────────────────────────

function mut_exercise_wrong(SQLite3 $db, string $uid, array $p): void
{
    $prog = ensure_progress($db, $uid);

    // Append mistake (keep last 200)
    $mistakes = json_decode((string)$prog['mistakes_j'], true);
    if (!is_array($mistakes)) $mistakes = [];
    $mistakes[] = [
        'lessonId'   => (string)($p['lessonId']   ?? ''),
        'exerciseId' => (string)($p['exerciseId'] ?? ''),
        'userAnswer' => (string)($p['answer']     ?? ''),
        'timestamp'  => now_iso(),
    ];
    if (count($mistakes) > 200) {
        $mistakes = array_slice($mistakes, -200);
    }

    $stmt = $db->prepare(<<<SQL
        UPDATE progress SET
            hearts     = MAX(0, hearts - 1),
            mistakes_j = ?,
            updated_at = ?
        WHERE user_id = ?
    SQL);
    $stmt->bindValue(1, json_encode($mistakes));
    $stmt->bindValue(2, now_iso());
    $stmt->bindValue(3, $uid);
    $stmt->execute();
}

// ─── word.update ─────────────────────────────────────────────────

function mut_word_update(SQLite3 $db, string $uid, array $p): void
{
    $wordId   = (string)($p['wordId']   ?? '');
    $favorite = isset($p['favorite'])   ? (int)(bool)$p['favorite'] : null;
    $status   = isset($p['status'])     ? (string)$p['status']      : null;

    if ($wordId === '') return;

    // Upsert the row first
    $stmt = $db->prepare(<<<SQL
        INSERT INTO user_words (user_id, word_id, favorite, last_seen)
        VALUES (?, ?, COALESCE(?, 0), ?)
        ON CONFLICT(user_id, word_id) DO UPDATE SET
            favorite  = COALESCE(excluded.favorite, favorite),
            last_seen = excluded.last_seen
    SQL);
    $stmt->bindValue(1, $uid);
    $stmt->bindValue(2, $wordId);
    $stmt->bindValue(3, $favorite, ($favorite === null) ? SQLITE3_NULL : SQLITE3_INTEGER);
    $stmt->bindValue(4, now_iso());
    $stmt->execute();

    if ($status !== null) {
        $s = $db->prepare('UPDATE user_words SET status = ? WHERE user_id = ? AND word_id = ?');
        $s->bindValue(1, $status);
        $s->bindValue(2, $uid);
        $s->bindValue(3, $wordId);
        $s->execute();
    }
}

// ─── practice.complete ───────────────────────────────────────────

function mut_practice_complete(SQLite3 $db, string $uid, array $p): void
{
    $results = is_array($p['results'] ?? null) ? $p['results'] : [];
    $prog    = ensure_progress($db, $uid);
    $today   = today_key();
    $weekId  = current_week_id();

    $xpWeekly = ((string)$prog['week_id'] === $weekId) ? (int)$prog['xp_weekly'] : 0;

    $xpDaily = json_decode((string)$prog['xp_daily_j'], true);
    if (!is_array($xpDaily)) $xpDaily = [];
    $xpDaily[$today] = ($xpDaily[$today] ?? 0) + XP_PER_PRACTICE;

    $lastPrac   = (string)$prog['last_prac'];
    $streakDays = (int)$prog['streak_days'];
    if ($lastPrac !== $today) {
        if ($lastPrac === '') {
            $streakDays = 1;
        } else {
            $yesterday  = gmdate('Y-m-d', strtotime('-1 day', strtotime($today)));
            $streakDays = ($lastPrac === $yesterday) ? $streakDays + 1 : 1;
        }
    }

    $stmt = $db->prepare(<<<SQL
        UPDATE progress SET
            xp_total    = xp_total + ?,
            xp_weekly   = ?,
            xp_daily_j  = ?,
            week_id     = ?,
            streak_days = ?,
            last_prac   = ?,
            updated_at  = ?
        WHERE user_id = ?
    SQL);
    $stmt->bindValue(1, XP_PER_PRACTICE,           SQLITE3_INTEGER);
    $stmt->bindValue(2, $xpWeekly + XP_PER_PRACTICE, SQLITE3_INTEGER);
    $stmt->bindValue(3, json_encode($xpDaily));
    $stmt->bindValue(4, $weekId);
    $stmt->bindValue(5, $streakDays,               SQLITE3_INTEGER);
    $stmt->bindValue(6, $today);
    $stmt->bindValue(7, now_iso());
    $stmt->bindValue(8, $uid);
    $stmt->execute();

    // Update word correctness stats
    foreach ($results as $r) {
        if (!is_array($r) || empty($r['wordId'])) continue;
        $wordId  = (string)$r['wordId'];
        $correct = (bool)($r['correct'] ?? false);

        $stmt2 = $db->prepare(<<<SQL
            INSERT INTO user_words (user_id, word_id, corrects, mistakes, last_seen)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, word_id) DO UPDATE SET
                corrects  = corrects + excluded.corrects,
                mistakes  = mistakes + excluded.mistakes,
                last_seen = excluded.last_seen,
                status    = CASE
                    WHEN (corrects + excluded.corrects) >= 5 THEN 'mastered'
                    WHEN (corrects + excluded.corrects) >= 2 THEN 'practicing'
                    ELSE status
                END
        SQL);
        $stmt2->bindValue(1, $uid);
        $stmt2->bindValue(2, $wordId);
        $stmt2->bindValue(3, $correct ? 1 : 0, SQLITE3_INTEGER);
        $stmt2->bindValue(4, $correct ? 0 : 1, SQLITE3_INTEGER);
        $stmt2->bindValue(5, now_iso());
        $stmt2->execute();
    }
}

// ─── hearts.restore ──────────────────────────────────────────────

function mut_hearts_restore(SQLite3 $db, string $uid): void
{
    $stmt = $db->prepare('UPDATE progress SET hearts = max_hearts, updated_at = ? WHERE user_id = ?');
    $stmt->bindValue(1, now_iso());
    $stmt->bindValue(2, $uid);
    $stmt->execute();
}

// ─── lesson.upsert ───────────────────────────────────────────────

function mut_lesson_upsert(SQLite3 $db, string $uid, array $p): void
{
    $lesson = is_array($p['lesson'] ?? null) ? $p['lesson'] : $p;
    if (empty($lesson['id'])) return;

    $stmt = $db->prepare(<<<SQL
        INSERT INTO lessons (id, data_json, published, created_by, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            data_json  = excluded.data_json,
            published  = excluded.published,
            updated_at = excluded.updated_at
    SQL);
    $stmt->bindValue(1, (string)$lesson['id']);
    $stmt->bindValue(2, json_encode($lesson, JSON_UNESCAPED_UNICODE));
    $stmt->bindValue(3, empty($lesson['published']) ? 0 : 1, SQLITE3_INTEGER);
    $stmt->bindValue(4, $uid);
    $stmt->bindValue(5, now_iso());
    $stmt->execute();
}

// ─── admin.user.update ───────────────────────────────────────────

function mut_admin_user_update(SQLite3 $db, array $p): void
{
    $targetId = (string)($p['userId'] ?? '');
    if ($targetId === '') return;

    $sets = [];
    $vals = [];
    if (isset($p['role']))               { $sets[] = 'role = ?';       $vals[] = [(string)$p['role'],               SQLITE3_TEXT]; }
    if (isset($p['isBlocked']))          { $sets[] = 'is_blocked = ?'; $vals[] = [(int)(bool)$p['isBlocked'],       SQLITE3_INTEGER]; }
    if (isset($p['subscriptionStatus'])){ $sets[] = 'sub_status = ?'; $vals[] = [(string)$p['subscriptionStatus'], SQLITE3_TEXT]; }
    if (isset($p['trialEndsAt']))        { $sets[] = 'trial_ends = ?'; $vals[] = [(string)$p['trialEndsAt'],        SQLITE3_TEXT]; }
    if (isset($p['level']))              { $sets[] = 'level = ?';      $vals[] = [(string)$p['level'],              SQLITE3_TEXT]; }

    if (empty($sets)) return;
    $sets[] = 'updated_at = ?';
    $vals[] = [now_iso(), SQLITE3_TEXT];

    $stmt = $db->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?');
    $i = 1;
    foreach ($vals as [$v, $t]) { $stmt->bindValue($i++, $v, $t); }
    $stmt->bindValue($i, $targetId);
    $stmt->execute();
}

// ══════════════════════════════════════════════════════════════════
// DB utilities
// ══════════════════════════════════════════════════════════════════

function ensure_progress(SQLite3 $db, string $uid): array
{
    $stmt = $db->prepare('SELECT * FROM progress WHERE user_id = ? LIMIT 1');
    $stmt->bindValue(1, $uid);
    $res = $stmt->execute();
    $row = $res ? $res->fetchArray(SQLITE3_ASSOC) : false;
    if ($row) return $row;

    $ins = $db->prepare('INSERT OR IGNORE INTO progress (user_id, updated_at) VALUES (?, ?)');
    $ins->bindValue(1, $uid);
    $ins->bindValue(2, now_iso());
    $ins->execute();

    $stmt->reset();
    $res = $stmt->execute();
    return ($res ? $res->fetchArray(SQLITE3_ASSOC) : false) ?: [];
}

function db_get_user_words(SQLite3 $db, string $uid): array
{
    $stmt = $db->prepare('SELECT * FROM user_words WHERE user_id = ?');
    $stmt->bindValue(1, $uid);
    $res  = $stmt->execute();
    $rows = [];
    while ($res && ($row = $res->fetchArray(SQLITE3_ASSOC))) {
        $rows[] = [
            'userId'       => $uid,
            'wordId'       => $row['word_id'],
            'status'       => $row['status'],
            'mistakeCount' => (int)$row['mistakes'],
            'correctCount' => (int)$row['corrects'],
            'favorite'     => (bool)$row['favorite'],
            'lastSeenAt'   => $row['last_seen'],
        ];
    }
    return $rows;
}

function db_get_published_lessons(SQLite3 $db): array
{
    $res     = $db->query('SELECT data_json FROM lessons WHERE published = 1 ORDER BY rowid');
    $lessons = [];
    while ($res && ($row = $res->fetchArray(SQLITE3_ASSOC))) {
        $l = json_decode((string)$row['data_json'], true);
        if (is_array($l)) $lessons[] = $l;
    }
    return $lessons;
}

function db_get_all_lessons(SQLite3 $db): array
{
    $res     = $db->query('SELECT data_json FROM lessons ORDER BY rowid');
    $lessons = [];
    while ($res && ($row = $res->fetchArray(SQLITE3_ASSOC))) {
        $l = json_decode((string)$row['data_json'], true);
        if (is_array($l)) $lessons[] = $l;
    }
    return $lessons;
}

// ── FCM token endpoint ────────────────────────────────────────────

function handle_user_fcm_token(SQLite3 $db): never
{
    init_session();
    $uid   = require_auth();
    $token = trim((string)(body()['token'] ?? ''));
    if ($token === '') fail('Token required', 422);
    $plat  = trim((string)(body()['platform'] ?? 'web'));

    $stmt = $db->prepare(
        'INSERT INTO fcm_tokens (token, user_id, platform, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, created_at = excluded.created_at'
    );
    $stmt->bindValue(1, $token);
    $stmt->bindValue(2, $uid);
    $stmt->bindValue(3, $plat);
    $stmt->bindValue(4, now_iso());
    $stmt->execute();
    respond(['ok' => true]);
}

// ── Save reminder time ────────────────────────────────────────────

function handle_user_reminder(SQLite3 $db): never
{
    init_session();
    $uid  = require_auth();
    $b    = body();
    $time = isset($b['time']) ? trim((string)$b['time']) : null;

    if ($time !== null && $time !== '' && !preg_match('/^\d{2}:\d{2}$/', $time)) {
        fail('Невірний формат часу (очікується HH:MM)', 422);
    }

    $row = $db->querySingle("SELECT settings_j FROM users WHERE id = '" . SQLite3::escapeString($uid) . "'", true);
    if (!$row) fail('Користувача не знайдено', 404);

    $settings = json_decode((string)$row['settings_j'], true) ?? [];
    if ($time === null || $time === '') {
        unset($settings['reminderTime']);
    } else {
        $settings['reminderTime'] = $time;
    }

    $stmt = $db->prepare('UPDATE users SET settings_j = ?, updated_at = ? WHERE id = ?');
    $stmt->bindValue(1, json_encode($settings, JSON_UNESCAPED_UNICODE));
    $stmt->bindValue(2, now_iso());
    $stmt->bindValue(3, $uid);
    $stmt->execute();
    respond(['ok' => true]);
}

// ── Process referral ──────────────────────────────────────────────

function handle_user_referral(SQLite3 $db): never
{
    init_session();
    $uid        = require_auth();
    $referrerId = trim((string)(body()['referrerId'] ?? ''));

    if ($referrerId === '' || $referrerId === $uid) respond(['ok' => true]);

    // Only honour first referral per user
    $cur = $db->querySingle("SELECT referred_by FROM users WHERE id = '" . SQLite3::escapeString($uid) . "'", true);
    if (!$cur || (string)$cur['referred_by'] !== '') respond(['ok' => true]);

    // Verify referrer exists and is active
    $esc = SQLite3::escapeString($referrerId);
    $ref = $db->querySingle("SELECT id, name_text FROM users WHERE id = '$esc' AND is_blocked = 0 LIMIT 1", true);
    if (!$ref) respond(['ok' => true]);

    // Mark this user as referred
    $stmt = $db->prepare('UPDATE users SET referred_by = ?, updated_at = ? WHERE id = ?');
    $stmt->bindValue(1, $referrerId);
    $stmt->bindValue(2, now_iso());
    $stmt->bindValue(3, $uid);
    $stmt->execute();

    // Award +1 streak freeze to the referrer
    $stmt2 = $db->prepare('UPDATE progress SET freeze_cnt = freeze_cnt + 1, updated_at = ? WHERE user_id = ?');
    $stmt2->bindValue(1, now_iso());
    $stmt2->bindValue(2, $referrerId);
    $stmt2->execute();

    // Notify the referrer via push (best-effort)
    $tokenRow = $db->querySingle("SELECT token FROM fcm_tokens WHERE user_id = '$esc' ORDER BY created_at DESC LIMIT 1", true);
    if ($tokenRow && !empty($tokenRow['token'])) {
        $newUser = $db->querySingle("SELECT name_text FROM users WHERE id = '" . SQLite3::escapeString($uid) . "'", true);
        $name    = $newUser ? (string)$newUser['name_text'] : 'Новий учень';
        fcm_send(
            (string)$tokenRow['token'],
            '🎉 Друг приєднався!',
            "$name почав вивчати словацьку. Ти отримав ❄️ заморозку серії!",
            ['tag' => 'referral']
        );
    }

    respond(['ok' => true]);
}

// ── Admin broadcast push ──────────────────────────────────────────

function handle_admin_notify(SQLite3 $db): never
{
    init_session();
    $uid = require_auth();
    require_role($db, $uid, 'admin');

    $b      = body();
    $title  = trim((string)($b['title']  ?? ''));
    $body   = trim((string)($b['body']   ?? ''));
    $target = trim((string)($b['target'] ?? 'all'));

    if ($title === '' || $body === '') fail('title і body обовʼязкові', 422);

    // Build parameterised query depending on audience
    $allowedStatic = ['students' => "u.role = 'student'", 'plus' => "u.sub_status = 'plus'", 'all' => '1=1'];

    if (array_key_exists($target, $allowedStatic)) {
        $res = $db->query(
            "SELECT ft.token FROM users u
             JOIN fcm_tokens ft ON ft.user_id = u.id
             WHERE u.is_blocked = 0 AND {$allowedStatic[$target]}"
        );
    } elseif (str_starts_with($target, 'level:')) {
        $level = substr($target, 6);
        $stmt  = $db->prepare(
            'SELECT ft.token FROM users u
             JOIN fcm_tokens ft ON ft.user_id = u.id
             WHERE u.is_blocked = 0 AND u.level = ?'
        );
        $stmt->bindValue(1, $level);
        $res = $stmt->execute();
    } else {
        fail('Невідомий target', 422);
    }

    $sent = 0;
    while ($res && ($row = $res->fetchArray(SQLITE3_ASSOC))) {
        fcm_send((string)$row['token'], $title, $body, ['tag' => 'admin']);
        $sent++;
    }
    respond(['ok' => true, 'sent' => $sent]);
}

// ── Daily push cron ───────────────────────────────────────────────
// Cron: run EVERY HOUR  →  0 * * * *
// e.g.  GET https://yourdomain.com/api/index.php/cron/push?key=YOUR_CRON_SECRET
// Each user is notified only once per day, at the hour matching their reminderTime setting.

function handle_cron_push(SQLite3 $db): never
{
    $key      = trim((string)($_GET['key'] ?? ''));
    $expected = (string)(getenv('CRON_SECRET') ?: '');
    if ($expected === '' || !hash_equals($expected, $key)) fail('Unauthorized', 401);

    $today   = today_key();
    $nowHour = gmdate('H'); // "09", "14", etc. — UTC
    $sent    = 0;

    $res = $db->query(
        'SELECT u.id, u.name_text, u.sub_status, u.trial_ends, u.settings_j,
                p.last_prac, p.streak_days, p.last_reminder_date,
                ft.token
         FROM users u
         JOIN fcm_tokens ft  ON ft.user_id  = u.id
         JOIN progress    p  ON p.user_id   = u.id
         WHERE u.is_blocked = 0'
    );
    if (!$res) respond(['ok' => true, 'sent' => 0]);

    while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
        $settings = json_decode((string)$row['settings_j'], true) ?? [];
        if (empty($settings['notificationsEnabled'])) continue;

        $reminderTime = trim((string)($settings['reminderTime'] ?? ''));
        $token        = (string)$row['token'];
        $lastPrac     = (string)($row['last_prac'] ?? '');
        $lastReminder = (string)($row['last_reminder_date'] ?? '');

        // Skip users who haven't set a reminder time
        if ($reminderTime === '') continue;

        // Already sent today — skip
        if ($lastReminder === $today) continue;

        // Check whether the reminder hour matches current UTC hour
        $remHour = substr($reminderTime, 0, 2);
        if ($remHour !== $nowHour) continue;

        // Determine message (priority: streak > trial > daily lesson)
        $title = '';
        $body  = '';
        $tag   = 'reminder';

        if ($lastPrac !== '' && $lastPrac < $today) {
            // Streak at risk
            $streak = (int)$row['streak_days'];
            $title  = '🔥 Серія під загрозою!';
            $body   = "Серія $streak " . plural_days($streak) . " закінчиться опівночі. Не переривай!";
            $tag    = 'streak';
        } elseif ($row['sub_status'] === 'trial' && !empty($row['trial_ends'])) {
            $days = (int)round((strtotime((string)$row['trial_ends']) - time()) / 86400);
            if ($days >= 0 && $days <= 3) {
                $d     = $days === 1 ? '1 день' : "$days дні";
                $title = '⏳ Пробний доступ закінчується';
                $body  = "Залишилось $d. Переходь на Plus щоб не втратити прогрес!";
                $tag   = 'trial';
            }
        }

        if ($title === '') {
            $name  = (string)$row['name_text'];
            $title = '📚 Час вчити словацьку!';
            $body  = "$name, твій щоденний урок чекає.";
        }

        fcm_send($token, $title, $body, ['tag' => $tag, 'click_action' => '/app/path']);

        // Mark reminder as sent so we don't duplicate within the same day
        $mark = $db->prepare('UPDATE progress SET last_reminder_date = ? WHERE user_id = ?');
        $mark->bindValue(1, $today);
        $mark->bindValue(2, (string)$row['id']);
        $mark->execute();

        $sent++;
    }
    respond(['ok' => true, 'sent' => $sent]);
}

function plural_days(int $n): string
{
    $n = abs($n) % 100;
    $n1 = $n % 10;
    if ($n >= 11 && $n <= 19) return 'днів';
    if ($n1 === 1) return 'день';
    if ($n1 >= 2 && $n1 <= 4) return 'дні';
    return 'днів';
}

// ── Weekly report push cron ───────────────────────────────────────
// Set up cron on shared hosting: GET https://yourdomain.com/api/index.php/cron/weekly?key=YOUR_CRON_SECRET
// Run every Sunday at 18:00 UTC: 0 18 * * 0

function handle_cron_weekly(SQLite3 $db): never
{
    $key      = trim((string)($_GET['key'] ?? ''));
    $expected = (string)(getenv('CRON_SECRET') ?: '');
    if ($expected === '' || !hash_equals($expected, $key)) fail('Unauthorized', 401);

    $sent = 0;

    $res = $db->query(
        'SELECT u.id, u.name_text, u.settings_j,
                p.xp_weekly, p.streak_days, p.completed_j,
                ft.token
         FROM users u
         JOIN fcm_tokens ft ON ft.user_id = u.id
         JOIN progress p ON p.user_id = u.id
         WHERE u.is_blocked = 0'
    );
    if (!$res) respond(['ok' => true, 'sent' => 0]);

    while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
        $settings = json_decode((string)$row['settings_j'], true) ?? [];
        if (empty($settings['notificationsEnabled'])) continue;

        $xpWeekly   = (int)$row['xp_weekly'];
        $streak     = (int)$row['streak_days'];
        $completed  = json_decode((string)$row['completed_j'], true) ?? [];
        $lessonsNum = count($completed);
        $name       = (string)$row['name_text'];
        $token      = (string)$row['token'];

        if ($xpWeekly === 0) continue; // user was inactive — skip

        $body = "{$name}, цього тижня: {$xpWeekly} XP, {$lessonsNum} уроків, серія {$streak} днів 🎉";
        fcm_send($token, '📊 Твій тижневий звіт', $body, ['tag' => 'weekly']);
        $sent++;
    }
    respond(['ok' => true, 'sent' => $sent]);
}

// ── Scenario helpers ──────────────────────────────────────────────

function scenario_phrase_for_goal(string $goal): ?string
{
    $map = [
        'лікар'     => ['Mám bolesti brucha. — У мене болить живіт.',
                        'Kde je lekáreň? — Де аптека?',
                        'Potrebujem recept. — Мені потрібен рецепт.'],
        'doctor'    => ['Mám bolesti brucha. — У мене болить живіт.',
                        'Kde je lekáreň? — Де аптека?',
                        'Potrebujem recept. — Мені потрібен рецепт.'],
        'документ'  => ['Kde je cudzinecká polícia? — Де міграційна поліція?',
                        'Potrebujem predĺžiť povolenie. — Мені потрібно продовжити дозвіл.',
                        'Kedy bude hotové? — Коли буде готово?'],
        'documents' => ['Kde je cudzinecká polícia? — Де міграційна поліція?',
                        'Potrebujem predĺžiť povolenie. — Мені потрібно продовжити дозвіл.',
                        'Kedy bude hotové? — Коли буде готово?'],
        'робот'     => ['Hľadám prácu. — Я шукаю роботу.',
                        'Kedy dostanem výplatu? — Коли я отримаю зарплату?',
                        'Potrebujem dovolenku. — Мені потрібна відпустка.'],
        'work'      => ['Hľadám prácu. — Я шукаю роботу.',
                        'Kedy dostanem výplatu? — Коли я отримаю зарплату?',
                        'Potrebujem dovolenku. — Мені потрібна відпустка.'],
        'оренд'     => ['Hľadám byt na prenájom. — Я шукаю квартиру для оренди.',
                        'Koľko stojí nájom? — Скільки коштує оренда?',
                        'Kedy môžem nastúpiť? — Коли я можу заселитися?'],
        'rent'      => ['Hľadám byt na prenájom. — Я шукаю квартиру для оренди.',
                        'Koľko stojí nájom? — Скільки коштує оренда?',
                        'Kedy môžem nastúpiť? — Коли я можу заселитися?'],
        'транспорт' => ['Kde je zastávka autobusu? — Де зупинка автобуса?',
                        'Koľko stojí lístok? — Скільки коштує квиток?',
                        'Meškáme. — Ми запізнюємося.'],
        'transport' => ['Kde je zastávka autobusu? — Де зупинка автобуса?',
                        'Koľko stojí lístok? — Скільки коштує квиток?',
                        'Meškáme. — Ми запізнюємося.'],
        'школ'      => ['Kde je základná škola? — Де початкова школа?',
                        'Kedy začína škola? — Коли починається школа?',
                        'Aké doklady treba? — Які документи потрібні?'],
        'school'    => ['Kde je základná škola? — Де початкова школа?',
                        'Kedy začína škola? — Коли починається школа?',
                        'Aké doklady treba? — Які документи потрібні?'],
    ];

    $phrases = null;
    foreach ($map as $keyword => $list) {
        if (str_contains($goal, $keyword)) {
            $phrases = $list;
            break;
        }
    }
    if (!$phrases) {
        $phrases = ['Dobrý deň! — Добрий день!',
                    'Ďakujem. — Дякую.',
                    'Nerozumiem. — Я не розумію.'];
    }

    $dayNum = (int)floor(time() / 86400);
    return $phrases[$dayNum % count($phrases)];
}

// ── FCM HTTP v1 helpers ───────────────────────────────────────────

function b64u(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function fcm_access_token(): ?string
{
    $sa_path = (string)(getenv('FIREBASE_SA_JSON') ?: '');
    if ($sa_path === '' || !file_exists($sa_path)) return null;

    $sa = json_decode((string)file_get_contents($sa_path), true);
    if (empty($sa['client_email']) || empty($sa['private_key'])) return null;

    $now    = time();
    $header = b64u((string)json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
    $claim  = b64u((string)json_encode([
        'iss'   => $sa['client_email'],
        'sub'   => $sa['client_email'],
        'aud'   => 'https://oauth2.googleapis.com/token',
        'iat'   => $now,
        'exp'   => $now + 3600,
        'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
    ]));
    $input = "$header.$claim";
    $key   = openssl_pkey_get_private((string)$sa['private_key']);
    if (!$key) return null;
    openssl_sign($input, $sig, $key, OPENSSL_ALGO_SHA256);

    $jwt  = "$input." . b64u($sig);
    $ch   = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query(['grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer', 'assertion' => $jwt]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
    ]);
    $resp = json_decode((string)curl_exec($ch), true);
    curl_close($ch);
    return $resp['access_token'] ?? null;
}

function fcm_send(string $token, string $title, string $body, array $data = []): void
{
    $project = (string)(getenv('FIREBASE_PROJECT_ID') ?: '');
    if ($project === '') return;
    $at = fcm_access_token();
    if ($at === null) return;

    $msg = json_encode([
        'message' => [
            'token'        => $token,
            'notification' => ['title' => $title, 'body' => $body],
            'data'         => array_map('strval', $data),
            'webpush'      => [
                'notification' => ['icon' => '/favicon.svg', 'tag' => $data['tag'] ?? 'slovaklife'],
                'fcm_options'  => ['link' => '/app/path'],
            ],
        ],
    ]);
    $ch = curl_init("https://fcm.googleapis.com/v1/projects/{$project}/messages:send");
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $msg,
        CURLOPT_HTTPHEADER     => ["Authorization: Bearer $at", 'Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
    ]);
    curl_exec($ch);
    curl_close($ch);
}

function row_to_user(array $row): array
{
    return [
        'id'                 => $row['id'],
        'email'              => $row['email'],
        'name'               => $row['name_text'],
        'role'               => $row['role'],
        'level'              => $row['level'],
        'goal'               => $row['goal']       ?? null,
        'avatar'             => $row['avatar']     ?? null,
        'country'            => $row['country']    ?? null,
        'subscriptionStatus' => $row['sub_status'],
        'trialEndsAt'        => $row['trial_ends'] ?? null,
        'onboardingDone'     => (bool)$row['ob_done'],
        'settings'           => json_decode((string)$row['settings_j'], true) ?? [],
        'createdAt'          => $row['created_at'],
        'updatedAt'          => $row['updated_at'],
    ];
}

// ══════════════════════════════════════════════════════════════════
// Stripe billing
// ══════════════════════════════════════════════════════════════════

function stripe_load(): void
{
    $autoload = dirname(__DIR__, 2) . '/vendor/autoload.php';
    if (!file_exists($autoload)) {
        fail('Stripe SDK не встановлено. Виконайте: composer require stripe/stripe-php', 503);
    }
    require_once $autoload;
    \Stripe\Stripe::setApiKey((string)getenv('STRIPE_SECRET_KEY'));
}

// POST /billing/checkout — creates Stripe Checkout session, returns redirect URL
function handle_billing_checkout(SQLite3 $db): never
{
    stripe_load();
    $uid  = require_auth();
    $stmt = $db->prepare('SELECT email, stripe_customer_id FROM users WHERE id = ? LIMIT 1');
    $stmt->bindValue(1, $uid);
    $res  = $stmt->execute();
    $row  = $res ? $res->fetchArray(SQLITE3_ASSOC) : false;
    if (!$row) fail('Користувача не знайдено', 404);

    $priceId = (string)getenv('STRIPE_PRICE_ID');
    if ($priceId === '') fail('STRIPE_PRICE_ID не налаштовано', 503);

    $appUrl = rtrim((string)(getenv('APP_URL') ?: 'http://localhost:5173'), '/');
    $params = [
        'mode'                  => 'subscription',
        'client_reference_id'   => $uid,
        'line_items'            => [['price' => $priceId, 'quantity' => 1]],
        'success_url'           => $appUrl . '/app/shop?subscribed=1',
        'cancel_url'            => $appUrl . '/app/shop',
        'allow_promotion_codes' => true,
    ];
    $customerId = (string)($row['stripe_customer_id'] ?? '');
    if ($customerId !== '') {
        $params['customer'] = $customerId;
    } else {
        $params['customer_email'] = (string)$row['email'];
    }

    $session = \Stripe\Checkout\Session::create($params);
    respond(['url' => $session->url]);
}

// POST /billing/portal — opens Stripe Customer Portal (manage/cancel subscription)
function handle_billing_portal(SQLite3 $db): never
{
    stripe_load();
    $uid  = require_auth();
    $stmt = $db->prepare('SELECT stripe_customer_id FROM users WHERE id = ? LIMIT 1');
    $stmt->bindValue(1, $uid);
    $res  = $stmt->execute();
    $row  = $res ? $res->fetchArray(SQLITE3_ASSOC) : false;
    $customerId = (string)($row['stripe_customer_id'] ?? '');
    if ($customerId === '') fail('Білінговий акаунт не знайдено', 404);

    $appUrl  = rtrim((string)(getenv('APP_URL') ?: 'http://localhost:5173'), '/');
    $session = \Stripe\BillingPortal\Session::create([
        'customer'   => $customerId,
        'return_url' => $appUrl . '/app/shop',
    ]);
    respond(['url' => $session->url]);
}

// POST /billing/webhook — called by Stripe, verified via HMAC signature (no session auth)
function handle_billing_webhook(SQLite3 $db): never
{
    stripe_load();
    $payload = (string)(file_get_contents('php://input') ?: '');
    $sig     = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';
    $secret  = (string)getenv('STRIPE_WEBHOOK_SECRET');

    try {
        $event = \Stripe\Webhook::constructEvent($payload, $sig, $secret);
    } catch (\Exception) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid signature']);
        exit;
    }

    $type = $event->type;
    $obj  = $event->data->object;

    if ($type === 'checkout.session.completed') {
        $uid        = (string)($obj->client_reference_id ?? '');
        $customerId = (string)($obj->customer ?? '');
        $subId      = (string)($obj->subscription ?? '');
        if ($uid === '') respond(['ok' => true]);

        $ends = date('Y-m-d H:i:s', strtotime('+1 month'));
        $stmt = $db->prepare(
            'UPDATE users SET sub_status = ?, trial_ends = ?, stripe_customer_id = ?, stripe_sub_id = ?, updated_at = ? WHERE id = ?'
        );
        $stmt->bindValue(1, 'plus');
        $stmt->bindValue(2, $ends);
        $stmt->bindValue(3, $customerId);
        $stmt->bindValue(4, $subId);
        $stmt->bindValue(5, date('Y-m-d H:i:s'));
        $stmt->bindValue(6, $uid);
        $stmt->execute();
    }

    if ($type === 'customer.subscription.deleted') {
        $customerId = (string)($obj->customer ?? '');
        if ($customerId !== '') {
            $stmt = $db->prepare(
                'UPDATE users SET sub_status = ?, updated_at = ? WHERE stripe_customer_id = ?'
            );
            $stmt->bindValue(1, 'free');
            $stmt->bindValue(2, date('Y-m-d H:i:s'));
            $stmt->bindValue(3, $customerId);
            $stmt->execute();
        }
    }

    respond(['ok' => true]);
}
