import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { BLOOM, VIGNETTE } from "./constants";

/** Sahne sonrası efektler: parlama (bloom) + hafif kenar kararması. */
export function Effects() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom
        mipmapBlur
        luminanceThreshold={BLOOM.threshold}
        luminanceSmoothing={BLOOM.smoothing}
        intensity={BLOOM.intensity}
        radius={BLOOM.radius}
      />
      <Vignette offset={VIGNETTE.offset} darkness={VIGNETTE.darkness} />
    </EffectComposer>
  );
}