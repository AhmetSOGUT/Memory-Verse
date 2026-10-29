import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { it } from "node:test";
import Database from "better-sqlite3";
import { openDatabase } from "./db.js";
import { migrations } from "./migrations.js";

it("eski sürümdeki (v1) veritabanını veri kaybetmeden yükseltir", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-migrate-"));
  const file = path.join(dir, "eski.sqlite");
  try {
    // Gerçek bir kullanıcının elindeki gibi: yalnızca 1. geçiş uygulanmış, içinde anı var
    const old = new Database(file);
    old.exec(migrations[0]);
    old.pragma("user_version = 1");
    old.prepare("INSERT INTO memories (date, title, description) VALUES (?, ?, ?)").run("2026-10-08", "Eski anı", "Korunmalı");
    old.close();

    const db = openDatabase(file);
    assert.equal(db.pragma("user_version", { simple: true }), migrations.length);
    const row = db.prepare("SELECT title, created_by FROM memories").get() as { title: string; created_by: number | null };
    assert.equal(row.title, "Eski anı");
    assert.equal(row.created_by, null); // yazarı bilinmeyen eski anı
    db.prepare("SELECT 1 FROM users").all(); // yeni tablolar var
    db.prepare("SELECT 1 FROM sessions").all();
    db.close();

    // İkinci açılış hiçbir şey değiştirmez
    const again = openDatabase(file);
    assert.equal(again.pragma("user_version", { simple: true }), migrations.length);
    again.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});