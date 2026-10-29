import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DRIFT, FOV_MAX, FOV_MIN } from "./constants";

interface CameraRigProps {
  /** Seçili küre yokken kamera yavaşça döner. */
  autoRotate: boolean;
  /** Her karede güncellenen bakış yönü (birim vektör). */
  lookDir: React.RefObject<THREE.Vector3>;
  /** Son pointer hareketi tıklama değil sürükleme miydi? */
  dragState: React.RefObject<{ moved: boolean }>;
}

const DRAG_THRESHOLD_PX = 6;
const IDLE_RESUME_MS = 3000;

/**
 * Kamera sabit noktada durur, yalnızca etrafına bakar (yaw/pitch).
 * Sürükleme = bakış yönü, tekerlek = FOV zoom. Fare ve dokunmatik pointer olaylarıyla.
 */
export function CameraRig({ autoRotate, lookDir, dragState }: CameraRigProps) {
  const { camera, gl } = useThree();
  const s = useRef({
    dragging: false,
    lastX: 0, lastY: 0, startX: 0, startY: 0,
    yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0,
    idleUntil: 0,
  });
  const autoRotateRef = useRef(autoRotate);
  useEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);

  useEffect(() => {
    const el = gl.domElement;
    const st = s.current;

    const onDown = (e: PointerEvent) => {
      st.dragging = true;
      st.lastX = st.startX = e.clientX;
      st.lastY = st.startY = e.clientY;
      dragState.current.moved = false;
      el.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!st.dragging) return;
      st.targetYaw -= (e.clientX - st.lastX) * 0.004;
      st.targetPitch -= (e.clientY - st.lastY) * 0.003;
      st.targetPitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, st.targetPitch));
      st.lastX = e.clientX;
      st.lastY = e.clientY;
      if (Math.hypot(e.clientX - st.startX, e.clientY - st.startY) > DRAG_THRESHOLD_PX) {
        dragState.current.moved = true;
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!st.dragging) return;
      st.dragging = false;
      st.idleUntil = performance.now() + IDLE_RESUME_MS;
      el.releasePointerCapture?.(e.pointerId);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cam = camera as THREE.PerspectiveCamera;
      cam.fov = Math.max(FOV_MIN, Math.min(FOV_MAX, cam.fov + e.deltaY * 0.04));
      cam.updateProjectionMatrix();
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, [camera, gl, dragState]);

  useFrame(({ clock }, delta) => {
    const st = s.current;
    const k = Math.min(delta * 60, 3); // 60 fps'e normalize

    if (!st.dragging && autoRotateRef.current && performance.now() > st.idleUntil) {
      st.targetYaw += 0.0003 * k;
    }
    const ease = 1 - Math.pow(1 - 0.06, k);
    st.yaw += (st.targetYaw - st.yaw) * ease;
    st.pitch += (st.targetPitch - st.pitch) * ease;

    const lx = Math.sin(st.yaw) * Math.cos(st.pitch);
    const ly = Math.sin(st.pitch);
    const lz = Math.cos(st.yaw) * Math.cos(st.pitch);
    lookDir.current.set(lx, ly, lz);
     // Çok yavaş süzülme: yakın yıldızlar uzaktakilere göre kayar → derinlik
    const t = clock.elapsedTime * DRIFT.speed;
    camera.position.set(
      Math.sin(t * 0.07) * DRIFT.amplitude,
      Math.sin(t * 0.05 + 1.3) * DRIFT.amplitude * 0.5,
      Math.sin(t * 0.06 + 2.1) * DRIFT.amplitude,
    );
    camera.lookAt(camera.position.x + lx * 100, camera.position.y + ly * 100, camera.position.z + lz * 100);
  });

  return null;
}
