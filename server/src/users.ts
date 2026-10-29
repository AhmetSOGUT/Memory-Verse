import type { DB } from "./db.js";
import type { PasswordHasher } from "./passwords.js";

export interface UserRow {
  id: number;
  username: string;
  display_name: string;
  password_hash: string;
  created_at: string;
  password_changed_at: string;
}

/** İstemciye gönderilebilen kullanıcı bilgisi (parola özeti asla çıkmaz). */
export interface PublicUser {
  id: number;
  username: string;
  displayName: string;
}

export const toPublicUser = (row: Pick<UserRow, "id" | "username" | "display_name">): PublicUser => ({
  id: row.id,
  username: row.username,
  displayName: row.display_name,
});

/** Kullanıcıya gösterilebilecek doğrulama hatası. */
export class UserError extends Error {}

const USERNAME_PATTERN = /^[a-z0-9._-]{2,32}$/;
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function validatePassword(password: string, username: string): void {
  if (password.length < PASSWORD_MIN) throw new UserError(`Parola en az ${PASSWORD_MIN} karakter olmalı`);
  if (password.length > PASSWORD_MAX) throw new UserError(`Parola en fazla ${PASSWORD_MAX} karakter olabilir`);
  if (password.toLowerCase().includes(username.toLowerCase())) throw new UserError("Parola kullanıcı adını içermemeli");
  if (new Set(password).size < 5) throw new UserError("Parola çok basit: daha çeşitli karakterler kullan");
}

export function findUserByUsername(db: DB, username: string): UserRow | undefined {
  return db.prepare<[string], UserRow>("SELECT * FROM users WHERE username = ?").get(normalizeUsername(username));
}

export async function createUser(
  db: DB,
  hasher: PasswordHasher,
  input: { username: string; displayName: string; password: string },
): Promise<PublicUser> {
  const username = normalizeUsername(input.username);
  const displayName = input.displayName.trim();
  if (!USERNAME_PATTERN.test(username)) {
    throw new UserError("Kullanıcı adı 2-32 karakter olmalı; yalnızca harf, rakam, nokta, tire ve alt çizgi");
  }
  if (displayName.length < 1 || displayName.length > 60) throw new UserError("Görünen ad 1-60 karakter olmalı");
  validatePassword(input.password, username);

  const hash = await hasher.hash(input.password);
  try {
    const { lastInsertRowid } = db
      .prepare("INSERT INTO users (username, display_name, password_hash) VALUES (?, ?, ?)")
      .run(username, displayName, hash);
    return { id: Number(lastInsertRowid), username, displayName };
  } catch (err) {
    if ((err as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE") throw new UserError("Bu kullanıcı adı zaten var");
    throw err;
  }
}

export async function setPassword(
  db: DB,
  hasher: PasswordHasher,
  user: Pick<UserRow, "id" | "username">,
  newPassword: string,
): Promise<void> {
  validatePassword(newPassword, user.username);
  const hash = await hasher.hash(newPassword);
  db.prepare(
    `UPDATE users SET password_hash = ?, password_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
  ).run(hash, user.id);
}

export function listUsers(db: DB): UserRow[] {
  return db.prepare<[], UserRow>("SELECT * FROM users ORDER BY id").all();
}

export function deleteUser(db: DB, username: string): boolean {
  return db.prepare("DELETE FROM users WHERE username = ?").run(normalizeUsername(username)).changes > 0;
}