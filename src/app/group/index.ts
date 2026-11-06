import type { RoleId, SessionAction, SessionState, StageId } from '../../sim/model'
import { isSession } from '../sessionValidation'

export interface GroupChannel {
  postMessage(data: unknown): void
  addEventListener(type: 'message', handler: (event: { data: unknown }) => void): void
  removeEventListener(type: 'message', handler: (event: { data: unknown }) => void): void
  close(): void
}

export type GroupChannelFactory = (name: string) => GroupChannel
export type Participant = Readonly<{ id: string; role: RoleId }>
export type GuestRole = 'operator' | 'observer'
export type GuestStatus = 'connecting' | 'connected' | 'lost'

export interface GroupHost {
  readonly id: string
  readonly code: string
  readonly state: SessionState
  readonly revision: number
  readonly participants: readonly Participant[]
  dispatch(action: SessionAction): boolean
  close(): void
}

export interface GroupGuest {
  readonly id: string
  readonly code: string
  readonly role: GuestRole
  readonly state: SessionState | null
  readonly revision: number
  readonly status: GuestStatus
  dispatch(action: SessionAction): boolean
  close(): void
}

export interface HostOptions {
  readonly code?: string
  readonly id?: string
  readonly initialState: SessionState
  readonly reducer: (state: SessionState, action: SessionAction) => SessionState
  readonly onChange?: (state: SessionState, revision: number) => void
  readonly onParticipants?: (participants: readonly Participant[]) => void
  readonly channelFactory?: GroupChannelFactory
}

export interface GuestOptions {
  readonly code: string
  readonly id?: string
  readonly role: GuestRole
  readonly onChange?: (state: SessionState, revision: number) => void
  readonly onStatus?: (status: GuestStatus) => void
  readonly onRejected?: (reason: string) => void
  readonly channelFactory?: GroupChannelFactory
}

const PROTOCOL = 'tvtest1-group'
const SCHEMA = 1
const HEARTBEAT_MS = 1_000
const LOST_AFTER_MS = 3_500
const MAX_GUESTS = 2
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_PATTERN = /^[A-Z0-9]{6,8}$/
const ID_PATTERN = /^[A-Za-z0-9_-]{3,64}$/

type WireMessage =
  | { protocol: typeof PROTOCOL; schema: typeof SCHEMA; code: string; kind: 'join'; participantId: string; role: GuestRole }
  | { protocol: typeof PROTOCOL; schema: typeof SCHEMA; code: string; kind: 'welcome'; recipientId: string; role: GuestRole; hostId: string; revision: number; state: SessionState }
  | { protocol: typeof PROTOCOL; schema: typeof SCHEMA; code: string; kind: 'snapshot'; hostId: string; revision: number; state: SessionState }
  | { protocol: typeof PROTOCOL; schema: typeof SCHEMA; code: string; kind: 'heartbeat'; hostId: string; revision: number }
  | { protocol: typeof PROTOCOL; schema: typeof SCHEMA; code: string; kind: 'action'; participantId: string; requestId: string; action: SessionAction }
  | { protocol: typeof PROTOCOL; schema: typeof SCHEMA; code: string; kind: 'alive' | 'leave'; participantId: string }
  | { protocol: typeof PROTOCOL; schema: typeof SCHEMA; code: string; kind: 'bye'; hostId: string }
  | { protocol: typeof PROTOCOL; schema: typeof SCHEMA; code: string; kind: 'rejected'; recipientId: string; requestId: string; reason: string }

type WithoutEnvelope<T> = T extends unknown ? Omit<T, 'protocol' | 'schema' | 'code'> : never
type WirePayload = WithoutEnvelope<WireMessage>

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value)
}

function validRole(value: unknown): value is GuestRole {
  return value === 'operator' || value === 'observer'
}

function validStage(value: unknown): value is StageId {
  return Number.isInteger(value) && typeof value === 'number' && value >= 0 && value <= 4
}

function validRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === 'number' && value >= 0
}

function isAction(value: unknown): value is SessionAction {
  if (!record(value)) return false
  switch (value.type) {
    case 'PROFILE': return value.profile === 'vver' || value.profile === 'smr'
    case 'STAGE': return validStage(value.stage)
    case 'SCENARIO': return value.scenario === 'normal' || value.scenario === 'flow' || value.scenario === 'split'
    case 'TICK': return value.seconds === undefined || (typeof value.seconds === 'number' && Number.isFinite(value.seconds) && value.seconds > 0)
    case 'COMMAND': return typeof value.value === 'number' && Number.isFinite(value.value)
    case 'OBSERVE': return value.zone === 'power' || value.zone === 'systems' || value.zone === 'alarms'
    case 'TRIGGER': return value.scenario === undefined || value.scenario === 'flow' || value.scenario === 'split'
    case 'ACK':
    case 'RESOLVE':
    case 'RESET':
    case 'HINT': return true
    case 'PAUSE': return value.paused === undefined || typeof value.paused === 'boolean'
    case 'MODE': return value.mode === 'solo' || value.mode === 'group'
    case 'ACTOR': return value.actor === 'observer' || value.actor === 'operator' || value.actor === 'instructor'
    case 'ASSIGN': return (value.actor === 'observer' || value.actor === 'operator' || value.actor === 'instructor') && (value.stage === undefined || validStage(value.stage))
    default: return false
  }
}

function isWireMessage(value: unknown, code: string): value is WireMessage {
  if (!record(value) || value.protocol !== PROTOCOL || value.schema !== SCHEMA || value.code !== code) return false
  switch (value.kind) {
    case 'join': return validId(value.participantId) && validRole(value.role)
    case 'welcome': return validId(value.recipientId) && validRole(value.role) && validId(value.hostId) && validRevision(value.revision) && isSession(value.state) && value.state.mode === 'group'
    case 'snapshot': return validId(value.hostId) && validRevision(value.revision) && isSession(value.state) && value.state.mode === 'group'
    case 'heartbeat': return validId(value.hostId) && validRevision(value.revision)
    case 'action': return validId(value.participantId) && validId(value.requestId) && isAction(value.action)
    case 'alive':
    case 'leave': return validId(value.participantId)
    case 'bye': return validId(value.hostId)
    case 'rejected': return validId(value.recipientId) && validId(value.requestId) && typeof value.reason === 'string' && value.reason.length <= 80
    default: return false
  }
}

function normalizeCode(code: string): string {
  const normalized = code.trim().toUpperCase()
  if (!CODE_PATTERN.test(normalized)) throw new Error('Код занятия должен содержать 6–8 латинских букв или цифр.')
  return normalized
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  if (globalThis.crypto?.getRandomValues) return globalThis.crypto.getRandomValues(bytes)
  for (let index = 0; index < length; index++) bytes[index] = Math.floor(Math.random() * 256)
  return bytes
}

function makeCode(): string {
  return Array.from(randomBytes(6), byte => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('')
}

function makeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Array.from(randomBytes(10), byte => byte.toString(16).padStart(2, '0')).join('')}`
}

function channelFor(code: string, factory?: GroupChannelFactory): GroupChannel {
  if (factory) return factory(`tvtest1.group.v1.${code}`)
  if (typeof BroadcastChannel === 'undefined') throw new Error('Этот браузер не поддерживает групповые занятия через BroadcastChannel.')
  return new BroadcastChannel(`tvtest1.group.v1.${code}`) as unknown as GroupChannel
}

function send(channel: GroupChannel, code: string, message: WirePayload): void {
  channel.postMessage({ protocol: PROTOCOL, schema: SCHEMA, code, ...message })
}

/** UI gating only; the instructor also checks this when a guest sends a raw channel packet. */
export function canGroupDispatch(role: RoleId, action: SessionAction): boolean {
  if (role === 'observer') return action.type === 'OBSERVE'
  if (role === 'operator') return ['OBSERVE', 'COMMAND', 'ACK', 'RESOLVE', 'STAGE', 'HINT'].includes(action.type)
  return action.type !== 'MODE' && action.type !== 'ACTOR'
}

export function createGroupHost(options: HostOptions): GroupHost {
  const code = normalizeCode(options.code ?? makeCode())
  const id = options.id ?? makeId()
  if (!validId(id)) throw new Error('Недопустимый идентификатор вкладки.')
  const channel = channelFor(code, options.channelFactory)
  let state = options.initialState.mode === 'group'
    ? options.initialState
    : options.reducer(options.initialState, { type: 'MODE', mode: 'group' })
  if (state.actor !== 'instructor') state = options.reducer(state, { type: 'ACTOR', actor: 'instructor' })
  let revision = 0
  let closed = false
  const guests = new Map<string, { role: GuestRole; lastSeen: number }>()

  const participants = (): readonly Participant[] => [
    { id, role: 'instructor' },
    ...Array.from(guests, ([guestId, guest]) => ({ id: guestId, role: guest.role })),
  ]
  const notifyParticipants = () => options.onParticipants?.(participants())
  const broadcast = () => send(channel, code, { kind: 'snapshot', hostId: id, revision, state })
  const reject = (recipientId: string, requestId: string, reason: string) =>
    send(channel, code, { kind: 'rejected', recipientId, requestId, reason })

  const apply = (action: SessionAction, role: RoleId): boolean => {
    if (closed || !canGroupDispatch(role, action)) return false
    const attributed = state.actor === role ? state : options.reducer(state, { type: 'ACTOR', actor: role })
    let next = options.reducer(attributed, action)
    if (next === attributed) return false
    if (next.mode !== 'group') next = options.reducer(next, { type: 'MODE', mode: 'group' })
    if (next.actor !== role) next = options.reducer(next, { type: 'ACTOR', actor: role })
    state = next
    revision++
    options.onChange?.(state, revision)
    broadcast()
    return true
  }

  const onMessage = (event: { data: unknown }) => {
    const message = event.data
    if (closed || !isWireMessage(message, code)) return
    if (message.kind === 'join') {
      if (message.participantId === id) return
      const existing = guests.get(message.participantId)
      if (!existing && guests.size >= MAX_GUESTS) {
        reject(message.participantId, 'join-request', 'room-full')
        return
      }
      if (existing && existing.role !== message.role) {
        reject(message.participantId, 'join-request', 'role-locked')
        return
      }
      guests.set(message.participantId, { role: existing?.role ?? message.role, lastSeen: Date.now() })
      if (!existing) notifyParticipants()
      send(channel, code, { kind: 'welcome', recipientId: message.participantId, role: message.role, hostId: id, revision, state })
      return
    }
    if (message.kind === 'alive' || message.kind === 'leave') {
      const guest = guests.get(message.participantId)
      if (!guest) return
      if (message.kind === 'leave') { guests.delete(message.participantId); notifyParticipants() }
      else guest.lastSeen = Date.now()
      return
    }
    if (message.kind === 'action') {
      const guest = guests.get(message.participantId)
      if (!guest) { reject(message.participantId, message.requestId, 'not-joined'); return }
      guest.lastSeen = Date.now()
      if (!canGroupDispatch(guest.role, message.action)) {
        reject(message.participantId, message.requestId, 'forbidden')
        return
      }
      apply(message.action, guest.role)
    }
  }

  channel.addEventListener('message', onMessage)
  const timer = setInterval(() => {
    if (closed) return
    const now = Date.now()
    let changed = false
    for (const [guestId, guest] of guests) {
      if (now - guest.lastSeen > LOST_AFTER_MS) { guests.delete(guestId); changed = true }
    }
    if (changed) notifyParticipants()
    send(channel, code, { kind: 'heartbeat', hostId: id, revision })
  }, HEARTBEAT_MS)

  return {
    id, code,
    get state() { return state },
    get revision() { return revision },
    get participants() { return participants() },
    dispatch: (action) => apply(action, 'instructor'),
    close: () => {
      if (closed) return
      closed = true
      clearInterval(timer)
      send(channel, code, { kind: 'bye', hostId: id })
      channel.removeEventListener('message', onMessage)
      channel.close()
    },
  }
}

export function joinGroup(options: GuestOptions): GroupGuest {
  const code = normalizeCode(options.code)
  const id = options.id ?? makeId()
  if (!validId(id) || !validRole(options.role)) throw new Error('Недопустимая роль или идентификатор вкладки.')
  const channel = channelFor(code, options.channelFactory)
  let state: SessionState | null = null
  let revision = -1
  let status: GuestStatus = 'connecting'
  let hostId: string | null = null
  let lastBeat = Date.now()
  let requestCounter = 0
  let closed = false
  const setStatus = (next: GuestStatus) => {
    if (next === status) return
    status = next
    options.onStatus?.(status)
  }
  const requestJoin = () => send(channel, code, { kind: 'join', participantId: id, role: options.role })
  const receiveState = (next: SessionState, nextRevision: number) => {
    if (nextRevision <= revision) return
    state = next
    revision = nextRevision
    options.onChange?.(state, revision)
  }
  const onMessage = (event: { data: unknown }) => {
    const message = event.data
    if (closed || !isWireMessage(message, code)) return
    if (message.kind === 'welcome') {
      if (message.recipientId !== id || message.role !== options.role) return
      if (status === 'connected' && hostId !== message.hostId) return
      if (hostId !== message.hostId) { state = null; revision = -1 }
      hostId = message.hostId
      lastBeat = Date.now()
      receiveState(message.state, message.revision)
      setStatus('connected')
      return
    }
    if (message.kind === 'snapshot' || message.kind === 'heartbeat') {
      if (message.hostId !== hostId || status !== 'connected') return
      lastBeat = Date.now()
      if (message.kind === 'snapshot') receiveState(message.state, message.revision)
      else if (message.revision > revision) requestJoin()
      return
    }
    if (message.kind === 'bye' && message.hostId === hostId) {
      hostId = null
      setStatus('lost')
      return
    }
    if (message.kind === 'rejected' && message.recipientId === id) {
      options.onRejected?.(message.reason)
    }
  }

  channel.addEventListener('message', onMessage)
  const timer = setInterval(() => {
    if (closed) return
    if (status === 'connected' && Date.now() - lastBeat > LOST_AFTER_MS) {
      hostId = null
      setStatus('lost')
    }
    if (status === 'connected') send(channel, code, { kind: 'alive', participantId: id })
    else requestJoin()
  }, HEARTBEAT_MS)
  requestJoin()

  return {
    id, code, role: options.role,
    get state() { return state },
    get revision() { return revision },
    get status() { return status },
    dispatch: (action) => {
      if (closed || status !== 'connected' || !canGroupDispatch(options.role, action) || !isAction(action)) return false
      send(channel, code, { kind: 'action', participantId: id, requestId: `${id}-${++requestCounter}`, action })
      return true
    },
    close: () => {
      if (closed) return
      closed = true
      clearInterval(timer)
      send(channel, code, { kind: 'leave', participantId: id })
      channel.removeEventListener('message', onMessage)
      channel.close()
    },
  }
}
