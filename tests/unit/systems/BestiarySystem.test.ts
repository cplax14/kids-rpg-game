import { describe, it, expect, beforeEach } from 'vitest'
import {
  discoverSpecies,
  discoverMultipleSpecies,
  isSpeciesDiscovered,
  getDiscoveryCount,
  getTotalSpeciesCount,
  getDiscoveryProgress,
  getDiscoveredSpeciesData,
  getUndiscoveredSpeciesIds,
  sortDiscoveredByName,
  sortDiscoveredByElement,
  filterDiscoveredByElement,
  filterDiscoveredByRarity,
} from '../../../src/systems/BestiarySystem'
import { loadSpeciesData, loadAbilityData } from '../../../src/systems/MonsterSystem'
import type { MonsterSpecies, Ability } from '../../../src/models/types'

const mockAbility: Ability = {
  abilityId: 'test-attack',
  name: 'Test Attack',
  description: 'A test attack',
  element: 'fire',
  type: 'physical',
  power: 40,
  accuracy: 95,
  mpCost: 5,
  targetType: 'single_enemy',
  statusEffect: null,
  animation: 'slash',
}

const mockSpecies: ReadonlyArray<MonsterSpecies> = [
  {
    speciesId: 'flamepup',
    name: 'Flamepup',
    description: 'A fiery puppy',
    element: 'fire',
    rarity: 'common',
    baseStats: {
      maxHp: 80, currentHp: 80, maxMp: 30, currentMp: 30,
      attack: 15, defense: 10, magicAttack: 12, magicDefense: 8, speed: 11, luck: 5,
    },
    statGrowth: { hp: 8, mp: 3, attack: 2, defense: 1.5, magicAttack: 2, magicDefense: 1, speed: 1 },
    abilities: [{ abilityId: 'test-attack', learnAtLevel: 1 }],
    captureBaseDifficulty: 0.3,
    spriteKey: 'flamepup',
    evolutionChain: null,
    breedingGroup: 'beast',
    breedingTraits: ['fire-affinity'],
  },
  {
    speciesId: 'bubblefin',
    name: 'Bubblefin',
    description: 'A bubbly fish',
    element: 'water',
    rarity: 'common',
    baseStats: {
      maxHp: 70, currentHp: 70, maxMp: 40, currentMp: 40,
      attack: 10, defense: 12, magicAttack: 18, magicDefense: 14, speed: 9, luck: 6,
    },
    statGrowth: { hp: 6, mp: 4, attack: 1.5, defense: 1.5, magicAttack: 2.5, magicDefense: 2, speed: 1 },
    abilities: [{ abilityId: 'test-attack', learnAtLevel: 1 }],
    captureBaseDifficulty: 0.3,
    spriteKey: 'bubblefin',
    evolutionChain: null,
    breedingGroup: 'aquatic',
    breedingTraits: ['water-affinity'],
  },
  {
    speciesId: 'shadowpup',
    name: 'Shadowpup',
    description: 'A mysterious shadow creature',
    element: 'dark',
    rarity: 'rare',
    baseStats: {
      maxHp: 90, currentHp: 90, maxMp: 35, currentMp: 35,
      attack: 18, defense: 8, magicAttack: 16, magicDefense: 10, speed: 14, luck: 8,
    },
    statGrowth: { hp: 7, mp: 3, attack: 2.5, defense: 1, magicAttack: 2.5, magicDefense: 1.5, speed: 1.5 },
    abilities: [{ abilityId: 'test-attack', learnAtLevel: 1 }],
    captureBaseDifficulty: 0.6,
    spriteKey: 'shadowpup',
    evolutionChain: null,
    breedingGroup: 'shadow',
    breedingTraits: ['dark-affinity'],
  },
]

beforeEach(() => {
  loadSpeciesData(mockSpecies)
  loadAbilityData([mockAbility])
})

describe('discoverSpecies', () => {
  it('adds new species to discovered list', () => {
    const discovered: ReadonlyArray<string> = []
    const result = discoverSpecies(discovered, 'flamepup')

    expect(result).toContain('flamepup')
    expect(result.length).toBe(1)
  })

  it('is idempotent - does not duplicate', () => {
    const discovered = ['flamepup']
    const result = discoverSpecies(discovered, 'flamepup')

    expect(result).toBe(discovered)
    expect(result.length).toBe(1)
  })

  it('does not mutate original array', () => {
    const discovered: ReadonlyArray<string> = []
    discoverSpecies(discovered, 'flamepup')

    expect(discovered.length).toBe(0)
  })
})

describe('discoverMultipleSpecies', () => {
  it('adds multiple new species', () => {
    const discovered: ReadonlyArray<string> = []
    const result = discoverMultipleSpecies(discovered, ['flamepup', 'bubblefin'])

    expect(result.length).toBe(2)
    expect(result).toContain('flamepup')
    expect(result).toContain('bubblefin')
  })

  it('skips already discovered species', () => {
    const discovered = ['flamepup']
    const result = discoverMultipleSpecies(discovered, ['flamepup', 'bubblefin'])

    expect(result.length).toBe(2)
  })

  it('returns same array if all already discovered', () => {
    const discovered = ['flamepup', 'bubblefin']
    const result = discoverMultipleSpecies(discovered, ['flamepup', 'bubblefin'])

    expect(result).toBe(discovered)
  })
})

describe('isSpeciesDiscovered', () => {
  it('returns true for discovered species', () => {
    const discovered = ['flamepup']
    expect(isSpeciesDiscovered(discovered, 'flamepup')).toBe(true)
  })

  it('returns false for undiscovered species', () => {
    const discovered = ['flamepup']
    expect(isSpeciesDiscovered(discovered, 'bubblefin')).toBe(false)
  })

  it('returns false for empty list', () => {
    expect(isSpeciesDiscovered([], 'flamepup')).toBe(false)
  })
})

describe('getDiscoveryCount', () => {
  it('returns 0 for empty list', () => {
    expect(getDiscoveryCount([])).toBe(0)
  })

  it('returns correct count', () => {
    const discovered = ['flamepup', 'bubblefin']
    expect(getDiscoveryCount(discovered)).toBe(2)
  })
})

describe('getTotalSpeciesCount', () => {
  it('returns total count from registry', () => {
    expect(getTotalSpeciesCount()).toBe(3)
  })
})

describe('getDiscoveryProgress', () => {
  it('returns correct progress for empty discoveries', () => {
    const progress = getDiscoveryProgress([])

    expect(progress.discovered).toBe(0)
    expect(progress.total).toBe(3)
    expect(progress.percentage).toBe(0)
  })

  it('returns correct progress for partial discoveries', () => {
    const progress = getDiscoveryProgress(['flamepup'])

    expect(progress.discovered).toBe(1)
    expect(progress.total).toBe(3)
    expect(progress.percentage).toBe(33)
  })

  it('returns 100% for complete discoveries', () => {
    const progress = getDiscoveryProgress(['flamepup', 'bubblefin', 'shadowpup'])

    expect(progress.discovered).toBe(3)
    expect(progress.percentage).toBe(100)
  })
})

describe('getDiscoveredSpeciesData', () => {
  it('returns full species data for discovered', () => {
    const discovered = ['flamepup', 'bubblefin']
    const data = getDiscoveredSpeciesData(discovered)

    expect(data.length).toBe(2)
    expect(data[0].name).toBe('Flamepup')
    expect(data[1].name).toBe('Bubblefin')
  })

  it('returns empty array for empty discoveries', () => {
    expect(getDiscoveredSpeciesData([])).toHaveLength(0)
  })

  it('filters out invalid species ids', () => {
    const discovered = ['flamepup', 'nonexistent']
    const data = getDiscoveredSpeciesData(discovered)

    expect(data.length).toBe(1)
    expect(data[0].speciesId).toBe('flamepup')
  })
})

describe('getUndiscoveredSpeciesIds', () => {
  it('returns all species when none discovered', () => {
    const undiscovered = getUndiscoveredSpeciesIds([])

    expect(undiscovered.length).toBe(3)
  })

  it('excludes discovered species', () => {
    const undiscovered = getUndiscoveredSpeciesIds(['flamepup'])

    expect(undiscovered.length).toBe(2)
    expect(undiscovered).not.toContain('flamepup')
  })

  it('returns empty when all discovered', () => {
    const undiscovered = getUndiscoveredSpeciesIds(['flamepup', 'bubblefin', 'shadowpup'])

    expect(undiscovered.length).toBe(0)
  })
})

describe('sortDiscoveredByName', () => {
  it('sorts alphabetically', () => {
    const discovered = ['shadowpup', 'flamepup', 'bubblefin']
    const sorted = sortDiscoveredByName(discovered)

    expect(sorted[0].name).toBe('Bubblefin')
    expect(sorted[1].name).toBe('Flamepup')
    expect(sorted[2].name).toBe('Shadowpup')
  })
})

describe('sortDiscoveredByElement', () => {
  it('sorts by element order then name', () => {
    const discovered = ['shadowpup', 'flamepup', 'bubblefin']
    const sorted = sortDiscoveredByElement(discovered)

    // fire, water, dark order
    expect(sorted[0].element).toBe('fire')
    expect(sorted[1].element).toBe('water')
    expect(sorted[2].element).toBe('dark')
  })
})

describe('filterDiscoveredByElement', () => {
  it('returns only matching element', () => {
    const discovered = ['flamepup', 'bubblefin', 'shadowpup']
    const fire = filterDiscoveredByElement(discovered, 'fire')

    expect(fire.length).toBe(1)
    expect(fire[0].speciesId).toBe('flamepup')
  })

  it('returns empty array if no match', () => {
    const discovered = ['flamepup']
    const wind = filterDiscoveredByElement(discovered, 'wind')

    expect(wind.length).toBe(0)
  })
})

describe('filterDiscoveredByRarity', () => {
  it('returns only matching rarity', () => {
    const discovered = ['flamepup', 'bubblefin', 'shadowpup']
    const rare = filterDiscoveredByRarity(discovered, 'rare')

    expect(rare.length).toBe(1)
    expect(rare[0].speciesId).toBe('shadowpup')
  })

  it('returns all common when filtering common', () => {
    const discovered = ['flamepup', 'bubblefin', 'shadowpup']
    const common = filterDiscoveredByRarity(discovered, 'common')

    expect(common.length).toBe(2)
  })
})
