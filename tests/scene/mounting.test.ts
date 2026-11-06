// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, OrthographicCamera, Raycaster, Vector2, Vector3 } from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { buildRoom } from '../../src/scene/buildRoom';
import { observeWebGLContext } from '../../src/scene/context';
import { createSession, deriveSnapshot } from '../../src/sim/model';
import { motionPose } from '../../src/scene/config';
import { actionFromIntersections } from '../../src/scene/picking';
import { frameConsole, frameOverview } from '../../src/scene/camera';

afterEach(() => vi.restoreAllMocks());

it.each(['vver', 'smr'] as const)('keeps every %s digital readout corner in front of the sloped desk', profile => {
  vi.spyOn(STLLoader.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const room = buildRoom(profile, '/');
  try {
    const camera = new OrthographicCamera(-4, 4, 3, -3, .1, 50);
    camera.position.set(7.2, 5.9, 9); camera.lookAt(0, 1.05, .35);
    frameConsole(camera, room.subjects, 2.3); room.root.updateMatrixWorld(true);
    const ray = new Raycaster();
    let screenCount = 0;
    room.root.traverse(object => {
      if (object.name !== 'status-display-screen') return;
      screenCount++;
      for (const x of [-.245, 0, .245]) for (const y of [-.0625, .0625]) {
        const point = object.localToWorld(new Vector3(x, y, 0)).project(camera);
        ray.setFromCamera(new Vector2(point.x, point.y), camera);
        const nearest = ray.intersectObject(room.root, true)[0]?.object;
        expect(nearest?.uuid, `Readout probe (${x}, ${y}) must hit the display itself`).toBe(object.uuid);
      }
    });
    expect(screenCount).toBe(3);
    let frameCount = 0, gaugeCount = 0;
    room.root.traverse(object => {
      const frame = object.name === 'status-display-frame';
      const gauge = object.name === 'gauge-dial-face';
      if (!frame && !gauge) return;
      if (frame) frameCount++; else gaugeCount++;
      for (const x of frame ? [-.275, .275] : [-.07, .07]) for (const y of frame ? [-.085, .085] : [-.07, .07]) {
        const point = object.localToWorld(new Vector3(x, y, frame ? .01 : .007)).project(camera);
        ray.setFromCamera(new Vector2(point.x, point.y), camera);
        expect(ray.intersectObject(room.root, true)[0]?.object.uuid).toBe(object.uuid);
      }
    });
    expect(frameCount).toBe(3); expect(gaugeCount).toBe(6);
  } finally { room.dispose(); }
});

describe('physical mounting', () => {
  it.each(['vver', 'smr'] as const)('grounds cabinet feet and connects chair arms in %s', profile => {
    // These geometry tests use the normal procedural fallback and need no GPU or network.
    vi.spyOn(STLLoader.prototype, 'load').mockImplementation((_url, _loaded, _progress, failed) => {
      failed?.(new Error('offline geometry test'));
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const room = buildRoom(profile, '/');
    try {
      room.root.updateMatrixWorld(true);
      const floor = room.root.getObjectByName('floor-platform');
      expect(floor).toBeDefined();
      const floorTop = new Box3().setFromObject(floor!).max.y;
      const feet: Mesh[] = [], arms: Mesh[] = [];
      room.root.traverse(object => {
        if (object instanceof Mesh && object.name === 'cabinet-foot') feet.push(object);
        if (object instanceof Mesh && object.name === 'chair-arm-support') arms.push(object);
      });
      expect(feet).toHaveLength(6);
      for (const foot of feet) expect(new Box3().setFromObject(foot).min.y).toBeCloseTo(floorTop, 6);
      const seat = room.root.getObjectByName('chair-seat') as Mesh;
      expect(seat).toBeDefined();
      seat.geometry.computeBoundingBox();
      const seatBounds = seat.geometry.boundingBox!.clone().applyMatrix4(seat.matrix);
      expect(arms).toHaveLength(2);
      for (const arm of arms) {
        arm.geometry.computeBoundingBox();
        const bounds = arm.geometry.boundingBox!.clone().applyMatrix4(arm.matrix);
        expect(bounds.intersectsBox(seatBounds)).toBe(true);
      }
    } finally { room.dispose(); }
  });
});

it('builds a long instrument wall and separate workstations for VVER, but a display wall for SMR', () => {
  vi.spyOn(STLLoader.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const vver = buildRoom('vver', '/');
  const smr = buildRoom('smr', '/');
  const count = (room: typeof vver, name: string) => {
    let total = 0;
    room.root.traverse(object => { if (object.name === name) total++; });
    return total;
  };
  try {
    expect(count(vver, 'wall-instrument-bay')).toBeGreaterThanOrEqual(4);
    expect(count(vver, 'wall-digital-screen')).toBe(0);
    expect(count(vver, 'operator-workstation')).toBeGreaterThanOrEqual(2);
    expect(count(smr, 'wall-digital-screen')).toBeGreaterThanOrEqual(5);
    expect(count(smr, 'wall-instrument-bay')).toBe(0);
    expect(count(smr, 'operator-workstation')).toBeGreaterThanOrEqual(2);
  } finally { vver.dispose(); smr.dispose(); }
});

it('lights each named system lamp from its own system status', () => {
  vi.spyOn(STLLoader.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect() {}, fillText() {} } as unknown as CanvasRenderingContext2D);
  const room = buildRoom('vver', '/');
  try {
    const base = deriveSnapshot(createSession());
    const snapshot = {
      ...base,
      systems: base.systems.map(system => ({
        ...system,
        status: system.id === 'flow' ? 'warning' as const : system.id === 'indicators' ? 'alarm' as const : 'normal' as const,
      })),
    };
    room.update(snapshot, 'power', true);
    const colors = new Map<string, string>();
    room.root.traverse(object => {
      if (object.name !== 'system-status-lamp') return;
      colors.set(object.userData.systemId, (object as Mesh).material instanceof MeshStandardMaterial
        ? ((object as Mesh).material as MeshStandardMaterial).color.getStyle() : '');
    });
    expect([...colors.keys()].sort()).toEqual(['flow', 'indicators', 'power']);
    expect(colors.get('power')).not.toBe(colors.get('flow'));
    expect(colors.get('flow')).not.toBe(colors.get('indicators'));
  } finally { room.dispose(); }
});

it.each(['vver', 'smr'] as const)('selects all three zones from the %s rear wall', profile => {
  vi.spyOn(STLLoader.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const room = buildRoom(profile, '/');
  try {
    const zones = new Set<string>();
    room.root.traverse(object => {
      if (object.name !== (profile === 'vver' ? 'wall-instrument-bay' : 'wall-digital-screen')) return;
      const target = profile === 'vver' ? object.children.find(child => child instanceof Mesh)! : object;
      const action = actionFromIntersections([{ object: target }]);
      if (action?.kind === 'zone') zones.add(action.zone);
    });
    expect([...zones].sort()).toEqual(['alarms', 'power', 'systems']);
  } finally { room.dispose(); }
});

it('seeds persisted controls before the first frame and animates later changes', () => {
  vi.spyOn(STLLoader.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect() {}, fillText() {} } as unknown as CanvasRenderingContext2D);
  const room = buildRoom('vver', '/');
  try {
    const initial = deriveSnapshot(createSession());
    const saved = { ...initial, command: 100 as const, signal: { ...initial.signal, acknowledged: true } };
    room.update(saved, 'power', false);
    const target = motionPose(100, saved.readings.power, true);
    expect(room.root.getObjectByName('knob')!.rotation.z).toBeCloseTo(target.knob);
    expect(room.root.getObjectByName('button')!.position.z).toBeCloseTo(target.button);
    expect(room.tick(0)).toBe(false);
    room.update({ ...saved, command: 0 }, 'power', false);
    expect(room.tick(.1)).toBe(true);
    const knob = room.root.getObjectByName('knob')!.rotation.z;
    expect(knob).toBeLessThan(target.knob);
    expect(knob).toBeGreaterThan(motionPose(0, 0, true).knob);
    expect(room.tick(1)).toBe(false);
  } finally { room.dispose(); }
});

it('tags the physical CAD control ancestors and all five switches in every sector', () => {
  vi.spyOn(STLLoader.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const room = buildRoom('vver', '/');
  try {
    const controls: { kind: string; stage?: number }[] = [];
    room.root.traverse(object => {
      if (!object.userData.control) return;
      controls.push(object.userData.control);
      // Hit the child mesh, as a real raycast does, instead of the tagged group.
      let target = object;
      while (target.children.length) target = target.children[0];
      expect(actionFromIntersections([{ object: target }])).toEqual(object.userData.control);
    });
    expect(controls.filter(c => c.kind === 'command')).toHaveLength(3);
    expect(controls.filter(c => c.kind === 'acknowledge')).toHaveLength(3);
    for (let stage = 0; stage < 5; stage++) expect(controls.filter(c => c.kind === 'stage' && c.stage === stage)).toHaveLength(3);
  } finally { room.dispose(); }
});

it.each(['vver', 'smr'] as const)('keeps the entire %s console and chair inside the expanded crop', profile => {
  vi.spyOn(STLLoader.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const room = buildRoom(profile, '/');
  try {
    for (const aspect of [1.3, 1.8, 2.2]) {
      const camera = new OrthographicCamera(-4, 4, 3, -3, .1, 50);
      camera.position.set(7.2, 5.9, 9); camera.lookAt(0, 1.05, .35);
      frameConsole(camera, room.subjects, aspect);
      const xs: number[] = [], ys: number[] = [];
      // Check rendered vertices, not the fitting function's bounding-box calculation.
      for (const subject of room.subjects) subject.traverse(object => {
        if (!(object instanceof Mesh)) return;
        const positions = object.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          const p = new Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).project(camera);
          xs.push(p.x); ys.push(p.y);
        }
      });
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      expect(Math.max(Math.abs(minX), Math.abs(maxX), Math.abs(minY), Math.abs(maxY))).toBeLessThan(.94);
      expect(Math.max(maxX - minX, maxY - minY)).toBeGreaterThan(1.7);
      expect((minY + maxY) / 2).toBeCloseTo(0, 1);
    }
  } finally { room.dispose(); }
});

it('keeps the SMR display wall, including its top rail, inside the ordinary overview', () => {
  vi.spyOn(STLLoader.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const room = buildRoom('smr', '/');
  try {
    const aspect = 1.65;
    const camera = new OrthographicCamera(-4, 4, 3, -3, .1, 50);
    camera.position.set(7.2, 5.9, 9); camera.lookAt(0, 1.05, .35);
    frameOverview(camera, room.subjects, aspect);
    room.root.updateMatrixWorld(true);
    const wall = room.root.getObjectByName('digital-display-wall')!;
    let top = -Infinity;
    wall.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const positions = object.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const point = new Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).project(camera);
        top = Math.max(top, point.y);
      }
    });
    expect(top).toBeLessThan(.9);
  } finally { room.dispose(); }
});

it.each(['vver', 'smr'] as const)('fills the ordinary %s overview without cutting off the physical room', profile => {
  vi.spyOn(STLLoader.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const room = buildRoom(profile, '/');
  try {
    const camera = new OrthographicCamera(-4, 4, 3, -3, .1, 50);
    camera.position.set(7.2, 5.9, 9); camera.lookAt(0, 1.05, .35);
    frameOverview(camera, room.subjects, 1.65);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const subject of room.subjects) subject.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const positions = object.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const point = new Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).project(camera);
        minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
      }
    });
    expect(Math.max(Math.abs(minX), Math.abs(maxX), Math.abs(minY), Math.abs(maxY))).toBeLessThan(.9);
    expect(Math.max(maxX - minX, maxY - minY)).toBeGreaterThan(1.6);
  } finally { room.dispose(); }
});

it('focuses a selected physical bay and allows a bounded zoomed pan', () => {
  const left = new Group(); left.position.x = -3;
  left.add(new Mesh(new BoxGeometry(1, 1, 1)));
  const right = new Group(); right.position.x = 3;
  right.add(new Mesh(new BoxGeometry(1, 1, 1)));
  const camera = new OrthographicCamera(-4, 4, 3, -3, .1, 50);
  camera.position.set(7, 5, 8); camera.lookAt(0, 0, 0);
  frameConsole(camera, [left, right], 1.6);
  const fullWidth = camera.right - camera.left;
  frameConsole(camera, [left, right], 1.6, { focus: right, zoom: 2 });
  const focusedWidth = camera.right - camera.left;
  expect(focusedWidth).toBeCloseTo(fullWidth / 2);
  expect(right.getWorldPosition(new Vector3()).project(camera).x).toBeCloseTo(0, 1);
  frameConsole(camera, [left, right], 1.6, { focus: right, zoom: 2, panX: .5 });
  expect(right.getWorldPosition(new Vector3()).project(camera).x).toBeLessThan(-.8);
});

it.each(['vver', 'smr'] as const)('keeps loaded %s CAD centered through asset completion and desktop resize', profile => {
  const loads: (() => void)[] = [];
  vi.spyOn(STLLoader.prototype, 'load').mockImplementation((url, loaded) => {
    loads.push(() => {
      const bytes = readFileSync(`public${url}`);
      const geometry = new STLLoader().parse(new Uint8Array(bytes).buffer);
      loaded(geometry);
    });
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const camera = new OrthographicCamera(-4, 4, 3, -3, .1, 50);
  camera.position.set(7.2, 5.9, 9); camera.lookAt(0, 1.05, .35);
  let aspect = 2.3;
  const room = buildRoom(profile, '/', () => frameConsole(camera, room.subjects, aspect));
  const assertFramed = () => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const point = new Vector3();
    for (const subject of room.subjects) subject.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const positions = object.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).project(camera);
        minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
      }
    });
    expect(Math.max(Math.abs(minX), Math.abs(maxX), Math.abs(minY), Math.abs(maxY))).toBeLessThan(.94);
    expect(Math.max(maxX - minX, maxY - minY)).toBeGreaterThan(1.7);
    expect(Math.abs((minX + maxX) / 2)).toBeLessThan(.04);
    expect(Math.abs((minY + maxY) / 2)).toBeLessThan(.04);
    room.root.updateMatrixWorld(true);
    const ray = new Raycaster();
    let switchCount = 0;
    room.root.traverse(object => {
      if (object.name !== 'stage-switch-cap') return;
      const center = object.getWorldPosition(new Vector3()).project(camera);
      ray.setFromCamera(new Vector2(center.x, center.y), camera);
      const action = actionFromIntersections(ray.intersectObject(room.root, true));
      expect(action).toEqual({ kind: 'stage', stage: object.parent!.userData.control.stage });
      switchCount++;
    });
    expect(switchCount).toBe(15);
    let socketCount = 0;
    room.root.traverse(object => {
      if (object.name !== 'stage-switch-socket') return;
      socketCount++;
      for (const x of [-.032, .032]) for (const y of [-.036, .036]) {
        const point = object.localToWorld(new Vector3(x, y, .009)).project(camera);
        ray.setFromCamera(new Vector2(point.x, point.y), camera);
        expect(actionFromIntersections(ray.intersectObject(room.root, true))).toEqual({ kind: 'stage', stage: object.parent!.userData.control.stage });
      }
    });
    expect(socketCount).toBe(15);
  };
  try {
    frameConsole(camera, room.subjects, aspect); assertFramed();
    expect(loads).toHaveLength(3);
    for (const load of loads) { load(); assertFramed(); }
    expect(room.root.getObjectByName('cad-bezel')).toBeDefined();
    expect(room.root.getObjectByName('cad-knob')).toBeDefined();
    expect(room.root.getObjectByName('cad-ack-button')).toBeDefined();
    for (const nextAspect of [1.6, 2.3, 2.05]) {
      aspect = nextAspect; frameConsole(camera, room.subjects, aspect); assertFramed();
    }
  } finally { room.dispose(); }
});

it('latches and lights only the current stage switch in all three sectors', () => {
  vi.spyOn(STLLoader.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect() {}, fillText() {} } as unknown as CanvasRenderingContext2D);
  const room = buildRoom('vver', '/');
  try {
    const snapshot = deriveSnapshot(createSession());
    for (const stage of [2, 4] as const) {
      room.update({ ...snapshot, stage }, 'power', true);
      let activeCount = 0;
      room.root.traverse(object => {
        if (object.userData.control?.kind !== 'stage') return;
        const cap = object.getObjectByName('stage-switch-cap') as Mesh;
        const socket = object.getObjectByName('stage-switch-socket') as Mesh;
        expect(cap).toBeDefined();
        expect(socket).toBeDefined();
        const active = object.userData.control.stage === stage;
        const material = cap.material as MeshStandardMaterial;
        expect(cap.position.z).toBeCloseTo(active ? .052 : .062);
        expect(material.emissive.getHex() !== 0).toBe(active);
        expect((socket.material as MeshStandardMaterial).emissive.getHex() !== 0).toBe(active);
        if (active) activeCount++;
      });
      expect(activeCount).toBe(3);
    }
  } finally { room.dispose(); }
});

it('clears the unavailable status on WebGL recovery and removes both listeners on cleanup', () => {
  const canvas = document.createElement('canvas');
  const states: boolean[] = [];
  const dispose = observeWebGLContext(canvas, available => states.push(available));
  const loss = new Event('webglcontextlost', { cancelable: true });
  canvas.dispatchEvent(loss);
  expect(loss.defaultPrevented).toBe(true);
  canvas.dispatchEvent(new Event('webglcontextrestored'));
  expect(states).toEqual([false, true]);
  dispose();
  canvas.dispatchEvent(new Event('webglcontextlost'));
  canvas.dispatchEvent(new Event('webglcontextrestored'));
  expect(states).toEqual([false, true]);
});
