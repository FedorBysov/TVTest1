import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { deriveSnapshot, reduceSession, type Profile, type SessionAction, type SessionState, type ZoneId } from '../sim/model'
import { DISCLAIMER, NAV } from './content'
import { routeFromHash, routeHref, type Route } from './routing'
import { readStored, writeStored, type StorageLike } from './storage'
import { readSession } from './migrateSession'
import { canGroupDispatch, createGroupHost, joinGroup, type GroupGuest, type GroupHost, type GuestRole } from './group'
import { OverviewPage } from './pages/OverviewPage'
import { ConsolePage } from './pages/ConsolePage'
import { ScenariosPage } from './pages/ScenariosPage'
import { SessionPage, type GroupView } from './pages/SessionPage'
import { HelpPage } from './pages/HelpPage'

type Theme = 'light' | 'dark'

const blockedStorage: StorageLike = { getItem: () => null, setItem: () => { throw new Error('Storage unavailable') } }

function safeLocalStorage(): StorageLike {
  try { return window.localStorage } catch { return blockedStorage }
}

function safeSessionStorage(): StorageLike {
  try { return window.sessionStorage } catch { return blockedStorage }
}

const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark'
const isZone = (value: unknown): value is ZoneId => value === 'power' || value === 'systems' || value === 'alarms'

export function App() {
  const storage = useMemo(safeLocalStorage, [])
  const sessionStorage = useMemo(safeSessionStorage, [])
  const [localSession, dispatchLocal] = useReducer(reduceSession, undefined, () => {
    const saved = readSession(sessionStorage, storage)
    return saved.mode === 'group' ? { ...saved, mode: 'solo' as const, actor: 'operator' as const } : saved
  })
  const roomRef = useRef<{ kind: 'host'; connection: GroupHost } | { kind: 'guest'; connection: GroupGuest } | null>(null)
  const [groupSession, setGroupSession] = useState<SessionState | null>(null)
  const [group, setGroup] = useState<GroupView | null>(null)
  const [groupError, setGroupError] = useState<string | null>(null)
  const [theme, setTheme] = useState<Theme>(() => readStored(storage, 'tvtest1.theme.v1', 'dark', isTheme))
  const [zone, setZone] = useState<ZoneId>(() => readStored(storage, 'tvtest1.zone.v1', 'power', isZone))
  const [route, setRoute] = useState<Route>(() => routeFromHash(window.location.hash))
  const previousRoute = useRef(route)
  const [storageError, setStorageError] = useState(false)
  const session = groupSession ?? localSession
  const snapshot = useMemo(() => deriveSnapshot(session), [session])
  const baseline = useMemo(() => deriveSnapshot({ ...session, deviation: 'idle' }), [session])

  useEffect(() => { setStorageError(!writeStored(sessionStorage, 'tvtest1.session.v3', localSession)) }, [sessionStorage, localSession])
  useEffect(() => { writeStored(storage, 'tvtest1.theme.v1', theme); document.documentElement.dataset.theme = theme }, [storage, theme])
  useEffect(() => { writeStored(storage, 'tvtest1.zone.v1', zone) }, [storage, zone])
  useEffect(() => {
    const update = () => setRoute(routeFromHash(window.location.hash))
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  useEffect(() => {
    if (previousRoute.current === route) return
    previousRoute.current = route
    window.scrollTo(0, 0)
  }, [route])
  useEffect(() => {
    if (session.paused || group?.kind === 'guest') return
    const timer = window.setInterval(() => {
      const room = roomRef.current
      if (room?.kind === 'host') room.connection.dispatch({ type: 'TICK', seconds: 1 })
      else if (!room) dispatchLocal({ type: 'TICK', seconds: 1 })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [session.paused, group?.kind])
  useEffect(() => () => roomRef.current?.connection.close(), [])

  const dispatch = (action: SessionAction) => {
    const room = roomRef.current
    if (room) room.connection.dispatch(action)
    else dispatchLocal(action)
  }
  const canDispatch = (action: SessionAction) => {
    if (!group) return true
    if (group.kind === 'guest' && group.status !== 'connected') return false
    return canGroupDispatch(group.role, action)
  }
  const createRoom = () => {
    if (roomRef.current) return
    try {
      const host = createGroupHost({
        initialState: localSession,
        reducer: reduceSession,
        onChange: (next) => setGroupSession(next),
        onParticipants: (participants) => setGroup((current) => current?.kind === 'host' ? { ...current, participants } : current),
      })
      roomRef.current = { kind: 'host', connection: host }
      setGroupSession(host.state)
      setGroup({ kind: 'host', code: host.code, role: 'instructor', status: 'connected', participants: host.participants })
      setGroupError(null)
    } catch (error) { setGroupError(error instanceof Error ? error.message : 'Не удалось создать групповое занятие.') }
  }
  const joinRoom = (code: string, role: GuestRole) => {
    if (roomRef.current) return
    setGroupError(null)
    try {
      const guest = joinGroup({
        code, role,
        onChange: (next) => setGroupSession(next),
        onStatus: (status) => setGroup((current) => current?.kind === 'guest' ? { ...current, status } : current),
        onRejected: (reason) => setGroupError(reason === 'room-full' ? 'В занятии уже два участника.' : 'Подключение отклонено ведущим.'),
      })
      roomRef.current = { kind: 'guest', connection: guest }
      if (guest.state) setGroupSession(guest.state)
      setGroup({ kind: 'guest', code: guest.code, role, status: guest.status, participants: [] })
    } catch (error) { setGroupError(error instanceof Error ? error.message : 'Не удалось подключиться к занятию.') }
  }
  const leaveRoom = () => {
    roomRef.current?.connection.close()
    roomRef.current = null
    setGroup(null)
    setGroupSession(null)
    setGroupError(null)
  }

  const navigate = (next: Route) => { window.location.hash = routeHref(next); setRoute(next) }
  const openZone = (next: ZoneId) => { setZone(next); navigate('console') }
  const signalIcon = snapshot.signal.kind === 'alarm' ? '⬣' : snapshot.signal.kind === 'warning' ? '▲' : '●'

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href={routeHref('overview')} aria-label="TVTest1 — к обзору">
        <span className="brand-mark"><i /><i /><i /></span><span><strong>TV<span>TEST</span>1</strong><small>УЧЕБНЫЙ БЩУ / 01</small></span>
      </a>
      <div className="sidebar-group"><span className="sidebar-label">РАЗДЕЛЫ ТРЕНАЖЁРА</span><nav aria-label="Основная навигация">
        {NAV.map((item) => <a key={item.route} href={routeHref(item.route)} aria-current={route === item.route ? 'page' : undefined} className={`nav-link${route === item.route ? ' is-active' : ''}`}><span className="nav-number">{item.number}</span><span><strong>{item.label}</strong><small>{item.hint}</small></span><span className="nav-arrow" aria-hidden="true">↗</span></a>)}
      </nav></div>
      <div className="sidebar-bottom"><div className="sidebar-status"><span>ТЕКУЩИЙ ПРОФИЛЬ</span><strong>{session.profile === 'vver' ? 'ВВЭР' : 'СМР'}</strong><small>{session.profile === 'vver' ? 'Сегментированный пост' : 'Компактный модульный пост'}</small></div><p>Данные и компоновка — вымышленные учебные варианты.</p></div>
    </aside>

    <div className="shell-main">
      <header className="topbar">
        <div className="topbar-context"><span className="topbar-overline">TVTEST1 / ИНТЕРАКТИВНЫЙ ТРЕНАЖЁР</span><strong>{NAV.find((item) => item.route === route)?.label}</strong></div>
        <div className="topbar-tools">
          <div className="topbar-stage" title={`Текущий учебный этап: ${snapshot.stageLabel}`}><span>ЭТАП {String(snapshot.stage + 1).padStart(2, '0')} / 05</span><strong>{snapshot.stageLabel}</strong></div>
          <div className="profile-switch" role="group" aria-label="Учебный профиль" title="Смена профиля начинает занятие заново">
            {(['vver', 'smr'] as Profile[]).map((profile) => <button type="button" key={profile} aria-pressed={session.profile === profile} className={session.profile === profile ? 'is-active' : ''} disabled={!canDispatch({ type: 'PROFILE', profile })} onClick={() => dispatch({ type: 'PROFILE', profile })}>{profile === 'vver' ? 'ВВЭР' : 'СМР'}</button>)}
          </div>
          <button className="theme-toggle" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Включить ${theme === 'dark' ? 'светлую' : 'тёмную'} тему`}>{theme === 'dark' ? '☼' : '◐'}<span>{theme === 'dark' ? 'Светлая' : 'Тёмная'}</span></button>
          <div className={`topbar-signal topbar-signal-${snapshot.signal.kind}`} title={snapshot.signal.cause ?? 'Учебная модель в штатном состоянии'}><span aria-hidden="true">{signalIcon}</span><strong>{snapshot.signal.label}</strong></div>
        </div>
      </header>
      <div className="disclaimer"><span aria-hidden="true">◇</span>{DISCLAIMER}<span className="profile-reset-note">Смена профиля сбрасывает занятие</span></div>
      {storageError && <div className="storage-alert" role="alert">Сохранение занятия в браузере недоступно. Текущие действия работают, но после перезагрузки могут исчезнуть.</div>}
      {group?.kind === 'guest' && group.status !== 'connected' && <div className="group-alert" role="status">{group.status === 'lost' ? 'Связь с ведущим потеряна. Действия заблокированы; попытка переподключения продолжается.' : 'Подключаемся к ведущему. До получения общего снимка показано ваше локальное занятие.'}</div>}
      <main className="main-content" id="main-content">
        {route === 'overview' && <OverviewPage snapshot={snapshot} profile={session.profile} selectedZone={zone} onZone={openZone} onSelectExpandedZone={setZone} onCommand={(value) => dispatch({ type: 'COMMAND', value })} onAcknowledge={() => dispatch({ type: 'ACK' })} onStage={(stage) => dispatch({ type: 'STAGE', stage })} onOpenScenarios={() => navigate('scenarios')} canDispatch={canDispatch} />}
        {route === 'console' && <ConsolePage snapshot={snapshot} baseline={baseline} profile={session.profile} zone={zone} onZone={setZone} dispatch={dispatch} onOverview={() => navigate('overview')} canDispatch={canDispatch} />}
        {route === 'scenarios' && <ScenariosPage state={session} snapshot={snapshot} baseline={baseline} dispatch={dispatch} onConsole={() => navigate('console')} canDispatch={canDispatch} />}
        {route === 'session' && <SessionPage state={session} snapshot={snapshot} dispatch={dispatch} group={group} groupError={groupError} onCreateGroup={createRoom} onJoinGroup={joinRoom} onLeaveGroup={leaveRoom} canDispatch={canDispatch} />}
        {route === 'help' && <HelpPage />}
      </main>
      <footer className="app-footer"><span>TVTest1 / демонстрация интерфейса</span><span>{DISCLAIMER}</span></footer>
    </div>
  </div>
}
