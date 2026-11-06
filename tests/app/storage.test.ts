import { describe, expect, it } from 'vitest'
import { readStored, writeStored, type StorageLike } from '../../src/app/storage'

function memoryStore(): StorageLike {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
  }
}

const isTheme = (value: unknown): value is 'light' | 'dark' => value === 'light' || value === 'dark'

describe('local user settings and lesson persistence', () => {
  it('round-trips a valid value', () => {
    const store = memoryStore()
    expect(writeStored(store, 'theme', 'dark')).toBe(true)
    expect(readStored(store, 'theme', 'light', isTheme)).toBe('dark')
  })

  it('discards a corrupt or invalid saved value', () => {
    const store = memoryStore()
    store.setItem('theme', '{')
    expect(readStored(store, 'theme', 'light', isTheme)).toBe('light')
    store.setItem('theme', JSON.stringify({ theme: 'dark' }))
    expect(readStored(store, 'theme', 'light', isTheme)).toBe('light')
  })

  it('keeps the app usable if storage is blocked', () => {
    const blocked: StorageLike = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    }
    expect(readStored(blocked, 'theme', 'light', isTheme)).toBe('light')
    expect(writeStored(blocked, 'theme', 'dark')).toBe(false)
  })
})
