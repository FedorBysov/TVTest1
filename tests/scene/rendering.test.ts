// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { Group, Mesh } from 'three';
import { zoneFromIntersections, isSelectionPointer, actionFromIntersections, dispatchScenePointer } from '../../src/scene/picking';
import { createRenderLoop } from '../../src/scene/renderLoop';
import { createSession, deriveSnapshot } from '../../src/sim/model';

afterEach(() => vi.unstubAllGlobals());

it('selects only a tagged ancestor of the nearest hit, never through the chair', () => {
  const sector = new Group(); sector.userData.zone = 'systems';
  const panel = new Mesh(); sector.add(panel);
  const chair = new Mesh();
  expect(zoneFromIntersections([{ object: chair }, { object: panel }])).toBeUndefined();
  expect(zoneFromIntersections([{ object: panel }])).toBe('systems');
  expect(zoneFromIntersections([])).toBeUndefined();
  expect(isSelectionPointer({ button: 0, isPrimary: true })).toBe(true);
  expect(isSelectionPointer({ button: 2, isPrimary: true })).toBe(false);
  expect(isSelectionPointer({ button: 0, isPrimary: false })).toBe(false);
});

it('resolves a control before its zone and dispatches one bounded command detent', () => {
  const sector = new Group(); sector.userData.zone = 'power';
  const knob = new Group(); knob.userData.control = { kind: 'command' }; sector.add(knob);
  const cap = new Mesh(); knob.add(cap);
  const hit = [{ object: cap }];
  expect(actionFromIntersections(hit)).toEqual({ kind: 'command' });
  const snapshot = { ...deriveSnapshot(createSession()), command: 50 as const };
  const commands: number[] = [], zones: string[] = [];
  const callbacks = { onSelectZone: (zone: string) => zones.push(zone), onCommand: (value: number) => commands.push(value) };
  const primary = { button: 0, isPrimary: true, shiftKey: false };
  dispatchScenePointer(primary, hit, snapshot, callbacks);
  dispatchScenePointer({ ...primary, shiftKey: true }, hit, snapshot, callbacks);
  expect(commands).toEqual([75, 25]); expect(zones).toEqual([]);
  dispatchScenePointer(primary, hit, { ...snapshot, command: 100 }, callbacks);
  dispatchScenePointer({ ...primary, shiftKey: true }, hit, { ...snapshot, command: 0 }, callbacks);
  dispatchScenePointer({ ...primary, isPrimary: false }, hit, snapshot, callbacks);
  dispatchScenePointer({ ...primary, button: 2 }, hit, snapshot, callbacks);
  dispatchScenePointer(primary, [{ object: new Mesh() }, ...hit], snapshot, callbacks);
  expect(commands).toEqual([75, 25]);
});

it('acknowledges only active unacknowledged signals and sends the selected stage', () => {
  const button = new Mesh(); button.userData.control = { kind: 'acknowledge' };
  const snapshot = deriveSnapshot(createSession());
  const pointer = { button: 0, isPrimary: true, shiftKey: false };
  let acknowledgments = 0;
  const stages: number[] = [];
  const callbacks = { onSelectZone() {}, onAcknowledge: () => { acknowledgments++; }, onStage: (stage: number) => stages.push(stage) };
  dispatchScenePointer(pointer, [{ object: button }], snapshot, callbacks);
  const alarm = { ...snapshot, signal: { ...snapshot.signal, kind: 'alarm' as const, acknowledged: false } };
  dispatchScenePointer(pointer, [{ object: button }], alarm, callbacks);
  dispatchScenePointer(pointer, [{ object: button }], { ...alarm, signal: { ...alarm.signal, acknowledged: true } }, callbacks);
  expect(acknowledgments).toBe(1);
  for (let stage = 0; stage < 5; stage++) {
    const control = new Mesh(); control.userData.control = { kind: 'stage', stage };
    dispatchScenePointer(pointer, [{ object: control }], snapshot, callbacks);
  }
  expect(stages).toEqual([0, 1, 2, 3, 4]);
  expect(() => dispatchScenePointer(pointer, [{ object: button }], alarm, { onSelectZone() {} })).not.toThrow();
});

it('coalesces invalidation and stops drawing when all motion is settled', () => {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  let draws = 0, moving = false, visible = true;
  const loop = createRenderLoop({ render: () => { draws++; }, advance: () => moving, isVisible: () => visible });
  loop.invalidate(); loop.invalidate();
  expect(frames).toHaveLength(1);
  frames.shift()!(0);
  expect(draws).toBe(1); expect(frames).toHaveLength(0);
  // A state transition requests frames only for its duration.
  moving = true; loop.invalidate(); frames.shift()!(20);
  expect(frames).toHaveLength(1);
  moving = false; frames.shift()!(40);
  expect(frames).toHaveLength(0); expect(draws).toBe(3);
  // Hidden canvases resume only when visibility explicitly invalidates them.
  visible = false; loop.invalidate(); frames.shift()!(60);
  expect(draws).toBe(3); expect(frames).toHaveLength(0);
  visible = true; loop.invalidate(); frames.shift()!(80);
  expect(draws).toBe(4);
  loop.dispose(); loop.invalidate(); expect(frames).toHaveLength(0);
});
