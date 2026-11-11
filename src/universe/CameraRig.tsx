import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { fovForAspect } from "./camera";
import { FOV_DEFAULT, SHEET_FOCUS_NDC_Y, SIDE_FOCUS_NDC_X, WORLD } from "./constants";
import { writeSlot, worldRadius, type WorldStore } from "./world";

interface CameraRigProps {
  /** Seçili küre yokken kamera boşta yavaşça döner. */
  autoRotate: boolean;
  /** Son pointer hareketi tıklama değil sürükleme miydi? */
  dragState: React.RefObject<{ moved: boolean }>;
  store: React.RefObject<WorldStore>;
  /** Anı sayısı: ilk bakış yönü ve gezinme sınırı buna göre. */
  count: number;
  /** Değiştikçe kamera merkeze döner. */
  homeTick: number;
  /** Seçili küre incelenirken ekranda nereye otursun: panelin yerine göre. */
  layout: "center" | "sheet" | "side";
}

const DRAG_THRESHOLD_PX = 6;
const IDLE_RESUME_MS = 3000;
const PITCH_LIMIT = Math.PI / 2 - 0.05;
/** İncelemede sürükleme: piksel başına yörünge dönüşü (rad). */
const ORBIT_SPEED = 0.005;
const ORBIT_PITCH_SPEED = 0.004;
/** Orb değiştirirken kamera geçişinin süresi (sn). Büyütmek geçişi yavaşlatır. */
const TRANSITION_SECONDS = 0.75;
/** Kamera kürenin merkezine bu kadar yakınsa bakış yönü açılardan verilir (lookAt kararsızlaşır). */
const ORBIT_CENTER_EPS = 0.5;
const smoothstep = (t: number) => t * t * (3 - 2 * t);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const UP = new THREE.Vector3(0, 1, 0);
const KEY_MOVES: Record<string, "fwd" | "back" | "left" | "right" | "up" | "down"> = {
  KeyW: "fwd", ArrowUp: "fwd", KeyS: "back", ArrowDown: "back", KeyA: "left", ArrowLeft: "left",
  KeyD: "right", ArrowRight: "right", KeyE: "up", KeyQ: "down",
};

/**
 * Kamera iki modda çalışır:
 *  - GEZİNME (hiçbir küre seçili değil): dünyanın içinde uçarsın. Sürükle = etrafına bak; tekerlek, W/S ya da iki parmakla
 *    sıkıştırma = ileri/geri; A/D yana; E/Q yukarı/aşağı; Shift = hızlı. Hız, en yakın küreye uzaklığa göre ayarlanır.
 *  - İNCELEME (bir küre seçili): küre YERİNDE KALIR; kamera onun etrafında döner. Sürükle = kürenin etrafında dön;
 *    tekerlek/sıkıştırma = yaklaş/uzaklaş (merkezine kadar yaklaşılabilir).
 */
export function CameraRig({ autoRotate, dragState, store, count, homeTick, layout }: CameraRigProps) {
  const { camera, gl } = useThree();
  const s = useRef({
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    dragging: false,
    lastX: 0, lastY: 0, startX: 0, startY: 0,
    yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0,
    orbitYaw: 0, orbitPitch: 0, // seçili küre etrafındaki yörünge açıları
    // Orb değişimi geçişi: yalnızca geçiş sırasında kullanılır (1 = geçiş bitti)
    transFrom: new THREE.Vector3(), transQuat: new THREE.Quaternion(), transT: 1,
    idleUntil: 0,
    keys: { fwd: false, back: false, left: false, right: false, up: false, down: false, fast: false },
    pinchMove: 0, // sıkıştırmadan biriken ileri/geri hareket (piksel)
    seenSelected: -1,
    goHome: false, homeSeen: homeTick,
    speedScale: 1, speedTimer: 0,
    started: false,
  });
  const autoRotateRef = useRef(autoRotate);
  useEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);

  useEffect(() => {
    const el = gl.domElement;
    const st = s.current;
    const g = store.current;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchPrev = 0;

    const fingerDistance = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a!.x - b!.x, a!.y - b!.y);
    };

    const onDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.setPointerCapture?.(e.pointerId);
      g.interacting = true;
      if (pointers.size === 1) {
        st.dragging = true;
        st.lastX = st.startX = e.clientX;
        st.lastY = st.startY = e.clientY;
        dragState.current.moved = false;
      } else if (pointers.size === 2) {
        // İkinci parmak: sürükleme biter, sıkıştırma başlar; sonunda küreye yanlışlıkla dokunulmasın
        st.dragging = false;
        pinchPrev = fingerDistance();
        dragState.current.moved = true;
      }
    };
    const onMove = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      if (!p) return; // basılı olmayan fare hareketi
      p.x = e.clientX;
      p.y = e.clientY;
      if (pointers.size === 2) {
        const now = fingerDistance();
        if (g.selected >= 0) {
          // İnceleme: parmaklar açılırsa küreye yaklaş (merkeze kadar)
          g.setFocusDistance(g.focusDistance - (now - pinchPrev) * WORLD.fly.pinchZoomGain);
        } else {
          // Gezinme: parmaklar açılırsa ileri, kapanırsa geri
          st.pinchMove += now - pinchPrev;
          st.goHome = false;
        }
        pinchPrev = now;
        return;
      }
      if (!st.dragging) return;
      const dx = e.clientX - st.lastX, dy = e.clientY - st.lastY;
      if (g.selected >= 0) {
        // İnceleme: küre yerinde kalır, kamera onun etrafında döner
        st.orbitYaw -= dx * ORBIT_SPEED;
        st.orbitPitch = clamp(st.orbitPitch + dy * ORBIT_PITCH_SPEED, -PITCH_LIMIT, PITCH_LIMIT);
      } else {
        st.targetYaw -= dx * 0.004;
        st.targetPitch = clamp(st.targetPitch - dy * 0.003, -PITCH_LIMIT, PITCH_LIMIT);
      }
      st.lastX = e.clientX;
      st.lastY = e.clientY;
      if (Math.hypot(e.clientX - st.startX, e.clientY - st.startY) > DRAG_THRESHOLD_PX) {
        dragState.current.moved = true;
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId)) return;
      el.releasePointerCapture?.(e.pointerId);
      if (pointers.size === 1) {
        // Sıkıştırmadan sonra kalan parmakla devam: zıplama olmasın
        const rest = [...pointers.values()][0]!;
        st.dragging = true;
        st.lastX = st.startX = rest.x;
        st.lastY = st.startY = rest.y;
        dragState.current.moved = true;
      } else if (pointers.size === 0) {
        st.dragging = false;
        g.interacting = false;
        st.idleUntil = performance.now() + IDLE_RESUME_MS;
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 33 : 1);
      if (g.selected >= 0) {
        // İnceleme: aşağı kaydırma uzaklaştırır, yukarı yaklaştırır (merkeze kadar)
        g.setFocusDistance(g.focusDistance + dy * WORLD.fly.zoomStep);
        return;
      }
      st.goHome = false;
      // Yukarı kaydırma = ileri. İvme verir; sönümle yumuşakça durur.
      lookVector(st, tmpForward);
      st.vel.addScaledVector(tmpForward, -dy * WORLD.fly.wheelImpulse * st.speedScale);
      if (st.vel.length() > 1200) st.vel.setLength(1200);
    };

    const onKey = (e: KeyboardEvent, down: boolean) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        st.keys.fast = down;
        return;
      }
      const move = KEY_MOVES[e.code];
      if (!move) return;
      e.preventDefault();
      st.keys[move] = down;
      if (down) st.goHome = false;
    };
    const onKeyDown = (e: KeyboardEvent) => onKey(e, true);
    const onKeyUp = (e: KeyboardEvent) => onKey(e, false);
    const onBlur = () => {
      st.keys = { fwd: false, back: false, left: false, right: false, up: false, down: false, fast: false };
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [camera, gl, dragState, store]);

  useFrame(({ camera: frameCamera }, delta) => {
    const st = s.current;
    const g = store.current;
    const cam = frameCamera as THREE.PerspectiveCamera;
    const dt = Math.min(delta, 0.1);
    const k = Math.min(dt * 60, 3); // 60 fps'e normalize

    // İlk bakış: en yeni anıya doğru (boş gökyüzüyle başlamasın). Kamera ortada, ilk anılar etrafında.
    if (!st.started) {
      if (count > 0) {
        writeSlot(count - 1, tmpSlot, 0);
        const len = Math.hypot(tmpSlot[0]!, tmpSlot[1]!, tmpSlot[2]!) || 1;
        st.yaw = st.targetYaw = Math.atan2(tmpSlot[0]!, tmpSlot[2]!);
        st.pitch = st.targetPitch = clamp(Math.asin(tmpSlot[1]! / len), -PITCH_LIMIT, PITCH_LIMIT);
      }
      st.started = true;
    }

    // Merkeze dön düğmesi
    if (homeTick !== st.homeSeen) {
      st.homeSeen = homeTick;
      st.goHome = true;
      st.vel.set(0, 0, 0);
    }

    // Hız ölçeği: en yakın küreye uzaklığa göre (kürelerin arasında yavaş, boşlukta hızlı). 0.15 sn'de bir.
    st.speedTimer += dt;
    if (st.speedTimer > 0.15 && g.n > 0) {
      st.speedTimer = 0;
      let nearest = Infinity;
      for (let i = 0; i < g.n; i++) {
        const dx = g.pos[i * 3]! - st.pos.x, dy = g.pos[i * 3 + 1]! - st.pos.y, dz = g.pos[i * 3 + 2]! - st.pos.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < nearest) nearest = d2;
      }
      st.speedScale = clamp(Math.sqrt(nearest) / 60, 0.4, 3);
    }

    const sel = g.selected >= 0 && g.selected < g.n ? g.selected : -1;

    // Seçim değişti: inceleme moduna gir / çık
    if (sel !== st.seenSelected) {
      const prev = st.seenSelected;
      st.seenSelected = sel;
      if (sel >= 0) {
        // Yeni küre: yörünge açıları mevcut bakış yönünden başlar.
        // Geçiş başlangıcı kaydedilir; sadece bu süre boyunca yumuşak süzülür.
        initOrbit(st, g);
        st.transFrom.copy(st.pos);
        st.transQuat.copy(cam.quaternion);
        st.transT = 0;
        st.vel.set(0, 0, 0);
        st.pinchMove = 0;
        st.goHome = false;
      } else if (prev >= 0) {
        // İnceleme bitti: serbest bakış mevcut yönden sürsün (kamera sıçramasın)
        st.transT = 1;
        cam.getWorldDirection(tmpForward);
        st.yaw = st.targetYaw = Math.atan2(tmpForward.x, tmpForward.z);
        st.pitch = st.targetPitch = clamp(Math.asin(clamp(tmpForward.y, -1, 1)), -PITCH_LIMIT, PITCH_LIMIT);
        st.vel.set(0, 0, 0);
      }
    }

    if (sel >= 0) {
      // İnceleme: küre yerinde kalır; kamera onun canlı konumunun etrafında döner
      st.vel.set(0, 0, 0);
      tmpOrb.fromArray(g.pos, sel * 3);
      const d = g.focusDistance;
      const cp = Math.cos(st.orbitPitch);
      tmpCamTarget.set(
        tmpOrb.x + Math.sin(st.orbitYaw) * cp * d,
        tmpOrb.y + Math.sin(st.orbitPitch) * d,
        tmpOrb.z + Math.cos(st.orbitYaw) * cp * d,
      );
      // Geçiş sırasında başlangıç konumundan yörüngeye süzül; sonra tam yörüngede kal (kayma yok).
      if (st.transT < 1) {
        st.transT = Math.min(1, st.transT + dt / TRANSITION_SECONDS);
        st.pos.lerpVectors(st.transFrom, tmpCamTarget, smoothstep(st.transT));
      } else {
        st.pos.copy(tmpCamTarget);
      }
    } else if (st.goHome) {
      st.pos.lerp(ORIGIN, 1 - Math.pow(1 - 0.05, k));
      st.vel.set(0, 0, 0);
      if (st.pos.length() < 1.5) st.goHome = false;
    } else {
      // Serbest gezinme: klavye + tekerlek ivmesi + sıkıştırma
      lookVector(st, tmpForward);
      const keys = st.keys;
      const iF = (keys.fwd ? 1 : 0) - (keys.back ? 1 : 0);
      const iR = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const iU = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
      if (iF || iR || iU) {
        tmpRight.crossVectors(tmpForward, UP);
        if (tmpRight.lengthSq() < 1e-6) tmpRight.set(1, 0, 0);
        tmpRight.normalize();
        tmpMove.set(0, 0, 0).addScaledVector(tmpForward, iF).addScaledVector(tmpRight, iR).addScaledVector(UP, iU);
        tmpMove.normalize().multiplyScalar(WORLD.fly.keySpeed * st.speedScale * (keys.fast ? 2.5 : 1));
        st.vel.lerp(tmpMove, 1 - Math.exp(-dt * 6));
      } else {
        st.vel.multiplyScalar(Math.exp(-dt * WORLD.fly.damping));
      }
      st.pos.addScaledVector(st.vel, dt);
      if (st.pinchMove !== 0) {
        st.pos.addScaledVector(tmpForward, st.pinchMove * WORLD.fly.pinchGain * 0.6 * st.speedScale);
        st.pinchMove = 0;
      }
    }

    // Kaybolma: dış kabuğun ötesine çok uzaklaşılamaz
    const limit = worldRadius(count) + WORLD.fly.bounds;
    if (st.pos.length() > limit) {
      st.pos.setLength(limit);
      st.vel.multiplyScalar(0.5);
    }

    // Boşta yavaşça dön (seçili küre yokken); fare/parmak/seçim varken dünyayla birlikte yavaşlar
    if (sel < 0 && !st.dragging && autoRotateRef.current && !st.goHome && performance.now() > st.idleUntil) {
      st.targetYaw += (WORLD.cameraIdle / 60) * k * g.motion;
    }

    if (sel >= 0) {
      // Kamera kürenin merkezine bakar; panelin yerine göre ekranda kaydırılır.
      // Geçiş anında başlangıç yönünden hedefe süzülür; geçiş bitince tam merkeze bakar.
      tmpOrb.fromArray(g.pos, sel * 3);
      const transitioning = st.transT < 1;
      placeOrbitCamera(
        cam, st, g.focusDistance, layout, tmpOrb,
        transitioning ? st.transQuat : null,
        transitioning ? smoothstep(st.transT) : 1,
      );
    } else {
      const ease = 1 - Math.pow(1 - 0.06, k);
      st.yaw += (st.targetYaw - st.yaw) * ease;
      st.pitch += (st.targetPitch - st.pitch) * ease;

      lookVector(st, tmpForward);
      cam.position.copy(st.pos);
      cam.lookAt(st.pos.x + tmpForward.x * 100, st.pos.y + tmpForward.y * 100, st.pos.z + tmpForward.z * 100);
    }
    cam.updateMatrixWorld(); // Orb ve seçici aynı karede güncel kamera eksenlerini okusun

    // Görüş açısı sabit; yalnızca dikey ekran için genişletilir
    const fov = fovForAspect(FOV_DEFAULT, cam.aspect);
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  });

  return null;
}

// Kare başına nesne üretmemek için ortak geçici nesneler
const ORIGIN = new THREE.Vector3();
const tmpForward = new THREE.Vector3();
const tmpRight = new THREE.Vector3();
const tmpMove = new THREE.Vector3();
const tmpOrb = new THREE.Vector3();
const tmpCamTarget = new THREE.Vector3();
const tmpAim = new THREE.Vector3();
const tmpQuatTo = new THREE.Quaternion();
const tmpSlot = new Float32Array(3);

/** yaw/pitch'ten birim bakış vektörü. */
function lookVector(st: { yaw: number; pitch: number }, out: THREE.Vector3): THREE.Vector3 {
  return out.set(Math.sin(st.yaw) * Math.cos(st.pitch), Math.sin(st.pitch), Math.cos(st.yaw) * Math.cos(st.pitch));
}

/**
 * Seçim başlarken yörünge açılarını kameranın küreye göre ŞU ANKİ yönünden kurar:
 * kamera nereden bakıyorsa küreye o taraftan yaklaşır. Uzaklık da başlangıç değerine döner.
 */
function initOrbit(
  st: { pos: THREE.Vector3; orbitYaw: number; orbitPitch: number },
  g: WorldStore,
): void {
  tmpOrb.fromArray(g.pos, g.selected * 3);
  const dx = st.pos.x - tmpOrb.x, dy = st.pos.y - tmpOrb.y, dz = st.pos.z - tmpOrb.z;
  const len = Math.hypot(dx, dy, dz);
  if (len > 1e-3) {
    st.orbitYaw = Math.atan2(dx, dz);
    st.orbitPitch = clamp(Math.asin(clamp(dy / len, -1, 1)), -PITCH_LIMIT, PITCH_LIMIT);
  } else {
    st.orbitYaw = 0;
    st.orbitPitch = 0;
  }
  g.setFocusDistance(WORLD.fly.dockDistance);
}

/**
 * İnceleme kamerasını yerleştirir: konum kürenin etrafındaki yörüngede, bakış kürenin merkezine.
 * Panelin yerine göre bakış hedefi ekranda kaydırılır, böylece küre panelin altında/sağında kalmaz.
 */
function placeOrbitCamera(
  cam: THREE.PerspectiveCamera,
  st: { pos: THREE.Vector3; orbitYaw: number; orbitPitch: number },
  focusDistance: number,
  layout: "center" | "sheet" | "side",
  pivot: THREE.Vector3,
  fromQuat: THREE.Quaternion | null,
  blend: number,
): void {
  cam.position.copy(st.pos);

  const cy = Math.cos(st.orbitYaw), sy = Math.sin(st.orbitYaw);
  const cp = Math.cos(st.orbitPitch), sp = Math.sin(st.orbitPitch);
  const halfH = focusDistance * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));

  // Bakış hedefi (varsayılan: kürenin merkezi)
  tmpAim.copy(pivot);
  if (layout === "sheet") {
    // Küre ekranın üstünde kalsın: hedefi aşağı kaydır (kamera eksenleri yörünge açılarından)
    const up = SHEET_FOCUS_NDC_Y * halfH;
    tmpAim.x -= -sy * sp * up;
    tmpAim.y -= cp * up;
    tmpAim.z -= -cy * sp * up;
  } else if (layout === "side") {
    // Küre ekranın solunda kalsın: hedefi sağa kaydır
    const right = -SIDE_FOCUS_NDC_X * halfH * cam.aspect;
    tmpAim.x += cy * right;
    tmpAim.z += -sy * right;
  }

  // Hedef bakış yönü: her zaman tam olarak kürenin merkezine (panel kaydırması hariç).
  if (st.pos.distanceToSquared(pivot) > ORBIT_CENTER_EPS * ORBIT_CENTER_EPS) {
    cam.lookAt(tmpAim);
  } else {
    // Tam merkezde hedef kamera konumuyla çakışır: yönü doğrudan yörünge açılarından ver
    cam.lookAt(
      st.pos.x - sy * cp * 100,
      st.pos.y - sp * 100,
      st.pos.z - cy * cp * 100,
    );
  }

  // Yalnızca geçiş sırasında: başlangıç yönünden hedefe yumuşak dönüş.
  if (fromQuat) {
    tmpQuatTo.copy(cam.quaternion);
    cam.quaternion.copy(fromQuat).slerp(tmpQuatTo, blend);
  }
}
