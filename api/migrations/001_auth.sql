-- Racik POS · migrasi 001: autentikasi, peran, sesi, log aktivitas
-- Semua waktu disimpan dalam UTC (DATETIME), diisi oleh aplikasi.

CREATE TABLE IF NOT EXISTS roles (
  id           VARCHAR(20)  NOT NULL PRIMARY KEY,
  name         VARCHAR(60)  NOT NULL,
  description  VARCHAR(255) NOT NULL DEFAULT '',
  tone         VARCHAR(10)  NOT NULL DEFAULT '',
  is_locked    TINYINT(1)   NOT NULL DEFAULT 0,
  sort_order   SMALLINT     NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id      VARCHAR(20)  NOT NULL,
  permission   VARCHAR(40)  NOT NULL,
  PRIMARY KEY (role_id, permission),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id                    INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name                  VARCHAR(120) NOT NULL,
  email                 VARCHAR(160) NOT NULL,
  password_hash         VARCHAR(255) NOT NULL,
  pin_hash              VARCHAR(255) NULL,
  role_id               VARCHAR(20)  NOT NULL,
  is_active             TINYINT(1)   NOT NULL DEFAULT 1,
  must_change_password  TINYINT(1)   NOT NULL DEFAULT 0,
  last_login_at         DATETIME     NULL,
  created_at            DATETIME     NOT NULL,
  updated_at            DATETIME     NOT NULL,
  UNIQUE KEY uq_users_email (email),
  KEY ix_users_role (role_id),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Token sesi disimpan sebagai hash SHA-256; cookie hanya membawa token acak.
CREATE TABLE IF NOT EXISTS sessions (
  id            CHAR(64)     NOT NULL PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  csrf_token    CHAR(64)     NOT NULL,
  remember      TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL,
  last_seen_at  DATETIME     NOT NULL,
  expires_at    DATETIME     NOT NULL,
  locked_at     DATETIME     NULL,
  ip            VARCHAR(45)  NOT NULL DEFAULT '',
  user_agent    VARCHAR(255) NOT NULL DEFAULT '',
  KEY ix_sessions_user (user_id),
  KEY ix_sessions_exp (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Batas percobaan: kunci per email (pw:), per pengguna PIN (pin:), dan per IP (ip:).
CREATE TABLE IF NOT EXISTS login_attempts (
  k             VARCHAR(190) NOT NULL PRIMARY KEY,
  fails         SMALLINT     NOT NULL DEFAULT 0,
  locked_until  DATETIME     NULL,
  lock_count    SMALLINT     NOT NULL DEFAULT 0,
  window_start  DATETIME     NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Log aktivitas: tambah saja, tidak diubah atau dihapus lewat aplikasi.
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NULL,
  user_name   VARCHAR(120) NOT NULL DEFAULT '',
  event       VARCHAR(60)  NOT NULL,
  detail      VARCHAR(500) NOT NULL DEFAULT '',
  source      VARCHAR(10)  NOT NULL DEFAULT 'server',
  ip          VARCHAR(45)  NOT NULL DEFAULT '',
  user_agent  VARCHAR(255) NOT NULL DEFAULT '',
  created_at  DATETIME(3)  NOT NULL,
  KEY ix_audit_time (created_at),
  KEY ix_audit_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
