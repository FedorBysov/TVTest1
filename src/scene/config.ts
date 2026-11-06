import type { DisplaySnapshot, Profile, ZoneId } from '../sim/model';

export const ZONE_READINGS: Record<ZoneId, readonly [keyof DisplaySnapshot['readings'], keyof DisplaySnapshot['readings']]> = {
  power: ['power', 'temperature'],
  systems: ['flow', 'pressure'],
  alarms: ['power', 'indicatorB'],
};

export const CAD_ASSETS = [
  { id: 'bezel', path: 'assets/cad/bezel.stl', scale: .005 },
  { id: 'knob', path: 'assets/cad/knob.stl', scale: .005 },
  { id: 'ack-button', path: 'assets/cad/ack-button.stl', scale: .005 },
] as const;
export type CadId = typeof CAD_ASSETS[number]['id'];
export type MotionPose = { knob: number; needle: number; button: number };

export function motionPose(command: number, reading: number, acknowledged: boolean): MotionPose {
  const bounded = (n: number) => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0)) / 100;
  return {
    knob: (bounded(command) * 2 - 1) * Math.PI * .7,
    needle: (1 - bounded(reading) * 2) * Math.PI * .75,
    button: acknowledged ? -.025 : 0,
  };
}

export function consoleLayout(profile: Profile) {
  const compact = profile === 'smr';
  // The physical lessons use distinct rooms: a long hybrid instrument wall
  // for VVER and a tighter screen-led workstation for SMR.
  const width = compact ? 6.1 : 9.4;
  const ids: ZoneId[] = ['power', 'systems', 'alarms'];
  return {
    width,
    depth: compact ? 3.3 : 3.8,
    sectors: ids.map((id, i) => ({
      id, x: (i - 1) * (compact ? 1.58 : 2.05),
      z: compact ? -.15 : (i === 1 ? -.34 : -.04),
      yaw: compact ? 0 : (1 - i) * .16,
      width: compact ? 1.48 : 1.94,
      height: compact ? 2.48 + (i === 1 ? .25 : 0) : 2.8,
      supports: 2,
    })),
  };
}
