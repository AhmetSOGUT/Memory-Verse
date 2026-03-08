import * as THREE from "three";

const COLORS = [
  "#fff59d", "#ffab91", "#81d4fa", "#ce93d8",
  "#a5d6a7", "#ffcc80", "#f9a8d4", "#6ee7b7",
  "#80cbc4", "#ef9a9a", "#b39ddb", "#80deea",
];

const SPH_RADIUS = 8;

export const Orbs = (() => {
  function build(orbGroup, renderer, memories) {
    const orbMeshes = [];
    clearGroup(orbGroup);

    if (!memories.length) return { orbMeshes };

    const loader = new THREE.TextureLoader();
    const total = memories.length;
    const golden = (1 + Math.sqrt(5)) / 2;
    const ainc = Math.PI * 2 * golden;

    memories.forEach((mem, i) => {
      const hex = COLORS[i % COLORS.length];
      const clr = new THREE.Color(hex);

      let mat;
      if (mem.image) {
        const tex = loader.load(mem.image);
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = true;

        mat = new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.18,
          metalness: 0.08,
          emissive: clr,
          emissiveIntensity: 0.08,
        });
      } else {
        mat = new THREE.MeshStandardMaterial({
          color: clr,
          emissive: clr,
          emissiveIntensity: 0.45,
          roughness: 0.25,
          metalness: 0.12,
        });
      }

      const sph = new THREE.Mesh(
        new THREE.SphereGeometry(SPH_RADIUS, 64, 64),
        mat
      );
      sph.userData = { isOrb: true, memory: mem, index: i };

      const g1 = new THREE.Mesh(
        new THREE.SphereGeometry(SPH_RADIUS * 1.2, 32, 32),
        new THREE.MeshBasicMaterial({
          color: clr,
          transparent: true,
          opacity: 0.12,
          side: THREE.BackSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );

      const g2 = new THREE.Mesh(
        new THREE.SphereGeometry(SPH_RADIUS * 1.6, 32, 32),
        new THREE.MeshBasicMaterial({
          color: clr,
          transparent: true,
          opacity: 0.04,
          side: THREE.BackSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );

      const grp = new THREE.Group();
      grp.add(sph, g1, g2);

      const t2 = i / Math.max(total - 1, 1);
      const inc = Math.acos(1 - 2 * t2);
      const az = ainc * i;
      const rad = 300 + (i % 4) * 100;

      const px = rad * Math.sin(inc) * Math.cos(az);
      const py = rad * Math.cos(inc) * 0.5;
      const pz = rad * Math.sin(inc) * Math.sin(az);

      grp.position.set(px, py, pz);
      grp.userData = { memory: mem, index: i, baseY: py, ox: px, oy: py, oz: pz };

      orbGroup.add(grp);
      orbMeshes.push(sph);
    });

    return { orbMeshes };
  }

  function clearGroup(group) {
    while (group.children.length) {
      const child = group.children[0];
      child.traverse((c) => {
        c.geometry?.dispose();
        if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose?.());
        else c.material?.dispose?.();
      });
      group.remove(child);
    }
  }

  return { build };
})();