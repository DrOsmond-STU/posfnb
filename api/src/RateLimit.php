<?php
declare(strict_types=1);

/**
 * Batas percobaan masuk:
 * - per akun/PIN: 5 kali gagal → kunci 60 detik; 3 kali terkunci dalam 1 jam → kunci 15 menit;
 * - per IP: 20 kali gagal → kunci 5 menit (satu outlet biasanya berbagi satu IP).
 */
final class RateLimit
{
    private const MAX_FAILS = 5;
    private const LOCK_SHORT = 60;
    private const LOCK_LONG = 900;
    private const WINDOW = 3600;

    /** Sisa detik kunci (0 bila tidak terkunci). */
    public static function lockedFor(string $key): int
    {
        $row = Db::one('SELECT locked_until FROM login_attempts WHERE k = ?', [$key]);
        if (!$row || $row['locked_until'] === null) {
            return 0;
        }
        $left = strtotime($row['locked_until'] . ' UTC') - time();
        return $left > 0 ? $left : 0;
    }

    /**
     * Mencatat kegagalan. Mengembalikan ['left' => sisa percobaan, 'locked' => detik kunci].
     */
    public static function fail(string $key, int $maxFails = self::MAX_FAILS, int $lockShort = self::LOCK_SHORT): array
    {
        return Db::tx(function () use ($key, $maxFails, $lockShort) {
            $row = Db::one('SELECT * FROM login_attempts WHERE k = ? FOR UPDATE', [$key]);
            $now = time();
            if (!$row) {
                $row = ['fails' => 0, 'lock_count' => 0, 'window_start' => now_utc(), 'locked_until' => null];
                Db::run('INSERT INTO login_attempts (k, fails, lock_count, window_start) VALUES (?,0,0,?)', [$key, $row['window_start']]);
            }
            $fails = (int) $row['fails'];
            $locks = (int) $row['lock_count'];
            $window = $row['window_start'];
            if ($now - strtotime($window . ' UTC') > self::WINDOW) {
                $locks = 0;
                $window = now_utc();
            }
            if ($row['locked_until'] !== null && strtotime($row['locked_until'] . ' UTC') <= $now) {
                $fails = 0;
            }
            $fails++;
            $lockedUntil = null;
            $lockedFor = 0;
            if ($fails >= $maxFails) {
                $locks++;
                $lockedFor = $locks >= 3 ? self::LOCK_LONG : $lockShort;
                $lockedUntil = now_utc($lockedFor);
                $fails = 0;
            }
            Db::run(
                'UPDATE login_attempts SET fails = ?, lock_count = ?, window_start = ?, locked_until = COALESCE(?, locked_until) WHERE k = ?',
                [$fails, $locks, $window, $lockedUntil, $key]
            );
            return ['left' => $lockedFor ? 0 : $maxFails - $fails, 'locked' => $lockedFor];
        });
    }

    public static function clear(string $key): void
    {
        Db::run('DELETE FROM login_attempts WHERE k = ?', [$key]);
    }
}
