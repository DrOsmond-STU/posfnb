<?php
/**
 * Racik POS API · front controller
 * Semua permintaan /api/* diarahkan ke berkas ini oleh .htaccess.
 */
declare(strict_types=1);

require __DIR__ . '/src/bootstrap.php';

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = '/' . trim((string) preg_replace('#^.*?/api(/|$)#', '', $path), '/');
$method = Http::method();

// [metode, pola path, handler]
$routes = [
    ['GET',  '#^/health$#',                  function () {
        $db = (bool) Db::one('SELECT 1 AS ok');
        Http::json(200, ['ok' => true, 'db' => $db, 'time' => gmdate('c')]);
    }],
    ['GET',  '#^/auth/me$#',                 [Auth::class, 'me']],
    ['POST', '#^/auth/login$#',              [Auth::class, 'login']],
    ['GET',  '#^/auth/pin-users$#',          [Auth::class, 'pinUsers']],
    ['POST', '#^/auth/pin$#',                [Auth::class, 'pinLogin']],
    ['POST', '#^/auth/lock$#',               [Auth::class, 'lock']],
    ['POST', '#^/auth/unlock$#',             [Auth::class, 'unlock']],
    ['POST', '#^/auth/logout$#',             [Auth::class, 'logout']],
    ['PUT',  '#^/auth/me/credentials$#',     [Auth::class, 'changeCredentials']],
    ['GET',  '#^/auth/approvers$#',          [Auth::class, 'approvers']],
    ['POST', '#^/auth/approve$#',            [Auth::class, 'approve']],
    ['GET',  '#^/staff$#',                   [Auth::class, 'staff']],
    ['POST', '#^/audit$#',                   [Auth::class, 'clientAudit']],
    ['GET',  '#^/users$#',                   [Users::class, 'list']],
    ['POST', '#^/users$#',                   function () { Users::save(null); }],
    ['PUT',  '#^/users/(\d+)$#',             function ($id) { Users::save((int) $id); }],
    ['GET',  '#^/roles$#',                   [Users::class, 'roles']],
    ['PUT',  '#^/roles/([a-z]+)/permissions$#', function ($id) { Users::setPermission($id); }],
    ['GET',  '#^/audit-logs$#',              [Users::class, 'auditLogs']],
];

try {
    $allowed = [];
    foreach ($routes as [$m, $pattern, $handler]) {
        if (!preg_match($pattern, $path, $args)) {
            continue;
        }
        if ($m !== $method) {
            $allowed[] = $m;
            continue;
        }
        array_shift($args);
        call_user_func_array($handler, $args);
        exit;
    }
    if ($allowed) {
        header('Allow: ' . implode(', ', $allowed));
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode tidak diizinkan.');
    }
    throw new ApiError(404, 'NOT_FOUND', 'Endpoint tidak ditemukan.');
} catch (ApiError $e) {
    Http::error($e);
} catch (Throwable $e) {
    error_log('[racikpos] ' . get_class($e) . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    Http::json(500, ['error' => ['code' => 'SERVER_ERROR', 'message' => 'Terjadi kesalahan di server. Coba lagi.', 'details' => (object) []]]);
}
