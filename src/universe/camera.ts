import { FOV_DEFAULT, FOV_MAX, FOV_MAX_PORTRAIT } from "./constants";

/**
 * Yakınlaştırma değerinden (zoom) gerçek dikey görüş açısını üretir.
 * Yatay ekranda zoom olduğu gibi kullanılır (PC davranışı değişmez).
 * Dikey ekranda yatay görüş çok daraldığı için dikey açı genişletilir; böylece telefonda daha fazla gökyüzü görünür.
 */
export function fovForAspect(zoom: number, aspect: number): number {
  if (aspect >= 1) return Math.min(zoom, FOV_MAX);
  return Math.min(zoom * Math.pow(aspect, -0.35), FOV_MAX_PORTRAIT);
}

/**
 * Açılışta ilk kürenin yönüne bakmak için (yaw, pitch). Küre ekranın üst-orta bölgesine oturur.
 * Geçici çözüm: küre yerleşimi yeniden tasarlanınca (zamana göre sarmal) gereksiz kalabilir.
 */
export function lookAtFirstOrb(
  pos: [number, number, number], aspect: number,
): { yaw: number; pitch: number } {
  const [x, y, z] = pos;
  const halfV = (fovForAspect(FOV_DEFAULT, aspect) * Math.PI) / 360;
  const place = Math.atan(0.35 * Math.tan(halfV)); // küre ekranda ortanın bu kadar üstünde dursun
  const elevation = Math.atan2(y, Math.hypot(x, z));
  const limit = Math.PI / 2 - 0.05;
  return { yaw: Math.atan2(x, z), pitch: Math.max(-limit, Math.min(limit, elevation - place)) };
}