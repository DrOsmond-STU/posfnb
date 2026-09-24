<?php
/**
 * Racik POS · membuat akun pengguna dari berkas JSON (CLI saja).
 *   php api/bin/seed-users.php /path/ke/users.json
 * Format JSON: [{"name":"...","email":"...","role":"kasir","password":"...","pin":"123456"}, ...]
 * - Email yang sudah ada dilewati (aman dijalankan berulang).
 * - Kata sandi minimal 8 karakter; PIN opsional, 6 digit.
 * - Semua akun baru wajib mengganti kata sandi saat pertama masuk.
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/../src/bootstrap.php';

$file = $argv[1] ?? '';
if ($file === '' || !is_file($file)) {
    fwrite(STDERR, "Pakai: php api/bin/seed-users.php users.json\n");
    exit(1);
}
$list = json_decode((string) file_get_contents($file), true);
if (!is_array($list)) {
    fwrite(STDERR, "! JSON tidak valid\n");
    exit(1);
}

$roles = array_column(Db::all('SELECT id FROM roles'), 'id');
$n = 0;
foreach ($list as $u) {
    $email = mb_strtolower(trim((string) ($u['email'] ?? '')));
    $name = trim((string) ($u['name'] ?? ''));
    $role = (string) ($u['role'] ?? '');
    $pw = (string) ($u['password'] ?? '');
    $pin = trim((string) ($u['pin'] ?? ''));
    if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || !in_array($role, $roles, true) || strlen($pw) < 8 || ($pin !== '' && !preg_match('/^\d{6}$/', $pin))) {
        fwrite(STDERR, "! dilewati (data tidak valid): " . json_encode($u['email'] ?? $u) . "\n");
        continue;
    }
    if (Db::one('SELECT id FROM users WHERE email = ?', [$email])) {
        echo "= $email (sudah ada)\n";
        continue;
    }
    Db::run(
        'INSERT INTO users (name, email, password_hash, pin_hash, role_id, is_active, must_change_password, created_at, updated_at) VALUES (?,?,?,?,?,1,1,?,?)',
        [$name, $email, Auth::makeHash($pw), $pin !== '' ? Auth::makeHash($pin) : null, $role, now_utc(), now_utc()]
    );
    echo "+ $email ($role)\n";
    $n++;
}
echo "Selesai: $n akun dibuat.\n";
