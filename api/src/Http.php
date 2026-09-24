<?php
declare(strict_types=1);

/** Galat yang dikirim ke klien sebagai JSON dengan kode HTTP tertentu. */
final class ApiError extends Exception
{
    /** @var string */
    public $codeName;
    /** @var array */
    public $details;
    /** @var int */
    public $status;

    public function __construct(int $status, string $codeName, string $message, array $details = [])
    {
        parent::__construct($message);
        $this->status = $status;
        $this->codeName = $codeName;
        $this->details = $details;
    }
}

final class Http
{
    /** @var array|null */
    private static $body = null;

    public static function method(): string
    {
        return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    }

    /** Isi permintaan JSON. Permintaan yang mengubah data wajib berformat JSON. */
    public static function body(): array
    {
        if (self::$body !== null) {
            return self::$body;
        }
        if (self::method() === 'GET') {
            return self::$body = [];
        }
        $type = $_SERVER['CONTENT_TYPE'] ?? '';
        if (stripos($type, 'application/json') !== 0) {
            throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Permintaan harus berformat JSON.');
        }
        $raw = file_get_contents('php://input', false, null, 0, 65536);
        $data = json_decode($raw === false || $raw === '' ? '{}' : $raw, true);
        if (!is_array($data)) {
            throw new ApiError(400, 'BAD_JSON', 'Format JSON tidak valid.');
        }
        return self::$body = $data;
    }

    public static function str(string $key, int $max = 255): string
    {
        $v = self::body()[$key] ?? '';
        if (!is_string($v)) {
            return '';
        }
        return mb_substr(trim($v), 0, $max);
    }

    public static function ip(): string
    {
        return substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);
    }

    public static function userAgent(): string
    {
        return substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255);
    }

    public static function json(int $status, array $data): void
    {
        http_response_code($status);
        header_remove('X-Powered-By');
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        header('Referrer-Policy: same-origin');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    public static function error(ApiError $e): void
    {
        self::json($e->status, ['error' => ['code' => $e->codeName, 'message' => $e->getMessage(), 'details' => (object) $e->details]]);
    }

    /**
     * Permintaan lintas situs ditolak: bila peramban mengirim Origin, harus sama dengan situs ini.
     * Bersama syarat Content-Type JSON, ini mencegah CSRF pada endpoint tanpa sesi (login, PIN).
     */
    public static function assertSameOrigin(): void
    {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if ($origin === '') {
            return;
        }
        $trusted = app_config()['trusted_origin'];
        $host = $_SERVER['HTTP_HOST'] ?? '';
        $ok = ($trusted !== '' && hash_equals($trusted, $origin))
            || ($host !== '' && $origin === 'https://' . $host)
            || ($host !== '' && !app_config()['cookie_secure'] && $origin === 'http://' . $host);   // hanya lingkungan lokal tanpa HTTPS
        if (!$ok) {
            throw new ApiError(403, 'BAD_ORIGIN', 'Permintaan lintas situs ditolak.');
        }
    }
}

/** Waktu UTC untuk kolom DATETIME. */
function now_utc(int $offsetSeconds = 0): string
{
    return gmdate('Y-m-d H:i:s', time() + $offsetSeconds);
}

/** DATETIME UTC → milidetik epoch untuk klien JavaScript. */
function to_ms(?string $utc): ?int
{
    if ($utc === null || $utc === '') {
        return null;
    }
    return (int) (strtotime($utc . ' UTC') * 1000);
}

function initials(string $name): string
{
    $out = '';
    foreach (preg_split('/\s+/u', trim($name)) ?: [] as $w) {
        if ($w !== '') {
            $out .= mb_strtoupper(mb_substr($w, 0, 1));
        }
    }
    return mb_substr($out, 0, 2);
}
