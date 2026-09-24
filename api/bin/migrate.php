<?php
/**
 * Racik POS · migrasi & data awal (CLI saja).
 *   php api/bin/migrate.php
 * - Menjalankan berkas api/migrations/*.sql yang belum pernah dijalankan.
 * - Membuat peran bawaan bila tabel roles kosong.
 * - Membuat akun Pemilik pertama dari config['initial_owner'] bila belum ada pengguna.
 *   Pemilik wajib mengganti kata sandi saat pertama masuk.
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/../src/bootstrap.php';

$pdo = Db::pdo();
$pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(100) NOT NULL PRIMARY KEY, applied_at DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
$done = array_column(Db::all('SELECT version FROM schema_migrations'), 'version');

$files = glob(__DIR__ . '/../migrations/*.sql') ?: [];
sort($files);
foreach ($files as $file) {
    $version = basename($file, '.sql');
    if (in_array($version, $done, true)) {
        echo "= $version (sudah)\n";
        continue;
    }
    $sql = (string) file_get_contents($file);
    // pecah per pernyataan; berkas migrasi tidak memakai ';' di dalam string
    foreach (array_filter(array_map('trim', explode(';', preg_replace('/^--.*$/m', '', $sql)))) as $stmt) {
        $pdo->exec($stmt);
    }
    Db::run('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', [$version, now_utc()]);
    echo "+ $version\n";
}

// peran bawaan
if (!(int) Db::one('SELECT COUNT(*) AS n FROM roles')['n']) {
    foreach (Permissions::defaultRoles() as $i => [$id, $name, $tone, $locked, $desc, $perms]) {
        Db::run('INSERT INTO roles (id, name, description, tone, is_locked, sort_order) VALUES (?,?,?,?,?,?)', [$id, $name, $desc, $tone, $locked, $i]);
        foreach ($perms as $p) {
            Db::run('INSERT INTO role_permissions (role_id, permission) VALUES (?,?)', [$id, $p]);
        }
    }
    echo "+ peran bawaan (" . count(Permissions::defaultRoles()) . ")\n";
}

// pemilik pertama
if (!(int) Db::one('SELECT COUNT(*) AS n FROM users')['n']) {
    $o = app_config()['initial_owner'] ?? null;
    if (!$o || empty($o['email']) || strlen((string) ($o['password'] ?? '')) < 12) {
        fwrite(STDERR, "! initial_owner belum diisi di konfigurasi (kata sandi minimal 12 karakter)\n");
        exit(1);
    }
    Db::run(
        'INSERT INTO users (name, email, password_hash, role_id, is_active, must_change_password, created_at, updated_at) VALUES (?,?,?,?,1,1,?,?)',
        [$o['name'] ?? 'Pemilik', mb_strtolower($o['email']), Auth::makeHash($o['password']), 'owner', now_utc(), now_utc()]
    );
    echo "+ akun Pemilik " . mb_strtolower($o['email']) . " (wajib ganti kata sandi saat pertama masuk)\n";
}

echo "Selesai. Pengguna: " . Db::one('SELECT COUNT(*) AS n FROM users')['n'] . ", peran: " . Db::one('SELECT COUNT(*) AS n FROM roles')['n'] . "\n";
