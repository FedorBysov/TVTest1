import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/app/App'
import { createSession, reduceSession } from '../../src/sim/model'
import type { StorageLike } from '../../src/app/storage'

class SameOriginChannel {
  static channels = new Set<SameOriginChannel>()
  private listeners = new Set<(event: { data: unknown }) => void>()

  constructor(readonly name: string) { SameOriginChannel.channels.add(this) }
  postMessage(data: unknown) {
    for (const peer of SameOriginChannel.channels) {
      if (peer !== this && peer.name === this.name) {
        for (const listener of peer.listeners) listener({ data: structuredClone(data) })
      }
    }
  }
  addEventListener(_type: 'message', listener: (event: { data: unknown }) => void) { this.listeners.add(listener) }
  removeEventListener(_type: 'message', listener: (event: { data: unknown }) => void) { this.listeners.delete(listener) }
  close() { SameOriginChannel.channels.delete(this); this.listeners.clear() }
}

const roots: Root[] = []
let originalSessionStorage: PropertyDescriptor | undefined

function tabStorage(): StorageLike {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
  }
}

function useTabStorage(storage: StorageLike) {
  Object.defineProperty(window, 'sessionStorage', { configurable: true, get: () => storage })
}

function mountApp(): HTMLElement {
  const node = document.createElement('div')
  document.body.append(node)
  const root = createRoot(node)
  roots.push(root)
  act(() => root.render(<App />))
  return node
}

function button(root: HTMLElement, name: string): HTMLButtonElement {
  const found = [...root.querySelectorAll('button')].find((candidate) => candidate.textContent?.trim() === name)
  if (!found) throw new Error(`Кнопка не найдена: ${name}`)
  return found
}

function click(root: HTMLElement, name: string) { act(() => button(root, name).click()) }

function page(route: string) {
  act(() => { window.location.hash = `#/${route}`; window.dispatchEvent(new HashChangeEvent('hashchange')) })
}

function input(root: HTMLElement, label: string, value: string) {
  const field = root.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement | null
  if (!field) throw new Error(`Поле не найдено: ${label}`)
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => { setter.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })) })
}

beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
  originalSessionStorage = Object.getOwnPropertyDescriptor(window, 'sessionStorage')
  vi.stubGlobal('BroadcastChannel', SameOriginChannel)
  vi.stubGlobal('scrollTo', vi.fn())
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.location.hash = '#/session'
})
afterEach(() => {
  act(() => roots.splice(0).forEach((root) => root.unmount()))
  document.body.innerHTML = ''
  SameOriginChannel.channels.clear()
  if (originalSessionStorage) Object.defineProperty(window, 'sessionStorage', originalSessionStorage)
  vi.unstubAllGlobals()
})

describe('group lesson in the desktop UI', () => {
  it('keeps solo lessons separate per tab and restores each after reload', () => {
    const firstStore = tabStorage()
    const secondStore = tabStorage()
    useTabStorage(firstStore)
    const first = mountApp()
    page('scenarios')
    act(() => (first.querySelector('.stage-strip button:nth-child(2)') as HTMLButtonElement).click())
    useTabStorage(secondStore)
    const second = mountApp()
    expect(second.querySelector('.topbar-stage strong')?.textContent).toBe('Подготовка к пуску')
    act(() => (second.querySelector('.stage-strip button:nth-child(3)') as HTMLButtonElement).click())
    expect(first.querySelector('.topbar-stage strong')?.textContent).toBe('Пуск')
    expect(second.querySelector('.topbar-stage strong')?.textContent).toBe('Выход на рабочую мощность')
    expect(JSON.parse(firstStore.getItem('tvtest1.session.v3')!).stage).toBe(1)
    expect(JSON.parse(secondStore.getItem('tvtest1.session.v3')!).stage).toBe(2)
    expect(window.localStorage.getItem('tvtest1.session.v3')).toBeNull()

    act(() => roots.splice(0).forEach((root) => root.unmount()))
    useTabStorage(firstStore)
    const firstReloaded = mountApp()
    expect(firstReloaded.querySelector('.topbar-stage strong')?.textContent).toBe('Пуск')
    useTabStorage(secondStore)
    const secondReloaded = mountApp()
    expect(secondReloaded.querySelector('.topbar-stage strong')?.textContent).toBe('Выход на рабочую мощность')
  })

  it('imports a previous shared v2 lesson into this tab without writing a shared v3 lesson', () => {
    const old = reduceSession(createSession(), { type: 'STAGE', stage: 1 })
    window.localStorage.setItem('tvtest1.session.v2', JSON.stringify(old))
    const currentStore = tabStorage()
    useTabStorage(currentStore)
    const app = mountApp()
    expect(app.querySelector('.topbar-stage strong')?.textContent).toBe('Пуск')
    expect(JSON.parse(currentStore.getItem('tvtest1.session.v3')!).stage).toBe(1)
    expect(window.localStorage.getItem('tvtest1.session.v3')).toBeNull()
  })

  it('returns each group participant to its own solo snapshot', () => {
    const hostStore = tabStorage()
    const guestStore = tabStorage()
    useTabStorage(hostStore)
    const host = mountApp()
    page('scenarios')
    act(() => (host.querySelector('.stage-strip button:nth-child(2)') as HTMLButtonElement).click())
    useTabStorage(guestStore)
    const guest = mountApp()
    act(() => (guest.querySelector('.stage-strip button:nth-child(3)') as HTMLButtonElement).click())
    page('session')
    click(host, 'Создать групповое занятие')
    const code = host.querySelector('output[aria-label="Код группового занятия"]')!.textContent!.trim()
    input(guest, 'Код занятия', code)
    click(guest, 'Подключиться')
    page('scenarios')
    act(() => (guest.querySelector('.stage-strip button:nth-child(4)') as HTMLButtonElement).click())
    expect(host.querySelector('.topbar-stage strong')?.textContent).toBe('Изменение мощности')
    expect(guest.querySelector('.topbar-stage strong')?.textContent).toBe('Изменение мощности')
    page('session')
    click(host, 'Завершить участие')
    click(guest, 'Завершить участие')
    expect(host.querySelector('.topbar-stage strong')?.textContent).toBe('Пуск')
    expect(guest.querySelector('.topbar-stage strong')?.textContent).toBe('Выход на рабочую мощность')
    expect(JSON.parse(hostStore.getItem('tvtest1.session.v3')!).stage).toBe(1)
    expect(JSON.parse(guestStore.getItem('tvtest1.session.v3')!).stage).toBe(2)
  })

  it('returns to the top when navigating from a long scenario page to the review', () => {
    mountApp()
    page('scenarios')
    page('session')
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it('joins a second tab, syncs its operator action, then restores the host local lesson', () => {
    const host = mountApp()
    const operator = mountApp()
    click(host, 'Создать групповое занятие')
    const code = host.querySelector('output[aria-label="Код группового занятия"]')?.textContent?.trim()
    expect(code).toMatch(/^[A-Z0-9]{6}$/)
    input(operator, 'Код занятия', code!)
    click(operator, 'Подключиться')
    expect(operator.textContent).toContain('Подключено')
    expect(host.textContent).toContain('Оператор панели')

    page('scenarios')
    const stageTwo = operator.querySelector('.stage-strip button:nth-child(2)') as HTMLButtonElement
    expect(stageTwo).toBeTruthy()
    act(() => stageTwo.click())
    expect(host.querySelector('.topbar-stage strong')?.textContent).toBe('Пуск')
    expect(operator.querySelector('.topbar-stage strong')?.textContent).toBe('Пуск')

    page('session')
    click(host, 'Завершить участие')
    expect(host.querySelector('.topbar-stage strong')?.textContent).toBe('Подготовка к пуску')
    expect(operator.textContent).toContain('Связь с ведущим потеряна')
  })

  it('keeps an observer read-only while allowing a recorded observation', () => {
    const host = mountApp()
    const observer = mountApp()
    click(host, 'Создать групповое занятие')
    const code = host.querySelector('output[aria-label="Код группового занятия"]')!.textContent!.trim()
    input(observer, 'Код занятия', code)
    const role = observer.querySelector('select[aria-label="Роль участника"]') as HTMLSelectElement
    act(() => { role.value = 'observer'; role.dispatchEvent(new Event('change', { bubbles: true })) })
    click(observer, 'Подключиться')
    page('console')
    expect((observer.querySelector('button[aria-label="Увеличить учебную команду"]') as HTMLButtonElement).disabled).toBe(true)
    expect(button(observer, 'Записать наблюдение этой зоны').disabled).toBe(false)
    click(observer, 'Записать наблюдение этой зоны')
    page('session')
    expect(host.querySelector('.event-list')?.textContent).toContain('Наблюдатель')
    expect(host.querySelector('.event-list')?.textContent).toContain('Наблюдение')
  })
})
