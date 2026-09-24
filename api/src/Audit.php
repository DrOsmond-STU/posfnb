<?php
declare(strict_types=1);

final class Audit
{
    /**
     * Menulis log aktivitas. $user boleh null (mis. gagal masuk dengan email tak dikenal).
     * @param array|null $user baris users (id, name)
     */
    public static function log(?array $user, string $event, string $detail = '', string $source = 'server'): void
    {
        Db::run(
            'INSERT INTO audit_logs (user_id, user_name, event, detail, source, ip, user_agent, created_at) VALUES (?,?,?,?,?,?,?,?)',
            [
                $user ? (int) $user['id'] : null,
                $user ? (string) $user['name'] : '—',
                mb_substr($event, 0, 60),
                mb_substr($detail, 0, 500),
                $source,
                Http::ip(),
                Http::userAgent(),
                gmdate('Y-m-d H:i:s') . sprintf('.%03d', (int) fmod(microtime(true) * 1000, 1000)),
            ]
        );
    }
}
