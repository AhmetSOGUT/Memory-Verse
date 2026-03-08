import * as THREE from "three";

export const Particles = (() => {
  function makeStars() {
    const pos = [], cols = [], sz = [];
  
    for (let i = 0; i < 9000; i++) {
      const radius = 40 + Math.random() * 260;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
  
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
  
      pos.push(x, y, z);
  
      const rn = Math.random();
      if (rn < 0.6) cols.push(0.9, 0.95, 1.0);
      else if (rn < 0.8) cols.push(1.0, 1.0, 0.85);
      else if (rn < 0.9) cols.push(1.0, 0.85, 0.7);
      else cols.push(0.8, 0.85, 1.0);
  
      const sizeRand = Math.random();
      if (sizeRand < 0.03) sz.push(3.2);
      else if (sizeRand < 0.15) sz.push(2.0);
      else sz.push(Math.random() * 1.2 + 0.3);
    }
  
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("aColor", new THREE.Float32BufferAttribute(cols, 3));
    geo.setAttribute("size", new THREE.Float32BufferAttribute(sz, 1));
  
    const mat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `
        attribute float size;
        attribute vec3 aColor;
        varying vec3 vColor;
        uniform float time;
  
        void main() {
          vColor = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
  
          float flicker = 1.0 + 0.12 * sin(time * 2.0 + position.x * 2.7 + position.y * 1.9);
          gl_PointSize = size * flicker * (220.0 / -mv.z);
  
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
  
        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float d = length(uv);
  
          if (d > 0.5) discard;
  
          float alpha = 1.0 - smoothstep(0.08, 0.5, d);
          float glow = exp(-d * 7.0);
  
          gl_FragColor = vec4(vColor + glow * 0.35, alpha * (0.65 + glow * 0.35));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  
    return new THREE.Points(geo, mat);
  }

  function makeNebula() {
    const pos = [], col = [];
    const nc = [
      [0.8, 0.2, 0.5],
      [0.3, 0.1, 0.8],
      [0.1, 0.3, 0.9],
      [0.0, 0.6, 0.8],
      [0.9, 0.4, 0.1],
    ];

    for (let n = 0; n < 5; n++) {
      const ct = (n / 5) * Math.PI * 2;
      const cp = Math.PI * 0.3 + Math.random() * Math.PI * 0.4;
      const cr = 320;
      const cx = cr * Math.sin(cp) * Math.cos(ct);
      const cy = cr * Math.sin(cp) * Math.sin(ct);
      const cz = cr * Math.cos(cp);
      const c = nc[n];

      for (let i = 0; i < 260; i++) {
        const sp = 40 + Math.random() * 16;
        pos.push(
          cx + (Math.random() - 0.5) * sp,
          cy + (Math.random() - 0.5) * sp,
          cz + (Math.random() - 0.5) * sp
        );
        const a = 0.3 + Math.random() * 0.7;
        col.push(c[0] * a, c[1] * a, c[2] * a);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));

    return new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 6,
        vertexColors: true,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      })
    );
  }

  function makeMilkyWay() {
    const pos = [], col = [];

    for (let i = 0; i < 3000; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (Math.random() - 0.5) * 0.25;
      const r = 160 + Math.random() * 30;

      pos.push(
        r * Math.cos(a),
        Math.sin(sp * Math.PI) * 15,
        r * Math.sin(a)
      );

      const b = 0.3 + Math.random() * 0.7;
      col.push(b * 0.85, b * 0.9, b);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));

    return new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 1.2,
        vertexColors: true,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      })
    );
  }

  function startShootingStars(containerEl, isOpenFn) {
    const interval = setInterval(() => {
      if (!containerEl || !isOpenFn()) return;

      const star = document.createElement("div");
      star.className = "shooting-star";
      star.style.left = `${window.innerWidth * (0.4 + Math.random() * 0.5)}px`;
      star.style.top = `${window.innerHeight * (Math.random() * 0.35)}px`;

      containerEl.appendChild(star);
      setTimeout(() => star.remove(), 1700);
    }, 3500);

    return () => clearInterval(interval);
  }

  return { makeStars, makeNebula, makeMilkyWay, startShootingStars };
})();