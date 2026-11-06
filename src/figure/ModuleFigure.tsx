import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import * as k from '../../.agents/skills/anatomy/kit/iso-kit';
import type { DisplaySnapshot, Profile, ZoneId } from '../sim/model';
import { BUTTON, GAUGE, HEIGHT, KNOB, P, WIDTH, buttonShift, figureReading, knobPointer, moduleGeometry, needlePath, springPaths, windowMatrix, windowPath } from './geometry';
import './module-figure.css';

export interface ModuleFigureProps {
  snapshot: DisplaySnapshot;
  profile: Profile;
  zone: ZoneId;
  onCommand: (value: number) => void;
  onAcknowledge: () => void;
}
const ZONE_NAMES = { power: 'Мощность и режим', systems: 'Технологические системы', alarms: 'Сигнализация' };

/** A display of the shared model; no independent simulation or idle demonstration. */
export function ModuleFigure({ snapshot, profile, zone, onCommand, onAcknowledge }: ModuleFigureProps) {
  const id = useId().replace(/:/g, ''), geometry = moduleGeometry(profile, zone), reading = figureReading(snapshot, zone);
  const canAcknowledge = snapshot.signal.kind !== 'normal' && !snapshot.signal.acknowledged;
  const host = useRef<HTMLElement>(null), needle = useRef<SVGPathElement>(null), pointer = useRef<SVGPathElement>(null);
  const cap = useRef<SVGGElement>(null), spring = useRef<SVGPathElement>(null), springBack = useRef<SVGPathElement>(null);
  const actual = useRef<{ reading: number; command: number; press: number }>({ reading: reading.value, command: snapshot.command, press: 0 });
  const pressTarget = useRef(0), kick = useRef<() => void>(() => {});
  const targets = useRef({ reading: reading.value, command: snapshot.command });
  targets.current = { reading: reading.value, command: snapshot.command };
  useEffect(() => {
    let frame = 0, previous = 0, visible = true;
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const draw = () => {
      needle.current?.setAttribute('d', needlePath(actual.current.reading));
      pointer.current?.setAttribute('d', knobPointer(actual.current.command));
      cap.current?.setAttribute('transform', buttonShift(actual.current.press));
      const coil = springPaths(actual.current.press);
      spring.current?.setAttribute('d', coil.front);
      springBack.current?.setAttribute('d', coil.back);
    };
    const tick = (now: number) => {
      const dt = previous ? Math.min((now - previous) / 1000, 1 / 30) : 1 / 60; previous = now;
      let moving = false;
      for (const key of ['reading', 'command', 'press'] as const) {
        const target = key === 'press' ? (media?.matches ? 0 : pressTarget.current) : targets.current[key];
        const error = target - actual.current[key];
        actual.current[key] = media?.matches || Math.abs(error) < .025 ? target : actual.current[key] + error * (1 - Math.exp(-dt / (key === 'press' ? .055 : .14)));
        moving ||= actual.current[key] !== target;
      }
      draw(); frame = moving && visible ? requestAnimationFrame(tick) : 0;
    };
    const start = () => { if (visible && !frame) { previous = 0; frame = requestAnimationFrame(tick); } };
    kick.current = start;
    const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => {
      visible = entries[entries.length - 1].isIntersecting;
      if (visible) start(); else { cancelAnimationFrame(frame); frame = 0; }
    }, { rootMargin: '120px' }) : null;
    if (host.current) observer?.observe(host.current);
    media?.addEventListener('change', start); start();
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); media?.removeEventListener('change', start); kick.current = () => {}; };
  }, []);
  useEffect(() => { kick.current(); }, [reading.value, snapshot.command]);
  useEffect(() => {
    if (!canAcknowledge) { pressTarget.current = 0; kick.current(); }
  }, [canAcknowledge]);
  const setPress = (value: number) => {
    if (value > 0 && !canAcknowledge) return;
    pressTarget.current = value; kick.current();
  };
  const commandKey = (event: KeyboardEvent<SVGGElement>) => {
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 25 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -25 : 0;
    const value = event.key === 'Home' ? 0 : event.key === 'End' ? 100 : delta ? Math.max(0, Math.min(100, snapshot.command + delta)) : undefined;
    if (value !== undefined) { event.preventDefault(); onCommand(value); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onCommand(Math.min(100, snapshot.command + 25)); }
  };
  const signalSymbol = snapshot.signal.kind === 'alarm' ? '⯃' : snapshot.signal.kind === 'warning' ? '△' : '○';
  const signalPoint = k.iso([121, -18, 38], P);
  return (
    <figure className="module-figure" ref={host} data-profile={profile} data-zone={zone} data-signal={snapshot.signal.kind} data-acknowledged={snapshot.signal.acknowledged}>
      <header className="module-figure-heading"><span>FIG. 02 / {profile === 'smr' ? 'СМР' : 'ВВЭР'}</span><strong>{ZONE_NAMES[zone]}</strong></header>
      <svg className="module-svg iso-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-labelledby={`${id}-title ${id}-description`}>
        <title id={`${id}-title`}>{`Учебный приборный модуль: ${ZONE_NAMES[zone]}`}</title>
        <desc id={`${id}-description`}>{`Стрелка и числовое окно: ${reading.label}, ${reading.value} из 100. Рукоятка: стрелки клавиатуры меняют команду на 25, Home и End — крайние положения. Защищённая кнопка квитирует сигнал. Данные условные.`}</desc>
        <defs><clipPath id={`${id}-window`}><path d={windowPath} /></clipPath></defs>
        <g aria-hidden="true" dangerouslySetInnerHTML={{ __html: geometry.staticMarkup }} />
        <g aria-hidden="true" clipPath={`url(#${id}-window)`}><text className="module-digit" transform={windowMatrix} textAnchor="middle" fontSize="22">{reading.value.toFixed(0).padStart(3, '0')}</text></g>
        <g aria-hidden="true" data-part="needle"><path ref={needle} className="module-needle" data-free="" d={needlePath(reading.value)} /><path className="module-hub" d={k.ring(GAUGE.x, GAUGE.y, 3.3, GAUGE.z + .6, P, 48)} /></g>
        <g className="module-control module-command" role="slider" tabIndex={0} aria-label="Команда, рукоятка" aria-valuemin={0} aria-valuemax={100} aria-valuenow={snapshot.command} aria-valuetext={`${snapshot.command} из 100, шаг 25`} onKeyDown={commandKey} onClick={() => onCommand(Math.min(100, snapshot.command + 25))}>
          <path className="module-hit" d={k.ring(KNOB.x, KNOB.y, KNOB.r + 11, KNOB.z, P, 96)} />
          <path ref={pointer} className="module-pointer" d={knobPointer(snapshot.command)} data-free="" aria-hidden="true" />
        </g>
        <path ref={springBack} className="module-spring" d={springPaths().back} aria-hidden="true" />
        <g aria-hidden="true" dangerouslySetInnerHTML={{ __html: geometry.stemMarkup }} />
        <path ref={spring} className="module-spring" data-part="button-spring" d={springPaths().front} aria-hidden="true" />
        <g className="module-control module-acknowledge" role="button" tabIndex={canAcknowledge ? 0 : -1} aria-disabled={!canAcknowledge} aria-label="Квитировать сигнал" onPointerDown={() => setPress(1)} onPointerUp={() => setPress(0)} onPointerCancel={() => setPress(0)} onPointerLeave={() => setPress(0)} onBlur={() => setPress(0)} onClick={() => { if (canAcknowledge) onAcknowledge(); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (canAcknowledge && !event.repeat) { setPress(1); onAcknowledge(); } } }} onKeyUp={() => setPress(0)}>
          <path className="module-hit" d={k.ring(BUTTON.x, BUTTON.y, 20, BUTTON.z, P, 80)} />
          <g ref={cap} aria-hidden="true" dangerouslySetInnerHTML={{ __html: geometry.buttonMarkup }} />
        </g>
        <g aria-hidden="true" className="module-guards" dangerouslySetInnerHTML={{ __html: geometry.frontMarkup }} />
        <text aria-hidden="true" x={signalPoint[0]} y={signalPoint[1] + 4} className="module-signal-mark" textAnchor="middle">{snapshot.signal.kind === 'alarm' ? '⬣' : snapshot.signal.kind === 'warning' ? '▲' : '•'}</text>
      </svg>
      <div className="module-figure-foot"><span>Рукоятка: щелчок / ← → · кнопка: Enter</span><output>{reading.label} <b>{reading.value}</b><small> / 100</small></output></div>
      <figcaption><span className="module-status"><span aria-hidden="true">{signalSymbol}</span> {snapshot.signal.label}{snapshot.signal.acknowledged ? ' · Подтверждён' : ''}</span><span>Стрелка — показание · рукоятка — команда {snapshot.command} · лампа — сигнал</span></figcaption>
    </figure>
  );
}
