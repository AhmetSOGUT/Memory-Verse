import { useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import type { Memory } from "../types";
import { BACKGROUND_COLOR, FOV_DEFAULT, QUALITY_TIERS } from "./constants";
import { AdaptiveQuality } from "./AdaptiveQuality";
import { CameraRig } from "./CameraRig";
import { Effects } from "./Effects";
import { Meteors } from "./Meteors";
import { Orb } from "./Orb";
import { NebulaSky, SpaceDust, Stars } from "./Stars";

interface UniverseCanvasProps {
  memories: Memory[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onDeselect: () => void;
}

export default function UniverseCanvas({ memories, selectedId, onSelect, onDeselect }: UniverseCanvasProps) {
  const lookDir = useRef(new THREE.Vector3(0, 0, 1));
  const dragState = useRef({ moved: false });
  const wasDrag = useMemo(() => () => dragState.current.moved, []);

  // Otomatik kalite: en yüksek kademeden başlar, FPS düşerse iner
  const [tier, setTier] = useState(QUALITY_TIERS.length - 1);
  const deviceDpr = useMemo(() => window.devicePixelRatio || 1, []);
  const { dpr, bloom } = QUALITY_TIERS[tier];

  return (
    <Canvas
      style={{ touchAction: "none" }}
      flat // ACES tone mapping kapalı — orijinal renklerle birebir aynı
      dpr={Math.min(dpr, deviceDpr)}
      gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
      camera={{ fov: FOV_DEFAULT, near: 0.1, far: 1000, position: [0, 0, 0] }}
      onPointerMissed={() => { if (!dragState.current.moved) onDeselect(); }}
    >
      <color attach="background" args={[BACKGROUND_COLOR]} />
      <AdaptiveQuality tier={tier} onTierChange={setTier} />

      <ambientLight color={0x8090c0} intensity={0.6} />
      <pointLight color={0xfff5e0} intensity={2.5} distance={200} position={[30, 40, 20]} />
      <pointLight color={0x6644ff} intensity={1.0} distance={150} position={[-50, -20, -40]} />
      <pointLight color={0xff66aa} intensity={0.8} distance={120} position={[0, -50, 50]} />

      <Stars />
      <NebulaSky />
      <SpaceDust />
      <Meteors />

      {memories.map((memory, i) => (
        <Orb
          key={memory.id}
          memory={memory}
          index={i}
          total={memories.length}
          selected={selectedId === memory.id}
          dimmed={selectedId !== null && selectedId !== memory.id}
          lookDir={lookDir}
          wasDrag={wasDrag}
          onSelect={onSelect}
        />
      ))}

      {bloom && <Effects />}

      <CameraRig autoRotate={selectedId === null} lookDir={lookDir} dragState={dragState} />
    </Canvas>
  );
}