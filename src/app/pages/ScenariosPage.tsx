import type { DisplaySnapshot, ScenarioId, SessionAction, SessionState } from '../../sim/model'
import { SCENARIOS } from '../content'
import { formatReading, formatTime, Panel, SectionTitle, SignalBadge, StageStrip } from '../components'

interface ScenariosProps { state: SessionState; snapshot: DisplaySnapshot; dispatch: (action: SessionAction) => void; onConsole: () => void }

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

export function ScenariosPage({ state, snapshot, dispatch, onConsole }: ScenariosProps) {
  const activeFault = snapshot.signal.kind !== 'normal'
  return <div className="page scenarios-page">
    <SectionTitle eyebrow="03 / Учебные сценарии" title="Пять этапов. Одна модель.">
      <div className="time-pill"><span>УЧЕБНОЕ ВРЕМЯ</span><strong>{formatTime(snapshot.time)}</strong></div>
    </SectionTitle>
    <p className="page-lead">Выберите этап и маршрут. Все шкалы, причины и скорости вымышлены для демонстрации причинно-следственной связи.</p>

    <Panel className="stage-panel">
      <div className="panel-heading"><span className="panel-index">ЛЕНТА ПЯТИ ЭТАПОВ</span><span className="panel-hint">Выбранный шаг закреплён</span></div>
      <StageStrip stage={snapshot.stage} onStage={(stage) => dispatch({ type: 'STAGE', stage })} />
      <div className="stage-explainer"><span className="stage-marker">0{snapshot.stage + 1}</span><div><strong>{snapshot.stageLabel}</strong><p>{stepNotes[snapshot.stage]}</p></div><button type="button" className="text-link" onClick={onConsole}>Открыть прибор ↗</button></div>
    </Panel>

    <div className="scenario-grid">
      <div className="scenario-main">
        <div className="scenario-cards" aria-label="Выбор учебного маршрута">
          {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => <button type="button" key={id} className={`scenario-card${snapshot.scenario === id ? ' is-selected' : ''}`} aria-pressed={snapshot.scenario === id} onClick={() => dispatch({ type: 'SCENARIO', scenario: id })} disabled={activeFault && snapshot.scenario !== id}>
            <span>{SCENARIOS[id].number} / МАРШРУТ</span><strong>{SCENARIOS[id].title}</strong><small>{SCENARIOS[id].summary}</small>
          </button>)}
        </div>
        <Panel className="lesson-controls">
          <div className="panel-heading"><span className="panel-index">УПРАВЛЕНИЕ ЗАНЯТИЕМ</span><span className="tiny-tag">{state.paused ? 'ПАУЗА' : 'ИДЁТ'}</span></div>
          <p className="lesson-intent">{SCENARIOS[snapshot.scenario].outcome}</p>
          <div className="control-row">
            <button type="button" className="primary-button" onClick={() => dispatch({ type: 'PAUSE', paused: !state.paused })}>{state.paused ? 'Продолжить время' : 'Пауза'}</button>
            <button type="button" className="secondary-button" disabled={state.paused} onClick={() => dispatch({ type: 'TICK', seconds: 10 })}>+10 с учебного времени</button>
            <button type="button" className="ghost-button" onClick={() => dispatch({ type: 'RESET' })}>Сбросить занятие</button>
          </div>
          <div className="control-row">
            <button type="button" className="secondary-button" disabled={snapshot.scenario === 'normal' || activeFault} onClick={() => dispatch({ type: 'TRIGGER' })}>Ввести учебное отклонение</button>
            <button type="button" className="ghost-button" onClick={() => dispatch({ type: 'HINT' })}>Показать подсказку</button>
          </div>
          {state.hint && <div className="hint-box" role="note"><strong>Подсказка</strong><p>{state.hint}</p></div>}
          <p className="microcopy">Пауза останавливает учебное время и плавное следование показаний. События ручного выбора остаются доступными.</p>
        </Panel>
      </div>
      <div className="scenario-side">
        <Panel className="signal-panel"><div className="panel-heading"><span className="panel-index">СИГНАЛ МОДЕЛИ</span></div><SignalBadge signal={snapshot.signal} /><p className="microcopy">Предупреждение и тревога отличаются знаком и текстом. Квитирование не устраняет причину.</p></Panel>
        <Panel className="trend-panel"><Trend state={state} snapshot={snapshot} /></Panel>
        <Panel className="scenario-context"><div className="panel-heading"><span className="panel-index">СЛЕДУЮЩИЙ ВЗГЛЯД</span></div><strong>От действия к результату</strong><p>Откройте прибор, затем вернитесь в разбор: там сохранены автор, учебное время и снимок показаний каждого события.</p><button type="button" className="text-link" onClick={onConsole}>Посмотреть модуль ↗</button></Panel>
      </div>
    </div>
  </div>
}
