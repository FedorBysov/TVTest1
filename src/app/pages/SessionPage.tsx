import { useState } from 'react'
import type { DisplaySnapshot, RoleId, SessionAction, SessionState } from '../../sim/model'
import { STAGES } from '../../sim/model'
import { assessSession } from '../../sim/assessment'
import type { GuestRole, GuestStatus, Participant } from '../group'
import { formatReading, formatTime, Panel, Readings, SectionTitle, SignalBadge } from '../components'

export interface GroupView {
  readonly kind: 'host' | 'guest'
  readonly code: string
  readonly role: RoleId
  readonly status: GuestStatus
  readonly participants: readonly Participant[]
}

interface SessionProps {
  state: SessionState
  snapshot: DisplaySnapshot
  dispatch: (action: SessionAction) => void
  group: GroupView | null
  groupError: string | null
  onCreateGroup: () => void
  onJoinGroup: (code: string, role: GuestRole) => void
  onLeaveGroup: () => void
  canDispatch: (action: SessionAction) => boolean
}

const roles: { id: RoleId; title: string; task: string; initials: string }[] = [
  { id: 'observer', title: 'Наблюдатель', task: 'Сопоставляет условные показания', initials: 'Н' },
  { id: 'operator', title: 'Оператор панели', task: 'Проверяет учебные органы управления', initials: 'О' },
  { id: 'instructor', title: 'Инструктор', task: 'Назначает шаг и ведёт разбор', initials: 'И' },
]

const eventName: Record<SessionAction['type'], string> = {
  PROFILE: 'Профиль', STAGE: 'Этап', SCENARIO: 'Маршрут', TICK: 'Ход времени', COMMAND: 'Команда',
  TRIGGER: 'Причина', ACK: 'Квитирование', RESOLVE: 'Устранение', PAUSE: 'Время', RESET: 'Сброс',
  HINT: 'Подсказка', MODE: 'Формат', ACTOR: 'Роль', ASSIGN: 'Назначение',
  OBSERVE: 'Наблюдение',
}

const taskStatus = { done: 'Выполнено', out_of_order: 'Нарушен порядок', missing: 'Не выполнено' } as const

function exportReview(state: SessionState) {
  const report = { kind: 'TVTest1-учебный-разбор', generatedAt: new Date().toISOString(), assessment: assessSession(state), journal: state.journal, trainingEvidence: state.trainingEvidence }
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `TVTest1-review-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function SessionPage({ state, snapshot, dispatch, group, groupError, onCreateGroup, onJoinGroup, onLeaveGroup, canDispatch }: SessionProps) {
  const [assignedRole, setAssignedRole] = useState<RoleId>('observer')
  const [joinCode, setJoinCode] = useState('')
  const [joinRole, setJoinRole] = useState<GuestRole>('operator')
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const events = state.journal.filter((event) => event.type !== 'TICK')
  const selectedEvent = selectedEventId === null ? null : events.find((event) => event.id === selectedEventId) ?? null
  const reviewSnapshot = selectedEvent?.snapshot ?? snapshot
  const visitedStages = new Set([0, ...[...state.journal, ...state.trainingEvidence].filter((event) => event.type === 'STAGE').map((event) => event.snapshot.stage)])
  const missing = STAGES.map((label, index) => ({ label, index })).filter(({ index }) => !visitedStages.has(index))
  const assessment = assessSession(state)

  return <div className="page session-page">
    <SectionTitle eyebrow="04 / Занятие и разбор" title="Проследите причину и результат">
      <span className="title-note">Локальный учебный прототип · результаты условные</span>
    </SectionTitle>
    <p className="page-lead">Журнал хранит до 500 последних событий и их снимки. Выбор записи показывает прошлое состояние для сравнения, не меняя текущее занятие; свидетельства контрольных шагов сохраняются отдельно.</p>

    <Panel className="mode-panel">
      <div className="panel-heading"><span className="panel-index">ФОРМАТ ЗАНЯТИЯ</span><span className="tiny-tag">{group ? 'СИНХРОНИЗАЦИЯ ВКЛАДОК' : 'ИНДИВИДУАЛЬНО'}</span></div>
      {!group ? <div className="group-entry">
        <div className="group-entry-intro"><strong>Индивидуальное занятие</strong><p>Для группы откройте этот сайт ещё в одной или двух вкладках того же браузерного профиля. Ведущий создаёт занятие и передаёт код участникам.</p><button className="primary-button" type="button" onClick={onCreateGroup}>Создать групповое занятие</button></div>
        <form className="group-join-form" onSubmit={(event) => { event.preventDefault(); onJoinGroup(joinCode, joinRole) }}>
          <strong>Подключиться к ведущему</strong><label>Код занятия<input aria-label="Код занятия" autoComplete="off" spellCheck={false} maxLength={8} value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="ABC234" required /></label>
          <label>Роль<select aria-label="Роль участника" value={joinRole} onChange={(event) => setJoinRole(event.target.value as GuestRole)}><option value="operator">Оператор панели</option><option value="observer">Наблюдатель</option></select></label>
          <button className="secondary-button" type="submit">Подключиться</button>
        </form>
      </div> : <div className="group-active">
        <div className="group-active-head"><div><span className="group-eyebrow">КОД ЗАНЯТИЯ</span><output aria-label="Код группового занятия" className="group-code">{group.code}</output><p>Передайте код второй и третьей вкладке этого же сайта.</p></div><div className="group-active-status"><strong>{group.status === 'connected' ? 'Подключено' : group.status === 'lost' ? 'Связь с ведущим потеряна' : 'Ожидание ведущего'}</strong><small>Ваша роль: {roles.find((role) => role.id === group.role)?.title}</small><button className="ghost-button" type="button" onClick={onLeaveGroup}>Завершить участие</button></div></div>
        {group.kind === 'host' ? <><div className="group-participants"><strong>Участники · {group.participants.length} / 3</strong><div className="role-grid">{group.participants.map((participant) => { const role = roles.find((entry) => entry.id === participant.role)!; return <div key={participant.id} className="role-card is-active"><span className="role-avatar">{role.initials}</span><span><strong>{role.title}</strong><small>{participant.id === group.participants[0]?.id ? 'Ведущая вкладка' : 'Подключённая вкладка'}</small></span></div> })}</div></div><div className="assignment-row"><div><strong>Назначить текущий учебный этап</strong><small>{snapshot.stageLabel}</small></div><select aria-label="Роль для назначения этапа" value={assignedRole} onChange={(event) => setAssignedRole(event.target.value as RoleId)}>{roles.map((role) => <option key={role.id} value={role.id}>{role.title}</option>)}</select><button className="secondary-button" type="button" disabled={!canDispatch({ type: 'ASSIGN', actor: assignedRole })} onClick={() => dispatch({ type: 'ASSIGN', actor: assignedRole })}>Назначить</button></div></> : <p className="group-guest-note">Ведущий управляет сценарием и учебным временем. Доступные действия зависят от вашей роли; наблюдатель может записывать наблюдения в журнал.</p>}
      </div>}
      {groupError && <p className="group-error" role="alert">{groupError}</p>}
      <p className="microcopy group-limit">Синхронизация работает между 2–3 вкладками одного origin. Для разных устройств или браузеров потребуется отдельный сервер.</p>
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
          <div className="summary-stat"><strong>{assessment.totals.done}<small>/ {assessment.totals.done + assessment.totals.out_of_order + assessment.totals.missing}</small></strong><span>контрольных действий выполнено по порядку</span></div>
          <p>Нарушен порядок: <strong>{assessment.totals.out_of_order}</strong>. Не выполнено: <strong>{assessment.totals.missing}</strong>.</p>
          <p>{missing.length ? `Пока не открыты: ${missing.map((item) => item.label.toLowerCase()).join(', ')}.` : 'Все пять учебных этапов были открыты.'}</p>
          <p>Подсказок использовано: <strong>{state.hints}</strong>. Текущая условная мощность: <strong>{formatReading(snapshot.readings.power)}%</strong>.</p>
          <button className="secondary-button review-export" type="button" onClick={() => exportReview(state)}>Скачать разбор JSON</button>
          <p className="microcopy">Это учебный разбор действий, не профессиональная оценка персонала.</p>
        </Panel>
      </div>
    </div>
    <Panel className="assessment-panel">
      <div className="panel-heading"><span className="panel-index">ПРОВЕРКА ПОСЛЕДОВАТЕЛЬНОСТИ</span><span className="tiny-tag">5 ЭТАПОВ · 2 ОТКЛОНЕНИЯ</span></div>
      <p className="microcopy">Статус каждого действия вычислен по сохранённым свидетельствам событий журнала. Вымышленные учебные шаги показывают порядок работы с интерфейсом, а не правила эксплуатации АЭС.</p>
      <div className="assessment-routes">
        {[...assessment.stages, ...assessment.deviations].map((route) => <details key={route.id} className={`assessment-route assessment-route-${route.status}`}>
          <summary><strong>{route.title}</strong><span>{taskStatus[route.status]}</span></summary>
          <ol>{route.tasks.map((task) => <li key={task.id} className={`assessment-task-${task.status}`}><strong>{task.title}</strong><span>{taskStatus[task.status]}</span><p>{task.reason}</p>{task.eventId !== undefined && <small>Событие занятия № {task.eventId}</small>}</li>)}</ol>
        </details>)}
      </div>
    </Panel>
  </div>
}
