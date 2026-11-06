import { describe, expect, it } from 'vitest'
import { createSession, reduceSession } from '../../src/sim/model'
import { isSession } from '../../src/app/sessionValidation'

describe('saved session validation', () => {
  it('accepts a complete session with historical snapshots', () => {
    const session = reduceSession(createSession(), { type: 'COMMAND', value: 50 })
    expect(isSession(JSON.parse(JSON.stringify(session)))).toBe(true)
  })

  it('rejects incomplete readings and systems in a historical snapshot', () => {
    const session = reduceSession(createSession(), { type: 'COMMAND', value: 50 })
    const brokenReadings = JSON.parse(JSON.stringify(session))
    brokenReadings.journal[0].snapshot.readings = {}
    expect(isSession(brokenReadings)).toBe(false)
    const brokenSystems = JSON.parse(JSON.stringify(session))
    delete brokenSystems.journal[0].snapshot.systems
    expect(isSession(brokenSystems)).toBe(false)
  })

  it('rejects malformed event metadata and assignments', () => {
    const session = reduceSession(createSession(), { type: 'COMMAND', value: 50 })
    const brokenEvent = JSON.parse(JSON.stringify(session))
    brokenEvent.journal[0].id = 'one'
    expect(isSession(brokenEvent)).toBe(false)
    const brokenAssignment = JSON.parse(JSON.stringify(session))
    brokenAssignment.assignments['3'] = 'unknown'
    expect(isSession(brokenAssignment)).toBe(false)
  })
})
