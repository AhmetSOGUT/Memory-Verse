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
];