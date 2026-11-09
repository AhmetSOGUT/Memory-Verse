import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { locate, stepPositions, writeSlot, type WorldStore } from "./world";

interface WorldProps {
  store: React.RefObject<WorldStore>;
  /** Anı sayısı. Anılar tarih sırasında gelir: dizin = dünyadaki sıra. */
  count: number;
  selectedIndex: number;
}

/**
 * Dünyanın saati ve konumları. Her karede her kürenin dünya konumunu hesaplar (kabuğun dönüşü + kendi yuvası
 * etrafında gezinme) ve ortak duruma (store) yazar. Çizim, seçim ve kamera bileşenleri bunu okur.
 * Sahnede, bunları okuyan bileşenlerden ÖNCE gelmeli (aynı karede güncel konumları görsünler).
 */
export function World({ store, count, selectedIndex }: WorldProps) {
  const slots = useMemo(() => {
    const a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) writeSlot(i, a, i * 3);
    return a;
  }, [count]);
  const shellOf = useMemo(() => {
    const a = new Uint16Array(count);
    for (let i = 0; i < count; i++) a[i] = locate(i).shell;
    return a;
  }, [count]);
  /** Kürelerin o an bulunduğu yuvalar. Hedef yuva değişirse (ör. geçmiş tarihli anı eklenip sıralar kaydı) yumuşakça süzülür. */
  const current = useRef(new Float32Array(0));
  const clock = useRef(0);

  useFrame((_, delta) => {
    const g = store.current;
    const dt = Math.min(delta, 0.1); // arka plandan dönünce zaman sıçramasın
    const k = Math.min(dt * 60, 3);
    g.sync(count, selectedIndex);

    if (current.current.length !== slots.length) {
      const next = new Float32Array(slots.length);
      const keep = Math.min(current.current.length, next.length);
      next.set(current.current.subarray(0, keep));
      next.set(slots.subarray(keep), keep); // yeni kürelerin yuvası doğrudan hedef: kayma yok
      current.current = next;
    }
    const glide = 1 - Math.pow(1 - 0.05, k);

    // Hareket çarpanı: fare üstündeyken, parmak basılıyken ve bir küre seçiliyken dünya neredeyse durur
    g.easeMotion(k);
    clock.current += dt * g.motion;

    stepPositions(slots, current.current, g.pos, shellOf, count, clock.current, glide);
  });

  return null;
}