import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  saveToStorage,
  loadFromStorage,
  removeFromStorage,
  hasSaveData,
  clearAllSaves,
} from '../../../src/utils/storage'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    get length() {
      return Object.keys(store).length
    },
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
})

beforeEach(() => {
  localStorageMock.clear()
  vi.clearAllMocks()
})

describe('saveToStorage', () => {
  it('saves data with prefixed key', () => {
    saveToStorage('test-key', { value: 42 })
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'kids-rpg:test-key',
      JSON.stringify({ value: 42 }),
    )
  })

  it('returns true on success', () => {
    expect(saveToStorage('key', 'data')).toBe(true)
  })

  it('returns false on error', () => {
    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new Error('QuotaExceeded')
    })
    expect(saveToStorage('key', 'data')).toBe(false)
  })
})

describe('loadFromStorage', () => {
  it('loads and parses saved data', () => {
    saveToStorage('player', { name: 'Hero', level: 5 })
    const result = loadFromStorage<{ name: string; level: number }>('player')
    expect(result).toEqual({ name: 'Hero', level: 5 })
  })

  it('returns null for missing key', () => {
    expect(loadFromStorage('nonexistent')).toBeNull()
  })

  it('returns null for corrupted data', () => {
    localStorageMock.getItem.mockReturnValueOnce('not valid json{{{')
    expect(loadFromStorage('corrupted')).toBeNull()
  })
})

describe('removeFromStorage', () => {
  it('removes item with prefixed key', () => {
    saveToStorage('temp', 'data')
    removeFromStorage('temp')
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('kids-rpg:temp')
  })
})

describe('hasSaveData', () => {
  it('returns false when no save exists', () => {
    expect(hasSaveData(0)).toBe(false)
  })

  it('returns true when save exists', () => {
    saveToStorage('save-slot-0', { data: true })
    expect(hasSaveData(0)).toBe(true)
  })
})

describe('clearAllSaves', () => {
  it('removes all prefixed items', () => {
    saveToStorage('save-0', 'a')
    saveToStorage('save-1', 'b')
    clearAllSaves()
    // After clearing, trying to load should return null
    expect(loadFromStorage('save-0')).toBeNull()
  })
})
