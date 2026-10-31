import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { fovForAspect } from "./camera";
import { DRIFT, FOV_DEFAULT, FOV_MAX, FOV_MIN } from "./constants";

interface CameraRigProps {
  /** Seçili küre yokken kamera yavaşça döner. */
  autoRotate: boolean;
  /** Her karede güncellenen bakış yönü (birim vektör). */
  lookDir: React.RefObject<THREE.Vector3>;
  /** Son pointer hareketi tıklama değil sürükleme miydi? */
  dragState: React.RefObject<{ moved: boolean }>;
  /** Açılışta bakılacak yön (yalnızca telefon düzeninde verilir; yoksa düz ileri bakar). */
  initialLook?: { yaw: number; pitch: number } | null;
}

const DRAG_THRESHOLD_PX = 6;
const IDLE_RESUME_MS = 3000;
const PITCH_LIMIT = Math.PI / 2 - 0.05;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Kamera sabit noktada durur, yalnızca etrafına bakar (yaw/pitch).
 * Tek parmak/fare sürükleme = bakış yönü, tekerlek veya iki parmakla sıkıştırma = FOV zoom.
 */
export function CameraRig({ autoRotate, lookDir, dragState, initialLook }: CameraRigProps) {
  const { camera, gl } = useThree();
  const s = useRef({
    dragging: false,
    lastX: 0, lastY: 0, startX: 0, startY: 0,
    yaw: initialLook?.yaw ?? 0, pitch: initialLook?.pitch ?? 0,
    targetYaw: initialLook?.yaw ?? 0, targetPitch: initialLook?.pitch ?? 0,
    idleUntil: 0,
    zoom: FOV_DEFAULT, // yakınlaştırma değeri; gerçek görüş açısı ekran oranına göre türetilir
  });
  const autoRotateRef = useRef(autoRotate);
  useEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);

  useEffect(() => {
    const el = gl.domElement;
    const st = s.current;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch: { dist: number; zoom: number } | null = null;

    const pinchDistance = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a!.x - b!.x, a!.y - b!.y);
    };

    const onDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.setPointerCapture?.(e.pointerId);
      if (pointers.size === 1) {
        st.dragging = true;
        st.lastX = st.startX = e.clientX;
        st.lastY = st.startY = e.clientY;
        dragState.current.moved = false;
      } else if (pointers.size === 2) {
        // İkinci parmak: sürükleme biter, sıkıştırma (zoom) başlar; sonunda küreye yanlışlıkla tıklanmasın
        st.dragging = false;
        pinch = { dist: Math.max(pinchDistance(), 1), zoom: st.zoom };
        dragState.current.moved = true;
      }
    };
    const onMove = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      if (!p) return; // basılı olmayan fare hareketi
      p.x = e.clientX;
      p.y = e.clientY;
      if (pinch && pointers.size === 2) {
        st.zoom = clamp((pinch.zoom * pinch.dist) / Math.max(pinchDistance(), 1), FOV_MIN, FOV_MAX);
        return;
      }
      if (!st.dragging) return;
      st.targetYaw -= (e.clientX - st.lastX) * 0.004;
      st.targetPitch -= (e.clientY - st.lastY) * 0.003;
      st.targetPitch = clamp(st.targetPitch, -PITCH_LIMIT, PITCH_LIMIT);
      st.lastX = e.clientX;
      st.lastY = e.clientY;
      if (Math.hypot(e.clientX - st.startX, e.clientY - st.startY) > DRAG_THRESHOLD_PX) {
        dragState.current.moved = true;
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId)) return;
      el.releasePointerCapture?.(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 1) {
        // Sıkıştırmadan sonra kalan parmakla sürüklemeye devam: bakış yönü zıplamasın
        const rest = [...pointers.values()][0]!;
        st.dragging = true;
        st.lastX = st.startX = rest.x;
        st.lastY = st.startY = rest.y;
        dragState.current.moved = true;
      } else if (pointers.size === 0) {
        st.dragging = false;
        st.idleUntil = performance.now() + IDLE_RESUME_MS;
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      st.zoom = clamp(st.zoom + e.deltaY * 0.04, FOV_MIN, FOV_MAX);
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

  useFrame(({ clock, camera: frameCamera }, delta) => {
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

    // Görüş açısı: yatay ekranda zoom'un kendisi, dikey ekranda genişletilmiş hâli
    const cam = frameCamera as THREE.PerspectiveCamera;
    const fov = fovForAspect(st.zoom, cam.aspect);
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  });

  return null;
}