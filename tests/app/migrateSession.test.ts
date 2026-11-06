import { describe, expect, it } from 'vitest'
import { createSession, reduceSession } from '../../src/sim/model'
import { readSession } from '../../src/app/migrateSession'
import type { StorageLike } from '../../src/app/storage'

function store(values: Record<string, string>): StorageLike {
  return { getItem: (key) => values[key] ?? null, setItem: (key, value) => { values[key] = value } }
}

describe('session migration', () => {
  it('restores a previous v1 journal with upgraded system fields', () => {
    const current = reduceSession(createSession(), { type: 'STAGE', stage: 1 })
    const legacy = structuredClone(current) as unknown as { stageTimeAdvanced?: boolean; trainingEvidence?: unknown; journal: { snapshot: { systems: Record<string, unknown>[] } }[] }
    delete legacy.stageTimeAdvanced
    delete legacy.trainingEvidence
    for (const event of legacy.journal) {
      for (const system of event.snapshot.systems) { delete system.phase; delete system.detail }
    }
    const values = { 'tvtest1.session.v1': JSON.stringify(legacy) }
    const restored = readSession(store(values))
    expect(restored.stage).toBe(1)
    expect(restored.journal).toHaveLength(1)
    expect(restored.trainingEvidence).toHaveLength(1)
    expect(restored.stageTimeAdvanced).toBe(false)
    expect(restored.journal[0].snapshot.systems.every(system => typeof system.detail === 'string')).toBe(true)
    expect(legacy.journal[0].snapshot.systems[0].detail).toBeUndefined()
  })

  it('prefers a tab-local v3 lesson over an older shared v2 and rejects malformed data', () => {
    const v3 = reduceSession(createSession('smr'), { type: 'STAGE', stage: 2 })
    const v2 = reduceSession(createSession(), { type: 'STAGE', stage: 3 })
    expect(readSession(store({ 'tvtest1.session.v3': JSON.stringify(v3) }), store({ 'tvtest1.session.v2': JSON.stringify(v2) })).stage).toBe(2)
    expect(readSession(store({ 'tvtest1.session.v1': JSON.stringify({ journal: [] }) })).stage).toBe(0)
  })

  it('migrates a shared v2 lesson into one tab and preserves elapsed time inside the selected stage', () => {
    let old = reduceSession(createSession(), { type: 'STAGE', stage: 1 })
    old = reduceSession(old, { type: 'PAUSE', paused: false })
    old = reduceSession(old, { type: 'TICK', seconds: 5 })
    const saved = structuredClone(old) as unknown as { stageTimeAdvanced?: boolean; trainingEvidence?: unknown }
    delete saved.stageTimeAdvanced
    delete saved.trainingEvidence
    const tabValues: Record<string, string> = {}
    const sharedValues: Record<string, string> = { 'tvtest1.session.v2': JSON.stringify(saved) }
    const restored = readSession(store(tabValues), store(sharedValues))
    expect(restored.stage).toBe(1)
    expect(restored.time).toBe(5)
    expect(restored.stageTimeAdvanced).toBe(true)
    expect(restored.trainingEvidence.length).toBeGreaterThan(0)
    expect(tabValues['tvtest1.session.v3']).toBeDefined()
    expect(sharedValues['tvtest1.session.imported.v3']).toBe('1')
    expect(readSession(store({}), store(sharedValues)).stage).toBe(0)
  })

  it('rejects an invalid evidence field rather than silently replacing it', () => {
    const current = { ...createSession('smr'), trainingEvidence: 'forged' }
    expect(readSession(store({ 'tvtest1.session.v3': JSON.stringify(current) })).profile).toBe('vver')
  })
})
