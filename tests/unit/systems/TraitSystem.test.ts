import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadTraitData,
  getTrait,
  getAllTraits,
  getTraitsByRarity,
  getMutationTraits,
  getRareTraits,
  getCommonTraits,
  applyTraitBonuses,
  calculateTraitValue,
  getUniqueTraits,
  filterValidTraits,
} from '../../../src/systems/TraitSystem'
import type { TraitDefinition, CharacterStats } from '../../../src/models/types'

const mockTraits: TraitDefinition[] = [
  {
    traitId: 'fierce',
    name: 'Fierce',
    description: 'Boosts attack',
    statModifiers: { attack: 10 },
    rarity: 'common',
  },
  {
    traitId: 'tough',
    name: 'Tough',
    description: 'Boosts HP',
    statModifiers: { maxHp: 15 },
    rarity: 'common',
  },
  {
    traitId: 'nimble',
    name: 'Nimble',
    description: 'Boosts speed',
    statModifiers: { speed: 10 },
    rarity: 'common',
  },
  {
    traitId: 'iron-will',
    name: 'Iron Will',
    description: 'Boosts magic defense',
    statModifiers: { magicDefense: 15 },
    rarity: 'rare',
  },
  {
    traitId: 'swift-strike',
    name: 'Swift Strike',
    description: 'Greatly boosts speed',
    statModifiers: { speed: 15 },
    rarity: 'rare',
  },
  {
    traitId: 'primal-power',
    name: 'Primal Power',
    description: 'Mutation that boosts attack and HP',
    statModifiers: { attack: 15, maxHp: 5 },
    rarity: 'mutation',
  },
  {
    traitId: 'chaos-touched',
    name: 'Chaos Touched',
    description: 'Mutation with multiple boosts',
    statModifiers: { attack: 8, magicAttack: 8, speed: 4 },
    rarity: 'mutation',
  },
]

const createBaseStats = (): CharacterStats => ({
  maxHp: 100,
  currentHp: 100,
  maxMp: 50,
  currentMp: 50,
  attack: 20,
  defense: 15,
  magicAttack: 18,
  magicDefense: 12,
  speed: 16,
  luck: 10,
})

beforeEach(() => {
  loadTraitData(mockTraits)
})

describe('loadTraitData and getTrait', () => {
  it('loads traits and retrieves them by ID', () => {
    const trait = getTrait('fierce')
    expect(trait).toBeDefined()
    expect(trait!.name).toBe('Fierce')
    expect(trait!.rarity).toBe('common')
  })

  it('returns undefined for unknown trait ID', () => {
    const trait = getTrait('nonexistent')
    expect(trait).toBeUndefined()
  })
})

describe('getAllTraits', () => {
  it('returns all loaded traits', () => {
    const all = getAllTraits()
    expect(all.length).toBe(7)
  })
})

describe('getTraitsByRarity', () => {
  it('filters common traits correctly', () => {
    const common = getTraitsByRarity('common')
    expect(common.length).toBe(3)
    expect(common.every((t) => t.rarity === 'common')).toBe(true)
  })

  it('filters rare traits correctly', () => {
    const rare = getTraitsByRarity('rare')
    expect(rare.length).toBe(2)
    expect(rare.every((t) => t.rarity === 'rare')).toBe(true)
  })

  it('filters mutation traits correctly', () => {
    const mutations = getTraitsByRarity('mutation')
    expect(mutations.length).toBe(2)
    expect(mutations.every((t) => t.rarity === 'mutation')).toBe(true)
  })
})

describe('getMutationTraits', () => {
  it('returns only mutation traits', () => {
    const mutations = getMutationTraits()
    expect(mutations.length).toBe(2)
    expect(mutations.map((t) => t.traitId)).toContain('primal-power')
    expect(mutations.map((t) => t.traitId)).toContain('chaos-touched')
  })
})

describe('getRareTraits', () => {
  it('returns only rare traits', () => {
    const rare = getRareTraits()
    expect(rare.length).toBe(2)
    expect(rare.map((t) => t.traitId)).toContain('iron-will')
    expect(rare.map((t) => t.traitId)).toContain('swift-strike')
  })
})

describe('getCommonTraits', () => {
  it('returns only common traits', () => {
    const common = getCommonTraits()
    expect(common.length).toBe(3)
    expect(common.map((t) => t.traitId)).toContain('fierce')
    expect(common.map((t) => t.traitId)).toContain('tough')
    expect(common.map((t) => t.traitId)).toContain('nimble')
  })
})

describe('applyTraitBonuses', () => {
  it('applies single trait bonus correctly', () => {
    const stats = createBaseStats()
    const modified = applyTraitBonuses(stats, ['fierce'])

    expect(modified.attack).toBe(30) // 20 + 10
    expect(modified.defense).toBe(15) // unchanged
  })

  it('applies multiple trait bonuses', () => {
    const stats = createBaseStats()
    const modified = applyTraitBonuses(stats, ['fierce', 'nimble'])

    expect(modified.attack).toBe(30) // 20 + 10
    expect(modified.speed).toBe(26) // 16 + 10
  })

  it('applies HP bonus and updates currentHp', () => {
    const stats = createBaseStats()
    const modified = applyTraitBonuses(stats, ['tough'])

    expect(modified.maxHp).toBe(115) // 100 + 15
    expect(modified.currentHp).toBe(115) // should also increase
  })

  it('handles mutation traits with multiple modifiers', () => {
    const stats = createBaseStats()
    const modified = applyTraitBonuses(stats, ['chaos-touched'])

    expect(modified.attack).toBe(28) // 20 + 8
    expect(modified.magicAttack).toBe(26) // 18 + 8
    expect(modified.speed).toBe(20) // 16 + 4
  })

  it('returns unchanged stats for empty trait list', () => {
    const stats = createBaseStats()
    const modified = applyTraitBonuses(stats, [])

    expect(modified).toEqual(stats)
  })

  it('ignores invalid trait IDs', () => {
    const stats = createBaseStats()
    const modified = applyTraitBonuses(stats, ['nonexistent', 'fierce'])

    expect(modified.attack).toBe(30) // only fierce applied
  })

  it('stacks bonuses from multiple traits', () => {
    const stats = createBaseStats()
    const modified = applyTraitBonuses(stats, ['fierce', 'primal-power'])

    expect(modified.attack).toBe(45) // 20 + 10 + 15
    expect(modified.maxHp).toBe(105) // 100 + 5
  })
})

describe('calculateTraitValue', () => {
  it('calculates value for common traits (1 point each)', () => {
    const value = calculateTraitValue(['fierce', 'tough'])
    expect(value).toBe(2)
  })

  it('calculates value for rare traits (3 points each)', () => {
    const value = calculateTraitValue(['iron-will', 'swift-strike'])
    expect(value).toBe(6)
  })

  it('calculates value for mutation traits (5 points each)', () => {
    const value = calculateTraitValue(['primal-power'])
    expect(value).toBe(5)
  })

  it('calculates mixed rarity value', () => {
    const value = calculateTraitValue(['fierce', 'iron-will', 'primal-power'])
    expect(value).toBe(9) // 1 + 3 + 5
  })

  it('returns 0 for empty array', () => {
    const value = calculateTraitValue([])
    expect(value).toBe(0)
  })

  it('ignores invalid trait IDs', () => {
    const value = calculateTraitValue(['fierce', 'nonexistent'])
    expect(value).toBe(1)
  })
})

describe('getUniqueTraits', () => {
  it('combines traits without duplicates', () => {
    const result = getUniqueTraits(['fierce', 'tough'], ['tough', 'nimble'])
    expect(result.length).toBe(3)
    expect(result).toContain('fierce')
    expect(result).toContain('tough')
    expect(result).toContain('nimble')
  })

  it('handles empty arrays', () => {
    const result = getUniqueTraits([], ['fierce'])
    expect(result).toEqual(['fierce'])
  })

  it('handles both empty arrays', () => {
    const result = getUniqueTraits([], [])
    expect(result).toEqual([])
  })

  it('removes duplicates within same array', () => {
    const result = getUniqueTraits(['fierce', 'fierce'], ['tough'])
    expect(result.length).toBe(2)
  })
})

describe('filterValidTraits', () => {
  it('filters out invalid trait IDs', () => {
    const result = filterValidTraits(['fierce', 'nonexistent', 'tough'])
    expect(result.length).toBe(2)
    expect(result).toContain('fierce')
    expect(result).toContain('tough')
    expect(result).not.toContain('nonexistent')
  })

  it('returns empty array if all invalid', () => {
    const result = filterValidTraits(['foo', 'bar', 'baz'])
    expect(result.length).toBe(0)
  })

  it('returns all traits if all valid', () => {
    const result = filterValidTraits(['fierce', 'tough', 'nimble'])
    expect(result.length).toBe(3)
  })
})
