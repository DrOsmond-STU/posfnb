<?php
declare(strict_types=1);

/**
 * Sesi & autentikasi.
 * - Cookie `rpos_sid` berisi token acak; DB hanya menyimpan hash SHA-256-nya.
 * - "Ingat saya": sesi 7 hari; tanpa itu 12 jam dan cookie hilang saat peramban ditutup.
 * - Tidak aktif 30 menit → sesi dikunci (423) sampai dibuka dengan PIN/kata sandi.
 * - PIN hanya bisa dipakai di "perangkat tepercaya": peramban yang pernah masuk
 *   dengan email + kata sandi (cookie `rpos_dev` bertanda tangan HMAC).
 */
final class Auth
{
    private const COOKIE = 'rpos_sid';
    private const DEVICE_COOKIE = 'rpos_dev';
    private const REMEMBER_TTL = 7 * 86400;
    private const SESSION_TTL = 12 * 3600;
    private const DEVICE_TTL = 180 * 86400;
    private const IDLE_LOCK = 30 * 60;

    /** @var array|null sesi aktif (gabungan sessions + users) */
    private static $current = null;

    // ------------------------------------------------------------------ util

    private static function hashSecret(string $secret): string
    {
        return password_hash($secret, defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT);
    }

    public static function makeHash(string $secret): string
    {
        return self::hashSecret($secret);
    }

    /** Hash tiruan agar waktu respons email tak terdaftar sama dengan email terdaftar. */
    private static function dummyHash(): string
    {
        static $h = null;
        return $h ?? ($h = self::hashSecret(bin2hex(random_bytes(8))));
    }

    private static function setCookie(string $name, string $value, int $expires): void
    {
        setcookie($name, $value, [
            'expires'  => $expires,
            'path'     => '/',
            'secure'   => (bool) app_config()['cookie_secure'],
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }

    private static function deviceToken(): string
    {
        $payload = 'dev.' . time();
        return $payload . '.' . hash_hmac('sha256', $payload, app_config()['app_secret']);
    }

    private static function deviceTrusted(): bool
    {
        $v = $_COOKIE[self::DEVICE_COOKIE] ?? '';
        $parts = explode('.', $v);
        if (count($parts) !== 3 || $parts[0] !== 'dev' || !ctype_digit($parts[1])) {
            return false;
        }
        $expected = hash_hmac('sha256', $parts[0] . '.' . $parts[1], app_config()['app_secret']);
        return hash_equals($expected, $parts[2]) && time() - (int) $parts[1] < self::DEVICE_TTL;
    }

    /** Data pengguna yang aman dikirim ke klien. */
    public static function publicUser(array $u): array
    {
        $role = Db::one('SELECT id, name FROM roles WHERE id = ?', [$u['role_id']]);
        return [
            'id'                   => (int) $u['id'],
            'name'                 => $u['name'],
            'email'                => $u['email'],
            'initials'             => initials($u['name']),
            'role'                 => $u['role_id'],
            'role_name'            => $role ? $role['name'] : $u['role_id'],
            'has_pin'              => !empty($u['pin_hash']),
            'must_change_password' => (bool) $u['must_change_password'],
        ];
    }

    // --------------------------------------------------------------- sesi

    /** Membuat sesi baru dan mengembalikan id (hash) sesi tersebut. */
    private static function startSession(array $user, bool $remember): string
    {
        $token = bin2hex(random_bytes(32));
        $ttl = $remember ? self::REMEMBER_TTL : self::SESSION_TTL;
        Db::run(
            'INSERT INTO sessions (id, user_id, csrf_token, remember, created_at, last_seen_at, expires_at, ip, user_agent) VALUES (?,?,?,?,?,?,?,?,?)',
            [hash('sha256', $token), $user['id'], bin2hex(random_bytes(32)), $remember ? 1 : 0, now_utc(), now_utc(), now_utc($ttl), Http::ip(), Http::userAgent()]
        );
        self::setCookie(self::COOKIE, $token, $remember ? time() + $ttl : 0);
        Db::run('UPDATE users SET last_login_at = ? WHERE id = ?', [now_utc(), $user['id']]);
        // bersihkan sesi kedaluwarsa sesekali
        if (random_int(1, 20) === 1) {
            Db::run('DELETE FROM sessions WHERE expires_at < ?', [now_utc()]);
        }
        return hash('sha256', $token);
    }

    /** Sesi dari cookie, atau null. Mengunci otomatis bila tidak aktif 30 menit. */
    public static function session(): ?array
    {
        if (self::$current !== null) {
            return self::$current;
        }
        $token = $_COOKIE[self::COOKIE] ?? '';
        if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/', $token)) {
            return null;
        }
        $row = Db::one(
            'SELECT s.id AS sid, s.csrf_token, s.remember, s.last_seen_at, s.expires_at, s.locked_at, u.*
               FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?',
            [hash('sha256', $token)]
        );
        if (!$row || strtotime($row['expires_at'] . ' UTC') < time() || !(int) $row['is_active']) {
            if ($row) {
                Db::run('DELETE FROM sessions WHERE id = ?', [$row['sid']]);
            }
            self::setCookie(self::COOKIE, '', time() - 3600);
            return null;
        }
        $idle = time() - strtotime($row['last_seen_at'] . ' UTC');
        if ($row['locked_at'] === null && $idle > self::IDLE_LOCK) {
            $row['locked_at'] = now_utc();
            Db::run('UPDATE sessions SET locked_at = ? WHERE id = ?', [$row['locked_at'], $row['sid']]);
            Audit::log($row, 'Layar dikunci', 'Tidak aktif 30 menit');
        } elseif ($row['locked_at'] === null && $idle > 60) {
            Db::run('UPDATE sessions SET last_seen_at = ? WHERE id = ?', [now_utc(), $row['sid']]);
        }
        return self::$current = $row;
    }

    /** Wajib masuk (dan tidak terkunci, kecuali $allowLocked). Memeriksa token CSRF untuk non-GET. */
    public static function require(bool $allowLocked = false): array
    {
        $s = self::session();
        if (!$s) {
            throw new ApiError(401, 'UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.');
        }
        if (Http::method() !== 'GET') {
            $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
            if (!is_string($sent) || !hash_equals($s['csrf_token'], $sent)) {
                throw new ApiError(403, 'CSRF', 'Sesi tidak valid. Muat ulang halaman.');
            }
        }
        if ($s['locked_at'] !== null && !$allowLocked) {
            throw new ApiError(423, 'SESSION_LOCKED', 'Layar terkunci.', ['user' => self::publicUser($s), 'csrf' => $s['csrf_token']]);
        }
        return $s;
    }

    /** Wajib punya izin tertentu. */
    public static function requirePerm(string $perm): array
    {
        $s = self::require();
        if (!Permissions::userHas($s, $perm)) {
            Audit::log($s, 'Akses ditolak', 'API: ' . $perm);
            throw new ApiError(403, 'FORBIDDEN', 'Anda tidak punya izin untuk tindakan ini.', ['permission' => $perm]);
        }
        return $s;
    }

    private static function mePayload(array $s): array
    {
        $roles = Db::all('SELECT id, name, description, tone, is_locked FROM roles ORDER BY sort_order');
        return [
            'user'        => self::publicUser($s),
            'permissions' => Permissions::forRole($s['role_id']),
            'roles'       => array_map(function ($r) {
                return ['id' => $r['id'], 'name' => $r['name'], 'desc' => $r['description'], 'tone' => $r['tone'], 'locked' => (bool) $r['is_locked']];
            }, $roles),
            'csrf'        => $s['csrf_token'],
        ];
    }

    // -------------------------------------------------------------- endpoint

    public static function me(): void
    {
        $s = self::require(true);
        if ($s['locked_at'] !== null) {
            throw new ApiError(423, 'SESSION_LOCKED', 'Layar terkunci.', ['user' => self::publicUser($s), 'csrf' => $s['csrf_token']]);
        }
        Http::json(200, self::mePayload($s));
    }

    public static function login(): void
    {
        Http::assertSameOrigin();
        $email = mb_strtolower(Http::str('email', 160));
        $password = (string) (Http::body()['password'] ?? '');
        $remember = !empty(Http::body()['remember']);
        if ($email === '' || $password === '') {
            throw new ApiError(422, 'VALIDATION_FAILED', 'Isi email dan kata sandi.');
        }
        foreach (['ip:' . Http::ip(), 'pw:' . $email] as $key) {
            if ($left = RateLimit::lockedFor($key)) {
                throw new ApiError(429, 'TOO_MANY_ATTEMPTS', "Terlalu banyak percobaan gagal. Coba lagi dalam {$left} detik.", ['retry_after' => $left]);
            }
        }
        $u = Db::one('SELECT * FROM users WHERE email = ?', [$email]);
        // password_verify tetap dijalankan agar waktu respons tidak membocorkan email terdaftar
        $valid = password_verify($password, $u ? $u['password_hash'] : self::dummyHash()) && $u !== null;
        if (!$valid) {
            RateLimit::fail('ip:' . Http::ip(), 20, 300);
            $r = RateLimit::fail('pw:' . $email);
            Audit::log($u, 'Gagal masuk', $email);
            if ($r['locked']) {
                Audit::log($u, 'Akun terkunci sementara', 'pw:' . $email . ' · ' . $r['locked'] . ' detik');
                throw new ApiError(429, 'TOO_MANY_ATTEMPTS', "Terlalu banyak percobaan gagal. Coba lagi dalam {$r['locked']} detik.", ['retry_after' => $r['locked']]);
            }
            throw new ApiError(401, 'INVALID_CREDENTIALS', "Email atau kata sandi salah. Sisa {$r['left']} percobaan.");
        }
        if (!(int) $u['is_active']) {
            Audit::log($u, 'Gagal masuk', 'Akun nonaktif');
            throw new ApiError(403, 'ACCOUNT_DISABLED', 'Akun ini dinonaktifkan. Hubungi pemilik outlet.');
        }
        RateLimit::clear('pw:' . $email);
        if (password_needs_rehash($u['password_hash'], defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT)) {
            Db::run('UPDATE users SET password_hash = ? WHERE id = ?', [self::hashSecret($password), $u['id']]);
        }
        $sid = self::startSession($u, $remember);
        self::setCookie(self::DEVICE_COOKIE, self::deviceToken(), time() + self::DEVICE_TTL);
        Audit::log($u, 'Masuk', 'Email & kata sandi');
        Http::json(200, self::mePayload(self::sessionById($sid)));
    }

    private static function sessionById(string $sid): array
    {
        return Db::one(
            'SELECT s.id AS sid, s.csrf_token, s.remember, s.last_seen_at, s.expires_at, s.locked_at, u.*
               FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?',
            [$sid]
        );
    }

    public static function pinUsers(): void
    {
        if (!self::deviceTrusted()) {
            throw new ApiError(403, 'DEVICE_NOT_TRUSTED', 'PIN hanya bisa dipakai di perangkat yang pernah dipakai masuk dengan email dan kata sandi.');
        }
        $rows = Db::all('SELECT u.id, u.name, r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.is_active = 1 AND u.pin_hash IS NOT NULL ORDER BY r.sort_order, u.name');
        Http::json(200, ['users' => array_map(function ($r) {
            return ['id' => (int) $r['id'], 'name' => $r['name'], 'initials' => initials($r['name']), 'role_name' => $r['role_name']];
        }, $rows)]);
    }

    /** Memeriksa PIN pengguna dengan batas percobaan. Mengembalikan baris pengguna. */
    private static function checkPin(int $uid, string $pin, string $context): array
    {
        $key = 'pin:' . $uid;
        if ($left = RateLimit::lockedFor($key)) {
            throw new ApiError(429, 'TOO_MANY_ATTEMPTS', "PIN terkunci. Coba lagi dalam {$left} detik.", ['retry_after' => $left]);
        }
        $u = Db::one('SELECT * FROM users WHERE id = ? AND is_active = 1', [$uid]);
        if (!$u || empty($u['pin_hash'])) {
            throw new ApiError(404, 'NOT_FOUND', 'Pengguna tidak ditemukan atau belum punya PIN.');
        }
        if (!preg_match('/^\d{6}$/', $pin) || !password_verify($pin, $u['pin_hash'])) {
            $r = RateLimit::fail($key);
            Audit::log($u, $context === 'login' ? 'Gagal masuk' : 'Persetujuan ditolak', 'PIN salah' . ($context !== 'login' ? ' · ' . $context : ''));
            if ($r['locked']) {
                Audit::log($u, 'Akun terkunci sementara', 'pin:' . $uid . ' · ' . $r['locked'] . ' detik');
                throw new ApiError(429, 'TOO_MANY_ATTEMPTS', "PIN terkunci selama {$r['locked']} detik.", ['retry_after' => $r['locked']]);
            }
            throw new ApiError(401, 'INVALID_PIN', "PIN salah. Sisa {$r['left']} percobaan.");
        }
        RateLimit::clear($key);
        return $u;
    }

    public static function pinLogin(): void
    {
        Http::assertSameOrigin();
        if (!self::deviceTrusted()) {
            throw new ApiError(403, 'DEVICE_NOT_TRUSTED', 'PIN hanya bisa dipakai di perangkat yang pernah dipakai masuk dengan email dan kata sandi.');
        }
        $u = self::checkPin((int) (Http::body()['user_id'] ?? 0), Http::str('pin', 6), 'login');
        $sid = self::startSession($u, false);
        Audit::log($u, 'Masuk dengan PIN', 'Perangkat tepercaya');
        Http::json(200, self::mePayload(self::sessionById($sid)));
    }

    public static function lock(): void
    {
        $s = self::require(true);
        if ($s['locked_at'] === null) {
            Db::run('UPDATE sessions SET locked_at = ? WHERE id = ?', [now_utc(), $s['sid']]);
            Audit::log($s, 'Layar dikunci', 'Manual');
        }
        Http::json(200, ['locked' => true, 'user' => self::publicUser($s)]);
    }

    /** Membuka layar terkunci dengan PIN atau kata sandi pemilik sesi. */
    public static function unlock(): void
    {
        $s = self::require(true);
        $pin = Http::str('pin', 6);
        if ($pin !== '') {
            self::checkPin((int) $s['id'], $pin, 'login');
        } else {
            $pw = (string) (Http::body()['password'] ?? '');
            $key = 'pw:' . $s['email'];
            if ($left = RateLimit::lockedFor($key)) {
                throw new ApiError(429, 'TOO_MANY_ATTEMPTS', "Coba lagi dalam {$left} detik.", ['retry_after' => $left]);
            }
            if (!password_verify($pw, $s['password_hash'])) {
                $r = RateLimit::fail($key);
                Audit::log($s, 'Gagal masuk', 'Buka kunci: kata sandi salah');
                throw new ApiError(401, 'INVALID_CREDENTIALS', $r['locked'] ? "Terkunci {$r['locked']} detik." : "Kata sandi salah. Sisa {$r['left']} percobaan.");
            }
            RateLimit::clear($key);
        }
        Db::run('UPDATE sessions SET locked_at = NULL, last_seen_at = ? WHERE id = ?', [now_utc(), $s['sid']]);
        Audit::log($s, 'Masuk', 'Membuka layar terkunci');
        $s['locked_at'] = null;
        Http::json(200, self::mePayload($s));
    }

    public static function logout(): void
    {
        $s = self::session();
        if ($s) {
            $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
            if (is_string($sent) && hash_equals($s['csrf_token'], $sent)) {
                Db::run('DELETE FROM sessions WHERE id = ?', [$s['sid']]);
                Audit::log($s, 'Keluar', '');
            }
        }
        self::setCookie(self::COOKIE, '', time() - 3600);
        Http::json(200, ['ok' => true]);
    }

    public static function changeCredentials(): void
    {
        $s = self::require();
        $b = Http::body();
        $current = (string) ($b['current_password'] ?? '');
        $newPw = (string) ($b['new_password'] ?? '');
        $newPin = Http::str('new_pin', 6);
        if ($newPw === '' && $newPin === '') {
            throw new ApiError(422, 'VALIDATION_FAILED', 'Isi kata sandi baru atau PIN baru.');
        }
        if (!password_verify($current, $s['password_hash'])) {
            RateLimit::fail('pw:' . $s['email']);
            throw new ApiError(401, 'INVALID_CREDENTIALS', 'Kata sandi sekarang salah.');
        }
        if ($newPw !== '' && strlen($newPw) < 8) {
            throw new ApiError(422, 'VALIDATION_FAILED', 'Kata sandi baru minimal 8 karakter.');
        }
        if ($newPw !== '' && hash_equals($current, $newPw)) {
            throw new ApiError(422, 'VALIDATION_FAILED', 'Kata sandi baru harus berbeda dari yang sekarang.');
        }
        if ($newPin !== '' && !preg_match('/^\d{6}$/', $newPin)) {
            throw new ApiError(422, 'VALIDATION_FAILED', 'PIN harus 6 digit angka.');
        }
        if ($newPw !== '') {
            Db::run('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?', [self::hashSecret($newPw), now_utc(), $s['id']]);
            // sesi lain milik pengguna ini diakhiri
            Db::run('DELETE FROM sessions WHERE user_id = ? AND id <> ?', [$s['id'], $s['sid']]);
        }
        if ($newPin !== '') {
            Db::run('UPDATE users SET pin_hash = ?, updated_at = ? WHERE id = ?', [self::hashSecret($newPin), now_utc(), $s['id']]);
        }
        Audit::log($s, 'Kredensial diubah', implode(' & ', array_filter([$newPw !== '' ? 'kata sandi' : '', $newPin !== '' ? 'PIN' : ''])));
        $fresh = Db::one('SELECT * FROM users WHERE id = ?', [$s['id']]);
        Http::json(200, ['user' => self::publicUser($fresh)]);
    }

    /** Daftar penyetuju (punya izin & PIN) untuk dialog persetujuan. */
    public static function approvers(): void
    {
        self::require();
        $perm = (string) ($_GET['perm'] ?? '');
        if (!Permissions::isValid($perm)) {
            throw new ApiError(422, 'VALIDATION_FAILED', 'Izin tidak dikenal.');
        }
        $rows = Db::all('SELECT u.*, r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.is_active = 1 AND u.pin_hash IS NOT NULL ORDER BY r.sort_order, u.name');
        $out = [];
        foreach ($rows as $r) {
            if (Permissions::userHas($r, $perm)) {
                $out[] = ['id' => (int) $r['id'], 'name' => $r['name'], 'role_name' => $r['role_name']];
            }
        }
        Http::json(200, ['users' => $out]);
    }

    /** Verifikasi PIN penyetuju untuk aksi yang butuh izin lebih tinggi (diskon, void, batal bill). */
    public static function approve(): void
    {
        $s = self::require();
        $perm = Http::str('perm', 40);
        $context = Http::str('context', 200);
        if (!Permissions::isValid($perm)) {
            throw new ApiError(422, 'VALIDATION_FAILED', 'Izin tidak dikenal.');
        }
        $u = self::checkPin((int) (Http::body()['user_id'] ?? 0), Http::str('pin', 6), $context ?: $perm);
        if (!Permissions::userHas($u, $perm)) {
            throw new ApiError(403, 'FORBIDDEN', $u['name'] . ' tidak punya izin untuk menyetujui tindakan ini.');
        }
        Audit::log($s, 'Persetujuan', ($context ?: $perm) . ' · disetujui ' . $u['name']);
        Http::json(200, ['approver' => ['id' => (int) $u['id'], 'name' => $u['name']]]);
    }

    /** Nama staf aktif (untuk pilihan "diterima oleh", "petugas", dsb.). */
    public static function staff(): void
    {
        self::require();
        $rows = Db::all('SELECT u.id, u.name, r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.is_active = 1 ORDER BY r.sort_order, u.name');
        Http::json(200, ['users' => array_map(function ($r) {
            return ['id' => (int) $r['id'], 'name' => $r['name'], 'role_name' => $r['role_name']];
        }, $rows)]);
    }

    /** Aktivitas dari modul lain di peramban (void, batal bill, akses ditolak, dll.). */
    public static function clientAudit(): void
    {
        $s = self::require();
        $event = Http::str('event', 60);
        if ($event === '') {
            throw new ApiError(422, 'VALIDATION_FAILED', 'Aktivitas kosong.');
        }
        Audit::log($s, $event, Http::str('detail', 500), 'client');
        Http::json(201, ['ok' => true]);
    }
}
