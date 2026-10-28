import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/** OWASP'ın scrypt için önerdiği asgari yapılandırma: N=2^17, r=8, p=1 (~128 MiB bellek). */
export const DEFAULT_COST = 2 ** 17;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;

function derive(password: string, salt: Buffer, N: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const options: ScryptOptions = { N, r, p, maxmem: 256 * 1024 * 1024 };
    // NFKC: aynı görünen parola farklı cihaz/klavyelerde (özellikle Türkçe karakterlerde) aynı sonucu versin
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

/**
 * Parola özetleme. Biçim: scrypt$N$r$p$tuz$özet (parametreler özetin içinde durur;
 * ileride maliyeti artırsak eski parolalar doğrulanmaya devam eder).
 * Aynı anda en fazla `maxConcurrent` özetleme çalışır: her biri ~128 MiB kullandığı için
 * art arda gelen giriş denemeleri belleği tüketemesin.
 */
export class PasswordHasher {
  private active = 0;
  private waiting: Array<() => void> = [];

  constructor(
    private readonly cost = DEFAULT_COST,
    private readonly maxConcurrent = 2,
  ) {}

  private async slot<T>(work: () => Promise<T>): Promise<T> {
    if (this.active >= this.maxConcurrent) {
      await new Promise<void>((resolve) => this.waiting.push(resolve)); // sıra bize devredilir
    } else {
      this.active++;
    }
    try {
      return await work();
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.active--;
    }
  }

  hash(password: string): Promise<string> {
    return this.slot(async () => {
      const salt = randomBytes(16);
      const key = await derive(password, salt, this.cost, R, P);
      return `scrypt$${this.cost}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
    });
  }

  /** Bozuk/yabancı biçimli özette de hata fırlatmaz, false döner. */
  verify(password: string, stored: string): Promise<boolean> {
    return this.slot(async () => {
      const parts = stored.split("$");
      if (parts.length !== 6 || parts[0] !== "scrypt") return false;
      const [N, r, p] = parts.slice(1, 4).map(Number);
      const okRange = Number.isInteger(Math.log2(N)) && N >= 2 ** 10 && N <= 2 ** 20 && r >= 1 && r <= 32 && p >= 1 && p <= 4;
      if (!okRange) return false;
      const salt = Buffer.from(parts[4], "base64");
      const expected = Buffer.from(parts[5], "base64");
      if (salt.length === 0 || expected.length !== KEY_LENGTH) return false;
      const actual = await derive(password, salt, N, r, p);
      return timingSafeEqual(actual, expected); // sabit zamanlı karşılaştırma
    });
  }
}