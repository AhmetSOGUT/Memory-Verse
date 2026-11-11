import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { COARSE_QUERY, COMPACT_QUERY } from "../lib/layout";
import type { Memory } from "../types";
import { BACKGROUND_COLOR, FOV_DEFAULT, QUALITY_TIERS } from "./constants";
import { AdaptiveQuality } from "./AdaptiveQuality";
import { CameraRig } from "./CameraRig";
import { demoOptionsFromUrl } from "./demo";
import { DemoStats } from "./DemoStats";
import { Effects } from "./Effects";
import { Meteors } from "./Meteors";
import { OrbField } from "./OrbField";
import { Picker } from "./Picker";
import { NebulaSky, SpaceDust, Stars } from "./Stars";
import { createWorldStore } from "./world";
import { World } from "./Worlds";

interface UniverseCanvasProps {
  /** Tarih sırasında (sunucu böyle gönderir): dizin = dünyadaki sıra. */
  memories: Memory[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onDeselect: () => void;
  /** Değiştikçe kamera merkeze döner. */
  homeTick: number;
  /** Anı kimliği → kürede gösterilecek fotoğrafın sırası (panelde kaydırınca değişir). */
  photoIndexById: Record<number, number>;
}

/**
 * Gökyüzü (yıldız, nebula, toz) kamerayla birlikte taşınır. Kamera dünyanın içinde gezdiği için sabit kalsaydı
 * uzaklaştıkça gökyüzü bir top gibi geride kalırdı.
 */
function SkyRig({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    ref.current?.position.copy(camera.position);
  });
  return <group ref={ref}>{children}</group>;
}

export default function UniverseCanvas({
  memories,
  selectedId,
  onSelect,
  onDeselect,
  homeTick,
  photoIndexById,
}: UniverseCanvasProps) {
  const dragState = useRef({ moved: false });
  const store = useRef(createWorldStore()); // ortak dünya durumu (kare başına değişir, React durumu değil)

  // Telefon düzeni (dar/dikey ekran) ve parmakla kullanım: PC'de ikisi de false
  const compact = useMediaQuery(COMPACT_QUERY);
  const coarse = useMediaQuery(COARSE_QUERY);
  const demo = useMemo(() => demoOptionsFromUrl(), []);
  const selectedIndex = selectedId === null ? -1 : memories.findIndex((m) => m.id === selectedId);
  const layout = compact ? "sheet" : coarse ? "side" : "center";

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
      camera={{ fov: FOV_DEFAULT, near: 1, far: 5000, position: [0, 0, 0] }}
    >
      <color attach="background" args={[BACKGROUND_COLOR]} />
      <AdaptiveQuality tier={tier} onTierChange={setTier} />

      {/* Sıra önemli: önce kamera, sonra dünya (konumlar), sonra bunları okuyan çizim/seçim */}
      <CameraRig
        autoRotate={selectedId === null}
        dragState={dragState}
        store={store}
        count={memories.length}
        homeTick={homeTick}
        layout={layout}
      />
      <World store={store} count={memories.length} selectedIndex={selectedIndex} />

      {/* Dünya büyük olabilir: uzaklığa bağlı nokta ışıkları yerine her yerde aynı etkiyen yönlü ışıklar */}
      <ambientLight color={0x8090c0} intensity={0.9} />
      <directionalLight color={0xfff5e0} intensity={1.6} position={[30, 40, 20]} />
      <directionalLight color={0x6644ff} intensity={0.6} position={[-50, -20, -40]} />
      <directionalLight color={0xff66aa} intensity={0.5} position={[0, -50, 50]} />

      <SkyRig>
        <Stars />
        <NebulaSky />
        <SpaceDust />
      </SkyRig>
      <Meteors />

      <OrbField
        store={store}
        memories={memories}
        selectedId={selectedId}
        coarse={coarse}
        maxOverride={demo.near ?? undefined}
        photoIndexById={photoIndexById}
      />
      <Picker store={store} memories={memories} dragState={dragState} onSelect={onSelect} onDeselect={onDeselect} />

      {demo.count > 0 && <DemoStats store={store} />}
      {bloom && <Effects />}
    </Canvas>
  );
}