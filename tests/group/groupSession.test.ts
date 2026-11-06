import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSession, reduceSession, type SessionAction } from '../../src/sim/model'
import { createGroupHost, joinGroup, type GroupChannel } from '../../src/app/group'

class MemoryChannel implements GroupChannel {
  readonly handlers = new Set<(event: { data: unknown }) => void>()
  muted = false
  closed = false

  constructor(readonly hub: MemoryHub, readonly name: string) {}

  postMessage(data: unknown) {
    if (this.muted || this.closed) return
    for (const channel of this.hub.channels) {
      if (channel !== this && channel.name === this.name && !channel.closed) {
        for (const handler of channel.handlers) handler({ data: structuredClone(data) })
      }
    }
  }

  addEventListener(_type: 'message', handler: (event: { data: unknown }) => void) { this.handlers.add(handler) }
  removeEventListener(_type: 'message', handler: (event: { data: unknown }) => void) { this.handlers.delete(handler) }
  close() { this.closed = true; this.handlers.clear() }
}

class MemoryHub {
  readonly channels: MemoryChannel[] = []
  connect = (name: string): GroupChannel => {
    const channel = new MemoryChannel(this, name)
    this.channels.push(channel)
    return channel
  }
}

const ROOM_CODE = 'ROOM42'

function setup() {
  const hub = new MemoryHub()
  const host = createGroupHost({
    code: ROOM_CODE,
    id: 'instructor-tab',
    initialState: createSession(),
    reducer: reduceSession,
    channelFactory: hub.connect,
  })
  const operator = joinGroup({ code: ROOM_CODE, id: 'operator-tab', role: 'operator', channelFactory: hub.connect })
  const observer = joinGroup({ code: ROOM_CODE, id: 'observer-tab', role: 'observer', channelFactory: hub.connect })
  return { hub, host, operator, observer, close: () => { observer.close(); operator.close(); host.close() } }
}

afterEach(() => vi.useRealTimers())

describe('group session over a shared origin', () => {
  it('joins two different roles and gives both the same instructor-owned state', () => {
    const room = setup()
    try {
      expect(room.host.state.mode).toBe('group')
      expect(room.operator.status).toBe('connected')
      expect(room.observer.status).toBe('connected')
      expect(room.host.participants.map((participant) => participant.role)).toEqual(['instructor', 'operator', 'observer'])
      expect(room.operator.state).toEqual(room.host.state)
      expect(room.observer.state).toEqual(room.host.state)
    } finally { room.close() }
  })

  it('records the actual participant role before each observation or control action', () => {
    const room = setup()
    try {
      expect(room.observer.dispatch({ type: 'OBSERVE', zone: 'systems' })).toBe(true)
      expect(room.host.state.journal.at(-1)).toMatchObject({ type: 'OBSERVE', actor: 'observer', zone: 'systems' })
      expect(room.operator.dispatch({ type: 'COMMAND', value: 75 })).toBe(true)
      expect(room.host.state.command).toBe(75)
      expect(room.host.state.journal.at(-1)).toMatchObject({ type: 'COMMAND', actor: 'operator' })
      expect(room.observer.state).toEqual(room.host.state)
    } finally { room.close() }
  })

  it('enforces read-only observer and instructor-only assignment on the host', () => {
    const room = setup()
    try {
      const before = room.host.state
      for (const action of [
        { type: 'COMMAND', value: 75 }, { type: 'ACK' }, { type: 'RESOLVE' },
        { type: 'STAGE', stage: 1 }, { type: 'ASSIGN', actor: 'operator' },
      ] as SessionAction[]) expect(room.observer.dispatch(action)).toBe(false)
      expect(room.operator.dispatch({ type: 'ASSIGN', actor: 'operator' })).toBe(false)
      expect(room.host.state).toBe(before)

      // A same-origin tab can send a raw packet, so the leader must recheck the role.
      room.hub.connect('tvtest1.group.v1.ROOM42').postMessage({
        protocol: 'tvtest1-group', schema: 1, code: ROOM_CODE, kind: 'action',
        participantId: room.observer.id, requestId: 'request-1', action: { type: 'COMMAND', value: 75 },
      })
      expect(room.host.state).toBe(before)
      expect(room.host.dispatch({ type: 'ASSIGN', actor: 'operator', stage: 1 })).toBe(true)
      expect(room.host.state.assignments[1]).toBe('operator')
      expect(room.host.state.journal.at(-1)?.actor).toBe('instructor')
    } finally { room.close() }
  })

  it('rejects malformed snapshots and older revisions rather than overwriting a current state', () => {
    const room = setup()
    try {
      const initial = room.operator.state
      expect(room.host.dispatch({ type: 'COMMAND', value: 75 })).toBe(true)
      const current = room.operator.state
      const rogue = room.hub.connect('tvtest1.group.v1.ROOM42')
      rogue.postMessage({
        protocol: 'tvtest1-group', schema: 1, code: ROOM_CODE, kind: 'snapshot',
        hostId: room.host.id, revision: 99, state: { ...current, profile: 'unknown' },
      })
      expect(room.operator.state).toEqual(current)
      rogue.postMessage({
        protocol: 'tvtest1-group', schema: 1, code: ROOM_CODE, kind: 'snapshot',
        hostId: room.host.id, revision: 0, state: initial,
      })
      expect(room.operator.state).toEqual(current)
      expect(room.operator.revision).toBe(room.host.revision)
    } finally { room.close() }
  })

  it('marks the leader lost after missing heartbeats and reconnects when it returns', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-06T12:00:00Z'))
    const room = setup()
    try {
      room.hub.channels[0].muted = true
      vi.advanceTimersByTime(4_000)
      expect(room.operator.status).toBe('lost')
      expect(room.operator.dispatch({ type: 'OBSERVE', zone: 'power' })).toBe(false)
      room.hub.channels[0].muted = false
      vi.advanceTimersByTime(1_000)
      expect(room.operator.status).toBe('connected')
      expect(room.operator.state).toEqual(room.host.state)
    } finally { room.close() }
  })
})
