import { createSession, type JournalEvent, type SessionState } from '../sim/model'
import { compactTrainingEvidence } from '../sim/assessment'
import { isSession } from './sessionValidation'
import type { StorageLike } from './storage'

const currentKey = 'tvtest1.session.v3'
const previousKey = 'tvtest1.session.v2'
const legacyKey = 'tvtest1.session.v1'
const importMarker = 'tvtest1.session.imported.v3'

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function upgradeSnapshot(value: unknown): unknown {
  if (!object(value) || !Array.isArray(value.systems) || !object(value.readings)) return value
  const power = value.readings.power
  const systems = value.systems.map((entry) => {
    if (!object(entry)) return entry
    if (entry.phase !== undefined || entry.detail !== undefined) return entry
    if (entry.id === 'power') {
      const moving = typeof power === 'number' && typeof value.command === 'number' && Math.abs(power - value.command) > 12
      return { ...entry, phase: moving ? 'transition' : 'steady', detail: moving ? 'Показание следует за учебной командой' : 'Показание согласовано с учебной целью' }
    }
    if (entry.id === 'flow') return { ...entry, phase: entry.status === 'warning' ? 'degraded' : 'steady', detail: entry.status === 'warning' ? 'Расход условного контура снижен' : 'Расход условного контура в норме' }
    if (entry.id === 'indicators') return { ...entry, phase: entry.status === 'alarm' ? 'discrepant' : 'steady', detail: entry.status === 'alarm' ? 'Учебные индикаторы расходятся' : 'Учебные индикаторы согласованы' }
    return entry
  })
  return { ...value, systems }
}

function upgradeSession(value: unknown): unknown {
  if (!object(value) || !Array.isArray(value.journal) || value.journal.length > 500) return value
  const journal = value.journal.map((entry) => object(entry) ? { ...entry, snapshot: upgradeSnapshot(entry.snapshot) } : entry)
  const trainingEvidence = value.trainingEvidence === undefined
    ? compactTrainingEvidence(journal as JournalEvent[])
    : Array.isArray(value.trainingEvidence)
      ? value.trainingEvidence.map((entry) => object(entry) ? { ...entry, snapshot: upgradeSnapshot(entry.snapshot) } : entry)
      : value.trainingEvidence
  const stageTimeAdvanced = value.stageTimeAdvanced === undefined
    ? inferStageTimeAdvanced(value, journal)
    : value.stageTimeAdvanced
  return { ...value, journal, trainingEvidence, stageTimeAdvanced }
}

function inferStageTimeAdvanced(value: Record<string, unknown>, journal: unknown[]): boolean {
  if (typeof value.time !== 'number' || !Number.isFinite(value.time)) return false
  const lastStage = [...journal].reverse().find((entry) => object(entry) && entry.type === 'STAGE')
  if (object(lastStage) && typeof lastStage.time === 'number') return value.time > lastStage.time
  return value.stage === 0 && value.time > 0
}

/** Restore this tab first, then import a previous shared v2/v1 lesson once. */
export function readSession(storage: StorageLike, legacyStorage: StorageLike = storage): SessionState {
  try {
    const raw = storage.getItem(currentKey)
    if (raw !== null) {
      const current = upgradeSession(JSON.parse(raw) as unknown)
      if (isSession(current)) return current
    }
  } catch {
    // A broken tab-local record does not prevent trying a previous version.
  }
  try { if (legacyStorage.getItem(importMarker) === '1') return createSession() } catch { /* continue */ }
  for (const key of [previousKey, legacyKey]) {
    try {
      const raw = legacyStorage.getItem(key)
      if (raw === null) continue
      const upgraded = upgradeSession(JSON.parse(raw) as unknown)
      if (isSession(upgraded)) {
        try {
          storage.setItem(currentKey, JSON.stringify(upgraded))
          legacyStorage.setItem(importMarker, '1')
        } catch {
          // A failed save leaves the original record available next time.
        }
        return upgraded
      }
    } catch {
      // Corrupt or inaccessible storage must not stop a fresh lesson.
    }
  }
  return createSession()
}
