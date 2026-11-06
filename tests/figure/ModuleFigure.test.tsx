// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { ModuleFigure } from '../../src/figure/ModuleFigure';
import { createSession, deriveSnapshot } from '../../src/sim/model';
import { moduleGeometry, needlePath, figureReading } from '../../src/figure/geometry';

let root: Root | undefined;
afterEach(() => { if (root) act(() => root?.unmount()); root = undefined; document.body.innerHTML = ''; vi.unstubAllGlobals(); });
const snapshot = () => deriveSnapshot(createSession('vver'));
describe('physical module figure', () => {
  it('builds a purposeful, finite kit assembly with mounted mechanisms', () => {
    const geometry = moduleGeometry('vver');
    expect(geometry.parts.length).toBeGreaterThanOrEqual(40);
    expect(geometry.parts.length).toBeLessThanOrEqual(80);
    expect(new Set(geometry.parts.map(p => p.id)).size).toBe(geometry.parts.length);
    expect(geometry.staticMarkup).not.toMatch(/NaN|Infinity|undefined/);
    expect(geometry.staticMarkup).toContain('iso-shade');
    for (const id of ['case', 'gauge-bezel', 'window-recess', 'knob-body', 'button-spring', 'signal-lens']) {
      expect(geometry.parts.some(p => p.id === id)).toBe(true);
    }
  });
  it('maps each zone to the same snapshot and keeps the dial range bounded', () => {
    const s = snapshot();
    expect(figureReading(s, 'power').value).toBe(s.readings.power);
    expect(figureReading(s, 'systems').value).toBe(s.readings.flow);
    expect(figureReading(s, 'alarms').value).toBe(s.readings.indicatorB);
    expect(figureReading(s, 'alarms').label).toBe('Индикатор Б');
    expect(needlePath(-10)).toBe(needlePath(0));
    expect(needlePath(150)).toBe(needlePath(100));
    expect(needlePath(0)).not.toBe(needlePath(100));
  });
  it('renders a labelled interactive object and retains signal after acknowledgement', () => {
    const initial = snapshot();
    const s = { ...initial, signal: { ...initial.signal, kind: 'alarm' as const, label: 'Тревога', cause: 'Учебное отклонение', acknowledged: true } };
    const html = renderToStaticMarkup(<ModuleFigure snapshot={s} profile="vver" zone="alarms" onCommand={() => {}} onAcknowledge={() => {}} />);
    expect(html).toContain('data-signal="alarm"');
    expect(html).toContain('data-acknowledged="true"');
    expect(html).toContain('role="slider"');
    expect(html).toContain('Квитировать сигнал');
    expect(html).toContain('Подтверждён');
    expect(html).toContain('clipPath');
  });
  it('keeps the rear guard behind the moving cap and side guards in front', () => {
    const html = renderToStaticMarkup(<ModuleFigure snapshot={snapshot()} profile="vver" zone="power" onCommand={() => {}} onAcknowledge={() => {}} />);
    const bridge = html.indexOf('data-part="guard-bridge"');
    const cap = html.indexOf('data-part="button-cap"');
    const pillar = html.indexOf('data-part="guard-pillar--34"');
    expect(bridge).toBeGreaterThan(0);
    expect(bridge).toBeLessThan(cap);
    expect(pillar).toBeGreaterThan(cap);
  });
  it('leaves a visible screen-space gap between the cap and both guard plates', () => {
    const geometry = moduleGeometry('vver');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.innerHTML = geometry.frontMarkup + geometry.buttonMarkup;
    const extent = (part: Element) => {
      const xs = [...part.querySelectorAll('path')].flatMap(path =>
        [...(path.getAttribute('d') ?? '').matchAll(/[ML](-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)].map(match => Number(match[1])));
      return [Math.min(...xs), Math.max(...xs)];
    };
    const cap = extent(svg.querySelector('[data-part="button-cap"]')!);
    const guards = [...svg.querySelectorAll('[data-part^="guard-pillar-"]')].map(extent).sort((a, b) => a[0] - b[0]);
    expect(guards).toHaveLength(2);
    expect(cap[0] - guards[0][1]).toBeGreaterThan(3);
    expect(guards[1][0] - cap[1]).toBeGreaterThan(3);
  });
  it('provides discrete keyboard and pointer controls without changing readings locally', async () => {
    const host = document.createElement('div'); document.body.append(host);
    const command = vi.fn(), acknowledge = vi.fn();
    const initial = snapshot();
    const s = { ...initial, command: 50 as const, signal: { ...initial.signal, kind: 'warning' as const, acknowledged: false } };
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    root = createRoot(host);
    await act(async () => root!.render(<ModuleFigure snapshot={s} profile="smr" zone="systems" onCommand={command} onAcknowledge={acknowledge} />));
    const knob = host.querySelector('[role="slider"]')!;
    act(() => knob.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(command).toHaveBeenLastCalledWith(75);
    act(() => knob.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })));
    expect(command).toHaveBeenLastCalledWith(0);
    act(() => knob.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(command).toHaveBeenLastCalledWith(75);
    expect(knob.getAttribute('aria-valuenow')).toBe('50');
    const button = host.querySelector('[aria-label="Квитировать сигнал"]')!;
    expect(button.getAttribute('aria-disabled')).toBe('false');
    act(() => button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })));
    expect(acknowledge).toHaveBeenCalledOnce();
  });
  it.each([
    { kind: 'normal' as const, acknowledged: false },
    { kind: 'warning' as const, acknowledged: true },
    { kind: 'alarm' as const, acknowledged: true },
  ])('disables acknowledgement for $kind / acknowledged=$acknowledged', async signal => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { frames.push(fn); return frames.length; });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    const initial = snapshot(), acknowledge = vi.fn();
    const s = { ...initial, signal: { ...initial.signal, ...signal } };
    const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    await act(async () => root!.render(<ModuleFigure snapshot={s} profile="vver" zone="alarms" onCommand={() => {}} onAcknowledge={acknowledge} />));
    act(() => frames.splice(0).forEach(fn => fn(16)));
    const button = host.querySelector('[aria-label="Квитировать сигнал"]')!;
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('tabindex')).toBe('-1');
    act(() => {
      button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      frames.splice(0).forEach(fn => fn(32));
    });
    expect(acknowledge).not.toHaveBeenCalled();
    expect(host.querySelector('[data-part="button-cap"]')?.parentElement?.getAttribute('transform')).toBe('translate(0 0)');
    expect(frames).toHaveLength(0);
  });
  it('places a changed needle immediately and suppresses cap travel under reduced motion', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { frames.push(fn); return frames.length; });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    const initial = snapshot();
    await act(async () => root!.render(<ModuleFigure snapshot={initial} profile="vver" zone="power" onCommand={() => {}} onAcknowledge={() => {}} />));
    act(() => frames.splice(0).forEach(fn => fn(16)));
    const next = { ...initial, readings: { ...initial.readings, power: 100 }, signal: { ...initial.signal, acknowledged: true } };
    await act(async () => root!.render(<ModuleFigure snapshot={next} profile="vver" zone="power" onCommand={() => {}} onAcknowledge={() => {}} />));
    act(() => frames.splice(0).forEach(fn => fn(32)));
    expect(host.querySelector('.module-needle')?.getAttribute('d')).toBe(needlePath(100));
    expect(host.querySelector('[data-part="button-cap"]')?.parentElement?.getAttribute('transform')).toBe('translate(0 0)');
    expect(frames).toHaveLength(0);
  });
});
