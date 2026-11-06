/// <reference types="node" />
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Group } from 'three';
import { CAD_ASSETS, consoleLayout, motionPose, ZONE_READINGS } from '../../src/scene/config';
import { animateToPose } from '../../src/scene/motion';

describe('console geometry and physical motion', () => {
  it('shows the same power / indicator B comparison pair as the alarm controls', () => {
    expect(ZONE_READINGS.alarms).toEqual(['power', 'indicatorB']);
  });

  it('keeps three supported sectors and gives profiles distinct silhouettes', () => {
    const wide = consoleLayout('vver');
    const compact = consoleLayout('smr');
    expect(wide.sectors.map(s => s.id)).toEqual(['power', 'systems', 'alarms']);
    expect(compact.sectors.map(s => s.id)).toEqual(['power', 'systems', 'alarms']);
    expect(wide.width).toBeGreaterThan(compact.width * 1.2);
    expect(wide.sectors[0].yaw).not.toBe(compact.sectors[0].yaw);
    for (const layout of [wide, compact]) {
      for (const sector of layout.sectors) {
        expect(Math.abs(sector.x) + sector.width / 2).toBeLessThan(layout.width / 2);
        expect(sector.supports).toBe(2);
      }
    }
  });

  it('maps only bounded training values into mechanical travel', () => {
    const low = motionPose(-20, -50, false);
    const high = motionPose(130, 200, true);
    expect(low.knob).toBeCloseTo(-Math.PI * .7);
    expect(high.knob).toBeCloseTo(Math.PI * .7);
    expect(low.needle).toBeCloseTo(Math.PI * .75);
    expect(high.needle).toBeCloseTo(-Math.PI * .75);
    expect(low.button).toBe(0);
    expect(high.button).toBeCloseTo(-.025);
  });

  it('AnimationMixer drives knob, needle and button to the same target', () => {
    const root = new Group();
    for (const name of ['knob', 'needle', 'button']) {
      const part = new Group(); part.name = name; root.add(part);
    }
    const target = motionPose(75, 60, true);
    const animation = animateToPose(root, target, false);
    animation.mixer.update(.15);
    expect(root.getObjectByName('button')!.position.z).toBeLessThan(0);
    expect(root.getObjectByName('button')!.position.z).toBeGreaterThan(target.button);
    animation.mixer.update(1);
    expect(root.getObjectByName('knob')!.rotation.z).toBeCloseTo(target.knob);
    expect(root.getObjectByName('needle')!.rotation.z).toBeCloseTo(target.needle);
    expect(root.getObjectByName('button')!.position.z).toBeCloseTo(target.button);
    animation.dispose();
  });

  it('reduced motion immediately applies final poses', () => {
    const root = new Group();
    for (const name of ['knob', 'needle', 'button']) {
      const part = new Group(); part.name = name; root.add(part);
    }
    const target = motionPose(20, 90, false);
    const animation = animateToPose(root, target, true);
    expect(root.getObjectByName('knob')!.rotation.z).toBeCloseTo(target.knob);
    expect(root.getObjectByName('needle')!.rotation.z).toBeCloseTo(target.needle);
    animation.dispose();
  });
});

describe('original CAD assets', () => {
  it('records positive solid volumes, local axes and bounded joint travel', () => {
    const manifest = JSON.parse(readFileSync('public/assets/cad/manifest.json', 'utf8'));
    expect(manifest.parts).toHaveLength(3);
    expect(manifest.parts.map((part: { joint: { type: string } }) => part.joint.type)).toEqual(['rigid', 'revolute', 'linear']);
    for (const part of manifest.parts) {
      expect(part.volumeMm3).toBeGreaterThan(0);
      expect(part.joint.axis).toBe('+Z');
      expect(part.boundsMm).toHaveLength(6);
    }
    expect(manifest.parts[1].joint.range).toEqual([-126, 126]);
    expect(manifest.parts[2].joint.range).toEqual([-5, 0]);
  });

  it('ships every manifest mesh as a small valid binary STL', () => {
    expect(CAD_ASSETS.map(a => a.id)).toEqual(['bezel', 'knob', 'ack-button']);
    for (const asset of CAD_ASSETS) {
      const bytes = readFileSync(`public/${asset.path}`);
      const triangles = bytes.readUInt32LE(80);
      expect(triangles).toBeGreaterThan(20);
      expect(bytes.byteLength).toBe(84 + triangles * 50);
      expect(bytes.byteLength).toBeLessThan(400_000);
      expect(asset.scale).toBe(.005);
    }
  });
});
