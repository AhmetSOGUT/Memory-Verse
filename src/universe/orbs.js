import * as THREE from "three";

const COLORS = [
  "#fff59d", "#ffab91", "#81d4fa", "#ce93d8",
  "#a5d6a7", "#ffcc80", "#f9a8d4", "#6ee7b7",
  "#80cbc4", "#ef9a9a", "#b39ddb", "#80deea",
];

const SPH_RADIUS = 8;

export const Orbs = (() => {

  // ── Fotoğraf texture ─────────────────────────────────────────────────────
  function makePhotoTexture(src, size = 512) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        const ar = img.width / img.height;
        let sx = 0, sy = 0, sw = img.width, sh = img.height;
        if (ar > 1) { sx = (img.width - img.height) / 2; sw = img.height; }
        else        { sy = (img.height - img.width) / 2; sh = img.width; }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        resolve(tex);
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  // ── İç küre shader — normal.xy'yi UV olarak kullan ──────────────────────
  // Bu yöntemde fotoğraf düzlemsel projeksiyon gibi yansıtılır.
  // Her yönden bakıldığında fotoğrafın tam ortası görünür, distortion minimal.
  function makeInnerMaterial(tex, clr) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTex:   { value: tex },
        uColor: { value: clr },
        uTime:  { value: 0 },
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          // BackSide'da normal otomatik ters döner, biz orijinalini istiyoruz
          vNormal     = normalize(normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uTex;
        uniform vec3      uColor;
        uniform float     uTime;
        varying vec3      vNormal;

        void main() {
          vec3 n = normalize(vNormal);

          // Düzlemsel projeksiyon: normal.xy → UV
          // -1..1 aralığını 0..1'e taşı
          vec2 uv = n.xy * 0.5 + 0.5;

          // Hafif dalga
          float wave = sin(uv.x * 6.0 + uTime * 0.7) * 0.007
                     + cos(uv.y * 5.0 + uTime * 0.5) * 0.005;
          uv += wave;
          uv = clamp(uv, 0.0, 1.0);

          vec4 photo = texture2D(uTex, uv);

          // Radyal vignette — kenarlara doğru eriyor
          float dist = length(n.xy);
          float vig  = 1.0 - smoothstep(0.92, 1.0, dist);

          // Dönen mavi/cyan iç yansıma — küre içinde dönen ışık halkası
          float innerAngle = atan(n.y, n.x) + uTime * 0.5;
          float ring1 = exp(-pow(dist - 0.7, 2.0) * 40.0)  // sabit halka
                      * (0.5 + 0.5 * sin(innerAngle * 3.0 + uTime * 1.2));
          float ring2 = exp(-pow(dist - 0.85, 2.0) * 60.0)
                      * (0.5 + 0.5 * cos(innerAngle * 2.0 - uTime * 0.8));

          // Halka rengi = orbun kendi rengi
          vec3 ringCol = uColor * ring1 * 0.45
                       + uColor * ring2 * 0.28;

          // Kenar parlaklık — orbun rengiyle
          float edge    = smoothstep(0.75, 1.0, dist);
          vec3  edgeCol = uColor * edge * 0.28;

          // Fotoğrafa çok hafif renk tinti — camın içindeymiş gibi
          vec3 tinted = mix(photo.rgb, uColor, 0.09);

          vec3  col  = tinted * vig + ringCol + edgeCol;

          gl_FragColor = vec4(col, vig * 0.98 + 0.02);
        }
      `,
      transparent: true,
      side:        THREE.BackSide,
      depthWrite:  false,
    });
  }

  // ── Dış cam shader — dramatik Fresnel + dönen ışık bandı ───────────────
  function makeGlassMaterial(clr) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: clr },
        uTime:  { value: 0 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPos;
        varying vec3 vLocalPos;
        void main() {
          vNormal   = normalize(normalMatrix * normal);
          vPos      = (modelMatrix * vec4(position, 1.0)).xyz;
          vLocalPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3  uColor;
        uniform float uTime;
        varying vec3  vNormal;
        varying vec3  vPos;
        varying vec3  vLocalPos;

        void main() {
          vec3  view    = normalize(cameraPosition - vPos);
          float fresnel = pow(1.0 - abs(dot(vNormal, view)), 2.8);

          // Dönen ışık bandı — küre üzerinde dönen parlak şerit
          float angle  = atan(vLocalPos.z, vLocalPos.x) + uTime * 0.6;
          float band   = smoothstep(0.85, 1.0, sin(angle)) * 0.22;

          // İkinci daha hızlı bant — zıt yön
          float angle2 = atan(vLocalPos.y, vLocalPos.x) - uTime * 0.4;
          float band2  = smoothstep(0.9, 1.0, sin(angle2)) * 0.12;

          // Pulse
          float pulse  = 0.5 + 0.5 * sin(uTime * 1.4);

          // Renk: tamamen orbun rengi
          vec3 glowCol = uColor * 1.3;
          vec3 col     = glowCol * (fresnel + band + band2);

          float alpha  = fresnel * (0.55 + pulse * 0.1) + band * 0.2 + band2 * 0.1;
          alpha        = clamp(alpha, 0.0, 1.0);

          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      side:        THREE.FrontSide,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    });
  }

  // ── Tek orb ──────────────────────────────────────────────────────────────
  async function buildOrb(mem, i, total) {
    const hex = COLORS[i % COLORS.length];
    const clr = new THREE.Color(hex);
    const grp = new THREE.Group();

    if (mem.image) {
      const tex = await makePhotoTexture(mem.image, 512);

      if (tex) {
        const innerMat = makeInnerMaterial(tex, clr);
        const innerSph = new THREE.Mesh(
          new THREE.SphereGeometry(SPH_RADIUS * 0.97, 64, 64),
          innerMat
        );
        innerSph.userData.shaderMat = innerMat;
        innerSph.renderOrder = 1;
        grp.add(innerSph);
      }

      const glassMat = makeGlassMaterial(clr);
      const glassSph = new THREE.Mesh(
        new THREE.SphereGeometry(SPH_RADIUS, 64, 64),
        glassMat
      );
      glassSph.userData = { isOrb: true, memory: mem, index: i, shaderMat: glassMat };
      glassSph.renderOrder = 2;
      grp.add(glassSph);

    } else {
      const orbMat = new THREE.MeshStandardMaterial({
        color:             clr,
        emissive:          clr,
        emissiveIntensity: 0.5,
        roughness:         0.2,
        metalness:         0.1,
      });
      const orb = new THREE.Mesh(new THREE.SphereGeometry(SPH_RADIUS, 64, 64), orbMat);
      orb.userData = { isOrb: true, memory: mem, index: i };
      grp.add(orb);
    }

    // Dış glow
    const glowMat = new THREE.MeshBasicMaterial({
      color: clr, transparent: true, opacity: 0.07,
      side: THREE.BackSide, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    grp.add(new THREE.Mesh(new THREE.SphereGeometry(SPH_RADIUS * 1.45, 32, 32), glowMat));

    // Pozisyon
    const golden = (1 + Math.sqrt(5)) / 2;
    const ainc   = Math.PI * 2 * golden;
    const t2     = i / Math.max(total - 1, 1);
    const inc    = Math.acos(1 - 2 * t2);
    const az     = ainc * i;
    const rad    = 300 + (i % 4) * 100;

    const px = rad * Math.sin(inc) * Math.cos(az);
    const py = rad * Math.cos(inc) * 0.5;
    const pz = rad * Math.sin(inc) * Math.sin(az);

    grp.position.set(px, py, pz);
    grp.userData = { memory: mem, index: i, baseY: py, ox: px, oy: py, oz: pz };

    const orbMesh = grp.children.find(c => c.userData.isOrb) || grp.children[0];
    return { grp, orbMesh };
  }

  async function build(orbGroup, renderer, memories) {
    clearGroup(orbGroup);
    if (!memories.length) return { orbMeshes: [] };
    const orbMeshes = [];
    for (let i = 0; i < memories.length; i++) {
      const { grp, orbMesh } = await buildOrb(memories[i], i, memories.length);
      orbGroup.add(grp);
      orbMeshes.push(orbMesh);
    }
    return { orbMeshes };
  }

  function updateShaders(orbGroup, time) {
    orbGroup.children.forEach((grp) => {
      grp.children.forEach((child) => {
        if (child.userData.shaderMat?.uniforms?.uTime) {
          child.userData.shaderMat.uniforms.uTime.value = time;
        }
      });
    });
  }

  function updateBillboards() {}

  function clearGroup(group) {
    while (group.children.length) {
      const child = group.children[0];
      child.traverse((c) => {
        c.geometry?.dispose();
        if (Array.isArray(c.material)) c.material.forEach(m => m.dispose?.());
        else c.material?.dispose?.();
      });
      group.remove(child);
    }
  }

  return { build, updateBillboards, updateShaders };
})();