import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { openDatabase } from "../db.js";
import { PasswordHasher } from "../passwords.js";
import { createUser, deleteUser, findUserByUsername, listUsers, setPassword, UserError } from "../users.js";

const HELP = `Kullanım (server klasöründe):
  npm run user -- create <kullanici-adi> "<Görünen Ad>"   Yeni hesap açar (parola sorulur)
  npm run user -- passwd <kullanici-adi>                    Parolayı değiştirir, tüm oturumları kapatır
  npm run user -- list                                      Hesapları listeler
  npm run user -- delete <kullanici-adi> --yes              Hesabı siler (anıları kalır)`;

// ─── Parola girişi (yazarken ekranda görünmez) ────────────────────────────────

let pipedLines: string[] | null = null;

async function readAllStdin(): Promise<string[]> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8").split(/\r?\n/);
}

async function promptHidden(question: string): Promise<string> {
  const { stdin, stdout } = process;

  if (!stdin.isTTY) {
    // Etkileşimsiz ortam (boru hattı / bazı terminaller): satırlar sırayla okunur, gizlenemez
    pipedLines ??= await readAllStdin();
    stdout.write(`${question}(girdi gizlenemiyor)\n`);
    return pipedLines.shift() ?? "";
  }

  return new Promise((resolve, reject) => {
    // Önce yankıyı kapat, sonra istemi yaz: aradaki anda yazılan hiçbir karakter ekrana düşmesin
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdout.write(question);
    let value = "";

    const finish = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
      stdout.write("\n");
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          finish();
          resolve(value);
          return;
        }
        if (ch === "\u0003") {
          finish();
          reject(new UserError("İptal edildi"));
          return;
        }
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

async function askNewPassword(): Promise<string> {
  const first = await promptHidden("Parola (en az 12 karakter): ");
  const second = await promptHidden("Parola (tekrar): ");
  if (first !== second) throw new UserError("Parolalar aynı değil");
  return first;
}

// ─── Komutlar ─────────────────────────────────────────────────────────────────

const [command, ...args] = process.argv.slice(2);

fs.mkdirSync(config.dataDir, { recursive: true });
const db = openDatabase(path.join(config.dataDir, "memory-verse.sqlite"));
const hasher = new PasswordHasher();

try {
  switch (command) {
    case "create": {
      const [username, displayName] = args;
      if (!username || !displayName) throw new UserError('Kullanım: create <kullanici-adi> "<Görünen Ad>"');
      const password = await askNewPassword();
      const user = await createUser(db, hasher, { username, displayName, password });
      console.log(`✅ Hesap açıldı: ${user.username} (${user.displayName})`);
      break;
    }
    case "passwd": {
      const [username] = args;
      const row = username ? findUserByUsername(db, username) : undefined;
      if (!row) throw new UserError("Böyle bir kullanıcı yok");
      const password = await askNewPassword();
      await setPassword(db, hasher, row, password);
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(row.id); // her yerden çıkış yaptır
      console.log(`✅ ${row.username} için parola değiştirildi, açık tüm oturumlar kapatıldı.`);
      break;
    }
    case "list": {
      const users = listUsers(db);
      if (users.length === 0) console.log("Henüz hesap yok.");
      for (const u of users) console.log(`${u.id}\t${u.username}\t${u.display_name}\toluşturulma: ${u.created_at}`);
      break;
    }
    case "delete": {
      const [username, flag] = args;
      if (!username) throw new UserError("Kullanım: delete <kullanici-adi> --yes");
      if (flag !== "--yes") throw new UserError("Silme geri alınamaz. Emin olduğunda sonuna --yes ekle.");
      console.log(deleteUser(db, username) ? `🗑️  ${username} silindi.` : "Böyle bir kullanıcı yok.");
      break;
    }
    default:
      console.log(HELP);
  }
} catch (err) {
  if (err instanceof UserError) {
    console.error(`❌ ${err.message}`);
    process.exitCode = 1;
  } else {
    throw err;
  }
} finally {
  db.close();
}