import { SPHERE_RADIUS, WORLD } from "./constants";

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Deterministik [0,1) sayı: aynı dizin + tuz her zaman aynı değeri verir.
 * Böylece bir kürenin sapması ve gezinme fazı, başka anılar eklenip silinse de değişmez.
 */
export function hash01(i: number, salt: number): number {
  let x = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b);
  x ^= x >>> 15;
  x = Math.imul(x, 0x2c1b3c6d);
  x ^= x >>> 12;
  x = Math.imul(x, 0x297a2d39);
  x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
}

// ─── Kabuklar ────────────────────────────────────────────────────────────────
interface Shell {
  radius: number;
  /** Bu kabukta toplam kaç küre yeri var (sıklık ≈ spacing). */
  count: number;
  /** Bu kabuğun ilk kürenin genel dizini. */
  start: number;
}
const shells: Shell[] = [];

function shellAt(k: number): Shell {
  while (shells.length <= k) {
    const idx = shells.length;
    const radius = WORLD.innerRadius + idx * WORLD.spacing;
    const count = Math.max(12, Math.round((4 * Math.PI * radius * radius) / (WORLD.spacing * WORLD.spacing)));
    const prev = shells[idx - 1];
    shells.push({ radius, count, start: prev ? prev.start + prev.count : 0 });
  }
  return shells[k]!;
}

/** Genel dizinden (kabuk, kabuktaki sıra). Kabuk sayısı küçüktür (~15), doğrusal arama yeter. */
export function locate(i: number): { shell: number; j: number } {
  let k = 0;
  while (i >= shellAt(k).start + shellAt(k).count) k++;
  return { shell: k, j: i - shellAt(k).start };
}

/** n anılık dünyanın en dış kabuğunun yarıçapı (+ sapma payı). */
export function worldRadius(n: number): number {
  const { shell } = locate(Math.max(n, 1) - 1);
  return shellAt(shell).radius + WORLD.radialJitter * WORLD.spacing + SPHERE_RADIUS;
}

/** Kabuk sayısı (dizi boyutlandırmak için): n anıyı kapsayan en yüksek kabuk dizini + 1. */
export function shellCount(n: number): number {
  return locate(Math.max(n, 1) - 1).shell + 1;
}

/** Birim vektörü (axis) etrafında `angle` kadar döndürür (Rodrigues); `out`'a yazar. */
function rotate(
  x: number, y: number, z: number, ax: number, ay: number, az: number, cos: number, sin: number,
  out: Float32Array, o: number,
): void {
  const dot = ax * x + ay * y + az * z;
  const cx = ay * z - az * y, cy = az * x - ax * z, cz = ax * y - ay * x;
  const k = dot * (1 - cos);
  out[o] = x * cos + cx * sin + ax * k;
  out[o + 1] = y * cos + cy * sin + ay * k;
  out[o + 2] = z * cos + cz * sin + az * k;
}

/** Rastgele ama SABİT birim vektör (kabuğun dönme ekseni vb.). */
function randomUnit(seed: number, salt: number, out: Float32Array, o: number): void {
  const z = hash01(seed, salt) * 2 - 1;
  const a = hash01(seed, salt + 1) * TAU;
  const r = Math.sqrt(1 - z * z);
  out[o] = r * Math.cos(a);
  out[o + 1] = z;
  out[o + 2] = r * Math.sin(a);
}
const tmp3 = new Float32Array(3);
const tmpAxis = new Float32Array(3);

/**
 * i. anının yuvası (dönme ve gezinme hariç), `out[o..o+2]`'ye yazılır.
 * Kabuğun üzerinde Fibonacci küresi: noktalar eşit aralıklı, tarih sırasıyla kuzeyden güneye bir sarmal çizer.
 * Her kabuk rastgele (ama sabit) çevrilir, böylece kutuplar hep aynı yerde olmaz.
 */
export function writeSlot(i: number, out: Float32Array, o: number): void {
  const { shell, j } = locate(i);
  const sh = shellAt(shell);
  const z = 1 - (2 * (j + 0.5)) / sh.count;
  const ring = Math.sqrt(1 - z * z);
  const phi = j * GOLDEN_ANGLE;
  const px = ring * Math.cos(phi), py = z, pz = ring * Math.sin(phi);

  // Kabuğun sabit rastgele yönelimi
  randomUnit(shell, 101, tmpAxis, 0);
  const tilt = hash01(shell, 103) * TAU;
  rotate(px, py, pz, tmpAxis[0]!, tmpAxis[1]!, tmpAxis[2]!, Math.cos(tilt), Math.sin(tilt), tmp3, 0);

  const r = sh.radius + (hash01(i, 1) - 0.5) * 2 * WORLD.radialJitter * WORLD.spacing;
  out[o] = tmp3[0]! * r;
  out[o + 1] = tmp3[1]! * r;
  out[o + 2] = tmp3[2]! * r;
}

/** Kabuğun yavaş dönüşü: eksen (birim) ve açısal hız (rad/sn, işaretli). Her kabuk farklı eksende ve yönde döner. */
export function shellSpin(shell: number, axisOut: Float32Array, o: number): number {
  randomUnit(shell, 201, axisOut, o);
  const dir = hash01(shell, 203) < 0.5 ? -1 : 1;
  return dir * WORLD.shellSpin * (0.35 + 0.65 * hash01(shell, 204));
}

/** Yuvası etrafında yavaş, doğal gezinme: her küre kendi fazında ve hızında. `out[o..o+2]`'ye yazar. */
export function writeWander(i: number, t: number, out: Float32Array, o: number): void {
  const A = WORLD.wander * WORLD.spacing;
  const p1 = hash01(i, 4) * TAU, p2 = hash01(i, 5) * TAU, p3 = hash01(i, 6) * TAU;
  const w1 = TAU / (45 + hash01(i, 7) * 50);
  const w2 = TAU / (60 + hash01(i, 8) * 60);
  const w3 = TAU / (50 + hash01(i, 9) * 60);
  out[o] = A * Math.sin(t * w1 + p1);
  out[o + 1] = A * 0.6 * Math.sin(t * w2 + p2);
  out[o + 2] = A * Math.cos(t * w3 + p3);
}

const stepScratch = new Float32Array(3);
const stepCos = new Float32Array(64);
const stepSin = new Float32Array(64);
const stepAxis = new Float32Array(64 * 3);
const stepRate = new Float32Array(64);
let stepAxesReady = 0;

/**
 * Bütün kürelerin dünya konumunu hesaplar: yuva (yumuşak geçişle) → kabuğun dönüşü → yuva etrafında gezinme.
 *  - `slots`: hedef yuvalar, `current`: kürelerin şu an bulunduğu yuvalar (her çağrıda hedefe doğru `glide` kadar kayar)
 *  - `shellOf`: her kürenin kabuk dizini; `t`: dünya saati (sn); `out`: dünya konumları (3·count)
 */
export function stepPositions(
  slots: Float32Array, current: Float32Array, out: Float32Array, shellOf: Uint16Array,
  count: number, t: number, glide: number,
): void {
  const K = Math.min(shellCount(count), 64);
  for (let k = stepAxesReady; k < K; k++) stepRate[k] = shellSpin(k, stepAxis, k * 3);
  stepAxesReady = Math.max(stepAxesReady, K);
  for (let k = 0; k < K; k++) {
    stepCos[k] = Math.cos(stepRate[k]! * t);
    stepSin[k] = Math.sin(stepRate[k]! * t);
  }
  const w = stepScratch;
  for (let i = 0; i < count; i++) {
    const o = i * 3;
    const dx = slots[o]! - current[o]!, dy = slots[o + 1]! - current[o + 1]!, dz = slots[o + 2]! - current[o + 2]!;
    if (dx * dx + dy * dy + dz * dz > 1e-4) {
      current[o] = current[o]! + dx * glide;
      current[o + 1] = current[o + 1]! + dy * glide;
      current[o + 2] = current[o + 2]! + dz * glide;
    }
    const k = Math.min(shellOf[i]!, 63);
    rotate(
      current[o]!, current[o + 1]!, current[o + 2]!,
      stepAxis[k * 3]!, stepAxis[k * 3 + 1]!, stepAxis[k * 3 + 2]!, stepCos[k]!, stepSin[k]!, out, o,
    );
    writeWander(i, t, w, 0);
    out[o] = out[o]! + w[0]!;
    out[o + 1] = out[o + 1]! + w[1]!;
    out[o + 2] = out[o + 2]! + w[2]!;
  }
}

/** Uzaktan bakınca küreler çok küçülmesin: SCALE_START'tan sonra uzaklıkla orantılı büyütülür (en çok SCALE_MAX kat). */
export const SCALE_START = 250;
export const SCALE_MAX = 2.2;
export function visualScale(distance: number): number {
  return Math.min(Math.max(distance / SCALE_START, 1), SCALE_MAX);
}

/**
 * Bütün canlı dünya durumu. Her karede World bileşeni yazar; çizim, seçim ve kamera bileşenleri okur
 * (React durumu değil: kare başına yenilenir). Bileşenlere `RefObject<WorldStore>` olarak verilir.
 * Kare içinde yapılan değişiklikler yöntemlerle yapılır.
 */
export class WorldStore {
  /** Anı sayısı. */
  n = 0;
  /** Her kürenin dünya konumu (3·n): dönme ve gezinme dahil. */
  pos = new Float32Array(0);
  /** Zaman çarpanı: 1 normal, fare/parmak/seçim varken düşer (yakalamak kolay olsun). */
  motion = 1;
  /** Üzerine gelinen kürenin dizini (yoksa -1). Yalnızca fare. */
  hovered = -1;
  /** Seçili kürenin dizini (yoksa -1). */
  selected = -1;
  /** Parmak/fare basılı mı. */
  interacting = false;
  /** Tam ayrıntıyla çizilen kürelerin dizinleri ve değiştikçe artan sürüm numarası. */
  near = new Set<number>();
  nearVersion = 0;

  // ─── İnceleme modu: kamera seçili kürenin etrafında döner, tekerlek/sıkıştırma yaklaştırır ───
  /** Seçili küreyi incelerken kamera ile kürenin merkezi arasındaki uzaklık (0 = tam merkez). */
  focusDistance: number = WORLD.fly.dockDistance;

  /** Her karede World çağırır: anı sayısı ve seçili dizin. Konum dizisi (3·n) gerekirse yeniden ayrılır. */
  sync(n: number, selected: number): void {
    if (selected !== this.selected) {
      // Yeni seçim: inceleme uzaklığı başlangıç değerine döner
      this.focusDistance = WORLD.fly.dockDistance;
    }
    this.n = n;
    this.selected = selected;
    if (this.pos.length !== n * 3) this.pos = new Float32Array(n * 3);
  }

  /** Zaman çarpanını hedefe doğru yumuşatır: fare üstündeyken, parmak basılıyken ve bir küre seçiliyken dünya neredeyse durur. */
  easeMotion(k: number): void {
    const slow = WORLD.motionSlow;
    const wanted = this.selected >= 0 ? slow.selected : this.hovered >= 0 ? slow.hover : this.interacting ? slow.press : 1;
    this.motion += (wanted - this.motion) * (1 - Math.pow(1 - 0.08, k));
  }

  setNear(next: Set<number>): void {
    this.near = next;
    this.nearVersion++;
  }

  setFocusDistance(d: number): void {
    this.focusDistance = Math.min(Math.max(d, WORLD.fly.focusMin), WORLD.fly.focusMax);
  }
}

export const createWorldStore = (): WorldStore => new WorldStore();