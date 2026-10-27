import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { createCircleTexture, createDustGeometry, createStarGeometry } from "./generate";
import { bakeNebulaTexture } from "./sky";
import {
  dustFragment, dustVertex, skyFragment, skyVertex, starFragment, starVertex,
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

/** Arka plan: önceden çizilmiş nebula dokusunu okuyan dev küre (kare başına çok ucuz). */
export function NebulaSky() {
  const gl = useThree((state) => state.gl);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uSky: { value: null as THREE.Texture | null }, uTime: { value: 0 } }), []);

  useLayoutEffect(() => {
    const target = bakeNebulaTexture(gl);
    if (matRef.current) matRef.current.uniforms.uSky.value = target.texture;
    return () => target.dispose();
  }, [gl]);

  useFrame(({ clock }) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <mesh renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[900, 32, 24]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={skyVertex}
        fragmentShader={skyFragment}
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