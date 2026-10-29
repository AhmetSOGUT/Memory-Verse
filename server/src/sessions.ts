import { createHash, randomBytes } from "node:crypto";
import type { DB } from "./db.js";
import { toPublicUser, type PublicUser } from "./users.js";

const DAY = 24 * 60 * 60 * 1000;
/** Kullanılmayan oturum bu süre sonra düşer; kullanıldıkça uzar. */
export const IDLE_LIFETIME_MS = 30 * DAY;
/** Hiçbir oturum, açıldığından bu kadar sonra (kullanılsa bile) yaşamaz. */
export const ABSOLUTE_LIFETIME_MS = 90 * DAY;
/** last_seen / süre uzatma yazımı en fazla saatte bir (her istekte yazma yok). */
const REFRESH_AFTER_MS = 60 * 60 * 1000;

/** Çerezdeki anahtarın özeti. Veritabanında yalnızca özet durur: DB sızsa da anahtar çıkarılamaz. */
const sha256 = (token: string) => createHash("sha256").update(token).digest("hex");

export interface ActiveSession {
  sessionId: number;
  user: PublicUser;
}

interface SessionJoinRow {
  session_id: number;
  created_at: number;
  last_seen_at: number;
  expires_at: number;
  id: number;
  username: string;
  display_name: string;
}

export class SessionStore {
  constructor(private readonly db: DB) {}

  /** Yeni oturum açar; çerezde taşınacak anahtarı döndürür. */
  create(userId: number, userAgent: string | undefined): { token: string; maxAgeSeconds: number } {
    const token = randomBytes(32).toString("base64url"); // 256 bit
    const now = Date.now();
    this.db
      .prepare(
        "INSERT INTO sessions (token_hash, user_id, created_at, last_seen_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(sha256(token), userId, now, now, now + IDLE_LIFETIME_MS, userAgent?.slice(0, 300) ?? null);
    return { token, maxAgeSeconds: Math.floor(IDLE_LIFETIME_MS / 1000) };
  }

  validate(token: string): ActiveSession | null {
    if (token.length < 20 || token.length > 200) return null;
    const row = this.db
      .prepare<[string], SessionJoinRow>(
        `SELECT s.id AS session_id, s.created_at, s.last_seen_at, s.expires_at,
                u.id, u.username, u.display_name
           FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.token_hash = ?`,
      )
      .get(sha256(token));
    if (!row) return null;

    const now = Date.now();
    if (row.expires_at <= now || row.created_at + ABSOLUTE_LIFETIME_MS <= now) {
      this.db.prepare("DELETE FROM sessions WHERE id = ?").run(row.session_id);
      return null;
    }
    if (now - row.last_seen_at > REFRESH_AFTER_MS) {
      const expiresAt = Math.min(now + IDLE_LIFETIME_MS, row.created_at + ABSOLUTE_LIFETIME_MS);
      this.db.prepare("UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?").run(now, expiresAt, row.session_id);
    }
    return { sessionId: row.session_id, user: toPublicUser(row) };
  }

  revoke(sessionId: number): void {
    this.db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
  }

  revokeByToken(token: string): void {
    this.db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
  }

  /** Parola değişince: mevcut oturum dışındakilerin hepsi kapanır. */
  revokeOthers(userId: number, keepSessionId: number): void {
    this.db.prepare("DELETE FROM sessions WHERE user_id = ? AND id != ?").run(userId, keepSessionId);
  }

  purgeExpired(): number {
    return this.db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now()).changes;
  }
}