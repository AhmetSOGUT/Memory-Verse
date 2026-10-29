import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { METEORS } from "./constants";
import { meteorFragment, meteorVertex } from "./shaders";

interface Slot {
  active: boolean;
  age: number;
  duration: number;
  speed: number;
}

const rand = (range: readonly [number, number]) => range[0] + Math.random() * (range[1] - range[0]);

// Her karede yeni nesne üretmemek için tekrar kullanılan vektörler
const FWD = new THREE.Vector3();
const RIGHT = new THREE.Vector3();
const UP = new THREE.Vector3();
const START = new THREE.Vector3();
const DIR = new THREE.Vector3();

/**
 * Kayan yıldızlar: havuzdaki en fazla `METEORS.max` meteor tek çizim çağrısıyla çizilir.
 * Her biri kameranın baktığı yönde, görüş alanının içinde doğar.
 */
export function Meteors() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const slots = useRef<Slot[]>(
    Array.from({ length: METEORS.max }, () => ({ active: false, age: 0, duration: 1, speed: 0 })),
  );
  const nextSpawn = useRef<number>(METEORS.firstDelay);

  const { geometry, uniforms } = useMemo(() => {
    const n = METEORS.max;
    const slotAttr = new Float32Array(n * 4);
    const corner = new Float32Array(n * 4 * 2);
    const index: number[] = [];
    const corners = [[-0.04, -1], [-0.04, 1], [1, -1], [1, 1]];
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < 4; c++) {
        slotAttr[i * 4 + c] = i;
        corner[(i * 4 + c) * 2] = corners[c][0];
        corner[(i * 4 + c) * 2 + 1] = corners[c][1];
      }
      const o = i * 4;
      index.push(o, o + 2, o + 1, o + 1, o + 2, o + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 4 * 3), 3));
    geo.setAttribute("aSlot", new THREE.BufferAttribute(slotAttr, 1));
    geo.setAttribute("aCorner", new THREE.BufferAttribute(corner, 2));
    geo.setIndex(index);
    return {
      geometry: geo,
      uniforms: {
        uHead: { value: Array.from({ length: n }, () => new THREE.Vector3()) },
        uDir: { value: Array.from({ length: n }, () => new THREE.Vector3(1, 0, 0)) },
        uParams: { value: Array.from({ length: n }, () => new THREE.Vector4(-1, 0, 0, 0)) },
      },
    };
  }, []);

  const vertexShader = useMemo(() => meteorVertex(METEORS.max), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock, camera }, delta) => {
    const mat = matRef.current;
    if (!mat) return;
    const u = mat.uniforms;
    const now = clock.elapsedTime;

    // Yeni meteor doğur
    if (now >= nextSpawn.current) {
      nextSpawn.current = now + rand(METEORS.gap);
      const free = slots.current.findIndex((s) => !s.active);
      if (free >= 0) {
        const cam = camera as THREE.PerspectiveCamera;
        FWD.set(0, 0, -1).applyQuaternion(cam.quaternion);
        RIGHT.set(1, 0, 0).applyQuaternion(cam.quaternion);
        UP.set(0, 1, 0).applyQuaternion(cam.quaternion);

        // Görüş alanının içinde, ağırlıklı olarak üst bölümde
        const halfV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
        const halfH = halfV * cam.aspect;
        const rx = (Math.random() * 2 - 1) * halfH * 0.8;
        const ry = (Math.random() * 1.3 - 0.35) * halfV * 0.9;
        START.copy(FWD).addScaledVector(RIGHT, rx).addScaledVector(UP, ry).normalize();

        // Ekran düzleminde, hafif aşağı eğimli yön
        const ang = THREE.MathUtils.degToRad(10 + Math.random() * 35);
        const sign = Math.random() < 0.5 ? -1 : 1;
        DIR.copy(RIGHT).multiplyScalar(sign * Math.cos(ang)).addScaledVector(UP, -Math.sin(ang));
        DIR.addScaledVector(START, -DIR.dot(START)).normalize();

        const bright = 0.6 + Math.random() * 0.4;
        const slot = slots.current[free];
        slot.active = true;
        slot.age = 0;
        slot.duration = rand(METEORS.duration);
        slot.speed = rand(METEORS.speed);

        u.uHead.value[free].copy(camera.position).addScaledVector(START, rand(METEORS.distance));
        u.uDir.value[free].copy(DIR);
        u.uParams.value[free].set(0, rand(METEORS.length) * (0.7 + 0.6 * bright), rand(METEORS.width), bright);
      }
    }

    // Var olan meteorları ilerlet
    slots.current.forEach((slot, i) => {
      if (!slot.active) return;
      slot.age += delta;
      if (slot.age >= slot.duration) {
        slot.active = false;
        u.uParams.value[i].x = -1;
        return;
      }
      u.uHead.value[i].addScaledVector(u.uDir.value[i], slot.speed * delta);
      u.uParams.value[i].x = slot.age / slot.duration;
    });
  });

  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={meteorFragment}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}