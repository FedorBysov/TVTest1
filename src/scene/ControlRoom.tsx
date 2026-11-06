import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { DisplaySnapshot, Profile, ZoneId } from '../sim/model';
import { buildRoom } from './buildRoom';
import { observeWebGLContext } from './context';
import { createRenderLoop } from './renderLoop';
import { dispatchScenePointer, isSelectionPointer } from './picking';
import type { SceneCallbacks } from './picking';
import { cameraViewHeight } from './config';
import { frameConsole } from './camera';

export interface ControlRoomProps extends SceneCallbacks {
  snapshot: DisplaySnapshot;
  profile: Profile;
  selectedZone: ZoneId;
  expanded?: boolean;
}

/** Fixed camera overview. Semantic controls and readouts are supplied by the page. */
export function ControlRoom({ snapshot, profile, selectedZone, onSelectZone, onCommand, onAcknowledge, onStage, expanded = false }: ControlRoomProps) {
  const host = useRef<HTMLDivElement>(null);
  const roomRef = useRef<ReturnType<typeof buildRoom> | null>(null);
  const invalidateRef = useRef<(() => void) | null>(null);
  const resizeRef = useRef<(() => void) | null>(null);
  const latest = useRef({ snapshot, selectedZone, onSelectZone, onCommand, onAcknowledge, onStage, expanded });
  latest.current = { snapshot, selectedZone, onSelectZone, onCommand, onAcknowledge, onStage, expanded };
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const element = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      setUnavailable(true); return;
    }
    setUnavailable(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;cursor:pointer';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    element.appendChild(renderer.domElement);

    let invalidate = () => {};
    const scene = new THREE.Scene();
    const room = buildRoom(profile, import.meta.env.BASE_URL, () => { resizeRef.current?.(); invalidate(); }); roomRef.current = room; scene.add(room.root);
    scene.add(new THREE.HemisphereLight('#e6f0ef', '#4d5b61', 2.6));
    const key = new THREE.DirectionalLight('#fff3df', 3.0); key.position.set(-3, 8, 6); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -5; key.shadow.camera.right = 5;
    key.shadow.camera.top = 5; key.shadow.camera.bottom = -5; key.shadow.normalBias = .035; scene.add(key);
    const rim = new THREE.DirectionalLight('#b5dce5', 1.6); rim.position.set(4, 4, -3); scene.add(rim);
    const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, .1, 50);
    camera.position.set(7.2, 5.9, 9); camera.lookAt(0, 1.05, .35);
    const resize = () => {
      const width = Math.max(1, element.clientWidth), height = Math.max(1, element.clientHeight);
      const aspect = width / height;
      if (latest.current.expanded) frameConsole(camera, room.subjects, aspect);
      else {
        const vertical = cameraViewHeight(aspect, room.layout.width);
        camera.left = -vertical * aspect / 2; camera.right = vertical * aspect / 2;
        camera.top = vertical / 2; camera.bottom = -vertical / 2; camera.updateProjectionMatrix();
      }
      renderer.setSize(width, height, false);
      invalidate();
    };
    resizeRef.current = resize;
    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(element); resize();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePose = () => {
      room.update(latest.current.snapshot, latest.current.selectedZone, reduced.matches);
      invalidate();
    };
    reduced.addEventListener('change', updatePose); updatePose();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const select = (event: PointerEvent) => {
      if (!isSelectionPointer(event)) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      dispatchScenePointer(event, raycaster.intersectObject(room.root, true), latest.current.snapshot, latest.current);
    };
    renderer.domElement.addEventListener('pointerup', select);
    let contextAvailable = true;
    const stopObservingContext = observeWebGLContext(renderer.domElement, available => {
      contextAvailable = available;
      setUnavailable(!available);
      if (available) { resize(); updatePose(); }
    });
    let visible = true;
    const intersection = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; invalidate(); });
    intersection.observe(element);
    const loop = createRenderLoop({
      advance: delta => room.tick(delta),
      render: () => renderer.render(scene, camera),
      isVisible: () => visible && !document.hidden && contextAvailable,
    });
    invalidate = loop.invalidate; invalidateRef.current = invalidate;
    document.addEventListener('visibilitychange', invalidate);
    invalidate();
    return () => {
      loop.dispose(); invalidateRef.current = null;
      resizeRef.current = null;
      document.removeEventListener('visibilitychange', invalidate);
      intersection.disconnect(); resizeObserver.disconnect();
      reduced.removeEventListener('change', updatePose);
      renderer.domElement.removeEventListener('pointerup', select);
      stopObservingContext();
      room.dispose(); roomRef.current = null;
      key.shadow.dispose();
      renderer.dispose(); renderer.domElement.remove();
    };
  }, [profile]);

  useEffect(() => {
    roomRef.current?.update(snapshot, selectedZone, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    invalidateRef.current?.();
  }, [snapshot, selectedZone]);

  useEffect(() => { resizeRef.current?.(); }, [expanded]);

  return <div className="control-room" style={{ position: 'relative', height: '100%', minHeight: 380 }}>
    <div ref={host} data-webgl={unavailable ? 'unavailable' : 'available'} style={{ position: 'absolute', inset: 0 }} />
    {unavailable && <p className="scene-fallback" role="status" style={{ position: 'relative', zIndex: 1, padding: '3rem 2rem', background: 'var(--surface)' }}>
      3D-обзор недоступен. Выберите зону кнопками под сценой; показатели и учебные действия доступны на странице.
    </p>}
  </div>;
}
