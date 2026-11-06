import type { JournalEvent, SessionState, StageId, ZoneId } from './model';
import { STAGES } from './stages';

export type TaskStatus = 'done' | 'out_of_order' | 'missing';

export interface TrainingTask {
  readonly id: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly reason: string;
  readonly eventId?: number;
}

export interface TrainingRoute {
  readonly id: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly tasks: readonly TrainingTask[];
}

export interface SessionAssessment {
  readonly stages: readonly TrainingRoute[];
  readonly deviations: readonly TrainingRoute[];
  readonly totals: Readonly<Record<TaskStatus, number>>;
  readonly nextAction: TrainingTask | null;
}

interface StepSpec {
  readonly id: string;
  readonly title: string;
  readonly matches: (event: JournalEvent) => boolean;
}

interface RouteSpec {
  readonly id: string;
  readonly title: string;
  readonly steps: readonly StepSpec[];
}

function eventAtStage(type: JournalEvent['type'], stage: StageId) {
  return (event: JournalEvent) => event.type === type && event.snapshot.stage === stage;
}

function observation(stage: StageId, zone: ZoneId) {
  return (event: JournalEvent) => event.type === 'OBSERVE' && event.snapshot.stage === stage && event.zone === zone;
}

const STAGE_ROUTES: readonly RouteSpec[] = [
  { id: 'stage-0', title: STAGES[0], steps: [
    { id: 'stage-0.observe-systems', title: 'Осмотреть исходные состояния учебных систем', matches: observation(0, 'systems') },
    { id: 'stage-0.observe-power', title: 'Сопоставить исходное показание и учебную команду', matches: observation(0, 'power') },
  ] },
  { id: 'stage-1', title: STAGES[1], steps: [
    { id: 'stage-1.select', title: 'Выбрать этап «Пуск» на учебном щите', matches: eventAtStage('STAGE', 1) },
    { id: 'stage-1.tick', title: 'Запустить учебное время и дождаться обновления показаний', matches: eventAtStage('TICK', 1) },
    { id: 'stage-1.observe-power', title: 'Осмотреть изменившееся показание мощности', matches: observation(1, 'power') },
  ] },
  { id: 'stage-2', title: STAGES[2], steps: [
    { id: 'stage-2.select', title: 'Выбрать этап «Выход на рабочую мощность»', matches: eventAtStage('STAGE', 2) },
    { id: 'stage-2.tick', title: 'Дождаться обновления условных показаний', matches: eventAtStage('TICK', 2) },
    { id: 'stage-2.observe-power', title: 'Сопоставить команду и показание после изменения', matches: observation(2, 'power') },
  ] },
  { id: 'stage-3', title: STAGES[3], steps: [
    { id: 'stage-3.select', title: 'Выбрать этап «Изменение мощности»', matches: eventAtStage('STAGE', 3) },
    { id: 'stage-3.command', title: 'Перевести учебную рукоятку на другую отметку', matches: eventAtStage('COMMAND', 3) },
    { id: 'stage-3.tick', title: 'Дождаться реакции условного прибора', matches: eventAtStage('TICK', 3) },
    { id: 'stage-3.observe-power', title: 'Осмотреть результат изменения учебной команды', matches: observation(3, 'power') },
  ] },
  { id: 'stage-4', title: STAGES[4], steps: [
    { id: 'stage-4.select', title: 'Выбрать этап «Плановый останов»', matches: eventAtStage('STAGE', 4) },
    { id: 'stage-4.tick', title: 'Дождаться изменения условных показаний', matches: eventAtStage('TICK', 4) },
    { id: 'stage-4.observe-systems', title: 'Осмотреть состояния учебных систем', matches: observation(4, 'systems') },
    { id: 'stage-4.observe-power', title: 'Сопоставить итоговое показание с учебной командой', matches: observation(4, 'power') },
  ] },
];

const DEVIATION_ROUTES: readonly RouteSpec[] = [
  { id: 'flow', title: 'Снижение условного расхода', steps: [
    { id: 'flow.trigger', title: 'Ввести учебное отклонение расхода', matches: event => event.type === 'TRIGGER' && event.snapshot.scenario === 'flow' },
    { id: 'flow.observe', title: 'Осмотреть зону учебных систем и показатель расхода', matches: event => event.type === 'OBSERVE' && event.zone === 'systems' && event.snapshot.scenario === 'flow' && event.snapshot.signal.kind === 'warning' },
    { id: 'flow.ack', title: 'Квитировать учебное предупреждение', matches: event => event.type === 'ACK' && event.snapshot.scenario === 'flow' },
    { id: 'flow.resolve', title: 'Устранить учебную причину отдельным действием', matches: event => event.type === 'RESOLVE' && event.snapshot.scenario === 'flow' },
    { id: 'flow.verify', title: 'Повторно осмотреть состояние учебных систем', matches: event => event.type === 'OBSERVE' && event.zone === 'systems' && event.snapshot.scenario === 'flow' && event.snapshot.signal.kind === 'normal' },
  ] },
  { id: 'split', title: 'Расхождение учебных индикаторов', steps: [
    { id: 'split.trigger', title: 'Ввести учебное расхождение индикаторов', matches: event => event.type === 'TRIGGER' && event.snapshot.scenario === 'split' },
    { id: 'split.observe', title: 'Сравнить индикаторы в зоне сигнализации', matches: event => event.type === 'OBSERVE' && event.zone === 'alarms' && event.snapshot.scenario === 'split' && event.snapshot.signal.kind === 'alarm' },
    { id: 'split.ack', title: 'Квитировать учебную тревогу', matches: event => event.type === 'ACK' && event.snapshot.scenario === 'split' },
    { id: 'split.resolve', title: 'Устранить учебную причину отдельным действием', matches: event => event.type === 'RESOLVE' && event.snapshot.scenario === 'split' },
    { id: 'split.verify', title: 'Повторно сравнить учебные индикаторы', matches: event => event.type === 'OBSERVE' && event.zone === 'alarms' && event.snapshot.scenario === 'split' && event.snapshot.signal.kind === 'normal' },
  ] },
];

function routeStatus(tasks: readonly TrainingTask[]): TaskStatus {
  if (tasks.every(task => task.status === 'done')) return 'done';
  return tasks.some(task => task.status === 'out_of_order') ? 'out_of_order' : 'missing';
}

function assessRoute(spec: RouteSpec, events: readonly JournalEvent[], startId: number, ready: boolean) {
  let cursor = startId;
  let previousDone = ready;
  const tasks: TrainingTask[] = [];
  for (const step of spec.steps) {
    const candidates = events.filter(step.matches);
    const inOrder = previousDone ? candidates.find(event => event.id > cursor) : undefined;
    if (inOrder) {
      tasks.push({ id: step.id, title: step.title, status: 'done',
        reason: `Действие сохранено как событие занятия ${inOrder.id}.`, eventId: inOrder.id });
      cursor = inOrder.id;
    } else if (candidates.length) {
      tasks.push({ id: step.id, title: step.title, status: 'out_of_order',
        reason: 'Действие выполнено раньше нужного шага или после пропуска предыдущего; повторите его в учебном порядке.', eventId: candidates.at(-1)!.id });
      previousDone = false;
    } else {
      tasks.push({ id: step.id, title: step.title, status: 'missing',
        reason: 'Действие пока не зафиксировано в журнале занятия.' });
      previousDone = false;
    }
  }
  return { route: { id: spec.id, title: spec.title, status: routeStatus(tasks), tasks }, cursor, complete: previousDone };
}

function episodeRange(journal: readonly JournalEvent[], scenario: string) {
  let start = -1;
  for (let index = journal.length - 1; index >= 0; index--) {
    if (journal[index].type === 'TRIGGER' && journal[index].snapshot.scenario === scenario) {
      start = index;
      break;
    }
  }
  if (start < 0) return { start: -1, end: journal.length };
  const end = journal.findIndex((event, index) => index > start && (
    event.type === 'TRIGGER' || (event.type === 'SCENARIO' && event.snapshot.scenario !== scenario)
  ));
  return { start, end: end < 0 ? journal.length : end };
}

function latestEpisode(journal: readonly JournalEvent[], scenario: string): readonly JournalEvent[] {
  const { start, end } = episodeRange(journal, scenario);
  return start < 0 ? [] : journal.slice(start, end);
}

function routeReports(events: readonly JournalEvent[]) {
  let cursor = 0;
  let ready = true;
  const stages = STAGE_ROUTES.map(spec => {
    const result = assessRoute(spec, events, cursor, ready);
    cursor = result.cursor;
    ready = result.complete;
    return result.route;
  });
  const deviations = DEVIATION_ROUTES.map(spec => assessRoute(spec, latestEpisode(events, spec.id), 0, true).route);
  return { stages, deviations };
}

/** Keep only events that still explain a completed or misplaced lesson step. */
export function compactTrainingEvidence(events: readonly JournalEvent[]): readonly JournalEvent[] {
  const { stages, deviations } = routeReports(events);
  const usedIds = new Set([...stages, ...deviations].flatMap(route => route.tasks)
    .map(task => task.eventId).filter((id): id is number => id !== undefined));
  for (const { id } of DEVIATION_ROUTES) {
    const { start, end } = episodeRange(events, id);
    if (start >= 0 && end < events.length) usedIds.add(events[end].id);
  }
  return Object.freeze(events.filter(event => usedIds.has(event.id)));
}

/** Explain only actions in the fictional interface, never real operating procedure. */
export function assessSession(state: SessionState): SessionAssessment {
  const { stages, deviations } = routeReports(state.trainingEvidence);
  const allTasks = [...stages, ...deviations].flatMap(route => route.tasks);
  const totals = {
    done: allTasks.filter(task => task.status === 'done').length,
    out_of_order: allTasks.filter(task => task.status === 'out_of_order').length,
    missing: allTasks.filter(task => task.status === 'missing').length,
  };
  const activeDeviation = state.scenario === 'normal' ? null : deviations.find(route => route.id === state.scenario);
  const nextAction = activeDeviation?.tasks.find(task => task.status !== 'done')
    ?? stages.flatMap(route => route.tasks).find(task => task.status !== 'done')
    ?? deviations.flatMap(route => route.tasks).find(task => task.status !== 'done')
    ?? null;
  return { stages, deviations, totals, nextAction };
}
