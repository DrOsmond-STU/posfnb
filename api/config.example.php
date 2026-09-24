<?php
/**
 * Contoh konfigurasi Racik POS API.
 * Salin ke LUAR document root:  <home>/posfnb-config/config.php  (chmod 600)
 * atau tunjuk lokasinya lewat variabel lingkungan POSFNB_CONFIG.
 * Jangan pernah menyimpan berkas konfigurasi asli di repositori.
 */
return [
    'app_env'        => 'production',
    'db'             => [
        'dsn'  => 'mysql:host=localhost;dbname=NAMA_DB;charset=utf8mb4',
        'user' => 'USER_DB',
        'pass' => 'KATA_SANDI_DB',
    ],
    // true bila situs memakai HTTPS (wajib di produksi)
    'cookie_secure'  => true,
    // asal (skema + host) yang boleh memanggil API; permintaan dari asal lain ditolak
    'trusted_origin' => 'https://pos.contoh.id',
    // string acak minimal 32 karakter, mis. hasil: php -r "echo bin2hex(random_bytes(32));"
    'app_secret'     => 'GANTI_DENGAN_STRING_ACAK_64_KARAKTER',
    'timezone'       => 'Asia/Jakarta',
    // akun Pemilik pertama, dibuat oleh api/bin/migrate.php bila tabel users kosong.
    // Wajib ganti kata sandi saat pertama masuk; hapus blok ini setelah migrasi.
    'initial_owner'  => [
        'name'     => 'Nama Pemilik',
        'email'    => 'pemilik@contoh.id',
        'password' => 'minimal-12-karakter',
    ],
];
