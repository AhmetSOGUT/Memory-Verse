import * as THREE from "three";

export class SpaceControls {
  constructor() {
    this.state = {
      dragging: false,
      lpx: 0,
      lpy: 0,
      clickSX: 0,
      clickSY: 0,
      camYaw: 0,
      camPitch: 0,
      tYaw: 0,
      tPitch: 0,
      autoRot: true,
    };

    this._onClickCb = null;
    this._cam = null;
    this._el = null;
    this._autoRotTimer = null;

    // Bind handlers so we can remove them later
    this._mdwn = this._mdwn.bind(this);
    this._mmov = this._mmov.bind(this);
    this._mup  = this._mup.bind(this);
    this._mclk = this._mclk.bind(this);
    this._tsta = this._tsta.bind(this);
    this._tmov = this._tmov.bind(this);
    this._mwhl = this._mwhl.bind(this);
  }

  init(overlay, camera, onClickFn) {
    this._el = overlay;
    this._cam = camera;
    this._onClickCb = onClickFn;

    overlay.addEventListener("mousedown",  this._mdwn);
    overlay.addEventListener("mousemove",  this._mmov);
    overlay.addEventListener("mouseup",    this._mup);
    overlay.addEventListener("mouseleave", this._mup);
    overlay.addEventListener("touchstart", this._tsta, { passive: false });
    overlay.addEventListener("touchmove",  this._tmov, { passive: false });
    overlay.addEventListener("touchend",   this._mup);
    overlay.addEventListener("wheel",      this._mwhl, { passive: false });
    overlay.addEventListener("click",      this._mclk);
  }

  destroy() {
    if (!this._el) return;

    this._el.removeEventListener("mousedown",  this._mdwn);
    this._el.removeEventListener("mousemove",  this._mmov);
    this._el.removeEventListener("mouseup",    this._mup);
    this._el.removeEventListener("mouseleave", this._mup);
    this._el.removeEventListener("touchstart", this._tsta);
    this._el.removeEventListener("touchmove",  this._tmov);
    this._el.removeEventListener("touchend",   this._mup);
    this._el.removeEventListener("wheel",      this._mwhl);
    this._el.removeEventListener("click",      this._mclk);

    clearTimeout(this._autoRotTimer);
    this._el = null;
  }

  setCamera(camera) {
    this._cam = camera;
  }

  setAutoRotate(v) {
    this.state.autoRot = v;
  }

  tick() {
    const s = this.state;

    if (!s.dragging && s.autoRot) s.tYaw += 0.0003;

    s.camYaw   += (s.tYaw   - s.camYaw)   * 0.06;
    s.camPitch += (s.tPitch - s.camPitch)  * 0.06;

    const lx = Math.sin(s.camYaw)   * Math.cos(s.camPitch);
    const ly = Math.sin(s.camPitch);
    const lz = Math.cos(s.camYaw)   * Math.cos(s.camPitch);

    if (this._cam) {
      this._cam.lookAt(new THREE.Vector3(lx * 100, ly * 100, lz * 100));
    }

    return { lx, ly, lz };
  }

  // ── Private event handlers ──────────────────────────────────────────────────

  _mdwn(e) {
    const s = this.state;
    s.dragging = true;
    s.autoRot  = false;
    s.lpx = e.clientX;
    s.lpy = e.clientY;
    s.clickSX = e.clientX;
    s.clickSY = e.clientY;
    clearTimeout(this._autoRotTimer);
  }

  _mmov(e) {
    const s = this.state;
    if (!s.dragging) return;
    s.tYaw   -= (e.clientX - s.lpx) * 0.004;
    s.tPitch -= (e.clientY - s.lpy) * 0.003;
    s.tPitch  = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, s.tPitch));
    s.lpx = e.clientX;
    s.lpy = e.clientY;
  }

  _mup() {
    this.state.dragging = false;
    clearTimeout(this._autoRotTimer);
    this._autoRotTimer = setTimeout(() => {
      if (!this.state.dragging) this.state.autoRot = true;
    }, 3000);
  }

  _mclk(e) {
    const s = this.state;
    if (Math.abs(e.clientX - s.clickSX) > 6 || Math.abs(e.clientY - s.clickSY) > 6) return;
    this._onClickCb?.(e.clientX, e.clientY);
  }

  _tsta(e) {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    const s = this.state;
    s.dragging = true;
    s.autoRot  = false;
    s.lpx = e.touches[0].clientX;
    s.lpy = e.touches[0].clientY;
    s.clickSX = s.lpx;
    s.clickSY = s.lpy;
    clearTimeout(this._autoRotTimer);
  }

  _tmov(e) {
    if (!this.state.dragging || e.touches.length !== 1) return;
    e.preventDefault();
    const s = this.state;
    s.tYaw   -= (e.touches[0].clientX - s.lpx) * 0.004;
    s.tPitch -= (e.touches[0].clientY - s.lpy) * 0.003;
    s.tPitch  = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, s.tPitch));
    s.lpx = e.touches[0].clientX;
    s.lpy = e.touches[0].clientY;
  }

  _mwhl(e) {
    e.preventDefault();
    if (!this._cam) return;
    this._cam.fov = Math.max(35, Math.min(95, this._cam.fov + e.deltaY * 0.04));
    this._cam.updateProjectionMatrix();
  }
}