import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ScenariosPage } from '../../src/app/pages/ScenariosPage'
import { createSession, deriveSnapshot, reduceSession } from '../../src/sim/model'

describe('scenario guidance', () => {
  it('offers the next stage after finishing the current stage, not the end of the whole lesson', () => {
    let state = createSession()
    state = reduceSession(state, { type: 'OBSERVE', zone: 'systems' })
    state = reduceSession(state, { type: 'OBSERVE', zone: 'power' })
    const html = renderToStaticMarkup(<ScenariosPage state={state} snapshot={deriveSnapshot(state)} baseline={deriveSnapshot({ ...state, deviation: 'idle' })} dispatch={() => {}} onConsole={() => {}} canDispatch={() => true} />)
    expect(html).toContain('Выбрать этап «Пуск»')
    expect(html).not.toContain('Контрольные действия выполнены')
  })

  it('keeps the final verification of a selected deviation visible after its signal clears', () => {
    let state = createSession()
    for (const action of [
      { type: 'SCENARIO', scenario: 'flow' }, { type: 'TRIGGER' },
      { type: 'OBSERVE', zone: 'systems' }, { type: 'ACK' }, { type: 'RESOLVE' },
    ] as const) state = reduceSession(state, action)
    const html = renderToStaticMarkup(<ScenariosPage state={state} snapshot={deriveSnapshot(state)} baseline={deriveSnapshot({ ...state, deviation: 'idle' })} dispatch={() => {}} onConsole={() => {}} canDispatch={() => true} />)
    const nextStep = html.match(/class="panel scenario-context"[\s\S]*?<strong>(.*?)<\/strong>/)?.[1]
    expect(nextStep).toBe('Повторно осмотреть состояние учебных систем')
  })
})
