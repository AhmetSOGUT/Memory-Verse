import * as THREE from "three";

export const Particles = (() => {

  // ── Yuvarlak sprite texture (canvas ile) ──────────────────────────────────
  function makeCircleTexture(size = 64) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    const half = size / 2;
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0,   "rgba(255,255,255,1)");
    gradient.addColorStop(0.3, "rgba(255,255,255,0.8)");
    gradient.addColorStop(0.7, "rgba(255,255,255,0.2)");
    gradient.addColorStop(1,   "rgba(255,255,255,0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    return new THREE.CanvasTexture(canvas);
  }

  // ── Yıldızlar ─────────────────────────────────────────────────────────────
  function makeStars() {
    const pos = [], cols = [], sz = [];

    for (let i = 0; i < 9000; i++) {
      const radius = 40 + Math.random() * 260;
      const theta  = Math.random() * Math.PI * 2;
      const phi    = Math.acos(2 * Math.random() - 1);

      pos.push(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );

      const rn = Math.random();
      if      (rn < 0.6) cols.push(0.9,  0.95, 1.0);
      else if (rn < 0.8) cols.push(1.0,  1.0,  0.85);
      else if (rn < 0.9) cols.push(1.0,  0.85, 0.7);
      else               cols.push(0.8,  0.85, 1.0);

      const sr = Math.random();
      if      (sr < 0.03) sz.push(3.2);
      else if (sr < 0.15) sz.push(2.0);
      else                sz.push(Math.random() * 1.2 + 0.3);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos,  3));
    geo.setAttribute("aColor",   new THREE.Float32BufferAttribute(cols, 3));
    geo.setAttribute("size",     new THREE.Float32BufferAttribute(sz,   1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        time:       { value: 0 },
        pointTex:   { value: makeCircleTexture(64) },
      },
      vertexShader: `
        attribute float size;
        attribute vec3  aColor;
        varying   vec3  vColor;
        uniform   float time;

        void main() {
          vColor = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float flicker = 1.0 + 0.12 * sin(time * 2.0 + position.x * 2.7 + position.y * 1.9);
          gl_PointSize = size * flicker * (220.0 / -mv.z);
          gl_Position  = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform sampler2D pointTex;
        varying vec3 vColor;

        void main() {
          vec4 tex   = texture2D(pointTex, gl_PointCoord);
          if (tex.a < 0.01) discard;
          float glow = exp(-length(gl_PointCoord - vec2(0.5)) * 7.0);
          gl_FragColor = vec4(vColor + glow * 0.35, tex.a * (0.65 + glow * 0.35));
        }
      `,
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    });

    return new THREE.Points(geo, mat);
  }

  // Her açılışta 2 nebula, rastgele renk, çok uzakta
  function makeNebula() {
    const circleTex = makeCircleTexture(128);

    const palettes = [
      [0.55, 0.15, 0.90],
      [0.95, 0.25, 0.55],
      [0.15, 0.45, 1.00],
      [1.00, 0.35, 0.10],
      [0.05, 0.75, 0.70],
      [0.70, 0.20, 1.00],
      [1.00, 0.60, 0.10],
      [0.10, 0.80, 0.40],
    ];

    const shuffled = [...palettes].sort(() => Math.random() - 0.5);
    const group = new THREE.Group();

    for (let ni = 0; ni < 2; ni++) {
      const [r, g, b] = shuffled[ni];
      const pos = [], col = [];

      const angle = ni * Math.PI + Math.random() * 0.5;
      const elev  = (Math.random() - 0.5) * 0.35;
      const dist  = 580 + Math.random() * 120;

      const cx = dist * Math.cos(elev) * Math.cos(angle);
      const cy = dist * Math.sin(elev) * 0.5;
      const cz = dist * Math.cos(elev) * Math.sin(angle);

      const spread = 130 + Math.random() * 50;

      for (let i = 0; i < 160; i++) {
        const u  = Math.random();
        const th = Math.random() * Math.PI * 2;
        const ph = (Math.random() - 0.5) * Math.PI;
        const rr = spread * Math.sqrt(-2 * Math.log(Math.max(u, 0.0001)));

        pos.push(
          cx + rr * Math.cos(ph) * Math.cos(th),
          cy + rr * Math.sin(ph) * 0.4,
          cz + rr * Math.cos(ph) * Math.sin(th)
        );

        const br   = 0.3 + Math.random() * 0.7;
        const vary = (Math.random() - 0.5) * 0.1;
        col.push(
          Math.min(1, r * br + vary),
          Math.min(1, g * br),
          Math.min(1, b * br - vary)
        );
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("color",    new THREE.Float32BufferAttribute(col, 3));

      group.add(new THREE.Points(geo, new THREE.PointsMaterial({
        size:            30,
        map:             circleTex,
        vertexColors:    true,
        transparent:     true,
        opacity:         0.05,
        depthWrite:      false,
        blending:        THREE.AdditiveBlending,
        sizeAttenuation: true,
        alphaTest:       0.001,
      })));
    }

    return group;
  }

  // ── Samanyolu bandı ────────────────────────────────────────────────────────
  function makeMilkyWay() {
    const pos = [], col = [];

    for (let i = 0; i < 3000; i++) {
      const a  = Math.random() * Math.PI * 2;
      const sp = (Math.random() - 0.5) * 0.25;
      const r  = 160 + Math.random() * 30;

      pos.push(r * Math.cos(a), Math.sin(sp * Math.PI) * 15, r * Math.sin(a));

      const b = 0.3 + Math.random() * 0.7;
      col.push(b * 0.85, b * 0.9, b);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("color",    new THREE.Float32BufferAttribute(col, 3));

    return new THREE.Points(geo, new THREE.PointsMaterial({
      size:            1.2,
      vertexColors:    true,
      transparent:     true,
      opacity:         0.5,
      depthWrite:      false,
      blending:        THREE.AdditiveBlending,
      sizeAttenuation: true,
    }));
  }

  // ── Kayan yıldızlar ────────────────────────────────────────────────────────
  function startShootingStars(containerEl, isOpenFn) {
    const interval = setInterval(() => {
      if (!containerEl || !isOpenFn()) return;

      const star = document.createElement("div");
      star.className = "shooting-star";
      star.style.left = `${window.innerWidth * (0.4 + Math.random() * 0.5)}px`;
      star.style.top  = `${window.innerHeight * (Math.random() * 0.35)}px`;

      containerEl.appendChild(star);
      setTimeout(() => star.remove(), 1700);
    }, 3500);

    return () => clearInterval(interval);
  }

  return { makeStars, makeNebula, makeMilkyWay, startShootingStars };
})();