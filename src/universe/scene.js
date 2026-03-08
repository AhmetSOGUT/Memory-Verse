import * as THREE from "three";
import { Particles } from "./particles";
import { Orbs } from "./orbs";
import { SpaceControls } from "./controls";

export class SpaceSceneController {
  constructor({ overlayEl, canvasContainerEl, memories }) {
    this.overlayEl = overlayEl;
    this.canvasContainerEl = canvasContainerEl;
    this.memories = memories;

    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.orbGroup = null;
    this.stars = null;
    this.nebula = null;
    this.milkyWay = null;
    this.orbMeshes = [];
    this.selectedOrb = null;
    this.zoomTarget = 0;
    this.zoomProg = 0;
    this.isOpen = false;
    this.animId = null;
    this.cleanupShootingStars = null;

    this.raycaster = new THREE.Raycaster();
    this.mouse2d = new THREE.Vector2();

    this.handleResize = this.handleResize.bind(this);
    this.handleClick = this.handleClick.bind(this);
  }

  setMemories(memories) {
    this.memories = memories;
    if (this.isOpen) this.rebuild();
  }

  open() {
    if (!this.overlayEl || !this.canvasContainerEl) return;

    this.isOpen = true;

    if (!this.renderer) {
      this.init();
    } else {
      this.handleResize();
      this.rebuild();
    }

    this.startLoop();
  }

  close() {
    this.isOpen = false;
    this.hidePanel();

    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  destroy() {
    this.close();

    SpaceControls.destroy();
    window.removeEventListener("resize", this.handleResize);

    if (this.cleanupShootingStars) {
      this.cleanupShootingStars();
      this.cleanupShootingStars = null;
    }

    if (this.orbGroup) {
      while (this.orbGroup.children.length) {
        const child = this.orbGroup.children[0];
        child.traverse((c) => {
          c.geometry?.dispose?.();
          if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose?.());
          else c.material?.dispose?.();
        });
        this.orbGroup.remove(child);
      }
    }

    if (this.renderer) {
      this.renderer.dispose();
      const canvas = this.renderer.domElement;
      if (canvas?.parentNode) canvas.parentNode.removeChild(canvas);
    }

    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.orbGroup = null;
    this.orbMeshes = [];
  }

  init() {
    const W = window.innerWidth;
    const H = window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(W, H);
    this.renderer.setClearColor(0x010816, 1);
    this.canvasContainerEl.innerHTML = "";
    this.canvasContainerEl.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(65, W / H, 0.1, 1000);
    this.camera.position.set(0, 0, 0);

    this.stars = Particles.makeStars();
    this.nebula = Particles.makeNebula();
    this.milkyWay = Particles.makeMilkyWay();

    this.nebula.scale.set(1.4, 1.1, 1.4);
    this.nebula.position.set(0, 20, -120);

    this.scene.add(this.stars, this.nebula);
    this.scene.add(new THREE.AmbientLight(0x8090c0, 0.6));

    const sun = new THREE.PointLight(0xfff5e0, 2.5, 200);
    sun.position.set(30, 40, 20);
    this.scene.add(sun);

    const fill = new THREE.PointLight(0x6644ff, 1.0, 150);
    fill.position.set(-50, -20, -40);
    this.scene.add(fill);

    const rim = new THREE.PointLight(0xff66aa, 0.8, 120);
    rim.position.set(0, -50, 50);
    this.scene.add(rim);

    this.orbGroup = new THREE.Group();
    this.scene.add(this.orbGroup);

    this.rebuild();

    SpaceControls.init(this.overlayEl, this.camera, this.handleClick);

    this.cleanupShootingStars = Particles.startShootingStars(
      this.overlayEl,
      () => this.isOpen
    );

    window.addEventListener("resize", this.handleResize);
  }

  rebuild() {
    const result = Orbs.build(this.orbGroup, this.renderer, this.memories);
    this.orbMeshes = result.orbMeshes;
    this.selectedOrb = null;
    this.zoomTarget = 0;
    this.zoomProg = 0;
    SpaceControls.setAutoRotate(true);
  }

  startLoop() {
    if (!this.renderer) return;

    const lerp = (a, b, t) => a + (b - a) * t;

    const loop = () => {
      if (!this.isOpen) return;

      this.animId = requestAnimationFrame(loop);
      const t = performance.now() * 0.001;

      const { lx, ly, lz } = SpaceControls.tick();

      if (this.stars?.material?.uniforms) {
        this.stars.material.uniforms.time.value = t;
      }

      if (this.nebula) this.nebula.rotation.y = t * 0.01;

      this.zoomProg = lerp(this.zoomProg, this.zoomTarget, 0.045);

      if (this.orbGroup) {
        this.orbGroup.children.forEach((grp, i) => {
          const ud = grp.userData;
          const isSelected = this.selectedOrb === grp;

          if (isSelected) {
            const tx = lx * 45;
            const ty = ly * 45 - 1.5;
            const tz = lz * 45;

            grp.position.x = lerp(ud.ox, tx, this.zoomProg);
            grp.position.y = lerp(ud.oy, ty, this.zoomProg);
            grp.position.z = lerp(ud.oz, tz, this.zoomProg);

            const sc = lerp(1.0, 1.45, this.zoomProg);
            grp.scale.set(sc, sc, sc);
          } else {
            grp.position.x = lerp(grp.position.x, ud.ox, 0.05);
            grp.position.y = lerp(
              grp.position.y,
              ud.oy + Math.sin(t * (0.35 + i * 0.06) + i * 1.4) * 0.8,
              0.05
            );
            grp.position.z = lerp(grp.position.z, ud.oz, 0.05);

            const tsc = this.selectedOrb ? 0.6 : 1.0;
            grp.scale.set(
              lerp(grp.scale.x, tsc, 0.05),
              lerp(grp.scale.y, tsc, 0.05),
              lerp(grp.scale.z, tsc, 0.05)
            );
          }

          if (grp.children[0]) {
            grp.children[0].rotation.y = t * 0.08 + i * 0.6;
          }
        });
      }

      this.renderer.render(this.scene, this.camera);
    };

    loop();
  }

  handleClick(clientX, clientY) {
    if (!this.renderer) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse2d.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse2d.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse2d, this.camera);

    const hits = this.raycaster.intersectObjects(this.orbMeshes);
    if (hits.length && hits[0].object.userData.isOrb) {
      const hitGrp = hits[0].object.parent;
      if (this.selectedOrb === hitGrp) this.deselect();
      else this.select(hitGrp, hits[0].object.userData.memory);
    } else {
      this.deselect();
    }
  }

  select(grp, mem) {
    this.selectedOrb = grp;
    this.zoomTarget = 1;
    SpaceControls.setAutoRotate(false);
    setTimeout(() => this.showPanel(mem), 350);
  }

  deselect() {
    this.selectedOrb = null;
    this.zoomTarget = 0;
    SpaceControls.setAutoRotate(true);
    this.hidePanel();
  }

  showPanel(mem) {
    this.hidePanel();

    const p = document.createElement("div");
    p.id = "orbPanel";

    const date = new Date(mem.date).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    p.style.cssText = [
      "position:fixed",
      "top:50%",
      "right:3vw",
      "transform:translateY(-50%) translateX(30px)",
      "background:rgba(4,8,24,0.92)",
      "backdrop-filter:blur(24px)",
      "-webkit-backdrop-filter:blur(24px)",
      "border:1px solid rgba(255,255,255,0.13)",
      "border-radius:28px",
      "padding:0",
      "width:360px",
      "max-width:90vw",
      "z-index:3000",
      "color:white",
      "font-family:Poppins,sans-serif",
      "box-shadow:0 24px 80px rgba(0,0,0,0.9),0 0 60px rgba(255,100,140,0.1)",
      "transition:all 0.45s cubic-bezier(0.2,0.8,0.2,1)",
      "opacity:0",
      "overflow:hidden",
    ].join(";");

    p.innerHTML =
      (mem.image
        ? `<div style="width:100%;background:#06090f;border-radius:28px 28px 0 0;display:flex;align-items:center;justify-content:center;padding:16px">
             <img src="${mem.image}" style="max-width:100%;max-height:260px;object-fit:contain;border-radius:16px;display:block">
           </div>`
        : `<div style="width:100%;height:140px;background:linear-gradient(135deg,#ff758c44,#7b4fe888);border-radius:28px 28px 0 0;display:flex;align-items:center;justify-content:center;font-size:3.5rem">💫</div>`) +
      `<div style="padding:22px 24px 24px">
        <div style="font-size:0.68rem;text-transform:uppercase;letter-spacing:2.5px;color:#ff758c;font-weight:600;margin-bottom:8px">${date}</div>
        <div style="font-size:1.18rem;font-weight:700;margin-bottom:10px;line-height:1.3">${mem.title}</div>
        <div style="font-size:0.86rem;color:#94a3b8;line-height:1.7">${mem.description}</div>
      </div>`;

    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = "✕";
    closeBtn.style.cssText =
      "position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.15);color:#e2e8f0;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px)";
    closeBtn.onclick = () => this.deselect();

    p.appendChild(closeBtn);
    this.overlayEl.appendChild(p);

    requestAnimationFrame(() => {
      p.style.opacity = "1";
      p.style.transform = "translateY(-50%) translateX(0)";
    });
  }

  hidePanel() {
    const p = document.getElementById("orbPanel");
    if (!p) return;

    p.style.opacity = "0";
    p.style.transform = "translateY(-50%) translateX(30px)";
    setTimeout(() => p.parentNode?.removeChild(p), 400);
  }

  handleResize() {
    if (!this.renderer || !this.camera) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}