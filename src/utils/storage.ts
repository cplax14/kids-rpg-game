import { generateSaveId } from './id'
import { logger } from './logger'

const STORAGE_PREFIX = 'kids-rpg:'

function getKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`
}

export function saveToStorage<T>(key: string, data: T): boolean {
  try {
    const serialized = JSON.stringify(data)
    localStorage.setItem(getKey(key), serialized)
    return true
  } catch (error) {
    logger.error('Failed to save to storage', { key, error })
    return false
  }
}

export function loadFromStorage<T>(key: string): T | null {
  try {
    const serialized = localStorage.getItem(getKey(key))
    if (serialized === null) return null
    return JSON.parse(serialized) as T
  } catch (error) {
    logger.error('Failed to load from storage', { key, error })
    return null
  }
}

export function removeFromStorage(key: string): void {
  localStorage.removeItem(getKey(key))
}

export function hasSaveData(slot: number): boolean {
  const key = generateSaveId(slot)
  return localStorage.getItem(getKey(key)) !== null
}

export function clearAllSaves(): void {
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(STORAGE_PREFIX)) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key))
}

export const storage = {
  save: saveToStorage,
  load: loadFromStorage,
  remove: removeFromStorage,
  hasSave: hasSaveData,
  clearAll: clearAllSaves,
} as const
