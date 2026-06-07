<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$allowed_origins = ['http://localhost:5173', 'http://localhost:4173'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

const DEV_PASSWORD = 'password123';

$storageDir = __DIR__ . '/storage';
$stateFile = $storageDir . '/state.json';

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function read_body(): array
{
    $raw = file_get_contents('php://input') ?: '{}';
    $json = json_decode($raw, true);
    if (!is_array($json)) {
        respond(['ok' => false, 'error' => 'Некоректний JSON'], 400);
    }
    return $json;
}

function ensure_storage(): void
{
    global $storageDir, $stateFile;
    if (!is_dir($storageDir)) {
        mkdir($storageDir, 0755, true);
    }
    if (!file_exists($stateFile)) {
        file_put_contents($stateFile, json_encode([
            'revision' => 1,
            'users' => [
                [
                    'id' => 'user-student',
                    'email' => 'student@slovaklife.local',
                    'name' => 'Олена',
                    'role' => 'student',
                    'level' => 'A1',
                    'subscriptionStatus' => 'trial',
                    'onboardingDone' => true
                ],
                [
                    'id' => 'user-teacher',
                    'email' => 'teacher@slovaklife.local',
                    'name' => 'Викладач',
                    'role' => 'teacher',
                    'level' => 'B2',
                    'subscriptionStatus' => 'plus',
                    'onboardingDone' => true
                ],
                [
                    'id' => 'user-admin',
                    'email' => 'admin@slovaklife.local',
                    'name' => 'Адмін',
                    'role' => 'admin',
                    'level' => 'C1',
                    'subscriptionStatus' => 'plus',
                    'onboardingDone' => true
                ]
            ],
            'mutations' => [],
            'clients' => [],
            'updatedAt' => gmdate('c')
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
    }
}

function load_state(): array
{
    global $stateFile;
    ensure_storage();
    $state = json_decode((string) file_get_contents($stateFile), true);
    return is_array($state) ? $state : ['revision' => 1, 'users' => [], 'mutations' => [], 'clients' => [], 'updatedAt' => gmdate('c')];
}

function save_state(array $state): void
{
    global $stateFile;
    $state['updatedAt'] = gmdate('c');
    file_put_contents($stateFile, json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), LOCK_EX);
}

function path(): string
{
    $path = $_SERVER['PATH_INFO'] ?? '';
    if ($path !== '') {
        return '/' . trim($path, '/');
    }
    $uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $marker = '/index.php';
    $pos = strpos($uriPath, $marker);
    if ($pos !== false) {
        return '/' . trim(substr($uriPath, $pos + strlen($marker)), '/');
    }
    return '/' . trim($uriPath, '/');
}

function token_for(array $user): string
{
    return 'dev-' . ($user['id'] ?? 'unknown');
}

function set_auth_cookie(string $token): void
{
    setcookie('sl_token', $token, [
        'expires'  => time() + 86400 * 30,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Strict',
        'secure'   => false
    ]);
}

function clear_auth_cookie(): void
{
    setcookie('sl_token', '', [
        'expires'  => time() - 3600,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Strict',
        'secure'   => false
    ]);
}

function current_user(array $state): ?array
{
    $token = $_COOKIE['sl_token'] ?? '';
    if ($token === '') return null;
    foreach ($state['users'] as $user) {
        if (token_for($user) === $token) return $user;
    }
    return null;
}

$route = path();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$state = load_state();

if ($method === 'GET' && ($route === '/' || $route === '/health')) {
    respond(['ok' => true, 'revision' => $state['revision'], 'updatedAt' => $state['updatedAt']]);
}

if ($method === 'POST' && $route === '/auth/login') {
    $body = read_body();
    $email = strtolower(trim((string) ($body['email'] ?? '')));
    $password = (string) ($body['password'] ?? '');
    foreach ($state['users'] as $user) {
        if (strtolower((string) ($user['email'] ?? '')) === $email && $password === DEV_PASSWORD) {
            set_auth_cookie(token_for($user));
            respond(['ok' => true, 'user' => $user]);
        }
    }
    respond(['ok' => false, 'error' => 'Невірний email або пароль'], 401);
}

if ($method === 'POST' && $route === '/auth/logout') {
    clear_auth_cookie();
    respond(['ok' => true]);
}

if ($method === 'POST' && $route === '/auth/register') {
    $body = read_body();
    $email = strtolower(trim((string) ($body['email'] ?? '')));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        respond(['ok' => false, 'error' => 'Введіть коректний email'], 422);
    }
    foreach ($state['users'] as $user) {
        if (strtolower((string) ($user['email'] ?? '')) === $email) {
            respond(['ok' => false, 'error' => 'Email вже зареєстрований'], 409);
        }
    }
    $user = [
        'id' => 'user-' . bin2hex(random_bytes(8)),
        'email' => $email,
        'name' => trim((string) ($body['name'] ?? 'Студент')),
        'role' => 'student',
        'level' => 'A0',
        'subscriptionStatus' => 'trial',
        'onboardingDone' => false,
        'createdAt' => gmdate('c')
    ];
    $state['users'][] = $user;
    $state['revision'] = ((int) $state['revision']) + 1;
    save_state($state);
    set_auth_cookie(token_for($user));
    respond(['ok' => true, 'user' => $user], 201);
}

if ($method === 'POST' && $route === '/sync/push') {
    if (current_user($state) === null) {
        respond(['ok' => false, 'error' => 'Неавторизовано'], 401);
    }
    $body = read_body();
    $clientId = trim((string) ($body['clientId'] ?? 'anonymous'));
    $mutations = $body['mutations'] ?? [];
    if (!is_array($mutations)) {
        respond(['ok' => false, 'error' => 'mutations має бути масивом'], 422);
    }
    $applied = 0;
    $known = array_column($state['mutations'], 'id');
    foreach ($mutations as $mutation) {
        if (!is_array($mutation) || empty($mutation['id']) || in_array($mutation['id'], $known, true)) {
            continue;
        }
        $state['revision'] = ((int) $state['revision']) + 1;
        $mutation['clientId'] = $clientId;
        $mutation['serverRevision'] = $state['revision'];
        $mutation['serverReceivedAt'] = gmdate('c');
        $state['mutations'][] = $mutation;
        $known[] = $mutation['id'];
        $applied++;
    }
    $state['clients'][$clientId] = ['lastSeenAt' => gmdate('c')];
    if ($applied > 0) {
        save_state($state);
    }
    respond(['ok' => true, 'applied' => $applied, 'revision' => $state['revision']]);
}

if ($method === 'GET' && $route === '/sync/pull') {
    if (current_user($state) === null) {
        respond(['ok' => false, 'error' => 'Неавторизовано'], 401);
    }
    $since = isset($_GET['since']) ? (int) $_GET['since'] : 0;
    respond([
        'ok' => true,
        'revision' => $state['revision'],
        'mutations' => array_values(array_filter($state['mutations'], fn ($mutation) => ((int) ($mutation['serverRevision'] ?? 0)) > $since)),
        'snapshot' => $state
    ]);
}

respond(['ok' => false, 'error' => 'Маршрут не знайдено', 'route' => $route], 404);
