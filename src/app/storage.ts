export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function readStored<T>(
  storage: StorageLike,
  key: string,
  fallback: T,
  validate: (value: unknown) => value is T,
): T {
  try {
    const raw = storage.getItem(key)
    if (raw === null) return fallback
    const value: unknown = JSON.parse(raw)
    return validate(value) ? value : fallback
  } catch {
    return fallback
  }
}

export function writeStored(storage: StorageLike, key: string, value: unknown): boolean {
  try {
    storage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
