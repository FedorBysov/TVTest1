import { STAGES, type DisplaySnapshot, type SessionState } from '../sim/model'

const profiles = ['vver', 'smr']
const scenarios = ['normal', 'flow', 'split']
const roles = ['observer', 'operator', 'instructor']
const actions = ['PROFILE', 'STAGE', 'SCENARIO', 'TICK', 'COMMAND', 'OBSERVE', 'TRIGGER', 'ACK', 'RESOLVE', 'PAUSE', 'RESET', 'HINT', 'MODE', 'ACTOR', 'ASSIGN']
const signals = ['normal', 'warning', 'alarm']
const zones = ['power', 'systems', 'alarms']
const phases = ['steady', 'transition', 'degraded', 'discrepant']

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function member(value: unknown, choices: readonly string[]): boolean {
  return typeof value === 'string' && choices.includes(value)
}

function finite(value: unknown, min = 0, max = Infinity): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function stage(value: unknown): value is 0 | 1 | 2 | 3 | 4 {
  return Number.isInteger(value) && finite(value, 0, 4)
}

function command(value: unknown): boolean {
  return value === 0 || value === 25 || value === 50 || value === 75 || value === 100
}

function snapshot(value: unknown): value is DisplaySnapshot {
  if (!record(value) || !record(value.readings) || !record(value.signal) || !Array.isArray(value.systems)) return false
  const readings = value.readings
  if (!member(value.profile, profiles) || !member(value.scenario, scenarios) || !stage(value.stage) || value.stageLabel !== STAGES[value.stage] || !finite(value.time) || !command(value.command)) return false
  if (!['power', 'temperature', 'pressure', 'flow', 'indicatorB'].every(key => finite(readings[key], 0, 100))) return false
  if (!member(value.signal.kind, signals) || typeof value.signal.label !== 'string' || !(typeof value.signal.cause === 'string' || value.signal.cause === null) || typeof value.signal.acknowledged !== 'boolean') return false
  if (value.systems.length !== 3) return false
  const ids = new Set<string>()
  for (const system of value.systems) {
    if (!record(system) || !member(system.id, ['power', 'flow', 'indicators']) || typeof system.label !== 'string' || !member(system.status, signals) || !member(system.phase, phases) || typeof system.detail !== 'string') return false
    ids.add(system.id as string)
  }
  return ids.size === 3
}

/** Reject partial/corrupt browser storage before any page reads historical data. */
export function isSession(value: unknown): value is SessionState {
  if (!record(value) || !record(value.assignments) || !Array.isArray(value.journal) || value.journal.length > 500 || !Array.isArray(value.trainingEvidence) || value.trainingEvidence.length > 30) return false
  if (!member(value.profile, profiles) || !member(value.scenario, scenarios) || !stage(value.stage) || !command(value.command)) return false
  if (!finite(value.time) || !finite(value.response, 0, 100) || !finite(value.hints) || !Number.isInteger(value.hints)) return false
  if (typeof value.paused !== 'boolean' || typeof value.stageTimeAdvanced !== 'boolean' || typeof value.acknowledged !== 'boolean' || !member(value.deviation, ['idle', 'active', 'resolved'])) return false
  if (!(typeof value.hint === 'string' || value.hint === null) || !member(value.mode, ['solo', 'group']) || !member(value.actor, roles)) return false
  if (!Object.entries(value.assignments).every(([key, role]) => /^[0-4]$/.test(key) && member(role, roles))) return false
  for (const events of [value.journal, value.trainingEvidence]) {
    let previousId = 0
    for (const event of events) {
      if (!record(event) || !Number.isInteger(event.id) || !finite(event.id, previousId + 1) || !finite(event.time) || !member(event.type, actions) || !member(event.actor, [...roles, 'student', 'model']) || typeof event.message !== 'string' || !snapshot(event.snapshot)) return false
      if (event.type === 'OBSERVE' ? !member(event.zone, zones) : event.zone !== undefined) return false
      previousId = event.id as number
    }
  }
  return true
}
