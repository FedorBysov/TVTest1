import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ConsolePage } from '../../src/app/pages/ConsolePage'
import { ScenariosPage } from '../../src/app/pages/ScenariosPage'
import { formatReading } from '../../src/app/components'
import { createSession, deriveSnapshot, reduceSession, type Profile, type ScenarioId, type SessionState } from '../../src/sim/model'

function comparisonValues(html: string, label: string) {
  const root = document.createElement('div')
  root.innerHTML = html
  const comparison = [...root.querySelectorAll<HTMLDListElement>('dl[aria-label]')]
    .find((node) => node.getAttribute('aria-label') === label)
  expect(comparison, `Ожидалось сравнение «${label}»`).toBeDefined()
  return [...comparison!.querySelectorAll('dd')].map((node) => node.textContent?.trim())
}

function renderPages(state: SessionState, zone: 'systems' | 'alarms') {
  const snapshot = deriveSnapshot(state)
  const baseline = deriveSnapshot({ ...state, deviation: 'idle' })
  return {
    snapshot, baseline,
    scenarios: renderToStaticMarkup(<ScenariosPage state={state} snapshot={snapshot} baseline={baseline} dispatch={() => {}} onConsole={() => {}} canDispatch={() => true} />),
    console: renderToStaticMarkup(<ConsolePage snapshot={snapshot} baseline={baseline} profile={state.profile} zone={zone} onZone={() => {}} dispatch={() => {}} onOverview={() => {}} canDispatch={() => true} />),
  }
}

describe('учебный ориентир показаний', () => {
  it.each(['vver', 'smr'] as Profile[])('показывает расход до и после отклонения в профиле %s', (profile) => {
    let state = reduceSession(createSession(profile), { type: 'SCENARIO', scenario: 'flow' })
    state = reduceSession(state, { type: 'STAGE', stage: 3 })
    state = reduceSession(state, { type: 'PAUSE', paused: false })
    state = reduceSession(state, { type: 'TICK', seconds: 5 })
    const before = renderPages(state, 'systems')
    const expectedZero = [formatReading(before.snapshot.readings.flow), formatReading(before.baseline.readings.flow), '0,0']
    expect(comparisonValues(before.scenarios, 'Сравнение расхода')).toEqual(expectedZero)
    expect(comparisonValues(before.console, 'Сравнение расхода')).toEqual(expectedZero)

    state = reduceSession(state, { type: 'TRIGGER' })
    const after = renderPages(state, 'systems')
    const difference = after.snapshot.readings.flow - after.baseline.readings.flow
    expect(difference).toBeLessThan(0)
    const expected = [formatReading(after.snapshot.readings.flow), formatReading(after.baseline.readings.flow), `−${formatReading(Math.abs(difference))}`]
    expect(comparisonValues(after.scenarios, 'Сравнение расхода')).toEqual(expected)
    expect(comparisonValues(after.console, 'Сравнение расхода')).toEqual(expected)
    expect(after.scenarios).toContain('не является уставкой реального оборудования')
  })

  it.each(['vver', 'smr'] as Profile[])('сравнивает индикатор Б с ориентиром А в профиле %s', (profile) => {
    let state = reduceSession(createSession(profile), { type: 'SCENARIO', scenario: 'split' satisfies ScenarioId })
    state = reduceSession(state, { type: 'TRIGGER' })
    const { snapshot, baseline, scenarios, console } = renderPages(state, 'alarms')
    expect(baseline.readings.indicatorB).toBe(snapshot.readings.power)
    const difference = snapshot.readings.indicatorB - baseline.readings.indicatorB
    expect(difference).toBeGreaterThan(0)
    const expected = [formatReading(snapshot.readings.indicatorB), formatReading(baseline.readings.indicatorB), `+${formatReading(difference)}`]
    expect(comparisonValues(scenarios, 'Сравнение индикаторов')).toEqual(expected)
    expect(comparisonValues(console, 'Сравнение индикаторов')).toEqual(expected)
  })
})
