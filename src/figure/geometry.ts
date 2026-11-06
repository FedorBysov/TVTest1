import * as k from '../../.agents/skills/anatomy/kit/iso-kit';
import type { DisplaySnapshot, Profile, ZoneId } from '../sim/model';

// The local Anatomy kit owns projection, four-tone solids and surface details.
// Coordinates are fictional workshop units; they are not plant dimensions.
export const WIDTH = 760, HEIGHT = 500;
const CASE: k.Plan = { x: -158, y: -100, w: 316, d: 200, r: 8 };
export const P = k.fitProjection(k.boxCorners(CASE, -12, 68), WIDTH, HEIGHT, { pad: 40, azimuth: 38, elevation: 48 });
export const GAUGE = { x: -75, y: -30, r: 48, z: 39 };
export const KNOB = { x: 50, y: -36, r: 24, z: 55 };
export const BUTTON = { x: 64, y: 56, r: 12, z: 54 };
export const WINDOW: k.Plan = { x: -124, y: 40, w: 103, d: 35, r: 3 };
const S = k.solidSvg, L = k.lineSvg;
export type FigurePart = { id: string; mount: string; purpose: string };
type Geometry = { staticMarkup: string; frontMarkup: string; buttonMarkup: string; stemMarkup: string; parts: FigurePart[] };
const cache = new Map<string, Geometry>();
const bounded = (n: number) => Math.min(100, Math.max(0, Number.isFinite(n) ? n : 0));

export function figureReading(snapshot: DisplaySnapshot, zone: ZoneId) {
  return zone === 'systems' ? { value: snapshot.readings.flow, label: 'Расход' }
    : zone === 'alarms' ? { value: snapshot.readings.indicatorB, label: 'Индикатор Б' }
      : { value: snapshot.readings.power, label: 'Мощность' };
}

export function needlePath(value: number) {
  const a = (-130 + bounded(value) * 2.6) * Math.PI / 180;
  const { x, y, z } = GAUGE;
  return k.lineOnTop([x - Math.sin(a) * 8, y + Math.cos(a) * 8], [x + Math.sin(a) * 36, y - Math.cos(a) * 36], z + .3, P);
}
export function knobPointer(value: number) {
  const a = (-130 + bounded(value) * 2.6) * Math.PI / 180;
  return k.lineOnTop([KNOB.x + Math.sin(a) * 8, KNOB.y - Math.cos(a) * 8], [KNOB.x + Math.sin(a) * 21, KNOB.y - Math.cos(a) * 21], KNOB.z + .2, P);
}
export function springPaths(press = 0) {
  const halves = { back: '', front: '' }, azimuth = 38 * Math.PI / 180;
  // Split each near/far half-turn at the tangent, so the stem masks the rear wire.
  for (let turn = 0; turn < 10; turn++) {
    const points: k.Flat[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = (turn + i / 24) / 10, a = azimuth - Math.PI / 2 + t * Math.PI * 10;
      points.push(k.iso([BUTTON.x + 5 * Math.cos(a), BUTTON.y + 5 * Math.sin(a), 35 + t * (15 - press * 4)], P));
    }
    halves[turn % 2 === 0 ? 'front' : 'back'] += k.pathOf(points);
  }
  return halves;
}
export const buttonShift = (press: number) => k.translateAlong(P, [0, 0, -4 * press]);
export const windowPath = k.planOutline(k.insetPlan(WINDOW, 7), 30.5, P);
export const windowMatrix = k.topMatrix([WINDOW.x + WINDOW.w / 2, WINDOW.y + WINDOW.d / 2 + 7], 30.6, P);

export function moduleGeometry(profile: Profile, zone: ZoneId = 'power'): Geometry {
  const cacheKey = `${profile}:${zone}`;
  const cached = cache.get(cacheKey); if (cached) return cached;
  const parts: FigurePart[] = [], base: string[] = [], assemblies: { depth: number; markup: string }[] = [];
  const add = (out: string[], id: string, mount: string, purpose: string, markup: string) => {
    parts.push({ id, mount, purpose }); out.push(`<g data-part="${id}">${markup}</g>`);
  };
  const screw = (out: string[], id: string, x: number, y: number, z: number, mount: string) => add(out, id, mount, 'Captive slotted fastener',
    S(k.cylinder(x, y, 2.4, z, .9, P, 24, .25), { tone: 'mid' }) + L(k.lineOnTop([x - 1.6, y], [x + 1.6, y], z + .9, P), { tone: 'lo' }));
  const assembly = (x: number, y: number, markup: string[]) => assemblies.push({ depth: k.depthOf([x, y, 40], P), markup: markup.join('') });

  base.push(`<path class="iso-halo" d="${k.haloOf(CASE, -12, 18, P)}"/>`);
  k.corners(CASE, 22).sort((a, b) => k.depthOf([...a, 0], P) - k.depthOf([...b, 0], P)).forEach(([x, y], i) => {
    add(base, `foot-${i}`, 'floor', 'Rubber isolation foot', S(k.cylinder(x, y, 10, -12, 6, P, 32, .6), { tone: 'lo' }));
    add(base, `foot-seat-${i}`, `foot-${i}`, 'Foot mounting boss', S(k.cylinder(x, y, 8, -6, 6, P, 32), { tone: 'mid' }));
  });
  add(base, 'case', 'foot-seat-0', 'Folded steel enclosure', S(k.slabOf(CASE, 0, 24, P, 10, 1.8), { tone: 'mid', inner: L(k.sideSeam(CASE, 7, P, 10), { tone: 'lo' }) }));
  add(base, 'gasket', 'case', 'Continuous sealing gasket', S(k.slabOf(k.insetPlan(CASE, 1.1), 24, 1.8, P, 10), { tone: 'lo' }));
  const panel = k.insetPlan(CASE, 1.6);
  add(base, 'faceplate', 'gasket', 'Removable bevelled instrument plate', S(k.slabOf(panel, 25.8, 2.2, P, 10, .7), { tone: 'hi' }) + L(k.planOutline(k.insetPlan(panel, 5), 28, P), { tone: 'faint' }));
  [...k.corners(CASE, 11), [0, -89] as k.Plane, [0, 89] as k.Plane].forEach(([x, y], i) => screw(base, `panel-screw-${i}`, x, y, 28, 'faceplate'));
  for (let i = 0; i < 6; i++) {
    const slot = { x: -12 + i * 8, y: 60, w: 3, d: 20, r: 1.5 };
    add(base, `vent-${i}`, 'faceplate', 'Closed ventilation slot', `<path class="module-recess" d="${k.planOutline(slot, 28.1, P)}"/>`);
  }
  // Different brackets identify the compact training profile without relocating controls.
  for (const y of [-80, 76]) {
    const rail = { x: profile === 'smr' ? 113 : 119, y, w: profile === 'smr' ? 29 : 22, d: 5, r: 1 };
    add(base, `service-rail-${y}`, 'faceplate', 'Removable service bracket', S(k.slabOf(rail, 28, profile === 'smr' ? 4 : 2, P, 4, .4), { tone: 'mid' }));
    screw(base, `service-fastener-${y}`, rail.x + 5, y + 2.5, profile === 'smr' ? 32 : 30, `service-rail-${y}`);
  }
  // A replaceable daughter plate distinguishes the three teaching zones.
  // Its mount clears the gauge, grip, signal lamp and pushbutton guards.
  const zonePlate = { x: 107, y: 12, w: 40, d: 31, r: 2 };
  add(base, `zone-${zone}-plate`, 'faceplate', 'Zone-specific screwed daughter plate',
    S(k.slabOf(zonePlate, 28.2, 2.5, P, 4, .4), { tone: 'mid' }));
  if (zone === 'power') {
    const bars = Array.from({ length: 5 }, (_, i) =>
      S(k.slabOf({ x: 111 + i * 7, y: 19, w: 3, d: 17 - Math.abs(2 - i) * 3, r: .6 }, 30.8, 1.1, P, 3), { tone: 'hi' }));
    add(base, 'zone-power-scale', 'zone-power-plate', 'Five raised scale bars for the power lesson', bars.join(''));
  } else if (zone === 'systems') {
    const channels = [18, 27, 36].map(y => L(k.lineOnTop([111, y], [143, y], 31, P), { tone: 'hi' })).join('');
    const fittings = [18, 27, 36].map(y => S(k.cylinder(138, y, 2.8, 30.8, 1.7, P, 24), { tone: 'hi' })).join('');
    add(base, 'zone-systems-manifold', 'zone-systems-plate', 'Three channel manifold for the systems lesson', channels + fittings);
  } else {
    const seats = [115, 127, 139].map(x =>
      S(k.cylinder(x, 27, 4.7, 30.8, 2, P, 32), { tone: 'lo' }) +
      `<path class="module-zone-alarm-lens" d="${k.ring(x, 27, 3.4, 33, P, 32)}"/>`);
    add(base, 'zone-alarms-bank', 'zone-alarms-plate', 'Three seated annunciator lenses for the alarm lesson', seats.join(''));
  }

  const gauge: string[] = [], { x: gx, y: gy, r: gr, z: gz } = GAUGE;
  add(gauge, 'gauge-seat', 'faceplate', 'Recessed rubber seat', S(k.cylinder(gx, gy, gr + 3, 28, 2, P, 96), { tone: 'lo' }));
  add(gauge, 'gauge-bezel', 'gauge-seat', 'Turned retaining bezel', S(k.cylinder(gx, gy, gr, 30, 10, P, 120, 1), { tone: 'hi' }) + L(k.knurl(gx, gy, gr, 31, 36, 96, P), { tone: 'lo' }) + L(k.sideArc(gx, gy, gr, 36, P, 96), { tone: 'mid' }));
  add(gauge, 'gauge-recess', 'gauge-bezel', 'Dark inner bevel', `<path class="module-recess" d="${k.ring(gx, gy, gr - 3, 40, P, 120)}"/>`);
  add(gauge, 'gauge-face', 'gauge-recess', 'Inset opaque printed dial', `<path class="module-dial" d="${k.ring(gx, gy, gr - 5, gz, P, 120)}"/>`);
  const ticks = k.radialTicks(gx, gy, 39, 50, 5, gz + .1, [2.2, 5], P, -130 * Math.PI / 180, 260 * Math.PI / 180);
  add(gauge, 'gauge-scale', 'gauge-face', 'Fifty divisions on a bounded 0–100 scale', L(k.ring(gx, gy, 39, gz + .1, P, 120), { tone: 'lo' }) + `<g class="module-scale">${L(ticks.minor, { tone: 'mid' })}${L(ticks.major, { tone: 'hi' })}</g>`);
  add(gauge, 'gauge-glass-rim', 'gauge-bezel', 'Glass retaining lip', L(k.ring(gx, gy, gr - 1.8, 40.2, P, 120), { tone: 'hi' }));
  for (const dx of [-35, 35]) screw(gauge, `gauge-retainer-${dx}`, gx + dx, gy + 30, 40, 'gauge-bezel');
  assembly(gx, gy, gauge);

  const window: string[] = [];
  add(window, 'window-frame', 'faceplate', 'Raised screwed window frame', S(k.slabOf(WINDOW, 28, 5, P, 6, .8), { tone: 'mid' }));
  add(window, 'window-recess', 'window-frame', 'Inset numeric window with clipped content', `<path class="module-recess" d="${k.planOutline(k.insetPlan(WINDOW, 6), 33, P)}"/><path class="module-window" d="${windowPath}"/>`);
  for (const [i, [x, y]] of k.corners(WINDOW, 3).entries()) screw(window, `window-fastener-${i}`, x, y, 33, 'window-frame');
  assembly(-73, 57, window);

  const knob: string[] = [], { x: nx, y: ny, r: nr } = KNOB;
  add(knob, 'knob-scale', 'faceplate', 'Five physically indexed command positions', S(k.cylinder(nx, ny, nr + 10, 28, 1, P, 96), { tone: 'mid' }) + L(k.radialTicks(nx, ny, nr + 8, 4, 1, 29.2, [4, 4], P, -130 * Math.PI / 180, 260 * Math.PI / 180).major, { tone: 'hi' }));
  add(knob, 'knob-collar', 'knob-scale', 'Shaft bearing collar', S(k.cylinder(nx, ny, 15, 29, 6, P, 64, .6), { tone: 'mid' }));
  add(knob, 'knob-body', 'knob-collar', 'Knurled polymer command grip', `<g class="module-rubber">${S(k.cylinder(nx, ny, nr, 35, 20, P, 96, 1.2), { tone: 'hi' })}${L(k.knurl(nx, ny, nr, 36.5, 53, 72, P, .3), { tone: 'lo' })}${L(k.sideArc(nx, ny, nr, 36.5, P, 72), { tone: 'mid' })}${L(k.sideArc(nx, ny, nr, 53, P, 72), { tone: 'mid' })}</g>`);
  add(knob, 'knob-inset', 'knob-body', 'Pointer cap recess', L(k.ring(nx, ny, nr - 4, 55.1, P, 80), { tone: 'lo' }));
  screw(knob, 'knob-shaft-screw', nx, ny, 55, 'knob-body');
  assembly(nx, ny, knob);

  const button: string[] = [], front: string[] = [], { x: bx, y: by } = BUTTON;
  add(button, 'button-seat', 'faceplate', 'Pushbutton mounting foot', S(k.cylinder(bx, by, 18, 28, 4, P, 64, .6), { tone: 'mid' }));
  add(button, 'button-gland', 'button-seat', 'Spring and stem guide', S(k.cylinder(bx, by, 8, 32, 3, P, 48), { tone: 'hi' }));
  const stem: string[] = [];
  add(stem, 'button-stem', 'button-gland', 'Single continuous sprung stem', S(k.cylinder(bx, by, 3, 35, 15, P, 32), { tone: 'hi' }));
  parts.push({ id: 'button-spring', mount: 'button-gland', purpose: 'Visible five-turn return spring' });
  const cap: string[] = [];
  add(cap, 'button-cap', 'button-stem', 'Spring-loaded acknowledgement cap', S(k.cylinder(bx, by, 12, 50, 4, P, 72, .8), { tone: 'hi' }) + L(k.ring(bx, by, 9, 54, P, 64), { tone: 'lo' }));
  const guardOffset = 34, guardDepth = 14;
  for (const dx of [-guardOffset, guardOffset]) {
    add(front, `guard-pillar-${dx}`, 'faceplate', 'Slim protective guard pillar', S(k.slabOf({ x: bx + dx - 2, y: by - guardDepth / 2, w: 4, d: guardDepth, r: 1.5 }, 28, 25, P, 6, .7), { tone: 'mid' }));
    screw(front, `guard-screw-${dx}`, bx + dx, by + 5, 53, `guard-pillar-${dx}`);
  }
  // The rear crossbar is physically behind the moving cap: paint it in the static layer.
  add(button, 'guard-bridge', `guard-pillar-${-guardOffset}`, 'Low rear guard bridge with an open button face', S(k.slabOf({ x: bx - guardOffset - 2, y: by - 9, w: 2 * guardOffset + 4, d: 4, r: 1.5 }, 50, 3, P, 6, .6), { tone: 'hi' }));
  assembly(bx, by, button);

  const lamp: string[] = [], lx = 121, ly = -18;
  add(lamp, 'signal-seat', 'faceplate', 'Signal indicator gasket', S(k.cylinder(lx, ly, 15, 28, 2, P, 64), { tone: 'lo' }));
  add(lamp, 'signal-bezel', 'signal-seat', 'Independent metal lamp housing', S(k.cylinder(lx, ly, 13, 30, 7, P, 72, .6), { tone: 'hi' }) + L(k.knurl(lx, ly, 13, 31, 36, 48, P), { tone: 'lo' }));
  add(lamp, 'signal-lens', 'signal-bezel', 'Diffusing coloured lens, state backed by symbol and text', `<path class="module-lens" d="${k.ring(lx, ly, 10, 37.1, P, 80)}"/>`);
  add(lamp, 'signal-ring', 'signal-bezel', 'Lens retaining ring', L(k.ring(lx, ly, 11.4, 37.2, P, 80), { tone: 'mid' }));
  assembly(lx, ly, lamp);
  const result = { staticMarkup: base.join('') + assemblies.sort((a, b) => a.depth - b.depth).map(a => a.markup).join(''), frontMarkup: front.join(''), buttonMarkup: cap.join(''), stemMarkup: stem.join(''), parts };
  cache.set(cacheKey, result); return result;
}
