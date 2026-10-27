import * as THREE from "three";
import { MILKY_WAY_NORMAL, MILKY_WAY_STAR_SHARE, STAR_COUNT } from "./constants";
// Rastgele veri üretimi bileşenlerin dışında tutulur (render saf kalsın).

/** Tohumlu rastgele sayı üreteci — aynı tohum, aynı gökyüzü. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createCircleTexture(size = 64): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const half = size / 2;
  const g = ctx.createRadialGradient(half, half, 0, half, half, half);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.3, "rgba(255,255,255,0.8)");
  g.addColorStop(0.7, "rgba(255,255,255,0.2)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export function createStarGeometry(seed = 1337): THREE.BufferGeometry {
  const rand = mulberry32(seed);
  const bandNormal = new THREE.Vector3(...MILKY_WAY_NORMAL).normalize();
  const dir = new THREE.Vector3();
  const pos = new Float32Array(STAR_COUNT * 3);
  const col = new Float32Array(STAR_COUNT * 3);
  const size = new Float32Array(STAR_COUNT);

  for (let i = 0; i < STAR_COUNT; i++) {
    const radius = 40 + rand() * 260;
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    dir.set(Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi));

    // Yıldızların bir kısmını Samanyolu düzlemine doğru sıkıştır
    if (rand() < MILKY_WAY_STAR_SHARE) {
      dir.addScaledVector(bandNormal, -dir.dot(bandNormal) * 0.88).normalize();
    }
    pos[i * 3] = dir.x * radius;
    pos[i * 3 + 1] = dir.y * radius;
    pos[i * 3 + 2] = dir.z * radius;

    const rn = rand();
    const c: [number, number, number] =
      rn < 0.6 ? [0.9, 0.95, 1.0]
      : rn < 0.8 ? [1.0, 1.0, 0.85]
      : rn < 0.9 ? [1.0, 0.85, 0.7]
      : [0.8, 0.85, 1.0];
    col.set(c, i * 3);

    const sr = rand();
    size[i] = sr < 0.03 ? 3.2 : sr < 0.15 ? 2.0 : rand() * 1.2 + 0.3;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(size, 1));
  return geo;
}

/** Kameranın çevresinde süzülen uzay tozu (±40 birimlik küp). */
export function createDustGeometry(count = 450): THREE.BufferGeometry {
  const rand = mulberry32(4242);
  const pos = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rand() - 0.5) * 80;
    pos[i * 3 + 1] = (rand() - 0.5) * 80;
    pos[i * 3 + 2] = (rand() - 0.5) * 80;
    phase[i] = rand();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
  return geo;
}

const NEBULA_PALETTES = [
  ["#5b2a9e", "#1f5fbf", "#c2306b"], // mor · mavi · magenta
  ["#0f8f8a", "#2f4fbf", "#7a3fc2"], // turkuaz · mavi · menekşe
  ["#c25a1f", "#b8326a", "#3a2f9e"], // turuncu · gül · indigo
] as const;

/** Her açılışta üç paletten biri (özellikle rastgele). */
export function pickNebulaPalette(): [THREE.Color, THREE.Color, THREE.Color] {
  const p = NEBULA_PALETTES[Math.floor(Math.random() * NEBULA_PALETTES.length)];
  return [new THREE.Color(p[0]), new THREE.Color(p[1]), new THREE.Color(p[2])];
}

/** Fotoğrafı kare kırpıp küre dokusuna çevirir. */
export function loadPhotoTexture(src: string, size = 512): Promise<THREE.CanvasTexture | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const ar = img.width / img.height;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (ar > 1) { sx = (img.width - img.height) / 2; sw = img.height; }
      else { sy = (img.height - img.width) / 2; sh = img.width; }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
      const tex = new THREE.CanvasTexture(canvas);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      resolve(tex);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Altın oran spiraliyle küre konumu (orijinal yerleşimle aynı). */
export function orbPosition(i: number, total: number): [number, number, number] {
  const golden = (1 + Math.sqrt(5)) / 2;
  const ainc = Math.PI * 2 * golden;
  const t2 = i / Math.max(total - 1, 1);
  const inc = Math.acos(1 - 2 * t2);
  const az = ainc * i;
  const rad = 300 + (i % 4) * 100;
  return [
    rad * Math.sin(inc) * Math.cos(az),
    rad * Math.cos(inc) * 0.5,
    rad * Math.sin(inc) * Math.sin(az),
  ];
}
