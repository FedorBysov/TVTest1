import type { DisplaySnapshot, Profile, SessionAction, ZoneId } from '../../sim/model'
import { ModuleFigure } from '../../figure/ModuleFigure'
import { ZONES } from '../content'
import { formatReading, Panel, ReadingRow, SectionTitle, SignalBadge, SystemsStatus } from '../components'

interface ConsoleProps {
  snapshot: DisplaySnapshot
  baseline: DisplaySnapshot
  profile: Profile
  zone: ZoneId
  onZone: (zone: ZoneId) => void
  dispatch: (action: SessionAction) => void
  onOverview: () => void
  canDispatch: (action: SessionAction) => boolean
}

export function ReadingComparison({ label, title, current, baseline, note }: { label: string; title: string; current: number; baseline: number; note: string }) {
  const difference = current - baseline
  const signedDifference = difference > 0 ? `+${formatReading(difference)}` : difference < 0 ? `−${formatReading(-difference)}` : formatReading(0)
  return <div className="reference-comparison">
    <strong className="reference-title">{title}</strong>
    <dl aria-label={label}>
      <div><dt>Показание</dt><dd>{formatReading(current)}</dd></div>
      <div><dt>Условный ориентир</dt><dd>{formatReading(baseline)}</dd></div>
      <div className={difference === 0 ? 'reference-equal' : 'reference-different'}><dt>Разница</dt><dd>{signedDifference}</dd></div>
    </dl>
    <p>{note} Все числа — проценты условной шкалы. Ориентир вычислен из текущего учебного состояния без введённого отклонения и не является уставкой реального оборудования.</p>
  </div>
}

export function ConsolePage({ snapshot, baseline, profile, zone, onZone, dispatch, onOverview, canDispatch }: ConsoleProps) {
  const changeCommand = (direction: -1 | 1) => dispatch({ type: 'COMMAND', value: Math.max(0, Math.min(100, snapshot.command + direction * 25)) })
  const canCommand = canDispatch({ type: 'COMMAND', value: snapshot.command })
  const canAck = canDispatch({ type: 'ACK' })
  return <div className="page console-page">
    <SectionTitle eyebrow="02 / Пульт и приборы" title={ZONES[zone].title}>
      <button className="ghost-button" type="button" onClick={onOverview}>← К обзору</button>
    </SectionTitle>
    <p className="page-lead">{ZONES[zone].detail} Модуль и текстовые показания отражают один учебный снимок.</p>

    <div className="zone-tabs" role="group" aria-label="Зона приборного модуля">
      {(Object.keys(ZONES) as ZoneId[]).map((key) => <button type="button" key={key} className={zone === key ? 'is-active' : ''} aria-pressed={zone === key} onClick={() => onZone(key)}>
        <span>{ZONES[key].number}</span>{ZONES[key].title}
      </button>)}
    </div>

    <div className="console-grid">
      <Panel className="figure-panel">
        <div className="panel-heading"><span className="panel-index">FIG 02 / ФИЗИЧЕСКИЙ МОДУЛЬ</span><span className="panel-hint">{canCommand ? 'Рукоятка и кнопка интерактивны' : 'Роль просмотра · управление заблокировано'}</span></div>
        <div className="figure-viewport" inert={!canCommand && !canAck}><ModuleFigure snapshot={snapshot} profile={profile} zone={zone} onCommand={(value) => dispatch({ type: 'COMMAND', value })} onAcknowledge={() => dispatch({ type: 'ACK' })} /></div>
        <div className="scene-caption"><span>Изометрическая деталь · Anatomy</span><span>Все значения — условные</span></div>
      </Panel>

      <div className="console-side">
        <Panel className="control-panel">
          <div className="panel-heading"><span className="panel-index">УЧЕБНОЕ УПРАВЛЕНИЕ</span><span className="tiny-tag">{profile === 'vver' ? 'ВВЭР' : 'СМР'}</span></div>
          <p className="mini-heading">Рукоятка · пять фиксаторов</p>
          <div className="command-control">
            <button type="button" aria-label="Уменьшить учебную команду" onClick={() => changeCommand(-1)} disabled={!canCommand || snapshot.command <= 0}>−</button>
            <div><strong>{formatReading(snapshot.command)}</strong><small>% условной цели</small></div>
            <button type="button" aria-label="Увеличить учебную команду" onClick={() => changeCommand(1)} disabled={!canCommand || snapshot.command >= 100}>+</button>
          </div>
          <div className="detent-track" aria-hidden="true"><span style={{ left: `${snapshot.command}%` }} />{[0, 25, 50, 75, 100].map((n) => <i key={n} />)}</div>
          <p className="microcopy">Учебная команда меняет условную цель. Прибор следует за ней во времени после запуска занятия.</p>
          <div className="action-stack">
            <button className="primary-button" type="button" onClick={() => dispatch({ type: 'ACK' })} disabled={!canAck || snapshot.signal.kind === 'normal' || snapshot.signal.acknowledged}>Квитировать сигнал</button>
            <button className="secondary-button" type="button" onClick={() => dispatch({ type: 'RESOLVE' })} disabled={!canDispatch({ type: 'RESOLVE' }) || snapshot.signal.kind === 'normal'}>Устранить учебную причину</button>
          </div>
          <p className="microcopy">Квитирование подтверждает просмотр сигнала. Оно не меняет его причину и уровень.</p>
        </Panel>
        <Panel className="instrument-panel">
          <div className="panel-heading"><span className="panel-index">ПОКАЗАНИЯ МОДУЛЯ</span><span className="tiny-tag">ДУБЛЬ ПРИБОРОВ</span></div>
          {zone === 'power' ? <><ReadingRow label="Мощность" value={snapshot.readings.power} emphasis /><ReadingRow label="Цель команды" value={snapshot.command} /></> : null}
          {zone === 'systems' ? <><ReadingRow label="Расход" value={snapshot.readings.flow} emphasis /><ReadingRow label="Температура" value={snapshot.readings.temperature} /><ReadingRow label="Давление" value={snapshot.readings.pressure} /></> : null}
          {zone === 'alarms' ? <><SignalBadge signal={snapshot.signal} /><ReadingRow label="Индикатор А" value={snapshot.readings.power} /><ReadingRow label="Индикатор Б" value={snapshot.readings.indicatorB} /></> : null}
          {snapshot.scenario === 'split' && <p className="microcopy">В сценарии расхождения сравниваются две условные величины: индикатор А {formatReading(snapshot.readings.power)} и индикатор Б {formatReading(snapshot.readings.indicatorB)}.</p>}
          {zone === 'systems' && snapshot.scenario === 'flow' && <ReadingComparison label="Сравнение расхода" title="Расход · сравнение" current={snapshot.readings.flow} baseline={baseline.readings.flow} note="Показано, насколько условный расход отличается от того же учебного контура без отклонения." />}
          {zone === 'alarms' && snapshot.scenario === 'split' && <ReadingComparison label="Сравнение индикаторов" title="Индикатор Б · сравнение с А" current={snapshot.readings.indicatorB} baseline={baseline.readings.indicatorB} note="При согласованных индикаторах ориентир Б совпадает с текущим показанием А." />}
          {zone === 'systems' && <><SystemsStatus snapshot={snapshot} /><ul className="system-detail-list" aria-label="Причины состояния учебных систем">{snapshot.systems.map((system) => <li key={system.id}><strong>{system.label}</strong><span>{system.detail}</span></li>)}</ul></>}
          <button className="secondary-button observe-button" type="button" disabled={!canDispatch({ type: 'OBSERVE', zone })} onClick={() => dispatch({ type: 'OBSERVE', zone })}>Записать наблюдение этой зоны</button>
          <p className="microcopy">Наблюдение сохраняет текущие показания в журнале и учитывается в учебном разборе.</p>
        </Panel>
      </div>
    </div>

    <div className="causal-strip" aria-label="Связь действий и показаний"><span>Учебная команда</span><b>→</b><span>Условная модель</span><b>→</b><span>Прибор и сигнал</span><b>→</b><span>Журнал</span></div>
  </div>
}
