import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MILKY_WAY_NORMAL, NEBULA } from "./constants";
import {
  createCircleTexture, createDustGeometry, createStarGeometry, pickNebulaPalette,
} from "./generate";
import {
  dustFragment, dustVertex, nebulaFragment, nebulaVertex, starFragment, starVertex,
} from "./shaders";

/** Yıldız alanı: tek Points nesnesi, GPU'da titreşir. */
export function Stars() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { geometry, uniforms } = useMemo(
    () => ({
      geometry: createStarGeometry(),
      uniforms: { time: { value: 0 }, pointTex: { value: createCircleTexture(64) } },
    }),
    [],
  );

  useFrame(({ clock }) => {
    if (matRef.current) matRef.current.uniforms.time.value = clock.elapsedTime;
  });

  useEffect(
    () => () => {
      uniforms.pointTex.value.dispose();
      geometry.dispose();
    },
    [geometry, uniforms],
  );

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={starVertex}
        fragmentShader={starFragment}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/** Arka plan: nebula bulutları + Samanyolu bandı (tek shader'lı dev küre). */
export function NebulaSky() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => {
    const [a, b, c] = pickNebulaPalette();
    return {
      uTime: { value: 0 },
      uIntensity: { value: NEBULA.intensity },
      uBandNormal: { value: new THREE.Vector3(...MILKY_WAY_NORMAL).normalize() },
      uColA: { value: a },
      uColB: { value: b },
      uColC: { value: c },
    };
  }, []);

  useFrame(({ clock }) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <mesh renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[900, 48, 32]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={nebulaVertex}
        fragmentShader={nebulaFragment}
        side={THREE.BackSide}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

/** Kameraya yakın süzülen toz: hareket ve derinlik hissini en çok bu verir. */
export function SpaceDust() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { geometry, uniforms } = useMemo(
    () => ({ geometry: createDustGeometry(), uniforms: { uTime: { value: 0 } } }),
    [],
  );

  useFrame(({ clock }) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.elapsedTime;
  });

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={dustVertex}
        fragmentShader={dustFragment}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}