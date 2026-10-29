/**
 * Veritabanı şeması: sıralı geçişler (migration).
 * Yeni bir değişiklik gerekirse listeye YENİ bir madde ekle; eskilerini asla değiştirme.
 * Sürüm numarası SQLite'ın `user_version` alanında tutulur.
 */
export const migrations: string[] = [
  // 1 — anılar
  `
  CREATE TABLE memories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    date        TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT NOT NULL,
    photo       TEXT,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX idx_memories_date ON memories(date);
  `,

  // 2 — kullanıcılar, oturumlar, anının sahibi
  `
  CREATE TABLE users (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    username            TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name        TEXT NOT NULL,
    password_hash       TEXT NOT NULL,
    created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    password_changed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE sessions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash   TEXT NOT NULL UNIQUE,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    expires_at   INTEGER NOT NULL,
    user_agent   TEXT
  );
  CREATE INDEX idx_sessions_user ON sessions(user_id);

  ALTER TABLE memories ADD COLUMN created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
  `,
];