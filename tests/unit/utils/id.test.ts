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
  it('generates slot-specific ID', () => {
    expect(generateSaveId(0)).toBe('save-slot-0')
    expect(generateSaveId(1)).toBe('save-slot-1')
    expect(generateSaveId(2)).toBe('save-slot-2')
  })
})
