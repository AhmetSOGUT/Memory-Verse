import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Memory } from "../types";
import {
  FOCUS_DISTANCE, GLASS_SHEEN, GLASS_STRENGTH, GLOW_STRENGTH, ORB_COLORS, SPHERE_RADIUS,
} from "./constants";
import { loadPhotoTexture, orbPosition } from "./generate";
import {
  glassFragment, glassVertex, glowFragment, glowVertex, innerFragment, innerVertex,
} from "./shaders";

interface OrbProps {
  memory: Memory;
  index: number;
  total: number;
  selected: boolean;
  /** Başka bir küre seçiliyse bu küçülür. */
  dimmed: boolean;
  /** Kameranın baktığı yön (birim vektör); seçili küre buraya uçar. */
  lookDir: React.RefObject<THREE.Vector3>;
  /** Sürükleme sonrası yanlışlıkla tıklamayı engellemek için. */
  wasDrag: () => boolean;
  onSelect: (memory: Memory) => void;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function Orb({ memory, index, total, selected, dimmed, lookDir, wasDrag, onSelect }: OrbProps) {
  const groupRef = useRef<THREE.Group>(null);
  const focus = useRef(0); // 0 → serbest, 1 → kameraya yaklaşmış
  const scale = useRef(1);

  const color = useMemo(() => new THREE.Color(ORB_COLORS[index % ORB_COLORS.length]), [index]);
  const base = useMemo(() => orbPosition(index, total), [index, total]);

  // Fotoğraf dokusu
  const [photo, setPhoto] = useState<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    if (!memory.image) return;
    let cancelled = false;
    let created: THREE.CanvasTexture | null = null;
    loadPhotoTexture(memory.image).then((tex) => {
      if (cancelled) { tex?.dispose(); return; }
      created = tex;
      setPhoto(tex);
    });
    return () => {
      cancelled = true;
      created?.dispose();
      setPhoto(null);
    };
  }, [memory.image]);

  // Uniform nesneleri (materyaller JSX'te; zaman ref üzerinden güncellenir)
  const glowUniforms = useMemo(
    () => ({ uColor: { value: color }, uTime: { value: 0 }, uStrength: { value: GLOW_STRENGTH } }),
    [color],
  );
  const glassUniforms = useMemo(
    () => ({
      uColor: { value: color },
      uTime: { value: 0 },
      uStrength: { value: GLASS_STRENGTH },
      uSheen: { value: GLASS_SHEEN },
    }),
    [color],
  );
  const innerUniforms = useMemo(
    () => (photo ? { uColor: { value: color }, uTime: { value: 0 }, uTex: { value: photo } } : null),
    [color, photo],
  );
  const glowRef = useRef<THREE.ShaderMaterial>(null);
  const glassRef = useRef<THREE.ShaderMaterial>(null);
  const innerRef = useRef<THREE.ShaderMaterial>(null);

  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock, camera }, delta) => {
    const grp = groupRef.current;
    if (!grp) return;
    const t = clock.elapsedTime;

    // Shader zamanı
    if (glowRef.current) glowRef.current.uniforms.uTime.value = t;
    if (glassRef.current) glassRef.current.uniforms.uTime.value = t;
    if (innerRef.current) innerRef.current.uniforms.uTime.value = t;

    // 60 fps'e göre normalize edilmiş yumuşatma (orijinal sabitler 60 fps içindi)
    const k = Math.min(delta * 60, 3);
    focus.current = lerp(focus.current, selected ? 1 : 0, 1 - Math.pow(1 - 0.045, k));
    const tScale = selected ? 1.45 : dimmed ? 0.6 : 1;
    scale.current = lerp(scale.current, tScale, 1 - Math.pow(1 - 0.05, k));

    // Süzülme
    const floatY = base[1] + Math.sin(t * (0.35 + index * 0.06) + index * 1.4) * 0.8;
    const f = focus.current;
    const dir = lookDir.current;
    target.set(
      camera.position.x + dir.x * FOCUS_DISTANCE,
      camera.position.y + dir.y * FOCUS_DISTANCE - 1.5,
      camera.position.z + dir.z * FOCUS_DISTANCE,
    );

    grp.position.set(
      lerp(base[0], target.x, f),
      lerp(floatY, target.y, f),
      lerp(base[2], target.z, f),
    );
    grp.scale.setScalar(scale.current);
    grp.rotation.y = t * 0.08 + index * 0.6;
  });

  function handleClick(e: ThreeEvent<MouseEvent>) {
    if (wasDrag()) return;
    e.stopPropagation();
    onSelect(memory);
  }

  return (
    <group ref={groupRef} position={base}>
      {memory.image ? (
        <>
          {innerUniforms && (
            <mesh renderOrder={1}>
              <sphereGeometry args={[SPHERE_RADIUS * 0.97, 64, 64]} />
              <shaderMaterial
                ref={innerRef}
                uniforms={innerUniforms}
                vertexShader={innerVertex}
                fragmentShader={innerFragment}
                transparent
                side={THREE.BackSide}
                depthWrite={false}
              />
            </mesh>
          )}
          <mesh renderOrder={2} onClick={handleClick}>
            <sphereGeometry args={[SPHERE_RADIUS, 64, 64]} />
            <shaderMaterial
              ref={glassRef}
              uniforms={glassUniforms}
              vertexShader={glassVertex}
              fragmentShader={glassFragment}
              transparent
              side={THREE.FrontSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </>
      ) : (
        <mesh onClick={handleClick}>
          <sphereGeometry args={[SPHERE_RADIUS, 64, 64]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.5}
            roughness={0.2}
            metalness={0.1}
          />
        </mesh>
      )}
      <mesh raycast={() => null}>
        <sphereGeometry args={[SPHERE_RADIUS * 1.55, 64, 64]} />
        <shaderMaterial
          ref={glowRef}
          uniforms={glowUniforms}
          vertexShader={glowVertex}
          fragmentShader={glowFragment}
          transparent
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
