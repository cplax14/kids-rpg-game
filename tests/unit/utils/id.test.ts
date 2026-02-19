import { describe, it, expect } from 'vitest'
import { generateId, generateMonsterId, generateSaveId } from '../../../src/utils/id'

describe('generateId', () => {
  it('returns a non-empty string', () => {
    const id = generateId()
    expect(id).toBeTruthy()
    expect(typeof id).toBe('string')
  })

  it('generates unique IDs', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      ids.add(generateId())
    }
    expect(ids.size).toBe(100)
  })

  it('contains a dash separator', () => {
    expect(generateId()).toContain('-')
  })
})

describe('generateMonsterId', () => {
  it('starts with mon- prefix', () => {
    expect(generateMonsterId()).toMatch(/^mon-/)
  })
})

describe('generateSaveId', () => {
  it('generates slot-specific ID for guest mode', () => {
    expect(generateSaveId(0)).toBe('save-slot-0')
    expect(generateSaveId(1)).toBe('save-slot-1')
    expect(generateSaveId(2)).toBe('save-slot-2')
  })

  it('generates user-scoped ID when userId provided', () => {
    expect(generateSaveId(0, 'user-abc')).toBe('save-slot-user-abc-0')
    expect(generateSaveId(1, 'user-abc')).toBe('save-slot-user-abc-1')
  })

  it('different users get different keys for same slot', () => {
    expect(generateSaveId(0, 'user-a')).not.toBe(generateSaveId(0, 'user-b'))
  })
})
