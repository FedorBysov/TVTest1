import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { DisplaySnapshot, Profile, ZoneId } from '../sim/model';
import { buildRoom } from './buildRoom';
import { observeWebGLContext } from './context';
import { createRenderLoop } from './renderLoop';
import { dispatchScenePointer, isSelectionPointer } from './picking';
import type { SceneCallbacks } from './picking';
import { frameConsole, frameOverview } from './camera';

type SceneView = { focus: ZoneId | 'all'; zoom: number; panX: number; panY: number };
const fullView: SceneView = { focus: 'all', zoom: 1, panX: 0, panY: 0 };

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
  const [view, setView] = useState<SceneView>(fullView);
  const viewRef = useRef(view); viewRef.current = view;
  const drag = useRef<{ startX: number; startY: number; x: number; y: number; moved: boolean } | null>(null);

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
    key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -7; key.shadow.camera.right = 7;
    key.shadow.camera.top = 7; key.shadow.camera.bottom = -7; key.shadow.normalBias = .035; scene.add(key);
    const rim = new THREE.DirectionalLight('#b5dce5', 1.6); rim.position.set(4, 4, -3); scene.add(rim);
    const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, .1, 50);
    camera.position.set(7.2, 5.9, 9); camera.lookAt(0, 1.05, .35);
    const resize = () => {
      const width = Math.max(1, element.clientWidth), height = Math.max(1, element.clientHeight);
      const aspect = width / height;
      if (latest.current.expanded) {
        const currentView = viewRef.current;
        const focus = currentView.focus === 'all' ? undefined : room.subjects.find(subject => subject.userData.zone === currentView.focus);
        frameConsole(camera, room.subjects, aspect, { ...currentView, focus });
      }
      else frameOverview(camera, room.subjects, aspect);
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
      if (drag.current?.moved) return;
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

  useEffect(() => { resizeRef.current?.(); }, [expanded, view]);

  const movePan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!expanded || !drag.current) return;
    const current = drag.current;
    if (!current.moved && Math.hypot(event.clientX - current.startX, event.clientY - current.startY) <= 4) return;
    current.moved = true;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - current.x, dy = event.clientY - current.y;
    current.x = event.clientX; current.y = event.clientY;
    setView(previous => ({ ...previous,
      panX: Math.max(-1, Math.min(1, previous.panX - dx / Math.max(rect.width, 1))),
      panY: Math.max(-1, Math.min(1, previous.panY + dy / Math.max(rect.height, 1))),
    }));
  };

  const zoom = (factor: number) => setView(previous => ({ ...previous, zoom: Math.max(1, Math.min(5, previous.zoom * factor)) }));

  return <div className="control-room" style={{ position: 'relative', height: '100%', minHeight: 380 }}
    onPointerDown={event => { if (expanded && event.button === 0 && event.target instanceof HTMLCanvasElement)
      drag.current = { startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, moved: false }; }}
    onPointerMove={movePan} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
    onWheel={event => { if (!expanded) return; event.preventDefault(); zoom(event.deltaY < 0 ? 1.15 : 1 / 1.15); }}>
    <div ref={host} data-webgl={unavailable ? 'unavailable' : 'available'} style={{ position: 'absolute', inset: 0 }} />
    {expanded && <div className="scene-view-controls" role="toolbar" aria-label="Навигация по щиту" style={{ position: 'absolute', zIndex: 3, top: 12, right: 12, display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 5, maxWidth: 'min(590px, 80%)', padding: 6, borderRadius: 4, background: 'var(--surface)', boxShadow: '0 3px 15px #0005' }}>
      {([['all', 'Весь щит'], ['power', 'Мощность'], ['systems', 'Системы'], ['alarms', 'Сигналы']] as const).map(([focus, label]) =>
        <button key={focus} type="button" aria-pressed={view.focus === focus} onClick={() => setView({ focus, zoom: focus === 'all' ? 1 : 2.2, panX: 0, panY: 0 })}>{label}</button>)}
      <button type="button" aria-label="Уменьшить щит" onClick={() => zoom(1 / 1.25)}>−</button>
      <output aria-label="Масштаб щита">{Math.round(view.zoom * 100)}%</output>
      <button type="button" aria-label="Увеличить щит" onClick={() => zoom(1.25)}>+</button>
    </div>}
    {unavailable && <p className="scene-fallback" role="status" style={{ position: 'relative', zIndex: 1, padding: '3rem 2rem', background: 'var(--surface)' }}>
      3D-обзор недоступен. Выберите зону кнопками под сценой; показатели и учебные действия доступны на странице.
    </p>}
  </div>;
}
