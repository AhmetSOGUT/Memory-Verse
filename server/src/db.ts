import Database from "better-sqlite3";
import { migrations } from "./migrations.js";

export type DB = Database.Database;

/** Veritabanını açar ve bekleyen geçişleri uygular. Her geçiş tek bir işlemdir: yarım kalmaz. */
export function openDatabase(file: string): DB {
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  return db;
}

function migrate(db: DB): void {
  const current = db.pragma("user_version", { simple: true }) as number;
  for (let version = current; version < migrations.length; version++) {
    db.transaction(() => {
      db.exec(migrations[version]);
      db.pragma(`user_version = ${version + 1}`);
    })();
  }
}