import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  GLASS_SHEEN, GLASS_STRENGTH, GLOW_STRENGTH, ORB_COLORS, SPHERE_RADIUS, SPHERE_SEGMENTS,
} from "./constants";
import { visualScale, type WorldStore } from "./world";
import { acquirePhotoTexture } from "./generate";
import {
  glassFragment, glassVertex, glowFragment, glowVertex, innerFragment, innerVertex,
} from "./shaders";

interface OrbProps {
  /** Kürenin içinde görünecek fotoğraf (yoksa null). Panelde kaydırılınca değişir. */
  image: string | null;
  /** Tarih sırasındaki dizini: dünyadaki yeri ve rengi buna bağlı. */
  index: number;
  selected: boolean;
  /** Başka bir küre seçiliyse bu küçülür. */
  dimmed: boolean;
  /** Dünyanın canlı durumu: kürenin konumu buradan okunur. */
  store: React.RefObject<WorldStore>;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Tüm küreler aynı üç geometriyi paylaşır (her küre için ayrı geometri üretmek yerine)
const GEO = {
  inner: new THREE.SphereGeometry(SPHERE_RADIUS * 0.97, SPHERE_SEGMENTS.body, SPHERE_SEGMENTS.body),
  body: new THREE.SphereGeometry(SPHERE_RADIUS, SPHERE_SEGMENTS.body, SPHERE_SEGMENTS.body),
  glow: new THREE.SphereGeometry(SPHERE_RADIUS * 1.55, SPHERE_SEGMENTS.glow, SPHERE_SEGMENTS.glow),
};

// Kare başına nesne üretmemek için ortak geçici nesneler
const spinQ = new THREE.Quaternion();
const spinEuler = new THREE.Euler();

/**
 * Tam ayrıntıyla çizilen küre (cam + içinde fotoğraf + hale). Yalnızca kameraya yakın küreler için oluşturulur;
 * uzaktakiler tek çizimde nokta olarak çizilir (bkz. OrbField). Konumu dünyanın ortak durumundan gelir.
 * Seçilince küre YERİNDE KALIR; kamera onun etrafında döner (bkz. CameraRig). Seçim kalkınca da yerinden oynamaz.
 */
function OrbImpl({ image, index, selected, dimmed, store }: OrbProps) {
  const groupRef = useRef<THREE.Group>(null);
  const scale = useRef(1);

  const color = useMemo(() => new THREE.Color(ORB_COLORS[index % ORB_COLORS.length]), [index]);

  // Fotoğraf dokusu (önbellekten ya da yüklenerek; küre uzaklaşıp yok olunca bırakılır)
  const [photo, setPhoto] = useState<THREE.CanvasTexture | null>(null);
  /** Şu an gösterilen dokunun ödünç kaydı. Yeni doku hazır olana kadar eskisi bırakılmaz:
   *  panelde kaydırınca küre bir an boş görünmesin. */
  const shownLease = useRef<{ release: () => void } | null>(null);

  useEffect(() => {
    if (!image) {
      shownLease.current?.release();
      shownLease.current = null;
      return;
    }
    let cancelled = false;
    const lease = acquirePhotoTexture(image);
    lease.promise.then((tex) => {
      if (cancelled) return;
      const previous = shownLease.current;
      shownLease.current = lease;
      setPhoto(tex);
      previous?.release(); // eski fotoğrafın dokusu artık gösterilmiyor
    });
    return () => {
      cancelled = true;
      if (shownLease.current !== lease) lease.release(); // hiç gösterilmedi
    };
  }, [image]);

  // Küre kapanınca gösterilen doku bırakılır
  useEffect(() => () => {
    shownLease.current?.release();
    shownLease.current = null;
  }, []);

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

    // Dünyadaki yeri (kabuğun dönüşü ve gezinme dahil). Küre seçilince de YERİNDE kalır;
    // incelemede kamerayı kürenin etrafında döndüren CameraRig'dir.
    const o = index * 3;
    const p = g.pos;
    grp.position.set(p[o] ?? 0, p[o + 1] ?? 0, p[o + 2] ?? 0);

    // Boyut: uzaktan bakınca orantılı büyür (küçücük nokta olmasın); seçili büyük, üzerine gelinen biraz şişer
    const vis = visualScale(grp.position.distanceTo(camera.position));
    const hovered = g.hovered === index;
    const tScale = selected ? 1.45 : (dimmed ? 0.75 : hovered ? 1.12 : 1) * vis;
    scale.current = lerp(scale.current, tScale, 1 - Math.pow(1 - 0.05, k));
    grp.scale.setScalar(scale.current);

    // Dönüş: kendi yavaş dönüşü (kullanıcı küreyi değil, kamerayı döndürür)
    spinEuler.set(0, t * 0.08 + index * 0.6, 0);
    spinQ.setFromEuler(spinEuler);
    grp.quaternion.copy(spinQ);
  });

  return (
    <group ref={groupRef}>
      {image ? (
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