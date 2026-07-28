-- schema.sql  ── Turso / SQLite
-- Run with:  turso db shell <your-db-name> < schema.sql

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT    NOT NULL UNIQUE,
  password   TEXT    NOT NULL,
  role       TEXT    NOT NULL DEFAULT 'user',
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Refresh tokens ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT    NOT NULL UNIQUE,
  expires_at TEXT    NOT NULL,
  revoked    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── TABLE 1: Core identity ────────────────────────────────────────────────────
-- Who the candidate is. Set once at registration, rarely changes.
CREATE TABLE IF NOT EXISTS candidate_profiles (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id            INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  email              TEXT    NOT NULL UNIQUE,
  application_number TEXT    NOT NULL,
  full_name          TEXT    NOT NULL,
  date_of_birth      TEXT    NOT NULL,
  created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── TABLE 2: Application form answers ────────────────────────────────────────
-- What the candidate filled in. Editable by the candidate (when unlocked).
CREATE TABLE IF NOT EXISTS candidate_form (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id         INTEGER NOT NULL UNIQUE REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  attendance           TEXT    NOT NULL,
  join_reason          TEXT    NOT NULL,
  primary_department   TEXT    NOT NULL,
  secondary_department TEXT    NOT NULL,
  other_societies      TEXT    NOT NULL,
  recruit_reason       TEXT    NOT NULL,
  updated_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── TABLE 3: Admin-controlled status ─────────────────────────────────────────
-- Locking, slot assignment, application decision. Only admins write here.
CREATE TABLE IF NOT EXISTS candidate_status (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id       INTEGER NOT NULL UNIQUE REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  application_status TEXT,
  form_locked        INTEGER NOT NULL DEFAULT 0,   -- 1 = locked by admin
  individual_unlock  INTEGER NOT NULL DEFAULT 0,   -- 1 = override global lock
  slot_id            INTEGER REFERENCES slots(id) ON DELETE SET NULL,
  updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── TABLE 4: Quiz / QR attendance ────────────────────────────────────────────
-- Tracks physical attendance via QR scan. Append-only in spirit.
CREATE TABLE IF NOT EXISTS candidate_quiz (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id     INTEGER NOT NULL UNIQUE REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  qr_token         TEXT    NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))),
  quiz_attended    INTEGER NOT NULL DEFAULT 0,
  quiz_attended_at TEXT,
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Slot tables ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS slot_day_dates (
  day_number INTEGER PRIMARY KEY,
  slot_date  TEXT
);

CREATE TABLE IF NOT EXISTS slot_time_schedules (
  slot_number INTEGER PRIMARY KEY,
  start_time  TEXT
);

CREATE TABLE IF NOT EXISTS slots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slot_day    INTEGER NOT NULL,
  slot_number INTEGER NOT NULL,
  slot_venue  TEXT    NOT NULL,
  UNIQUE (slot_day, slot_number, slot_venue)
);

-- ── App settings ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

INSERT INTO app_settings (key, value) VALUES ('global_form_locked', 'false')
ON CONFLICT (key) DO NOTHING;

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_candidates_user_id      ON candidate_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_candidates_email        ON candidate_profiles(email);
CREATE INDEX IF NOT EXISTS idx_candidate_form_cid      ON candidate_form(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_status_cid    ON candidate_status(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_status_slot   ON candidate_status(slot_id);
CREATE INDEX IF NOT EXISTS idx_candidate_quiz_cid      ON candidate_quiz(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_quiz_qrtoken  ON candidate_quiz(qr_token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token    ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id  ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_slots_day_number        ON slots(slot_day, slot_number);