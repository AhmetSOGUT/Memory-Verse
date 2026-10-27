import * as THREE from "three";
import { MILKY_WAY_NORMAL, NEBULA } from "./constants";
import { pickNebulaPalette } from "./generate";
import { nebulaBakeFragment, nebulaBakeVertex } from "./shaders";

/**
 * Nebula gökyüzünü tek seferlik bir doku olarak çizer (eşdikdörtgen, 2:1).
 * Ağır shader yalnızca burada, açılışta bir kez çalışır.
 */
export function bakeNebulaTexture(gl: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const [a, b, c] = pickNebulaPalette();
  const half = gl.extensions.has("EXT_color_buffer_float") || gl.extensions.has("EXT_color_buffer_half_float");

  const target = new THREE.WebGLRenderTarget(NEBULA.bakeWidth, NEBULA.bakeWidth / 2, {
    type: half ? THREE.HalfFloatType : THREE.UnsignedByteType, // yarım hassasiyet = bantlaşma yok
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
    depthBuffer: false,
  });
  target.texture.wrapS = THREE.RepeatWrapping;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uIntensity: { value: NEBULA.intensity },
      uBandNormal: { value: new THREE.Vector3(...MILKY_WAY_NORMAL).normalize() },
      uColA: { value: a },
      uColB: { value: b },
      uColC: { value: c },
    },
    vertexShader: nebulaBakeVertex,
    fragmentShader: nebulaBakeFragment,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  const scene = new THREE.Scene();
  scene.add(quad);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const previous = gl.getRenderTarget();
  gl.setRenderTarget(target);
  gl.render(scene, camera);
  gl.setRenderTarget(previous);

  quad.geometry.dispose();
  material.dispose();
  return target;
}