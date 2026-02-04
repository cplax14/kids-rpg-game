import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateLoot, generateBattleLoot, hasLootTable } from '../../../src/systems/LootSystem'

// Mock the math utilities so loot generation is deterministic
vi.mock('../../../src/utils/math', () => ({
  randomChance: vi.fn(),
  randomInt: vi.fn(),
}))

import { randomChance, randomInt } from '../../../src/utils/math'

const mockedRandomChance = vi.mocked(randomChance)
const mockedRandomInt = vi.mocked(randomInt)

beforeEach(() => {
  vi.resetAllMocks()
})

// ── hasLootTable ──

describe('hasLootTable', () => {
  it('should return true for a known species', () => {
    expect(hasLootTable('flamepup')).toBe(true)
  })

  it('should return true for all defined species', () => {
    const knownSpecies = ['flamepup', 'bubblefin', 'pebblit', 'breezling', 'mossbun', 'shadowpup', 'glowmoth']
    for (const species of knownSpecies) {
      expect(hasLootTable(species)).toBe(true)
    }
  })

  it('should return false for an unknown species', () => {
    expect(hasLootTable('unknown-monster')).toBe(false)
  })
})

// ── generateLoot ──

describe('generateLoot', () => {
  describe('known species', () => {
    it('should return drops when randomChance succeeds', () => {
      // flamepup has 3 entries; we make all drops succeed
      mockedRandomChance.mockReturnValue(true)
      mockedRandomInt.mockReturnValue(1)

      const drops = generateLoot('flamepup')

      expect(drops).toHaveLength(3)
      expect(drops[0].itemId).toBe('flame-shard')
      expect(drops[1].itemId).toBe('soft-fur')
      expect(drops[2].itemId).toBe('potion-small')
    })

    it('should return an empty array when all drops fail', () => {
      mockedRandomChance.mockReturnValue(false)

      const drops = generateLoot('flamepup')

      expect(drops).toHaveLength(0)
    })

    it('should use the quantity from randomInt', () => {
      mockedRandomChance.mockReturnValue(true)
      mockedRandomInt.mockReturnValue(2)

      const drops = generateLoot('flamepup')

      expect(drops[0].quantity).toBe(2)
    })

    it('should return partial drops when some succeed and some fail', () => {
      // Only the first entry succeeds
      mockedRandomChance
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
      mockedRandomInt.mockReturnValue(1)

      const drops = generateLoot('flamepup')

      expect(drops).toHaveLength(1)
      expect(drops[0].itemId).toBe('flame-shard')
    })
  })

  describe('unknown species defaults', () => {
    it('should use the default loot table for an unregistered species', () => {
      mockedRandomChance.mockReturnValue(true)
      mockedRandomInt.mockReturnValue(1)

      const drops = generateLoot('mystery-creature')

      // Default table has 2 entries: monster-bone and potion-small
      expect(drops).toHaveLength(2)
      expect(drops[0].itemId).toBe('monster-bone')
      expect(drops[1].itemId).toBe('potion-small')
    })
  })
})

// ── generateBattleLoot ──

describe('generateBattleLoot', () => {
  it('should merge duplicates by summing quantities', () => {
    // Two flamepups; both drop flame-shard with quantity 1
    mockedRandomChance.mockReturnValue(true)
    mockedRandomInt.mockReturnValue(1)

    const drops = generateBattleLoot(['flamepup', 'flamepup'])

    const flameShard = drops.find((d) => d.itemId === 'flame-shard')
    expect(flameShard).toBeDefined()
    // Two flamepups each drop 1 flame-shard => merged to 2
    expect(flameShard!.quantity).toBe(2)
  })

  it('should return unique items from different species', () => {
    // flamepup drops: flame-shard, soft-fur, potion-small
    // bubblefin drops: aqua-shard, monster-bone, ether-small
    mockedRandomChance.mockReturnValue(true)
    mockedRandomInt.mockReturnValue(1)

    const drops = generateBattleLoot(['flamepup', 'bubblefin'])

    const itemIds = drops.map((d) => d.itemId)
    expect(itemIds).toContain('flame-shard')
    expect(itemIds).toContain('aqua-shard')
  })

  it('should return an empty array when no species are provided', () => {
    const drops = generateBattleLoot([])

    expect(drops).toHaveLength(0)
  })

  it('should return an empty array when all drops fail', () => {
    mockedRandomChance.mockReturnValue(false)

    const drops = generateBattleLoot(['flamepup', 'bubblefin'])

    expect(drops).toHaveLength(0)
  })

  it('should merge shared items across different species', () => {
    // Both pebblit and bubblefin can drop monster-bone
    mockedRandomChance.mockReturnValue(true)
    mockedRandomInt.mockReturnValue(1)

    const drops = generateBattleLoot(['pebblit', 'bubblefin'])

    const monsterBone = drops.find((d) => d.itemId === 'monster-bone')
    expect(monsterBone).toBeDefined()
    expect(monsterBone!.quantity).toBe(2)
  })
})
