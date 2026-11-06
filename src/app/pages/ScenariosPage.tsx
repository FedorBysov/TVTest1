import type { DisplaySnapshot, ScenarioId, SessionAction, SessionState } from '../../sim/model'
import { assessSession, type TrainingRoute } from '../../sim/assessment'
import { SCENARIOS } from '../content'
import { formatReading, formatTime, Panel, SectionTitle, SignalBadge, StageStrip } from '../components'
import { ReadingComparison } from './ConsolePage'

interface ScenariosProps { state: SessionState; snapshot: DisplaySnapshot; baseline: DisplaySnapshot; dispatch: (action: SessionAction) => void; onConsole: () => void; canDispatch: (action: SessionAction) => boolean }

const stepNotes = [
  'Осмотрите исходные состояния учебного поста.',
  'Наблюдайте первый условный подъём показаний.',
  'Сравните показание с учебной целевой полосой.',
  'Измените цель и проследите ответ приборов.',
  'Наблюдайте возврат к демонстрационной базе.',
]

function Trend({ state, snapshot }: { state: SessionState; snapshot: DisplaySnapshot }) {
  const recent = [...state.journal.slice(-20).map((event) => ({ time: event.time, value: event.snapshot.readings.power })), { time: snapshot.time, value: snapshot.readings.power }]
  const series = recent.length < 2 ? [{ time: snapshot.time, value: snapshot.readings.power }, ...recent] : recent
  const start = series[0].time
  const duration = snapshot.time - start
  const points = series.map(({ time, value }, index) => `${duration > 0 ? (time - start) / duration * 100 : index / (series.length - 1) * 100},${84 - Math.max(0, Math.min(100, value)) * .68}`).join(' ')
  return <div className="trend-graph" role="img" aria-label={`График условной мощности, текущее значение ${formatReading(snapshot.readings.power)} процентов учебной шкалы`}>
    <div className="trend-top"><span>Мощность / условная шкала</span><strong>{formatReading(snapshot.readings.power)}%</strong></div>
    <svg viewBox="0 0 100 90" preserveAspectRatio="none" aria-hidden="true">
      <path className="trend-grid" d="M0 16H100 M0 50H100 M0 84H100" />
      <polyline className="trend-line" points={points} />
    </svg>
    <div className="trend-axis"><span>{duration > 0 ? `Фрагмент с ${formatTime(start)}` : 'Последние действия'}</span><span>Учебное время {formatTime(snapshot.time)}</span></div>
  </div>
}

const taskStatus = { done: 'Выполнено', out_of_order: 'Нарушен порядок', missing: 'Ожидается' } as const

function RouteChecklist({ route }: { route: TrainingRoute }) {
  return <div className="route-checklist" aria-label={`Контрольные действия: ${route.title}`}>
    {route.tasks.map((task, index) => <div key={task.id} className={`route-task route-task-${task.status}`}>
      <span className="route-task-index">{String(index + 1).padStart(2, '0')}</span>
      <div><strong>{task.title}</strong><small>{task.reason}</small></div>
      <em>{taskStatus[task.status]}</em>
    </div>)}
  </div>
}

export function ScenariosPage({ state, snapshot, baseline, dispatch, onConsole, canDispatch }: ScenariosProps) {
  const activeFault = snapshot.signal.kind !== 'normal'
  const assessment = assessSession(state)
  const stageRoute = assessment.stages[snapshot.stage]
  const faultRoute = assessment.deviations.find((route) => route.id === snapshot.scenario)
  const currentTask = faultRoute?.tasks.find((task) => task.status !== 'done')
    ?? stageRoute.tasks.find((task) => task.status !== 'done')
    ?? assessment.nextAction
  return <div className="page scenarios-page">
    <SectionTitle eyebrow="03 / Учебные сценарии" title="Пять этапов. Одна модель.">
      <div className="time-pill"><span>УЧЕБНОЕ ВРЕМЯ</span><strong>{formatTime(snapshot.time)}</strong></div>
    </SectionTitle>
    <p className="page-lead">Выберите этап и маршрут, затем выполните контрольные действия. Порядок и пропуски видны в разборе. Все шкалы, причины и скорости вымышлены.</p>

    <Panel className="stage-panel">
      <div className="panel-heading"><span className="panel-index">ЛЕНТА ПЯТИ ЭТАПОВ</span><span className="panel-hint">Выбранный шаг закреплён</span></div>
      <StageStrip stage={snapshot.stage} onStage={canDispatch({ type: 'STAGE', stage: snapshot.stage }) ? (stage) => dispatch({ type: 'STAGE', stage }) : undefined} />
      <div className="stage-explainer"><span className="stage-marker">0{snapshot.stage + 1}</span><div><strong>{snapshot.stageLabel}</strong><p>{stepNotes[snapshot.stage]}</p></div><button type="button" className="text-link" onClick={onConsole}>Открыть прибор ↗</button></div>
      <div className="lesson-checklist-head"><strong>Контрольные действия этапа</strong><span>Статус: {taskStatus[stageRoute.status]}</span></div>
      <RouteChecklist route={stageRoute} />
    </Panel>

    <div className="scenario-grid">
      <div className="scenario-main">
        <div className="scenario-cards" aria-label="Выбор учебного маршрута">
          {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => <button type="button" key={id} className={`scenario-card${snapshot.scenario === id ? ' is-selected' : ''}`} aria-pressed={snapshot.scenario === id} onClick={() => dispatch({ type: 'SCENARIO', scenario: id })} disabled={!canDispatch({ type: 'SCENARIO', scenario: id }) || activeFault && snapshot.scenario !== id}>
            <span>{SCENARIOS[id].number} / МАРШРУТ</span><strong>{SCENARIOS[id].title}</strong><small>{SCENARIOS[id].summary}</small>
          </button>)}
        </div>
        <Panel className="lesson-controls">
          <div className="panel-heading"><span className="panel-index">УПРАВЛЕНИЕ ЗАНЯТИЕМ</span><span className="tiny-tag">{state.paused ? 'ПАУЗА' : 'ИДЁТ'}</span></div>
          <p className="lesson-intent">{SCENARIOS[snapshot.scenario].outcome}</p>
          <div className="control-row">
            <button type="button" className="primary-button" disabled={!canDispatch({ type: 'PAUSE' })} onClick={() => dispatch({ type: 'PAUSE', paused: !state.paused })}>{state.paused ? 'Продолжить время' : 'Пауза'}</button>
            <button type="button" className="secondary-button" disabled={!canDispatch({ type: 'TICK', seconds: 10 }) || state.paused} onClick={() => dispatch({ type: 'TICK', seconds: 10 })}>+10 с учебного времени</button>
            <button type="button" className="ghost-button" disabled={!canDispatch({ type: 'RESET' })} onClick={() => dispatch({ type: 'RESET' })}>Сбросить занятие</button>
          </div>
          <div className="control-row">
            <button type="button" className="secondary-button" disabled={!canDispatch({ type: 'TRIGGER' }) || snapshot.scenario === 'normal' || activeFault} onClick={() => dispatch({ type: 'TRIGGER' })}>Ввести учебное отклонение</button>
            <button type="button" className="ghost-button" disabled={!canDispatch({ type: 'HINT' })} onClick={() => dispatch({ type: 'HINT' })}>Показать подсказку</button>
          </div>
          {state.hint && <div className="hint-box" role="note"><strong>Подсказка</strong><p>{state.hint}</p></div>}
          <p className="microcopy">Пауза останавливает учебное время и плавное следование показаний. События ручного выбора остаются доступными.</p>
        </Panel>
      </div>
      <div className="scenario-side">
        <Panel className="signal-panel"><div className="panel-heading"><span className="panel-index">СИГНАЛ МОДЕЛИ</span></div><SignalBadge signal={snapshot.signal} /><p className="microcopy">Предупреждение и тревога отличаются знаком и текстом. Квитирование не устраняет причину.</p></Panel>
        {snapshot.scenario !== 'normal' && <Panel className="reference-panel"><div className="panel-heading"><span className="panel-index">ПОКАЗАНИЕ / ОРИЕНТИР / РАЗНИЦА</span></div>{snapshot.scenario === 'flow'
          ? <ReadingComparison label="Сравнение расхода" title="Расход учебного контура" current={snapshot.readings.flow} baseline={baseline.readings.flow} note="Расход сравнивается с той же моделью при тех же текущих условиях без отклонения." />
          : <ReadingComparison label="Сравнение индикаторов" title="Индикатор Б относительно А" current={snapshot.readings.indicatorB} baseline={baseline.readings.indicatorB} note="При согласованных индикаторах ориентир Б совпадает с текущим показанием А." />}</Panel>}
        {faultRoute && <Panel className="fault-checklist-panel"><div className="panel-heading"><span className="panel-index">РАЗБОР ОТКЛОНЕНИЯ</span><span className="tiny-tag">{taskStatus[faultRoute.status]}</span></div><RouteChecklist route={faultRoute} /></Panel>}
        <Panel className="trend-panel"><Trend state={state} snapshot={snapshot} /></Panel>
        <Panel className="scenario-context"><div className="panel-heading"><span className="panel-index">СЛЕДУЮЩИЙ ШАГ</span></div><strong>{currentTask?.title ?? 'Все контрольные действия выполнены'}</strong><p>{currentTask?.reason ?? 'Откройте разбор, чтобы проверить результаты всех этапов и отклонений.'}</p><button type="button" className="text-link" onClick={onConsole}>Посмотреть модуль ↗</button></Panel>
      </div>
    </div>
  </div>
}
