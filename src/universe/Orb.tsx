import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Memory } from "../types";
import {
  GLASS_SHEEN, GLASS_STRENGTH, GLOW_STRENGTH, ORB_COLORS, SHEET_FOCUS_NDC_Y, SIDE_FOCUS_NDC_X, SPHERE_RADIUS,
  SPHERE_SEGMENTS,
} from "./constants";
import { visualScale, type WorldStore } from "./world";
import { acquirePhotoTexture } from "./generate";
import {
  glassFragment, glassVertex, glowFragment, glowVertex, innerFragment, innerVertex,
} from "./shaders";

interface OrbProps {
  memory: Memory;
  /** Tarih sırasındaki dizini: dünyadaki yeri ve rengi buna bağlı. */
  index: number;
  selected: boolean;
  /** Başka bir küre seçiliyse bu küçülür. */
  dimmed: boolean;
  /** Dünyanın canlı durumu: kürenin konumu buradan okunur. */
  store: React.RefObject<WorldStore>;
  /** Seçilince küre ekranda nereye otursun: panelin yerine göre (telefonda panelin üstüne, yatayda panelin soluna). */
  layout: "center" | "sheet" | "side";
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Tüm küreler aynı üç geometriyi paylaşır (her küre için ayrı geometri üretmek yerine)
const GEO = {
  inner: new THREE.SphereGeometry(SPHERE_RADIUS * 0.97, SPHERE_SEGMENTS.body, SPHERE_SEGMENTS.body),
  body: new THREE.SphereGeometry(SPHERE_RADIUS, SPHERE_SEGMENTS.body, SPHERE_SEGMENTS.body),
  glow: new THREE.SphereGeometry(SPHERE_RADIUS * 1.55, SPHERE_SEGMENTS.glow, SPHERE_SEGMENTS.glow),
};

// Kare başına nesne üretmemek için ortak geçici nesneler
const camForward = new THREE.Vector3();
const camRight = new THREE.Vector3();
const camUp = new THREE.Vector3();
const focusTarget = new THREE.Vector3();
const spinQ = new THREE.Quaternion();
const turnQ = new THREE.Quaternion();
const spinEuler = new THREE.Euler();
const IDENTITY_Q = new THREE.Quaternion();
const INSPECT_SPEED = 0.008; // piksel başına dönüş (rad)

/**
 * Tam ayrıntıyla çizilen küre (cam + içinde fotoğraf + hale). Yalnızca kameraya yakın küreler için oluşturulur;
 * uzaktakiler tek çizimde nokta olarak çizilir (bkz. OrbField). Konumu dünyanın ortak durumundan gelir.
 * Seçilince kamera yerinden kıpırdamaz: ekran küreye döner (bkz. CameraRig), küre kameranın önüne gelir ve
 * sürüklenince döner (inceleme). Seçim kalkınca yerine süzülür.
 */
function OrbImpl({ memory, index, selected, dimmed, store, layout }: OrbProps) {
  const groupRef = useRef<THREE.Group>(null);
  const scale = useRef(1);
  const focus = useRef(0); // 0 → dünyadaki yerinde, 1 → kameranın önünde
  const inspectQ = useRef(new THREE.Quaternion()); // kullanıcının sürükleyerek verdiği dönüş

  const color = useMemo(() => new THREE.Color(ORB_COLORS[index % ORB_COLORS.length]), [index]);

  // Fotoğraf dokusu (önbellekten ya da yüklenerek; küre uzaklaşıp yok olunca bırakılır)
  const [photo, setPhoto] = useState<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    if (!memory.image) return;
    let cancelled = false;
    const lease = acquirePhotoTexture(memory.image);
    lease.promise.then((tex) => {
      if (!cancelled) setPhoto(tex);
    });
    return () => {
      cancelled = true;
      lease.release();
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

  useFrame(({ clock, camera }, delta) => {
    const grp = groupRef.current;
    if (!grp) return;
    const g = store.current;
    const t = clock.elapsedTime;

    // Shader zamanı
    if (glowRef.current) glowRef.current.uniforms.uTime.value = t;
    if (glassRef.current) glassRef.current.uniforms.uTime.value = t;
    if (innerRef.current) innerRef.current.uniforms.uTime.value = t;

    // 60 fps'e göre normalize edilmiş yumuşatma (orijinal sabitler 60 fps içindi)
    const k = Math.min(delta * 60, 3);
    focus.current = lerp(focus.current, selected ? 1 : 0, 1 - Math.pow(1 - 0.045, k));
    const f = focus.current;

    // Dünyadaki yeri (kabuğun dönüşü ve gezinme dahil); seçiliyse kameranın tam önüne gelir
    const o = index * 3;
    const p = g.pos;
    let x = p[o] ?? 0, y = p[o + 1] ?? 0, z = p[o + 2] ?? 0;
    if (f > 0.0005) {
      camera.getWorldDirection(camForward);
      const d = g.focusDistance;
      focusTarget.copy(camera.position).addScaledVector(camForward, d);
      const halfH = d * Math.tan(THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov / 2));
      if (layout === "sheet") {
        camUp.setFromMatrixColumn(camera.matrixWorld, 1);
        focusTarget.addScaledVector(camUp, SHEET_FOCUS_NDC_Y * halfH); // telefonda alt panelin üstüne
      } else if (layout === "side") {
        camRight.setFromMatrixColumn(camera.matrixWorld, 0);
        focusTarget.addScaledVector(camRight, SIDE_FOCUS_NDC_X * halfH * (camera as THREE.PerspectiveCamera).aspect); // yatayda panelin soluna
      }
      x = lerp(x, focusTarget.x, f);
      y = lerp(y, focusTarget.y, f);
      z = lerp(z, focusTarget.z, f);
    }
    grp.position.set(x, y, z);
    if (selected) g.setSelectedPos(x, y, z); // seçici, kameranın önüne gelen küreye dokunmayı "boşluğa dokunma" saymasın

    // Boyut: uzaktan bakınca orantılı büyür (küçücük nokta olmasın); seçili büyük, üzerine gelinen biraz şişer
    const vis = visualScale(grp.position.distanceTo(camera.position));
    const hovered = g.hovered === index;
    const tScale = selected ? (layout === "center" ? 1.45 : 1.1) : (dimmed ? 0.75 : hovered ? 1.12 : 1) * vis;
    scale.current = lerp(scale.current, tScale, 1 - Math.pow(1 - 0.05, k));
    grp.scale.setScalar(scale.current);

    // Dönüş: kendi yavaş dönüşü + (seçiliyken) kullanıcının sürükleyerek verdiği dönüş
    if (selected) {
      if (g.inspectDX !== 0 || g.inspectDY !== 0) {
        // Kameranın yukarı/sağ eksenleri etrafında döndür: parmağın/farenin gittiği yöne yüzey akar
        camUp.setFromMatrixColumn(camera.matrixWorld, 1);
        camRight.setFromMatrixColumn(camera.matrixWorld, 0);
        turnQ.setFromAxisAngle(camUp, g.inspectDX * INSPECT_SPEED);
        inspectQ.current.premultiply(turnQ);
        turnQ.setFromAxisAngle(camRight, g.inspectDY * INSPECT_SPEED);
        inspectQ.current.premultiply(turnQ);
        g.clearInspect();
      }
    } else {
      inspectQ.current.slerp(IDENTITY_Q, 1 - Math.pow(1 - 0.08, k)); // seçim kalkınca verilen dönüş yavaşça silinir
    }
    spinEuler.set(0, t * 0.08 + index * 0.6, 0);
    spinQ.setFromEuler(spinEuler);
    grp.quaternion.copy(inspectQ.current).multiply(spinQ);
  });

  return (
    <group ref={groupRef}>
      {memory.image ? (
        <>
          {innerUniforms && (
            <mesh renderOrder={1}>
              <primitive object={GEO.inner} attach="geometry" />
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
          <mesh renderOrder={2}>
            <primitive object={GEO.body} attach="geometry" />
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
        <mesh>
          <primitive object={GEO.body} attach="geometry" />
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
        <primitive object={GEO.glow} attach="geometry" />
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

/** Seçim değişince yalnızca ilgili küreler yeniden çizilsin. */
export const Orb = memo(OrbImpl);