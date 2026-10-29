import path from "node:path";
import { BACKUP_PASSWORD_MIN, BackupError, createBackup, restoreBackup, verifyBackup } from "../backup.js";
import { config } from "../config.js";

const HELP = `Kullanım (server klasöründe):
  npm run backup -- create --to <klasor> [--keep 10]     Şifreli yedek alır (parola iki kez sorulur)
  npm run backup -- verify <dosya.mvbak>                 Yedeğin şifresini açıp doğrular (hiçbir şeyi değiştirmez)
  npm run backup -- restore <dosya.mvbak> [--into <klasor>]
                                                         Yedeği YENİ bir klasöre açar (varsayılan: data-restored).
                                                         Var olan veriyi asla ezmez; yerine koymayı sen yaparsın.`;

// ─── Parola girişi (yazarken ekranda görünmez) ────────────────────────────────

let pipedLines: string[] | null = null;

async function promptHidden(question: string): Promise<string> {
  const { stdin, stdout } = process;
  if (!stdin.isTTY) {
    if (!pipedLines) {
      const chunks: Buffer[] = [];
      for await (const c of stdin) chunks.push(c as Buffer);
      pipedLines = Buffer.concat(chunks).toString("utf8").split(/\r?\n/);
    }
    stdout.write(`${question}(girdi gizlenemiyor)\n`);
    return pipedLines.shift() ?? "";
  }
  return new Promise((resolve, reject) => {
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
        if (ch === "\r" || ch === "\n") { finish(); resolve(value); return; }
        if (ch === "\u0003") { finish(); reject(new BackupError("İptal edildi")); return; }
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

function option(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  if (command === "create") {
    const to = option(rest, "--to");
    if (!to) throw new BackupError("--to <klasor> gerekli (yedeğin konacağı klasör)");
    const keep = Number(option(rest, "--keep") ?? 10);
    console.log(`Yedek parolası (en az ${BACKUP_PASSWORD_MIN} karakter). DİKKAT: parolayı kaybedersen yedek hiç kimse tarafından açılamaz.`);
    const password = await promptHidden("Yedek parolası: ");
    if (password !== (await promptHidden("Yedek parolası (tekrar): "))) throw new BackupError("Parolalar aynı değil");

    console.log("Yedek alınıyor ve doğrulanıyor...");
    const result = await createBackup({
      dbPath: path.join(config.dataDir, "memory-verse.sqlite"),
      photosDir: path.join(config.dataDir, "photos"),
      destDir: path.resolve(to),
      password,
      keep,
    });
    console.log(`\nYedek hazır ve doğrulandı: ${result.file}`);
    console.log(`  ${result.summary.photos} fotoğraf, dosya boyutu ${mb(result.bytes)}`);
    if (result.pruned.length) console.log(`  Eski ${result.pruned.length} yedek silindi (son ${keep} tutuluyor).`);
    return;
  }

  if (command === "verify" || command === "restore") {
    const file = rest[0];
    if (!file || file.startsWith("--")) throw new BackupError("Yedek dosyasının yolunu yaz");
    const password = await promptHidden("Yedek parolası: ");
    if (command === "verify") {
      const s = await verifyBackup(path.resolve(file), password);
      console.log(`\nYedek sağlam: ${s.photos} fotoğraf, ${mb(s.bytes)} veri, oluşturulma ${s.createdAt}`);
      return;
    }
    const into = path.resolve(option(rest, "--into") ?? path.join(path.dirname(config.dataDir), "data-restored"));
    const s = await restoreBackup({ file: path.resolve(file), password, intoDir: into });
    console.log(`\nGeri yüklendi: ${into}`);
    console.log(`  ${s.photos} fotoğraf, ${mb(s.bytes)} veri.`);
    console.log("Bu klasör şu an kullanılmıyor. Yerine koymak için sunucuyu kapat, server\\data'yı yeniden adlandır, bunu data yap.");
    return;
  }

  console.log(HELP);
  if (command) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`\nHATA: ${err instanceof BackupError ? err.message : (err as Error).message}`);
  process.exitCode = 1;
});