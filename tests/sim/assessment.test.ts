import { describe, expect, it } from 'vitest';
import { isSession } from '../../src/app/sessionValidation';
import { assessSession } from '../../src/sim/assessment';
import { createSession, deriveSnapshot, reduceSession } from '../../src/sim/model';
import type { SessionAction, SessionState } from '../../src/sim/model';

function apply(state: SessionState, ...actions: SessionAction[]) {
  return actions.reduce(reduceSession, state);
}

describe('наблюдения учебного щита', () => {
  it('записывает зону наблюдения и неизменяемый снимок без изменения показаний', () => {
    const before = createSession();
    const state = reduceSession(before, { type: 'OBSERVE', zone: 'systems' });
    expect(deriveSnapshot(state)).toEqual(deriveSnapshot(before));
    expect(state.journal).toHaveLength(1);
    expect(state.journal[0]).toMatchObject({ type: 'OBSERVE', zone: 'systems', actor: 'student', snapshot: { stage: 0 } });
    expect(state.journal[0].message).toMatch(/систем/i);
    expect(isSession(JSON.parse(JSON.stringify(state)))).toBe(true);
  });

  it('не записывает неизвестную зону и отвергает испорченное сохранённое наблюдение', () => {
    const before = createSession();
    expect(reduceSession(before, { type: 'OBSERVE', zone: 'unknown' } as unknown as SessionAction)).toBe(before);
    const state = reduceSession(before, { type: 'OBSERVE', zone: 'alarms' });
    const saved = JSON.parse(JSON.stringify(state));
    saved.journal[0].zone = 'unknown';
    expect(isSession(saved)).toBe(false);
    delete saved.journal[0].zone;
    expect(isSession(saved)).toBe(false);
  });

  it('различает независимые фазы учебных систем при переходе, снижении расхода и расхождении', () => {
    const initial = deriveSnapshot(createSession());
    expect(initial.systems.map(({ id, phase }) => [id, phase])).toEqual([
      ['power', 'steady'], ['flow', 'steady'], ['indicators', 'steady'],
    ]);
    const changing = deriveSnapshot(reduceSession(createSession(), { type: 'STAGE', stage: 2 }));
    expect(changing.systems.map(({ phase }) => phase)).toEqual(['transition', 'steady', 'steady']);
    const lowFlow = deriveSnapshot(reduceSession(createSession(), { type: 'TRIGGER', scenario: 'flow' }));
    expect(lowFlow.systems.map(({ phase }) => phase)).toEqual(['steady', 'degraded', 'steady']);
    const split = deriveSnapshot(reduceSession(createSession(), { type: 'TRIGGER', scenario: 'split' }));
    expect(split.systems.map(({ phase }) => phase)).toEqual(['steady', 'steady', 'discrepant']);
    expect(split.systems.every(({ detail }) => detail.length > 10)).toBe(true);
    const saved = JSON.parse(JSON.stringify(split));
    saved.systems[2].phase = 'unknown';
    expect(isSession({ ...createSession(), journal: [{ id: 1, type: 'OBSERVE', zone: 'alarms', time: 0, actor: 'student', message: 'x', snapshot: saved }] })).toBe(false);
  });
});

describe('объяснимый разбор учебных маршрутов', () => {
  it('показывает все пять этапов и оба отклонения как ещё не выполненные', () => {
    const report = assessSession(createSession());
    expect(report.stages).toHaveLength(5);
    expect(report.deviations.map(({ id }) => id)).toEqual(['flow', 'split']);
    expect(report.stages[0].tasks.map(({ status }) => status)).toEqual(['missing', 'missing']);
    expect(report.nextAction?.id).toBe('stage-0.observe-systems');
    expect(report.totals.done).toBe(0);
  });

  it('зачитывает наблюдение, выбор этапа, ход времени и повторное наблюдение в заданном порядке', () => {
    const state = apply(createSession(),
      { type: 'OBSERVE', zone: 'systems' }, { type: 'OBSERVE', zone: 'power' },
      { type: 'STAGE', stage: 1 }, { type: 'PAUSE', paused: false },
      { type: 'TICK', seconds: 10 }, { type: 'OBSERVE', zone: 'power' },
    );
    const report = assessSession(state);
    expect(report.stages[0].status).toBe('done');
    expect(report.stages[1].status).toBe('done');
    expect(report.stages[1].tasks.map(({ status }) => status)).toEqual(['done', 'done', 'done']);
    expect(report.nextAction?.id).toBe('stage-2.select');
    expect(report.totals.done).toBe(5);
  });

  it('зачитывает фактическое изменение показаний после одной секунды без ожидания десятой секунды', () => {
    const state = apply(createSession(),
      { type: 'OBSERVE', zone: 'systems' }, { type: 'OBSERVE', zone: 'power' },
      { type: 'STAGE', stage: 1 }, { type: 'PAUSE', paused: false },
      { type: 'TICK', seconds: 1 }, { type: 'OBSERVE', zone: 'power' },
    );
    expect(state.time).toBe(1);
    expect(deriveSnapshot(state).readings.power).toBeGreaterThan(deriveSnapshot(createSession()).readings.power);
    expect(assessSession(state).stages[1].status).toBe('done');
    expect(state.journal.filter(({ type }) => type === 'TICK')).toHaveLength(1);
  });

  it('отмечает ранний переход нарушением порядка до повторного прохождения', () => {
    const early = apply(createSession(), { type: 'STAGE', stage: 1 }, { type: 'OBSERVE', zone: 'power' });
    const earlyReport = assessSession(early);
    expect(earlyReport.stages[1].tasks[0].status).toBe('out_of_order');
    const corrected = apply(early, { type: 'STAGE', stage: 0 },
      { type: 'OBSERVE', zone: 'systems' }, { type: 'OBSERVE', zone: 'power' },
      { type: 'STAGE', stage: 1 }, { type: 'PAUSE', paused: false },
      { type: 'TICK', seconds: 10 }, { type: 'OBSERVE', zone: 'power' });
    expect(assessSession(corrected).stages[1].status).toBe('done');
  });

  it.each(['flow', 'split'] as const)('разбирает полную цепочку отклонения %s', (scenario) => {
    const zone = scenario === 'flow' ? 'systems' : 'alarms';
    const state = apply(createSession(), { type: 'TRIGGER', scenario },
      { type: 'OBSERVE', zone }, { type: 'ACK' }, { type: 'RESOLVE' }, { type: 'OBSERVE', zone });
    const report = assessSession(state);
    const route = report.deviations.find(({ id }) => id === scenario)!;
    expect(route.status).toBe('done');
    expect(route.tasks.map(({ status }) => status)).toEqual(['done', 'done', 'done', 'done', 'done']);
    expect(route.tasks.every(({ reason }) => reason.length > 0)).toBe(true);
  });

  it('показывает пропущенное квитирование и преждевременное устранение причины', () => {
    const state = apply(createSession(), { type: 'TRIGGER', scenario: 'flow' },
      { type: 'OBSERVE', zone: 'systems' }, { type: 'RESOLVE' });
    const route = assessSession(state).deviations[0];
    expect(route.tasks.find(({ id }) => id === 'flow.ack')?.status).toBe('missing');
    expect(route.tasks.find(({ id }) => id === 'flow.resolve')?.status).toBe('out_of_order');
    expect(route.tasks.find(({ id }) => id === 'flow.resolve')?.reason).toMatch(/раньше|порядок/i);
  });

  it('не склеивает события разных попыток одного отклонения в ложный успех', () => {
    const state = apply(createSession(),
      { type: 'TRIGGER', scenario: 'flow' }, { type: 'OBSERVE', zone: 'systems' },
      { type: 'ACK' }, { type: 'RESOLVE' }, { type: 'OBSERVE', zone: 'systems' },
      { type: 'TRIGGER', scenario: 'flow' }, { type: 'RESOLVE' },
    );
    const route = assessSession(state).deviations[0];
    expect(route.status).not.toBe('done');
    expect(route.tasks.find(({ id }) => id === 'flow.ack')?.status).toBe('missing');
    expect(route.tasks.find(({ id }) => id === 'flow.resolve')?.status).toBe('out_of_order');
  });

  it('не засчитывает проверку расхода после переключения на другой сценарий без его запуска', () => {
    const state = apply(createSession(),
      { type: 'TRIGGER', scenario: 'flow' }, { type: 'OBSERVE', zone: 'systems' },
      { type: 'ACK' }, { type: 'RESOLVE' },
      { type: 'SCENARIO', scenario: 'split' }, { type: 'OBSERVE', zone: 'systems' },
    );
    const flow = assessSession(state).deviations.find(({ id }) => id === 'flow')!;
    expect(flow.tasks.find(({ id }) => id === 'flow.verify')?.status).toBe('missing');
    expect(flow.status).not.toBe('done');
  });

  it('предлагает следующий шаг выбранного отклонения и не меняет состояние занятия', () => {
    const state = apply(createSession(), { type: 'SCENARIO', scenario: 'split' }, { type: 'TRIGGER' });
    const original = JSON.stringify(state);
    const report = assessSession(state);
    expect(report.nextAction?.id).toBe('split.observe');
    expect(JSON.stringify(state)).toBe(original);
  });

  it('сохраняет оценку пройденных этапов после вытеснения их событий из журнала', () => {
    let state = apply(createSession(),
      { type: 'OBSERVE', zone: 'systems' }, { type: 'OBSERVE', zone: 'power' },
      { type: 'STAGE', stage: 1 }, { type: 'PAUSE', paused: false },
      { type: 'TICK', seconds: 1 }, { type: 'OBSERVE', zone: 'power' },
    );
    for (let index = 0; index < 550; index++) {
      state = reduceSession(state, { type: 'COMMAND', value: index % 2 === 0 ? 100 : 0 });
    }
    expect(state.journal).toHaveLength(500);
    expect(state.journal.every(({ id }) => id > 6)).toBe(true);
    expect(assessSession(state).stages[0].status).toBe('done');
    expect(assessSession(state).stages[1].status).toBe('done');
    expect(JSON.stringify(state).length).toBeLessThan(400_000);
  });
});
