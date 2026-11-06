import { describe, expect, it } from 'vitest';
import { createSession, deriveSnapshot, reduceSession, STAGES } from '../../src/sim/model';
import type { SessionAction, SessionState, StageId } from '../../src/sim/model';

function apply(state: SessionState, ...actions: SessionAction[]) {
  return actions.reduce(reduceSession, state);
}

describe('учебное занятие', () => {
  it('проходит пять этапов с разными целями и плавным переходом', () => {
    expect(STAGES).toEqual([
      'Подготовка к пуску', 'Пуск', 'Выход на рабочую мощность',
      'Изменение мощности', 'Плановый останов',
    ]);
    let state = apply(createSession(), { type: 'PAUSE', paused: false });
    const powers = [];
    for (const stage of [0, 1, 2, 3, 4] as const satisfies readonly StageId[]) {
      const before = deriveSnapshot(state).readings.power;
      state = reduceSession(state, { type: 'STAGE', stage });
      expect(deriveSnapshot(state)).toMatchObject({ stage, stageLabel: STAGES[stage] });
      expect(deriveSnapshot(state).readings.power).toBe(before);
      const first = deriveSnapshot(reduceSession(state, { type: 'TICK' })).readings.power;
      state = reduceSession(state, { type: 'TICK', seconds: 30 });
      const settled = deriveSnapshot(state).readings.power;
      if (stage > 0) {
        expect(first).toBeGreaterThan(Math.min(before, settled));
        expect(first).toBeLessThan(Math.max(before, settled));
      }
      powers.push(settled);
    }
    expect(powers[0]).toBeLessThan(powers[1]);
    expect(powers[1]).toBeLessThan(powers[2]);
    expect(powers[2]).toBeGreaterThan(powers[3]);
    expect(powers[3]).toBeGreaterThan(powers[4]);
    expect(new Set(powers).size).toBe(5);
    expect(deriveSnapshot(state).signal.kind).toBe('normal');
  });

  it('профили показывают разные учебные кривые при тех же действиях', () => {
    const profiles = (['vver', 'smr'] as const).map((profile) => {
      const start = apply(createSession(profile), { type: 'STAGE', stage: 2 }, { type: 'PAUSE' });
      return [1, 4, 12].map((seconds) => deriveSnapshot(reduceSession(start, { type: 'TICK', seconds })));
    });
    const [a, b] = profiles;
    expect(a.map(({ readings }) => readings.power)).not.toEqual(b.map(({ readings }) => readings.power));
    expect(a.map(({ readings }) => readings.flow)).not.toEqual(b.map(({ readings }) => readings.flow));
    expect(a[0].systems.map(({ label }) => label)).not.toEqual(b[0].systems.map(({ label }) => label));
  });

  it('воспроизводит тот же журнал и показания при повторении действий', () => {
    const route: SessionAction[] = [
      { type: 'STAGE', stage: 3 }, { type: 'COMMAND', value: 90 }, { type: 'PAUSE' },
      { type: 'TICK', seconds: 10 }, { type: 'TRIGGER', scenario: 'flow' },
      { type: 'TICK', seconds: 2 }, { type: 'ACK' }, { type: 'HINT' }, { type: 'RESOLVE' },
    ];
    const original = apply(createSession('smr'), ...route);
    const replay = apply(reduceSession(original, { type: 'RESET' }), ...route);
    expect(replay).toEqual(original);
    expect(deriveSnapshot(replay)).toEqual(deriveSnapshot(original));
    expect(original.journal.filter(({ type }) => type === 'TICK').map(({ time }) => time)).toEqual([10]);
  });

  it('за три часа обновляет часы каждую секунду, сохраняет действия и ограничивает архив отсчётов', () => {
    let state = apply(createSession(), { type: 'STAGE', stage: 2 }, { type: 'PAUSE', paused: false });
    const stageEvent = state.journal[0];
    for (let second = 1; second <= 3 * 60 * 60; second++) {
      state = reduceSession(state, { type: 'TICK', seconds: 1 });
      expect(state.time).toBe(second);
    }
    expect(state.journal[0]).toBe(stageEvent);
    const samples = state.journal.filter(({ type }) => type === 'TICK');
    expect(samples).toHaveLength(60);
    expect(samples.at(-1)).toMatchObject({ time: 10800, snapshot: deriveSnapshot(state) });
    expect(samples[1].time - samples[0].time).toBe(10);
    expect(state.journal.map(({ id }) => id)).toEqual([1, 2, ...Array.from({ length: 60 }, (_, index) => 1024 + index)]);
    expect(JSON.stringify(state).length).toBeLessThan(100_000);
  });

  it('ограничивает общий журнал без повторного использования номеров событий', () => {
    let state = createSession();
    for (let event = 1; event <= 525; event++) {
      state = reduceSession(state, { type: 'COMMAND', value: event % 2 === 1 ? 100 : 0 });
    }
    const oldJournal = state.journal;
    const next = reduceSession(state, { type: 'COMMAND', value: 0 });
    expect(next.journal).toHaveLength(500);
    expect(next.journal[0].id).toBe(27);
    expect(next.journal.at(-1)).toMatchObject({ id: 526, snapshot: { command: 0 } });
    expect(oldJournal.at(-1)).toMatchObject({ id: 525, snapshot: { command: 100 } });
  });

  it('держит часы и показания на паузе, затем продолжает движение к команде', () => {
    const start = apply(createSession(), { type: 'PAUSE' }, { type: 'STAGE', stage: 2 }, { type: 'TICK' });
    const paused = apply(start, { type: 'PAUSE', paused: true }, { type: 'COMMAND', value: 99 });
    expect(deriveSnapshot(paused).command).toBe(100);
    expect(deriveSnapshot(paused).readings).toEqual(deriveSnapshot(start).readings);
    expect(reduceSession(paused, { type: 'TICK', seconds: 8 })).toBe(paused);
    const resumed = apply(paused, { type: 'PAUSE', paused: false }, { type: 'TICK', seconds: 2 });
    expect(deriveSnapshot(resumed).time).toBe(3);
    expect(deriveSnapshot(resumed).readings.power).toBeGreaterThan(deriveSnapshot(paused).readings.power);
  });

  it('сохраняет показания в учебной шкале и не принимает неконечные команды или время', () => {
    const start = apply(createSession(), { type: 'PAUSE' }, { type: 'STAGE', stage: 2 });
    expect(reduceSession(start, { type: 'COMMAND', value: NaN })).toBe(start);
    expect(reduceSession(start, { type: 'TICK', seconds: Infinity })).toBe(start);
    expect(reduceSession(start, { type: 'TICK', seconds: -1 })).toBe(start);
    const high = deriveSnapshot(apply(start,
      { type: 'COMMAND', value: 999 }, { type: 'TRIGGER', scenario: 'split' }, { type: 'TICK', seconds: 100 },
    ));
    const low = deriveSnapshot(apply(start,
      { type: 'STAGE', stage: 4 }, { type: 'COMMAND', value: -50 },
      { type: 'TRIGGER', scenario: 'flow' }, { type: 'TICK', seconds: 100 },
    ));
    expect(high.command).toBe(100);
    expect(low.command).toBe(0);
    for (const reading of [...Object.values(high.readings), ...Object.values(low.readings)]) {
      expect(Number.isInteger(reading)).toBe(true);
      expect(reading).toBeGreaterThanOrEqual(0);
      expect(reading).toBeLessThanOrEqual(100);
    }
  });

  it('смена профиля очищает активную причину, журнал, роли и учебные часы', () => {
    const session = apply(createSession(),
      { type: 'PAUSE' }, { type: 'TICK', seconds: 3 }, { type: 'STAGE', stage: 2 },
      { type: 'MODE', mode: 'group' }, { type: 'ACTOR', actor: 'instructor' },
      { type: 'ASSIGN', actor: 'observer' }, { type: 'TRIGGER', scenario: 'split' },
      { type: 'ACK' }, { type: 'HINT' },
    );
    expect(reduceSession(session, { type: 'PROFILE', profile: 'vver' })).toBe(session);
    expect(reduceSession(session, { type: 'PROFILE', profile: 'smr' })).toEqual(createSession('smr'));
    expect(reduceSession(session, { type: 'RESET' })).toEqual(createSession());
  });
});

describe('учебные отклонения и разбор', () => {
  it('выбор сценария не активирует причину, а падение расхода даёт предупреждение', () => {
    const start = createSession();
    expect(reduceSession(start, { type: 'TRIGGER' })).toBe(start);
    const selected = reduceSession(start, { type: 'SCENARIO', scenario: 'flow' });
    expect(deriveSnapshot(selected).signal.kind).toBe('normal');
    const snapshot = deriveSnapshot(reduceSession(selected, { type: 'TRIGGER' }));
    expect(snapshot.signal).toMatchObject({ kind: 'warning', acknowledged: false });
    expect(snapshot.signal.cause).toMatch(/расход/i);
    expect(snapshot.readings.flow).toBeLessThan(deriveSnapshot(start).readings.flow);
    expect(snapshot.readings.indicatorB).toBe(snapshot.readings.power);
    expect(snapshot.systems.find(({ id }) => id === 'flow')?.status).toBe('warning');
  });

  it('расхождение изменяет второй индикатор и оставляет расход на прежнем уровне', () => {
    const start = createSession('smr');
    const snapshot = deriveSnapshot(reduceSession(start, { type: 'TRIGGER', scenario: 'split' }));
    expect(snapshot.signal).toMatchObject({ kind: 'alarm', acknowledged: false });
    expect(snapshot.signal.cause).toMatch(/расхождение/i);
    expect(Math.abs(snapshot.readings.indicatorB - snapshot.readings.power)).toBeGreaterThan(10);
    expect(snapshot.readings.flow).toBe(deriveSnapshot(start).readings.flow);
    expect(snapshot.systems.find(({ id }) => id === 'indicators')?.status).toBe('alarm');
  });

  it('второй индикатор не скачет назад, когда мощность плавно растёт при расхождении', () => {
    let state = apply(createSession(), { type: 'PAUSE' }, { type: 'STAGE', stage: 2 },
      { type: 'COMMAND', value: 100 }, { type: 'TRIGGER', scenario: 'split' });
    for (let second = 0; second < 12; second++) {
      const before = deriveSnapshot(state).readings;
      state = reduceSession(state, { type: 'TICK' });
      const after = deriveSnapshot(state).readings;
      expect(after.indicatorB).toBeGreaterThanOrEqual(before.indicatorB);
      expect(Math.abs(after.indicatorB - after.power)).toBeGreaterThan(10);
    }
  });

  it.each(['flow', 'split'] as const)('квитирование %s сохраняет причину и показания до устранения', (scenario) => {
    const triggered = reduceSession(createSession(), { type: 'TRIGGER', scenario });
    const active = deriveSnapshot(triggered);
    const acknowledged = reduceSession(triggered, { type: 'ACK' });
    expect(deriveSnapshot(acknowledged)).toEqual({ ...active, signal: { ...active.signal, acknowledged: true } });
    expect(reduceSession(acknowledged, { type: 'ACK' })).toBe(acknowledged);
    expect(reduceSession(acknowledged, { type: 'SCENARIO', scenario: 'normal' })).toBe(acknowledged);
    expect(reduceSession(acknowledged, { type: 'TRIGGER' })).toBe(acknowledged);
    const resolved = reduceSession(acknowledged, { type: 'RESOLVE' });
    const recovered = deriveSnapshot(resolved);
    expect(recovered.signal).toMatchObject({ kind: 'normal', cause: null, acknowledged: false });
    expect(recovered.signal.label).not.toBe(deriveSnapshot(createSession()).signal.label);
    expect(recovered.readings).toEqual(deriveSnapshot(createSession()).readings);
    expect(resolved.journal.map(({ type }) => type)).toEqual(['TRIGGER', 'ACK', 'RESOLVE']);
  });

  it('подсказка в разборе учитывает квитирование последнего отклонения', () => {
    const first = apply(createSession(), { type: 'TRIGGER', scenario: 'split' },
      { type: 'ACK' }, { type: 'RESOLVE' }, { type: 'HINT' });
    expect(first.hint).toMatch(/события появления сигнала, квитирования и устранения причины/);

    const second = apply(first, { type: 'TRIGGER', scenario: 'flow' }, { type: 'RESOLVE' }, { type: 'HINT' });
    expect(second.hint).toMatch(/сигнал не был квитирован/i);
    expect(second.hint).not.toMatch(/события появления сигнала, квитирования/);
  });

  it('подсказка сообщает, если запись о начале отклонения уже удалена из журнала', () => {
    let state = apply(createSession(), { type: 'TRIGGER', scenario: 'split' }, { type: 'ACK' }, { type: 'RESOLVE' });
    for (let event = 0; event < 497; event++) {
      state = reduceSession(state, { type: 'COMMAND', value: event % 2 === 0 ? 100 : 0 });
    }
    const result = reduceSession(state, { type: 'HINT' });
    expect(result.hint).toMatch(/за пределы журнала/);
    expect(result.hint).not.toMatch(/сигнал не был квитирован/i);
  });

  it('журнал хранит неизменяемые снимки после квитирования, устранения и смены этапа', () => {
    const triggered = apply(createSession(), { type: 'PAUSE' }, { type: 'TICK', seconds: 4 }, { type: 'TRIGGER', scenario: 'split' });
    const event = triggered.journal.at(-1)!;
    const recorded = JSON.parse(JSON.stringify(event));
    const later = apply(triggered, { type: 'ACK' }, { type: 'RESOLVE' }, { type: 'STAGE', stage: 4 }, { type: 'TICK', seconds: 5 });
    expect(later.journal.find(({ id }) => id === event.id)).toEqual(recorded);
    expect(event).toMatchObject({ time: 4, snapshot: { time: 4, stage: 0, signal: { acknowledged: false } } });
    expect(Object.isFrozen(event.snapshot.readings)).toBe(true);
    expect(Object.isFrozen(event.snapshot.signal)).toBe(true);
    expect(Object.isFrozen(event.snapshot.systems[0])).toBe(true);
    expect(deriveSnapshot(later)).toMatchObject({ time: 9, stage: 4, signal: { kind: 'normal' } });
  });

  it('группа назначает этапы через инструктора и фиксирует действия от трёх ролей', () => {
    const solo = createSession();
    expect(reduceSession(solo, { type: 'ACTOR', actor: 'instructor' })).toBe(solo);
    const group = apply(solo, { type: 'MODE', mode: 'group' });
    expect(reduceSession(group, { type: 'ASSIGN', actor: 'observer' })).toBe(group);
    const state = apply(group,
      { type: 'COMMAND', value: 100 }, { type: 'ACTOR', actor: 'instructor' },
      { type: 'ASSIGN', actor: 'observer', stage: 2 }, { type: 'ACTOR', actor: 'observer' }, { type: 'HINT' },
    );
    expect(state.assignments).toEqual({ 2: 'observer' });
    expect(state.hints).toBe(1);
    expect(state.hint).toMatch(/\S/);
    expect(state.journal.filter(({ type }) => ['COMMAND', 'ASSIGN', 'HINT'].includes(type)).map(({ actor }) => actor))
      .toEqual(['operator', 'instructor', 'observer']);
  });

  it('смену формата и роли журнал относит к участнику, который её инициировал', () => {
    const state = apply(createSession(), { type: 'MODE', mode: 'group' },
      { type: 'ACTOR', actor: 'instructor' }, { type: 'MODE', mode: 'solo' });
    expect(state.mode).toBe('solo');
    expect(state.journal.map(({ type, actor }) => [type, actor])).toEqual([
      ['MODE', 'student'], ['ACTOR', 'operator'], ['MODE', 'instructor'],
    ]);
  });
});
