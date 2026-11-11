import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Memory } from "../types";
import { ORB_COLORS, SPHERE_RADIUS, WORLD } from "./constants";
import { Orb } from "./Orb";
import { farOrbFragment, farOrbVertex } from "./shaders";
import { SCALE_MAX, SCALE_START, type WorldStore } from "./world";

interface OrbFieldProps {
  store: React.RefObject<WorldStore>;
  /** Tarih sırasında; dizin = dünyadaki sıra. */
  memories: Memory[];
  selectedId: number | null;
  /** Dokunmatik: tam çizilecek küre sayısı daha düşük (telefon GPU'su). */
  coarse: boolean;
  /** Deneme modunda (?near=N) tam çizilecek küre sayısını geçersiz kılar. */
  maxOverride?: number;
}

const CHECK_EVERY_S = 0.25;
const STICKY = 0.8; // zaten tam çizilen küre, yer değiştirmek için rakipten %20 daha yakın olmalı (sürekli gelip gitmesin)

/**
 * İki seviyeli çizim. Kameraya en yakın birkaç küre tam ayrıntıyla çizilir (cam + fotoğraf + hale, <Orb>),
 * geri kalanı tek çizim çağrısında parlak nokta olarak (<FarOrbs>). Binlerce anıda bile akıcı kalmak için.
 * Seçili ve üzerine gelinen küre her zaman tam çizilir.
 */
export function OrbField({ store, memories, selectedId, coarse, maxOverride }: OrbFieldProps) {
  const max = maxOverride ?? (coarse ? WORLD.nearMaxCoarse : WORLD.nearMax);
  const [nearList, setNearList] = useState<number[]>(() =>
    Array.from({ length: Math.min(memories.length, max) }, (_, i) => i),
  );
  const acc = useRef(CHECK_EVERY_S); // ilk karede hemen hesapla
  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }, delta) => {
    acc.current += delta;
    if (acc.current < CHECK_EVERY_S) return;
    acc.current = 0;
    const g = store.current;
    const n = Math.min(g.n, memories.length);
    if (n === 0) return;

    const cam = camera as THREE.PerspectiveCamera;
    const prev = g.near;
    const cands: { i: number; score: number }[] = [];
    for (let i = 0; i < n; i++) {
      v.fromArray(g.pos, i * 3);
      const dx = v.x - cam.position.x, dy = v.y - cam.position.y, dz = v.z - cam.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > WORLD.nearDistance) continue;
      v.project(cam);
      if (v.z > 1 || Math.abs(v.x) > 1.25 || Math.abs(v.y) > 1.25) continue; // görünmüyor
      cands.push({ i, score: dist * (prev.has(i) ? STICKY : 1) });
    }
    cands.sort((a, b) => a.score - b.score);

    const next = new Set<number>();
    if (g.selected >= 0 && g.selected < n) next.add(g.selected);
    if (g.hovered >= 0 && g.hovered < n) next.add(g.hovered);
    for (const c of cands) {
      if (next.size >= max) break;
      next.add(c.i);
    }

    let changed = next.size !== prev.size;
    if (!changed) for (const i of next) if (!prev.has(i)) { changed = true; break; }
    if (changed) {
      g.setNear(next);
      setNearList([...next]);
    }
  });

  return (
    <>
      {nearList.map((i) => {
        const memory = memories[i];
        if (!memory) return null;
        return (
          <Orb
            key={memory.id}
            memory={memory}
            index={i}
            selected={selectedId === memory.id}
            dimmed={selectedId !== null && selectedId !== memory.id}
            store={store}
          />
        );
      })}
      <FarOrbs store={store} count={memories.length} dim={selectedId !== null} />
    </>
  );
}

/** Tek çizim çağrısında tüm uzak küreler. Yakındaki (tam çizilen) küreler aFar=0 ile gizlenir. */
function FarOrbs({ store, count, dim }: { store: React.RefObject<WorldStore>; count: number; dim: boolean }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const position = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    position.setUsage(THREE.DynamicDrawUsage);
    const color = new Float32Array(count * 3);
    const tmp = new THREE.Color();
    for (let i = 0; i < count; i++) {
      tmp.set(ORB_COLORS[i % ORB_COLORS.length]!);
      color.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    g.setAttribute("position", position);
    g.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
    g.setAttribute("aFar", new THREE.BufferAttribute(new Float32Array(count).fill(1), 1));
    return g;
  }, [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(
    () => ({
      uPxPerUnit: { value: 1 }, uRadius: { value: SPHERE_RADIUS }, uScaleStart: { value: SCALE_START },
      uScaleMax: { value: SCALE_MAX }, uDim: { value: 1 }, uMinPx: { value: 4 }, uMaxPx: { value: 96 },
    }),
    [],
  );
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const seen = useRef({ version: -1, count: -1 });

  useFrame(({ gl, camera }) => {
    const g = store.current;
    const cam = camera as THREE.PerspectiveCamera;
    const position = geometry.getAttribute("position") as THREE.BufferAttribute;
    if (g.pos.length >= count * 3) {
      (position.array as Float32Array).set(g.pos.subarray(0, count * 3));
      position.needsUpdate = true;
    }
    if (seen.current.version !== g.nearVersion || seen.current.count !== count) {
      const far = geometry.getAttribute("aFar") as THREE.BufferAttribute;
      for (let i = 0; i < count; i++) far.setX(i, g.near.has(i) ? 0 : 1);
      far.needsUpdate = true;
      seen.current = { version: g.nearVersion, count };
    }
    const u = matRef.current?.uniforms;
    if (u) {
      u.uPxPerUnit!.value = gl.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
      u.uDim!.value = dim ? 0.45 : 1;
    }
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={farOrbVertex}
        fragmentShader={farOrbFragment}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}