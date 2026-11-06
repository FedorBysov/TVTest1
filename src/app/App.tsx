import { useEffect, useMemo, useReducer, useState } from 'react'
import { createSession, deriveSnapshot, reduceSession, type Profile, type ZoneId } from '../sim/model'
import { DISCLAIMER, NAV } from './content'
import { routeFromHash, routeHref, type Route } from './routing'
import { readStored, writeStored, type StorageLike } from './storage'
import { isSession } from './sessionValidation'
import { OverviewPage } from './pages/OverviewPage'
import { ConsolePage } from './pages/ConsolePage'
import { ScenariosPage } from './pages/ScenariosPage'
import { SessionPage } from './pages/SessionPage'
import { HelpPage } from './pages/HelpPage'

type Theme = 'light' | 'dark'

const blockedStorage: StorageLike = { getItem: () => null, setItem: () => { throw new Error('Storage unavailable') } }

function safeStorage(): StorageLike {
  try { return window.localStorage } catch { return blockedStorage }
}

const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark'
const isZone = (value: unknown): value is ZoneId => value === 'power' || value === 'systems' || value === 'alarms'

export function App() {
  const storage = useMemo(safeStorage, [])
  const [session, dispatch] = useReducer(reduceSession, undefined, () => readStored(storage, 'tvtest1.session.v1', createSession(), isSession))
  const [theme, setTheme] = useState<Theme>(() => readStored(storage, 'tvtest1.theme.v1', 'dark', isTheme))
  const [zone, setZone] = useState<ZoneId>(() => readStored(storage, 'tvtest1.zone.v1', 'power', isZone))
  const [route, setRoute] = useState<Route>(() => routeFromHash(window.location.hash))
  const [storageError, setStorageError] = useState(false)
  const snapshot = useMemo(() => deriveSnapshot(session), [session])

  useEffect(() => { setStorageError(!writeStored(storage, 'tvtest1.session.v1', session)) }, [storage, session])
  useEffect(() => { writeStored(storage, 'tvtest1.theme.v1', theme); document.documentElement.dataset.theme = theme }, [storage, theme])
  useEffect(() => { writeStored(storage, 'tvtest1.zone.v1', zone) }, [storage, zone])
  useEffect(() => {
    const update = () => setRoute(routeFromHash(window.location.hash))
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  useEffect(() => {
    if (session.paused) return
    const timer = window.setInterval(() => dispatch({ type: 'TICK', seconds: 1 }), 1000)
    return () => window.clearInterval(timer)
  }, [session.paused])

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
          <div className="profile-switch" role="group" aria-label="Учебный профиль" title="Смена профиля начинает занятие заново">
            {(['vver', 'smr'] as Profile[]).map((profile) => <button type="button" key={profile} aria-pressed={session.profile === profile} className={session.profile === profile ? 'is-active' : ''} onClick={() => dispatch({ type: 'PROFILE', profile })}>{profile === 'vver' ? 'ВВЭР' : 'СМР'}</button>)}
          </div>
          <button className="theme-toggle" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Включить ${theme === 'dark' ? 'светлую' : 'тёмную'} тему`}>{theme === 'dark' ? '☼' : '◐'}<span>{theme === 'dark' ? 'Светлая' : 'Тёмная'}</span></button>
          <div className={`topbar-signal topbar-signal-${snapshot.signal.kind}`} title={snapshot.signal.cause ?? 'Учебная модель в штатном состоянии'}><span aria-hidden="true">{signalIcon}</span><strong>{snapshot.signal.label}</strong></div>
        </div>
      </header>
      <div className="disclaimer"><span aria-hidden="true">◇</span>{DISCLAIMER}<span className="profile-reset-note">Смена профиля сбрасывает занятие</span></div>
      {storageError && <div className="storage-alert" role="alert">Сохранение занятия в браузере недоступно. Текущие действия работают, но после перезагрузки могут исчезнуть.</div>}
      <main className="main-content" id="main-content">
        {route === 'overview' && <OverviewPage snapshot={snapshot} profile={session.profile} selectedZone={zone} onZone={openZone} onSelectExpandedZone={setZone} onCommand={(value) => dispatch({ type: 'COMMAND', value })} onAcknowledge={() => dispatch({ type: 'ACK' })} onStage={(stage) => dispatch({ type: 'STAGE', stage })} onOpenScenarios={() => navigate('scenarios')} />}
        {route === 'console' && <ConsolePage snapshot={snapshot} profile={session.profile} zone={zone} onZone={setZone} dispatch={dispatch} onOverview={() => navigate('overview')} />}
        {route === 'scenarios' && <ScenariosPage state={session} snapshot={snapshot} dispatch={dispatch} onConsole={() => navigate('console')} />}
        {route === 'session' && <SessionPage state={session} snapshot={snapshot} dispatch={dispatch} />}
        {route === 'help' && <HelpPage />}
      </main>
      <footer className="app-footer"><span>TVTest1 / демонстрация интерфейса</span><span>{DISCLAIMER}</span></footer>
    </div>
  </div>
}
