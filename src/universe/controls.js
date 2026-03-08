import * as THREE from "three";

export const SpaceControls = (() => {
  const state = {
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

  let onClickCb = null;
  let cam3d = null;
  let overlayEl = null;

  function init(overlay, camera, onClickFn) {
    overlayEl = overlay;
    cam3d = camera;
    onClickCb = onClickFn;

    overlay.addEventListener("mousedown", mdwn);
    overlay.addEventListener("mousemove", mmov);
    overlay.addEventListener("mouseup", mup);
    overlay.addEventListener("mouseleave", mup);
    overlay.addEventListener("touchstart", tsta, { passive: false });
    overlay.addEventListener("touchmove", tmov, { passive: false });
    overlay.addEventListener("touchend", mup);
    overlay.addEventListener("wheel", mwhl, { passive: false });
    overlay.addEventListener("click", mclk);
  }

  function destroy() {
    if (!overlayEl) return;

    overlayEl.removeEventListener("mousedown", mdwn);
    overlayEl.removeEventListener("mousemove", mmov);
    overlayEl.removeEventListener("mouseup", mup);
    overlayEl.removeEventListener("mouseleave", mup);
    overlayEl.removeEventListener("touchstart", tsta);
    overlayEl.removeEventListener("touchmove", tmov);
    overlayEl.removeEventListener("touchend", mup);
    overlayEl.removeEventListener("wheel", mwhl);
    overlayEl.removeEventListener("click", mclk);

    overlayEl = null;
  }

  function setCamera(camera) {
    cam3d = camera;
  }

  function setAutoRotate(v) {
    state.autoRot = v;
  }

  function tick() {
    if (!state.dragging && state.autoRot) state.tYaw += 0.0003;

    state.camYaw += (state.tYaw - state.camYaw) * 0.06;
    state.camPitch += (state.tPitch - state.camPitch) * 0.06;

    const lx = Math.sin(state.camYaw) * Math.cos(state.camPitch);
    const ly = Math.sin(state.camPitch);
    const lz = Math.cos(state.camYaw) * Math.cos(state.camPitch);

    if (cam3d) {
      cam3d.lookAt(new THREE.Vector3(lx * 100, ly * 100, lz * 100));
    }

    return { lx, ly, lz };
  }

  function mdwn(e) {
    state.dragging = true;
    state.autoRot = false;
    state.lpx = e.clientX;
    state.lpy = e.clientY;
    state.clickSX = e.clientX;
    state.clickSY = e.clientY;
  }

  function mmov(e) {
    if (!state.dragging) return;
    state.tYaw -= (e.clientX - state.lpx) * 0.004;
    state.tPitch -= (e.clientY - state.lpy) * 0.003;
    state.tPitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, state.tPitch));
    state.lpx = e.clientX;
    state.lpy = e.clientY;
  }

  function mup() {
    state.dragging = false;
    setTimeout(() => {
      if (!state.dragging) state.autoRot = true;
    }, 3000);
  }

  function mclk(e) {
    if (Math.abs(e.clientX - state.clickSX) > 6 || Math.abs(e.clientY - state.clickSY) > 6) return;
    onClickCb?.(e.clientX, e.clientY);
  }

  function tsta(e) {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    state.dragging = true;
    state.autoRot = false;
    state.lpx = e.touches[0].clientX;
    state.lpy = e.touches[0].clientY;
    state.clickSX = state.lpx;
    state.clickSY = state.lpy;
  }

  function tmov(e) {
    if (!state.dragging || e.touches.length !== 1) return;
    e.preventDefault();
    state.tYaw -= (e.touches[0].clientX - state.lpx) * 0.004;
    state.tPitch -= (e.touches[0].clientY - state.lpy) * 0.003;
    state.tPitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, state.tPitch));
    state.lpx = e.touches[0].clientX;
    state.lpy = e.touches[0].clientY;
  }

  function mwhl(e) {
    e.preventDefault();
    if (!cam3d) return;
    cam3d.fov = Math.max(35, Math.min(95, cam3d.fov + e.deltaY * 0.04));
    cam3d.updateProjectionMatrix();
  }

  return { init, destroy, tick, setCamera, setAutoRotate };
})();