import { useEffect, useRef, useState } from 'react'
import { STAGES, type DisplaySnapshot, type Profile, type SessionAction, type StageId, type ZoneId } from '../../sim/model'
import { ControlRoom } from '../../scene/ControlRoom'
import { ZONES } from '../content'
import { formatTime, Panel, Readings, SectionTitle, SignalBadge, StageStrip } from '../components'

interface OverviewProps {
  snapshot: DisplaySnapshot
  profile: Profile
  selectedZone: ZoneId
  onZone: (zone: ZoneId) => void
  onSelectExpandedZone: (zone: ZoneId) => void
  onCommand: (value: number) => void
  onAcknowledge: () => void
  onStage: (stage: StageId) => void
  onOpenScenarios: () => void
  canDispatch: (action: SessionAction) => boolean
}

export function OverviewPage({ snapshot, profile, selectedZone, onZone, onSelectExpandedZone, onCommand, onAcknowledge, onStage, onOpenScenarios, canDispatch }: OverviewProps) {
  const mediaBase = `${import.meta.env.BASE_URL}media/`
  const [expanded, setExpanded] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const expandButtonRef = useRef<HTMLButtonElement>(null)
  const viewOnly = !canDispatch({ type: 'STAGE', stage: snapshot.stage })
  const closeWorkbench = () => {
    setExpanded(false)
    window.requestAnimationFrame(() => expandButtonRef.current?.focus())
  }
  useEffect(() => {
    const dialog = dialogRef.current
    if (!expanded || !dialog) return
    const onCancel = (event: Event) => { event.preventDefault(); closeWorkbench() }
    dialog.addEventListener('cancel', onCancel)
    dialog.showModal()
    return () => { dialog.removeEventListener('cancel', onCancel); if (dialog.open) dialog.close() }
  }, [expanded])

  return <div className="page overview-page">
    <SectionTitle eyebrow="01 / Пространство щита" title="Учебный операторский пост">
      <span className="title-note">Собирательная 3D-модель · фиксированный ракурс</span>
    </SectionTitle>
    <p className="page-lead">Осмотрите три физические зоны поста. Разверните стол для работы с рукоятками, тумблерами и кнопками прямо на 3D-модели; в обычном обзоре выбор сектора открывает приборный модуль.</p>

    <div className="overview-grid">
      <Panel className="scene-panel">
        <div className="panel-heading"><span className="panel-index">FIG 01 / ОБЩИЙ ВИД</span><div className="scene-heading-actions"><span className="panel-hint">Секции и органы управления интерактивны</span><button ref={expandButtonRef} className="scene-expand-button" type="button" onClick={() => setExpanded(true)}>⤢ Развернуть стол</button></div></div>
        <div className={`scene-viewport${viewOnly ? ' scene-readonly' : ''}`}>
          {!expanded && <ControlRoom snapshot={snapshot} profile={profile} selectedZone={selectedZone} onSelectZone={onZone} onCommand={onCommand} onAcknowledge={onAcknowledge} onStage={onStage} />}
        </div>
        <div className="scene-caption"><span>Вымышленная компоновка {profile === 'vver' ? 'ВВЭР · сегментированная' : 'СМР · модульная'}</span><span>01 — 03 / зоны поста</span></div>
      </Panel>

      <div className="overview-side">
        <Panel className="status-panel">
          <div className="panel-heading"><span className="panel-index">СОСТОЯНИЕ ЗАНЯТИЯ</span><span className="live-dot">● ДЕМО</span></div>
          <SignalBadge signal={snapshot.signal} />
          <p className="mini-heading">Текущий этап</p>
          <strong className="current-stage">{snapshot.stageLabel}</strong>
          <StageStrip stage={snapshot.stage} compact />
          <button className="text-link" type="button" onClick={onOpenScenarios}>Перейти к сценарию <span aria-hidden="true">↗</span></button>
        </Panel>
        <Panel className="measure-panel">
          <div className="panel-heading"><span className="panel-index">УСЛОВНЫЕ ПОКАЗАНИЯ</span><span className="tiny-tag">0–100</span></div>
          <Readings snapshot={snapshot} />
          <p className="microcopy">Показания синхронизированы с прибором, сигналом и журналом. Единицы учебные, не эксплуатационные.</p>
        </Panel>
      </div>
    </div>

    <div className="zone-grid" aria-label="Зоны учебного поста">
      {(Object.keys(ZONES) as ZoneId[]).map((zone) => <button key={zone} type="button" className={`zone-card${zone === selectedZone ? ' is-selected' : ''}`} onClick={() => onZone(zone)}>
        <span className="zone-card-top"><span>{ZONES[zone].number} / ЗОНА</span><span aria-hidden="true">↗</span></span>
        <strong>{ZONES[zone].title}</strong><small>{ZONES[zone].short}</small>
      </button>)}
    </div>

    <Panel className="demo-panel">
      <div className="panel-heading"><span className="panel-index">FIG 03 / ВИДЕООБЗОР</span><span className="tiny-tag">С ОЗВУЧКОЙ И СУБТИТРАМИ</span></div>
      <div className="demo-grid">
        <video className="demo-video" controls playsInline preload="metadata" poster={`${mediaBase}tvtest1-demo-poster.jpg`} aria-label="Видеообзор возможностей TVTest1 на русском языке">
          <source src={`${mediaBase}tvtest1-demo.mp4`} type="video/mp4" />
          <track kind="captions" src={`${mediaBase}tvtest1-demo.ru.vtt`} srcLang="ru" label="Русский" default />
          Ваш браузер не поддерживает встроенное видео. <a href={`${mediaBase}tvtest1-demo.mp4`}>Открыть ролик</a>.
        </video>
        <div className="demo-description">
          <span className="eyebrow">КАК РАБОТАЕТ TVTEST1</span>
          <h2>От общего вида до разбора действий</h2>
          <p>Короткая демонстрация показывает, как осмотреть и развернуть 3D-щит, работать с условными органами управления, ввести учебное отклонение и проверить результат в журнале.</p>
          <p className="demo-disclaimer">Компоновка, показания и сценарии вымышлены для прототипа.</p>
        </div>
      </div>
    </Panel>

    {expanded && <dialog ref={dialogRef} className="workbench-dialog" aria-label="Расширенный учебный стол">
      <div className="workbench-shell">
        <div className="workbench-header">
          <div><span className="panel-index">FIG 01 / РАСШИРЕННЫЙ ВИД</span><h2>Учебный стол · {profile === 'vver' ? 'ВВЭР' : 'СМР'}</h2></div>
          <div className="workbench-header-actions"><span className={`workbench-signal workbench-signal-${snapshot.signal.kind}`}>{snapshot.signal.kind === 'alarm' ? '⬣' : snapshot.signal.kind === 'warning' ? '▲' : '●'} {snapshot.signal.label}</span><button className="ghost-button" type="button" onClick={closeWorkbench}>Свернуть ×</button></div>
        </div>
        <div className={`workbench-viewport${viewOnly ? ' scene-readonly' : ''}`}><ControlRoom snapshot={snapshot} profile={profile} selectedZone={selectedZone} onSelectZone={onSelectExpandedZone} onCommand={onCommand} onAcknowledge={onAcknowledge} onStage={onStage} expanded />{viewOnly && <span className="workbench-readonly-note">Роль просмотра · управление на 3D-столе недоступно</span>}</div>
        <div className="workbench-controls">
          <div className="workbench-control-group workbench-zone-group"><span className="workbench-label">ЗОНА ЩИТА</span><div>{(Object.keys(ZONES) as ZoneId[]).map((zone) => <button key={zone} type="button" className={zone === selectedZone ? 'is-active' : ''} aria-pressed={zone === selectedZone} onClick={() => onSelectExpandedZone(zone)}>{ZONES[zone].number} {ZONES[zone].title}</button>)}</div></div>
          <div className="workbench-control-group workbench-stage-group"><span className="workbench-label">ЭТАП · ПЯТЬ ТУМБЛЕРОВ НА СТОЛЕ</span><div>{STAGES.map((label, index) => <button key={index} type="button" className={index === snapshot.stage ? 'is-active' : ''} aria-label={`Этап ${index + 1}: ${label}`} aria-pressed={index === snapshot.stage} disabled={!canDispatch({ type: 'STAGE', stage: index as StageId })} onClick={() => onStage(index as StageId)}>{String(index + 1).padStart(2, '0')}</button>)}</div></div>
          <div className="workbench-control-group workbench-command-group"><span className="workbench-label">УЧЕБНАЯ КОМАНДА · РУКОЯТКА</span><div>{[0, 25, 50, 75, 100].map((value) => <button key={value} type="button" className={snapshot.command === value ? 'is-active' : ''} aria-pressed={snapshot.command === value} disabled={!canDispatch({ type: 'COMMAND', value })} onClick={() => onCommand(value)}>{value}</button>)}</div></div>
          <div className="workbench-control-group workbench-action-group"><span className="workbench-label">СИГНАЛ · {formatTime(snapshot.time)}</span><button className="primary-button" type="button" disabled={!canDispatch({ type: 'ACK' }) || snapshot.signal.kind === 'normal' || snapshot.signal.acknowledged} onClick={onAcknowledge}>Квитировать</button></div>
        </div>
        <div className="workbench-footer"><span>Мышью: рукоятка — шаг +25 (Shift — −25); тумблеры — этап; кнопка — квитирование.</span><button className="text-link" type="button" onClick={() => onZone(selectedZone)}>Открыть прибор выбранной зоны ↗</button><span>Учебный прототип · условные данные</span></div>
      </div>
    </dialog>}
  </div>
}
