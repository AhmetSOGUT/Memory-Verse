import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildApp } from "./app.js";
import { openDatabase } from "./db.js";

/** Bellek içi veritabanı + geçici fotoğraf klasörüyle izole bir test uygulaması. */
export function createTestApp() {
  const photosDir = fs.mkdtempSync(path.join(os.tmpdir(), "memory-verse-test-"));
  const app = buildApp(openDatabase(":memory:"), { photosDir });
  return { app, photosDir, cleanup: () => fs.rmSync(photosDir, { recursive: true, force: true }) };
}