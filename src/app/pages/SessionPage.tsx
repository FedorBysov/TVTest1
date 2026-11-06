import { useState } from 'react'
import type { DisplaySnapshot, RoleId, SessionAction, SessionState } from '../../sim/model'
import { STAGES } from '../../sim/model'
import { formatReading, formatTime, Panel, Readings, SectionTitle, SignalBadge } from '../components'

interface SessionProps { state: SessionState; snapshot: DisplaySnapshot; dispatch: (action: SessionAction) => void }

const roles: { id: RoleId; title: string; task: string; initials: string }[] = [
  { id: 'observer', title: 'Наблюдатель', task: 'Сопоставляет условные показания', initials: 'Н' },
  { id: 'operator', title: 'Оператор панели', task: 'Проверяет учебные органы управления', initials: 'О' },
  { id: 'instructor', title: 'Инструктор', task: 'Назначает шаг и ведёт разбор', initials: 'И' },
]

const eventName: Record<SessionAction['type'], string> = {
  PROFILE: 'Профиль', STAGE: 'Этап', SCENARIO: 'Маршрут', TICK: 'Ход времени', COMMAND: 'Команда',
  TRIGGER: 'Причина', ACK: 'Квитирование', RESOLVE: 'Устранение', PAUSE: 'Время', RESET: 'Сброс',
  HINT: 'Подсказка', MODE: 'Формат', ACTOR: 'Роль', ASSIGN: 'Назначение',
}

export function SessionPage({ state, snapshot, dispatch }: SessionProps) {
  const [assignedRole, setAssignedRole] = useState<RoleId>('observer')
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const events = state.journal.filter((event) => event.type !== 'TICK')
  const selectedEvent = selectedEventId === null ? null : events.find((event) => event.id === selectedEventId) ?? null
  const reviewSnapshot = selectedEvent?.snapshot ?? snapshot
  const visitedStages = new Set([0, ...state.journal.filter((event) => event.type === 'STAGE').map((event) => event.snapshot.stage)])
  const missing = STAGES.map((label, index) => ({ label, index })).filter(({ index }) => !visitedStages.has(index))

  return <div className="page session-page">
    <SectionTitle eyebrow="04 / Занятие и разбор" title="Проследите причину и результат">
      <span className="title-note">Один браузер · локальная учебная имитация</span>
    </SectionTitle>
    <p className="page-lead">Журнал хранит снимок каждого действия. Выбор записи показывает прошлое состояние для сравнения, не меняя текущее занятие.</p>

    <Panel className="mode-panel">
      <div className="panel-heading"><span className="panel-index">ФОРМАТ ЗАНЯТИЯ</span><span className="tiny-tag">УЧЕБНЫЙ МАКЕТ</span></div>
      <div className="mode-row"><div className="segmented" role="group" aria-label="Формат занятия">
        <button type="button" aria-pressed={state.mode === 'solo'} className={state.mode === 'solo' ? 'is-active' : ''} onClick={() => dispatch({ type: 'MODE', mode: 'solo' })}>Индивидуально</button>
        <button type="button" aria-pressed={state.mode === 'group'} className={state.mode === 'group' ? 'is-active' : ''} onClick={() => dispatch({ type: 'MODE', mode: 'group' })}>Учебная группа</button>
      </div><p>Три роли имитируются локально. Синхронизации устройств и многопользовательского сервера нет.</p></div>
      {state.mode === 'group' && <><div className="role-grid">
        {roles.map((role) => <button type="button" key={role.id} className={`role-card${state.actor === role.id ? ' is-active' : ''}`} aria-pressed={state.actor === role.id} onClick={() => dispatch({ type: 'ACTOR', actor: role.id })}>
          <span className="role-avatar">{role.initials}</span><span><strong>{role.title}</strong><small>{role.task}</small></span><i>{state.actor === role.id ? 'Активна' : 'Выбрать'}</i>
        </button>)}
      </div><div className="assignment-row"><div><strong>Назначить текущий учебный этап</strong><small>{snapshot.stageLabel}</small></div><select aria-label="Роль для назначения этапа" value={assignedRole} onChange={(event) => setAssignedRole(event.target.value as RoleId)}>{roles.map((role) => <option key={role.id} value={role.id}>{role.title}</option>)}</select><button className="secondary-button" type="button" disabled={state.actor !== 'instructor'} onClick={() => dispatch({ type: 'ASSIGN', actor: assignedRole })}>Назначить</button></div>
      {state.actor !== 'instructor' && <p className="microcopy">Назначение доступно роли инструктора. Выберите её в группе выше.</p>}</>}
    </Panel>

    <div className="review-grid">
      <Panel className="timeline-panel">
        <div className="panel-heading"><span className="panel-index">ХРОНОЛОГИЯ ДЕЙСТВИЙ</span><span className="tiny-tag">{events.length} СОБЫТИЙ</span></div>
        {events.length === 0 ? <div className="empty-state"><strong>Журнал пока пуст</strong><p>Выберите этап, измените учебную команду или запустите сценарий. Здесь появятся действия и снимки.</p></div> : <ol className="event-list">
          {events.map((event) => <li key={event.id}><button type="button" className={`event-item${selectedEventId === event.id ? ' is-active' : ''}`} onClick={() => setSelectedEventId(event.id)} aria-pressed={selectedEventId === event.id}>
            <span className="event-rail" aria-hidden="true" /><span className="event-time">{formatTime(event.time)}</span><span className="event-body"><strong>{eventName[event.type]}</strong><small>{event.message}</small><em>{event.actor === 'model' ? 'Модель' : event.actor === 'student' ? 'Учащийся' : roles.find((role) => role.id === event.actor)?.title}</em></span><span aria-hidden="true">↗</span>
          </button></li>)}
        </ol>}
      </Panel>
      <div className="review-side">
        <Panel className="snapshot-panel">
          <div className="panel-heading"><span className="panel-index">{selectedEvent ? `СНИМОК СОБЫТИЯ ${String(selectedEvent.id).padStart(2, '0')}` : 'ТЕКУЩИЙ СНИМОК'}</span><span className="tiny-tag">{formatTime(reviewSnapshot.time)}</span></div>
          <SignalBadge signal={reviewSnapshot.signal} />
          <Readings snapshot={reviewSnapshot} compact />
          {selectedEvent && <button className="text-link" type="button" onClick={() => setSelectedEventId(null)}>Вернуться к текущему состоянию ↗</button>}
        </Panel>
        <Panel className="summary-panel">
          <div className="panel-heading"><span className="panel-index">ДЕМОНСТРАЦИОННЫЙ ИТОГ</span></div>
          <div className="summary-stat"><strong>{visitedStages.size}<small>/ 5</small></strong><span>этапов показано</span></div>
          <p>{missing.length ? `Пока не открыты: ${missing.map((item) => item.label.toLowerCase()).join(', ')}.` : 'Все пять учебных этапов были открыты.'}</p>
          <p>Подсказок использовано: <strong>{state.hints}</strong>. Текущая условная мощность: <strong>{formatReading(snapshot.readings.power)}%</strong>.</p>
          <p className="microcopy">Это учебный разбор действий, не профессиональная оценка персонала.</p>
        </Panel>
      </div>
    </div>
  </div>
}
