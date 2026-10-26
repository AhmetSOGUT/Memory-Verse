import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createCircleTexture, createStarGeometry, createNebulaGeometries } from "./generate";
import { starFragment, starVertex } from "./shaders";

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

export function Nebula() {
  const { geometries, material, texture } = useMemo(() => {
    const texture = createCircleTexture(128);
    const material = new THREE.PointsMaterial({
      size: 30,
      map: texture,
      vertexColors: true,
      transparent: true,
      opacity: 0.05,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      alphaTest: 0.001,
    });
    return { geometries: createNebulaGeometries(), material, texture };
  }, []);

  useFrame(({ scene, clock }) => {
    const group = scene.getObjectByName("nebula");
    if (!group) return;
    const t = clock.elapsedTime;
    group.children.forEach((child, i) => {
      child.rotation.y = t * (0.003 + i * 0.0008);
      child.rotation.x = t * (0.001 + i * 0.0004);
    });
  });

  useEffect(
    () => () => {
      texture.dispose();
      material.dispose();
      geometries.forEach((g) => g.dispose());
    },
    [geometries, material, texture],
  );

  return (
    <group name="nebula">
      {geometries.map((geo, i) => (
        <points key={i} geometry={geo} material={material} frustumCulled={false} />
      ))}
    </group>
  );
}
