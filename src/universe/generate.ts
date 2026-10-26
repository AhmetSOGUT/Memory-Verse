import * as THREE from "three";
import { STAR_COUNT } from "./constants";

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
  const pos = new Float32Array(STAR_COUNT * 3);
  const col = new Float32Array(STAR_COUNT * 3);
  const size = new Float32Array(STAR_COUNT);

  for (let i = 0; i < STAR_COUNT; i++) {
    const radius = 40 + rand() * 260;
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    pos[i * 3 + 2] = radius * Math.cos(phi);

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

const NEBULA_PALETTES: [number, number, number][] = [
  [0.55, 0.15, 0.9], [0.95, 0.25, 0.55], [0.15, 0.45, 1.0], [1.0, 0.35, 0.1],
  [0.05, 0.75, 0.7], [0.7, 0.2, 1.0], [1.0, 0.6, 0.1], [0.1, 0.8, 0.4],
];

/** Her açılışta farklı renkte 2 nebula bulutu (özellikle rastgele). */
export function createNebulaGeometries(): THREE.BufferGeometry[] {
  const shuffled = [...NEBULA_PALETTES].sort(() => Math.random() - 0.5);
  const result: THREE.BufferGeometry[] = [];

  for (let ni = 0; ni < 2; ni++) {
    const [r, g, b] = shuffled[ni];
    const pos: number[] = [];
    const col: number[] = [];

    const angle = ni * Math.PI + Math.random() * 0.5;
    const elev = (Math.random() - 0.5) * 0.35;
    const dist = 580 + Math.random() * 120;
    const cx = dist * Math.cos(elev) * Math.cos(angle);
    const cy = dist * Math.sin(elev) * 0.5;
    const cz = dist * Math.cos(elev) * Math.sin(angle);
    const spread = 130 + Math.random() * 50;

    for (let i = 0; i < 160; i++) {
      const u = Math.random();
      const th = Math.random() * Math.PI * 2;
      const ph = (Math.random() - 0.5) * Math.PI;
      const rr = spread * Math.sqrt(-2 * Math.log(Math.max(u, 0.0001)));
      pos.push(
        cx + rr * Math.cos(ph) * Math.cos(th),
        cy + rr * Math.sin(ph) * 0.4,
        cz + rr * Math.cos(ph) * Math.sin(th),
      );
      const br = 0.3 + Math.random() * 0.7;
      const vary = (Math.random() - 0.5) * 0.1;
      col.push(
        Math.min(1, r * br + vary),
        Math.min(1, g * br),
        Math.min(1, b * br - vary),
      );
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    result.push(geo);
  }
  return result;
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
