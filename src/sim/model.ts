export type Profile = 'vver' | 'smr';
export type ZoneId = 'power' | 'systems' | 'alarms';
export type ScenarioId = 'normal' | 'flow' | 'split';
export type StageId = 0 | 1 | 2 | 3 | 4;
export type RoleId = 'observer' | 'operator' | 'instructor';
export type SessionMode = 'solo' | 'group';
export type SignalKind = 'normal' | 'warning' | 'alarm';
export type Command = 0 | 25 | 50 | 75 | 100;

export const STAGES = [
  'Подготовка к пуску', 'Пуск', 'Выход на рабочую мощность',
  'Изменение мощности', 'Плановый останов',
] as const;

type DeviationId = Exclude<ScenarioId, 'normal'>;
type DeviationStatus = 'idle' | 'active' | 'resolved';

export type SessionAction =
  | { type: 'PROFILE'; profile: Profile }
  | { type: 'STAGE'; stage: StageId }
  | { type: 'SCENARIO'; scenario: ScenarioId }
  | { type: 'TICK'; seconds?: number }
  | { type: 'COMMAND'; value: number }
  | { type: 'TRIGGER'; scenario?: DeviationId }
  | { type: 'ACK' }
  | { type: 'RESOLVE' }
  | { type: 'PAUSE'; paused?: boolean }
  | { type: 'RESET' }
  | { type: 'HINT' }
  | { type: 'MODE'; mode: SessionMode }
  | { type: 'ACTOR'; actor: RoleId }
  | { type: 'ASSIGN'; actor: RoleId; stage?: StageId };

export interface DisplaySnapshot {
  readonly profile: Profile;
  readonly stage: StageId;
  readonly stageLabel: (typeof STAGES)[StageId];
  readonly scenario: ScenarioId;
  readonly time: number;
  readonly command: Command;
  readonly readings: Readonly<{
    power: number;
    temperature: number;
    pressure: number;
    flow: number;
    indicatorB: number;
  }>;
  readonly signal: Readonly<{
    kind: SignalKind;
    label: string;
    cause: string | null;
    acknowledged: boolean;
  }>;
  readonly systems: readonly Readonly<{
    id: 'power' | 'flow' | 'indicators';
    label: string;
    status: SignalKind;
  }>[];
}

export interface JournalEvent {
  readonly id: number;
  readonly type: SessionAction['type'];
  readonly time: number;
  readonly actor: RoleId | 'student' | 'model';
  readonly message: string;
  readonly snapshot: DisplaySnapshot;
}

export interface SessionState {
  readonly profile: Profile;
  readonly stage: StageId;
  readonly scenario: ScenarioId;
  readonly time: number;
  readonly paused: boolean;
  readonly command: Command;
  readonly response: number;
  readonly deviation: DeviationStatus;
  readonly acknowledged: boolean;
  readonly hints: number;
  readonly hint: string | null;
  readonly mode: SessionMode;
  readonly actor: RoleId;
  readonly assignments: Readonly<Partial<Record<StageId, RoleId>>>;
  readonly journal: readonly JournalEvent[];
}

// These are toy display curves and names for a fictional panel. The profile
// identifiers label lessons; the curves don't describe any real plant.
const PROFILES = {
  vver: {
    levels: [17, 39, 73, 57, 9], responseSeconds: 4, commandGain: 0.58,
    temperature: [19, 0.59], pressure: [24, 0.48], flow: [37, 0.51],
    systems: ['Канал учебной мощности', 'Учебный контур', 'Пара индикаторов'],
  },
  smr: {
    levels: [12, 34, 64, 49, 6], responseSeconds: 2.7, commandGain: 0.49,
    temperature: [14, 0.72], pressure: [19, 0.53], flow: [29, 0.61],
    systems: ['Модуль учебной мощности', 'Учебный блок расхода', 'Модуль сравнения'],
  },
} as const;

const COMMANDS = [25, 50, 75, 50, 0] as const;
const DETENTS = [0, 25, 50, 75, 100] as const;

// The live clock updates on every tick. Keep snapshots only when it crosses a
// ten-second mark. The saved session holds up to 500 events, including up to 60
// clock samples. Once either limit is reached, older entries are removed.
const SAMPLE_SECONDS = 10;
const CLOCK_SAMPLE_LIMIT = 60;
const JOURNAL_LIMIT = 500;

const DEVIATIONS = {
  flow: { kind: 'warning', label: 'Предупреждение', cause: 'Падение расхода учебного контура' },
  split: { kind: 'alarm', label: 'Учебная тревога', cause: 'Расхождение двух учебных индикаторов' },
} as const;

const ROLES: Record<RoleId, string> = {
  observer: 'Наблюдатель параметров', operator: 'Оператор учебной панели', instructor: 'Инструктор',
};

const STAGE_HINTS = [
  'Сравните показания на обзоре и на пульте: это один снимок учебной модели.',
  'Запустите учебное время и посмотрите, как стрелка приближается к новой отметке.',
  'Проследите за изменением условной мощности на шкале и на графике.',
  'Переведите учебную рукоятку на соседнюю отметку и сравните команду с показанием.',
  'Откройте разбор и сравните показания этого этапа с предыдущими снимками.',
] as const;

const clamp = (value: number) => Math.min(100, Math.max(0, value));
const reading = (value: number) => Math.round(clamp(value));

export function createSession(profile: Profile = 'vver'): SessionState {
  return {
    profile, stage: 0, scenario: 'normal', time: 0, paused: true,
    command: COMMANDS[0], response: PROFILES[profile].levels[0],
    deviation: 'idle', acknowledged: false, hints: 0, hint: null,
    mode: 'solo', actor: 'operator', assignments: {}, journal: Object.freeze([]),
  };
}

export function deriveSnapshot(state: SessionState): DisplaySnapshot {
  const { profile, stage, scenario, time, command, response } = state;
  const curve = PROFILES[profile];
  const active = state.deviation === 'active' && scenario !== 'normal' ? DEVIATIONS[scenario] : null;
  const lowFlow = active?.kind === 'warning';
  const split = active?.kind === 'alarm';
  const power = reading(response);
  const temperature = reading(curve.temperature[0] + response * curve.temperature[1] + (lowFlow ? 7 : 0));
  const pressure = reading(curve.pressure[0] + response * curve.pressure[1]);
  const flow = reading((curve.flow[0] + response * curve.flow[1]) * (lowFlow ? 0.55 : 1));
  const indicatorB = split ? reading(power + 24) : power;
  const signal: DisplaySnapshot['signal'] = active ? { ...active, acknowledged: state.acknowledged } : {
    kind: 'normal', label: state.deviation === 'resolved' ? 'Причина устранена' : 'Норма',
    cause: null, acknowledged: false,
  };
  const systems: DisplaySnapshot['systems'] = Object.freeze([
    Object.freeze({ id: 'power', label: curve.systems[0], status: 'normal' }),
    Object.freeze({ id: 'flow', label: curve.systems[1], status: lowFlow ? 'warning' : 'normal' }),
    Object.freeze({ id: 'indicators', label: curve.systems[2], status: split ? 'alarm' : 'normal' }),
  ]);
  return Object.freeze({
    profile, stage, stageLabel: STAGES[stage], scenario, time, command,
    readings: Object.freeze({ power, temperature, pressure, flow, indicatorB }),
    signal: Object.freeze(signal), systems,
  });
}

function record(state: SessionState, type: SessionAction['type'], message: string, previous = state): SessionState {
  const event: JournalEvent = Object.freeze({
    id: (state.journal.at(-1)?.id ?? 0) + 1, type, time: state.time,
    actor: type === 'TICK' ? 'model' : previous.mode === 'group' ? previous.actor : 'student',
    message, snapshot: deriveSnapshot(state),
  });
  const journal = [event];
  let clockSamples = type === 'TICK' ? 1 : 0;
  for (let index = state.journal.length - 1; index >= 0 && journal.length < JOURNAL_LIMIT; index--) {
    const entry = state.journal[index];
    if (entry.type === 'TICK') {
      if (clockSamples === CLOCK_SAMPLE_LIMIT) continue;
      clockSamples++;
    }
    journal.push(entry);
  }
  return { ...state, journal: Object.freeze(journal.reverse()) };
}

function hintFor(state: SessionState): string {
  if (state.deviation === 'active') {
    const observe = state.scenario === 'flow'
      ? 'Сравните расход с предыдущим снимком в зоне «Параметры и системы».'
      : 'Сравните индикаторы А и Б в зоне «Сигнализация».';
    return `${observe} ${state.acknowledged ? 'Сигнал квитирован; причина всё ещё активна.' : 'Квитирование подтвердит сигнал, но не устранит причину.'}`;
  }
  if (state.deviation === 'resolved') {
    let acknowledged = false;
    // Leave room for the HINT event itself, which may evict the oldest record.
    const firstRetained = Math.max(0, state.journal.length - JOURNAL_LIMIT + 1);
    for (let index = state.journal.length - 1; index >= firstRetained; index--) {
      const { type } = state.journal[index];
      if (type === 'ACK') acknowledged = true;
      if (type === 'TRIGGER') {
        return acknowledged
          ? 'В разборе найдите отдельные события появления сигнала, квитирования и устранения причины.'
          : 'В разборе сравните появление сигнала и устранение причины. Сигнал не был квитирован.';
      }
    }
    return 'Начало этого отклонения уже вышло за пределы журнала. Сравните сохранённые снимки.';
  }
  return STAGE_HINTS[state.stage];
}

// Stage and command change the target; only an unpaused TICK advances the
// response. A selected deviation must be triggered and then explicitly resolved.
// ACK updates confirmation only. PROFILE and RESET begin a new journal.
export function reduceSession(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'PROFILE':
      return action.profile === state.profile ? state : createSession(action.profile);
    case 'RESET':
      return createSession(state.profile);
    case 'STAGE':
      return action.stage === state.stage ? state : record(
        { ...state, stage: action.stage, command: COMMANDS[action.stage], hint: null }, action.type,
        `Выбран этап «${STAGES[action.stage]}».`,
      );
    case 'SCENARIO':
      return state.deviation === 'active' || action.scenario === state.scenario ? state : record(
        { ...state, scenario: action.scenario, deviation: 'idle', hint: null }, action.type,
        action.scenario === 'normal' ? 'Выбран штатный маршрут.' : `Выбрано отклонение: ${DEVIATIONS[action.scenario].cause}.`,
      );
    case 'TICK': {
      const seconds = action.seconds ?? 1;
      const time = state.time + seconds;
      if (state.paused || !Number.isFinite(time) || time <= state.time) return state;
      const curve = PROFILES[state.profile];
      const target = clamp(curve.levels[state.stage] + (state.command - COMMANDS[state.stage]) * curve.commandGain);
      const response = target + (state.response - target) * Math.exp(-seconds / curve.responseSeconds);
      const next = { ...state, time, response };
      const crossedSampleMark = Math.floor(time / SAMPLE_SECONDS) > Math.floor(state.time / SAMPLE_SECONDS);
      return crossedSampleMark ? record(next, action.type, 'Обновлены условные показания.') : next;
    }
    case 'COMMAND': {
      if (!Number.isFinite(action.value)) return state;
      const command = DETENTS[Math.round(clamp(action.value) / 25)];
      return command === state.command ? state : record(
        { ...state, command }, action.type, `Учебная рукоятка переведена на отметку ${command}.`,
      );
    }
    case 'TRIGGER': {
      const scenario = action.scenario ?? state.scenario;
      if (scenario === 'normal' || state.deviation === 'active') return state;
      const { cause, label } = DEVIATIONS[scenario];
      return record(
        { ...state, scenario, deviation: 'active', acknowledged: false, hint: null }, action.type,
        `${label}: ${cause.toLowerCase()}.`,
      );
    }
    case 'ACK':
      return state.deviation !== 'active' || state.acknowledged ? state : record(
        { ...state, acknowledged: true, hint: null }, action.type, 'Сигнал квитирован. Учебная причина остаётся активной.',
      );
    case 'RESOLVE':
      return state.deviation !== 'active' ? state : record(
        { ...state, deviation: 'resolved', acknowledged: false, hint: null }, action.type,
        state.acknowledged ? 'Учебная причина устранена.' : 'Учебная причина устранена; сигнал не был квитирован.',
      );
    case 'PAUSE': {
      const paused = action.paused ?? !state.paused;
      return paused === state.paused ? state : record(
        { ...state, paused }, action.type, paused ? 'Учебное время остановлено.' : 'Учебное время запущено.',
      );
    }
    case 'HINT': {
      const hint = hintFor(state);
      return record({ ...state, hint, hints: state.hints + 1 }, action.type, `Подсказка: ${hint}`);
    }
    case 'MODE':
      return action.mode === state.mode ? state : record(
        { ...state, mode: action.mode, actor: 'operator' }, action.type,
        action.mode === 'group' ? 'Включена локальная учебная группа.' : 'Включено индивидуальное занятие.', state,
      );
    case 'ACTOR':
      return state.mode !== 'group' || action.actor === state.actor ? state : record(
        { ...state, actor: action.actor }, action.type, `Активная роль: ${ROLES[action.actor]}.`, state,
      );
    case 'ASSIGN': {
      const stage = action.stage ?? state.stage;
      if (state.mode !== 'group' || state.actor !== 'instructor' || state.assignments[stage] === action.actor) return state;
      return record(
        { ...state, assignments: { ...state.assignments, [stage]: action.actor } }, action.type,
        `Этап «${STAGES[stage]}» назначен роли «${ROLES[action.actor]}».`,
      );
    }
  }
}
