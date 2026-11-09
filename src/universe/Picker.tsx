import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Memory } from "../types";
import { SPHERE_RADIUS, WORLD } from "./constants";
import { visualScale, type WorldStore } from "./world";

interface PickerProps {
  store: React.RefObject<WorldStore>;
  /** Tarih sırasında; dizin = dünyadaki sıra. */
  memories: Memory[];
  dragState: React.RefObject<{ moved: boolean }>;
  onSelect: (id: number) => void;
  onDeselect: () => void;
}

/**
 * Mıknatıs seçim: dokunulan/tıklanan noktaya EKRANDA en yakın küre seçilir (kamera ona uçar). Küçük ya da hareket eden
 * küreyi tam üstünden vurmak gerekmez; tam çizilen de, uzaktaki nokta olan da aynı şekilde seçilir.
 * Boşluğa dokunmak seçimi kaldırır. Fareyle üzerine gelinen küreyi işaretler (imleç + dünya yavaşlar).
 */
export function Picker({ store, memories, dragState, onSelect, onDeselect }: PickerProps) {
  const { gl, camera } = useThree();
  const latest = useRef({ memories, onSelect, onDeselect });
  useEffect(() => {
    latest.current = { memories, onSelect, onDeselect };
  });

  useEffect(() => {
    const el = gl.domElement;
    const cam = camera as THREE.PerspectiveCamera;
    const g = store.current;
    const v = new THREE.Vector3();

    /** Ekran noktasına (CSS pikseli) en uygun kürenin dizini; yoksa -1. */
    function pick(clientX: number, clientY: number, touch: boolean): number {
      const rect = el.getBoundingClientRect();
      const px = clientX - rect.left, py = clientY - rect.top;
      const pxPerUnit = rect.height / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      const base = touch ? WORLD.pickRadius.touch : WORLD.pickRadius.mouse;
      let best = -1, bestScore = Infinity, bestDepth = Infinity;
      for (let i = 0; i < g.n; i++) {
        // Seçili küre kameranın önüne gelmiştir: gerçek (görünen) konumundan ölçülür
        if (i === g.selected) v.fromArray(g.selectedPos, 0);
        else v.fromArray(g.pos, i * 3);
        const depth = v.distanceTo(cam.position);
        v.project(cam);
        if (v.z > 1) continue; // kameranın arkasında
        const sx = (v.x * 0.5 + 0.5) * rect.width, sy = (-v.y * 0.5 + 0.5) * rect.height;
        const radius = (SPHERE_RADIUS * visualScale(depth) * pxPerUnit) / Math.max(depth, 1);
        const d = Math.hypot(sx - px, sy - py);
        if (d > base + radius) continue;
        const score = d - radius; // küre diskinin içindeyse negatif; büyük/yakın küre öncelikli
        if (score < bestScore - 1e-6 || (Math.abs(score - bestScore) <= 1e-6 && depth < bestDepth)) {
          best = i; bestScore = score; bestDepth = depth;
        }
      }
      return best;
    }

    const clearHover = () => {
      if (g.hovered !== -1) g.hovered = -1;
      if (el.style.cursor) el.style.cursor = "";
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.buttons !== 0) return clearHover();
      const idx = pick(e.clientX, e.clientY, false);
      g.hovered = idx;
      el.style.cursor = idx >= 0 ? "pointer" : "";
    };
    const onUp = (e: PointerEvent) => {
      if (e.button !== 0 || dragState.current.moved) return; // sürükleme/sıkıştırma tıklama değildir
      const idx = pick(e.clientX, e.clientY, e.pointerType !== "mouse");
      if (idx === g.selected && idx >= 0) return; // zaten seçili küreye tekrar dokunmak seçimi bozmasın
      const memory = idx >= 0 ? latest.current.memories[idx] : undefined;
      if (memory) latest.current.onSelect(memory.id);
      else latest.current.onDeselect();
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", clearHover);
    el.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", clearHover);
      el.removeEventListener("pointerup", onUp);
      clearHover();
    };
  }, [gl, camera, store, dragState]);

  return null;
}