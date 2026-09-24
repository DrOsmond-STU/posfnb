<?php
declare(strict_types=1);

/** Pengelolaan pengguna, peran & izin, dan log aktivitas (izin: pengguna.kelola). */
final class Users
{
    private static function row(array $u): array
    {
        return [
            'id'         => (int) $u['id'],
            'name'       => $u['name'],
            'email'      => $u['email'],
            'initials'   => initials($u['name']),
            'role'       => $u['role_id'],
            'active'     => (bool) $u['is_active'],
            'has_pin'    => !empty($u['pin_hash']),
            'last_login' => to_ms($u['last_login_at']),
            'must_change_password' => (bool) $u['must_change_password'],
        ];
    }

    public static function list(): void
    {
        Auth::requirePerm('pengguna.kelola');
        $rows = Db::all('SELECT u.* FROM users u JOIN roles r ON r.id = u.role_id ORDER BY r.sort_order, u.name');
        Http::json(200, ['users' => array_map([self::class, 'row'], $rows)]);
    }

    /** Membuat (id = null) atau mengubah pengguna. */
    public static function save(?int $id): void
    {
        $me = Auth::requirePerm('pengguna.kelola');
        $b = Http::body();
        $name = Http::str('name', 120);
        $email = mb_strtolower(Http::str('email', 160));
        $roleId = Http::str('role', 20);
        $active = !empty($b['active']);
        $pw = (string) ($b['password'] ?? '');
        $pin = Http::str('pin', 6);

        $target = $id ? Db::one('SELECT * FROM users WHERE id = ?', [$id]) : null;
        if ($id && !$target) {
            throw new ApiError(404, 'NOT_FOUND', 'Pengguna tidak ditemukan.');
        }
        $fail = function (string $m) { throw new ApiError(422, 'VALIDATION_FAILED', $m); };
        if ($name === '') $fail('Nama wajib diisi.');
        if (preg_match('/[<>\p{Cc}]/u', $name)) $fail('Nama tidak boleh memuat karakter < > atau karakter kendali.');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $fail('Format email tidak valid.');
        if (!Db::one('SELECT id FROM roles WHERE id = ?', [$roleId])) $fail('Peran tidak dikenal.');
        if (Db::one('SELECT id FROM users WHERE email = ? AND id <> ?', [$email, $id ?? 0])) $fail('Email sudah dipakai pengguna lain.');
        if (!$id && strlen($pw) < 8) $fail('Kata sandi awal minimal 8 karakter.');
        if ($id && $pw !== '' && strlen($pw) < 8) $fail('Kata sandi baru minimal 8 karakter.');
        if ($pin !== '' && !preg_match('/^\d{6}$/', $pin)) $fail('PIN harus 6 digit angka.');
        if ($me['role_id'] !== 'owner' && ($roleId === 'owner' || ($target && $target['role_id'] === 'owner'))) {
            $fail('Hanya Pemilik yang bisa membuat, mengubah, atau menunjuk akun Pemilik.');
        }
        if ($id && (int) $me['id'] === $id && !$active) $fail('Anda tidak bisa menonaktifkan akun sendiri.');
        $otherOwners = (int) Db::one('SELECT COUNT(*) AS n FROM users WHERE role_id = ? AND is_active = 1 AND id <> ?', ['owner', $id ?? 0])['n'];
        if ($otherOwners === 0 && ($roleId !== 'owner' || !$active)) $fail('Harus ada minimal satu Pemilik yang aktif.');

        $changes = [];
        Db::tx(function () use (&$id, $target, $name, $email, $roleId, $active, $pw, $pin, &$changes) {
            if (!$id) {
                Db::run(
                    'INSERT INTO users (name, email, password_hash, pin_hash, role_id, is_active, must_change_password, created_at, updated_at) VALUES (?,?,?,?,?,?,1,?,?)',
                    [$name, $email, Auth::makeHash($pw), $pin !== '' ? Auth::makeHash($pin) : null, $roleId, $active ? 1 : 0, now_utc(), now_utc()]
                );
                $id = (int) Db::pdo()->lastInsertId();
                return;
            }
            if ($target['role_id'] !== $roleId) $changes[] = 'peran → ' . $roleId;
            if ((bool) $target['is_active'] !== $active) $changes[] = $active ? 'diaktifkan' : 'dinonaktifkan';
            Db::run('UPDATE users SET name = ?, email = ?, role_id = ?, is_active = ?, updated_at = ? WHERE id = ?', [$name, $email, $roleId, $active ? 1 : 0, now_utc(), $id]);
            if ($pw !== '') {
                // kata sandi diatur ulang pemilik: wajib diganti saat masuk berikutnya
                Db::run('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?', [Auth::makeHash($pw), $id]);
                $changes[] = 'kata sandi diatur ulang';
            }
            if ($pin !== '') {
                Db::run('UPDATE users SET pin_hash = ? WHERE id = ?', [Auth::makeHash($pin), $id]);
                $changes[] = 'PIN diatur ulang';
            }
            // akun dinonaktifkan / kata sandi diatur ulang → semua sesinya berakhir
            if (!$active || $pw !== '') {
                Db::run('DELETE FROM sessions WHERE user_id = ?', [$id]);
            }
        });
        Audit::log($me, $target ? 'Pengguna diubah' : 'Pengguna ditambah', $name . ($target ? ($changes ? ': ' . implode(', ', $changes) : '') : ' sebagai ' . $roleId));
        Http::json($target ? 200 : 201, ['user' => self::row(Db::one('SELECT * FROM users WHERE id = ?', [$id]))]);
    }

    public static function roles(): void
    {
        Auth::requirePerm('pengguna.kelola');
        $roles = Db::all('SELECT * FROM roles ORDER BY sort_order');
        $out = [];
        foreach ($roles as $r) {
            $perms = array_column(Db::all('SELECT permission FROM role_permissions WHERE role_id = ?', [$r['id']]), 'permission');
            $out[] = ['id' => $r['id'], 'name' => $r['name'], 'desc' => $r['description'], 'tone' => $r['tone'], 'locked' => (bool) $r['is_locked'], 'perms' => $perms];
        }
        Http::json(200, ['roles' => $out, 'catalog' => Permissions::all()]);
    }

    public static function setPermission(string $roleId): void
    {
        $me = Auth::requirePerm('pengguna.kelola');
        $perm = Http::str('permission', 40);
        $granted = !empty(Http::body()['granted']);
        $role = Db::one('SELECT * FROM roles WHERE id = ?', [$roleId]);
        if (!$role) {
            throw new ApiError(404, 'NOT_FOUND', 'Peran tidak ditemukan.');
        }
        if ((int) $role['is_locked']) {
            throw new ApiError(409, 'ROLE_LOCKED', 'Izin peran ' . $role['name'] . ' tidak bisa diubah.');
        }
        if (!Permissions::isValid($perm)) {
            throw new ApiError(422, 'VALIDATION_FAILED', 'Izin tidak dikenal.');
        }
        if ($granted) {
            Db::run('INSERT IGNORE INTO role_permissions (role_id, permission) VALUES (?,?)', [$roleId, $perm]);
        } else {
            Db::run('DELETE FROM role_permissions WHERE role_id = ? AND permission = ?', [$roleId, $perm]);
        }
        Audit::log($me, 'Hak akses diubah', $role['name'] . ': ' . ($granted ? '+ ' : '− ') . $perm);
        Http::json(200, ['role' => $roleId, 'permission' => $perm, 'granted' => $granted]);
    }

    public static function auditLogs(): void
    {
        Auth::requirePerm('pengguna.kelola');
        $limit = max(1, min(500, (int) ($_GET['limit'] ?? 200)));
        $rows = Db::all('SELECT created_at, user_name, event, detail, source, ip FROM audit_logs ORDER BY id DESC LIMIT ' . $limit);
        Http::json(200, ['logs' => array_map(function ($r) {
            return ['t' => to_ms(substr($r['created_at'], 0, 19)), 'who' => $r['user_name'], 'event' => $r['event'], 'detail' => $r['detail'], 'source' => $r['source'], 'ip' => $r['ip']];
        }, $rows)]);
    }
}
