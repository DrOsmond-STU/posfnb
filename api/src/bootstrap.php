<?php
/**
 * Racik POS API · bootstrap
 * Memuat konfigurasi dari LUAR document root, menyiapkan penanganan galat,
 * dan memuat kelas-kelas aplikasi. Kompatibel PHP 7.4+.
 */
declare(strict_types=1);

// Galat PHP tidak boleh tampil di respons (bisa membocorkan path/kredensial); dicatat ke error_log saja.
ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);
set_error_handler(function (int $no, string $str, string $file, int $line): bool {
    if ($no & (E_DEPRECATED | E_USER_DEPRECATED)) {
        error_log("[racikpos] deprecated: $str @ $file:$line");
        return true;
    }
    throw new ErrorException($str, 0, $no, $file, $line);
});

// Konfigurasi berisi kredensial DB, jadi tidak pernah disimpan di repositori.
// Urutan pencarian: variabel lingkungan POSFNB_CONFIG, lalu <home>/posfnb-config/<nama-folder-situs>.php
// (satu instalasi per domain), lalu <home>/posfnb-config/config.php. Semuanya di luar document root.
function app_config(): array
{
    static $cfg = null;
    if ($cfg !== null) {
        return $cfg;
    }
    $dir = dirname(__DIR__, 3) . '/posfnb-config/';
    $site = $dir . basename(dirname(__DIR__, 2)) . '.php';
    $path = getenv('POSFNB_CONFIG') ?: (is_file($site) ? $site : $dir . 'config.php');
    if (!is_file($path)) {
        throw new RuntimeException('Berkas konfigurasi tidak ditemukan: ' . $path);
    }
    $cfg = require $path;
    $cfg += [
        'app_env'        => 'production',
        'cookie_secure'  => true,
        'trusted_origin' => '',
        'app_secret'     => '',
        'timezone'       => 'Asia/Jakarta',
        // true: browser yang belum punya data diisi data contoh 30 hari; false: mulai kosong
        'demo_data'      => true,
    ];
    if (strlen((string) $cfg['app_secret']) < 32) {
        throw new RuntimeException('app_secret di konfigurasi minimal 32 karakter.');
    }
    return $cfg;
}

require __DIR__ . '/Http.php';
require __DIR__ . '/Db.php';
require __DIR__ . '/Permissions.php';
require __DIR__ . '/Audit.php';
require __DIR__ . '/RateLimit.php';
require __DIR__ . '/Auth.php';
require __DIR__ . '/Users.php';
