import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadSpeciesData,
  loadAbilityData,
  getSpecies,
  getAllSpecies,
  getAbility,
  getAllAbilities,
  calculateMonsterStats,
  getLearnedAbilitiesAtLevel,
  createMonsterInstance,
  addExperienceToMonster,
  healMonster,
  damageMonster,
  isMonsterAlive,
  setMonsterInSquad,
  increaseBondLevel,
} from '../../../src/systems/MonsterSystem'
import type { MonsterSpecies, Ability, CharacterStats } from '../../../src/models/types'

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

const mockAbility2: Ability = {
  abilityId: 'test-heal',
  name: 'Test Heal',
  description: 'A test heal',
  element: 'light',
  type: 'healing',
  power: 30,
  accuracy: 100,
  mpCost: 8,
  targetType: 'self',
  statusEffect: null,
  animation: 'glow',
}

const mockSpecies: MonsterSpecies = {
  speciesId: 'test-mon',
  name: 'Testmon',
  description: 'A test monster',
  element: 'fire',
  rarity: 'common',
  baseStats: {
    maxHp: 80,
    currentHp: 80,
    maxMp: 30,
    currentMp: 30,
    attack: 15,
    defense: 10,
    magicAttack: 12,
    magicDefense: 8,
    speed: 11,
    luck: 5,
  },
  statGrowth: {
    hp: 8,
    mp: 3,
    attack: 2,
    defense: 1.5,
    magicAttack: 2,
    magicDefense: 1,
    speed: 1,
  },
  abilities: [
    { abilityId: 'test-attack', learnAtLevel: 1 },
    { abilityId: 'test-heal', learnAtLevel: 5 },
  ],
  captureBaseDifficulty: 0.5,
  spriteKey: 'test-mon-sprite',
  evolutionChain: null,
  breedingGroup: 'beast',
  breedingTraits: ['fire-affinity'],
}

beforeEach(() => {
  loadSpeciesData([mockSpecies])
  loadAbilityData([mockAbility, mockAbility2])
})

describe('species registry', () => {
  it('loads and retrieves species by id', () => {
    const species = getSpecies('test-mon')
    expect(species).toBeDefined()
    expect(species!.name).toBe('Testmon')
  })

  it('returns undefined for unknown species', () => {
    expect(getSpecies('nonexistent')).toBeUndefined()
  })

  it('returns all loaded species', () => {
    const all = getAllSpecies()
    expect(all).toHaveLength(1)
    expect(all[0].speciesId).toBe('test-mon')
  })
})

describe('ability registry', () => {
  it('loads and retrieves ability by id', () => {
    const ability = getAbility('test-attack')
    expect(ability).toBeDefined()
    expect(ability!.name).toBe('Test Attack')
  })

  it('returns undefined for unknown ability', () => {
    expect(getAbility('nonexistent')).toBeUndefined()
  })

  it('returns all loaded abilities', () => {
    const all = getAllAbilities()
    expect(all).toHaveLength(2)
  })
})

describe('calculateMonsterStats', () => {
  it('returns base stats at level 1', () => {
    const stats = calculateMonsterStats(mockSpecies, 1)
    expect(stats.maxHp).toBe(80)
    expect(stats.attack).toBe(15)
    expect(stats.defense).toBe(10)
  })

  it('grows stats at higher levels', () => {
    const stats = calculateMonsterStats(mockSpecies, 5)
    // maxHp: 80 + floor(8 * 4) = 112
    expect(stats.maxHp).toBe(112)
    // attack: 15 + floor(2 * 4) = 23
    expect(stats.attack).toBe(23)
    // defense: 10 + floor(1.5 * 4) = 16
    expect(stats.defense).toBe(16)
  })

  it('sets currentHp and currentMp to max', () => {
    const stats = calculateMonsterStats(mockSpecies, 5)
    expect(stats.currentHp).toBe(stats.maxHp)
    expect(stats.currentMp).toBe(stats.maxMp)
  })

  it('luck stays constant', () => {
    const stats = calculateMonsterStats(mockSpecies, 10)
    expect(stats.luck).toBe(mockSpecies.baseStats.luck)
  })
})

describe('getLearnedAbilitiesAtLevel', () => {
  it('returns abilities learned by given level', () => {
    const abilities = getLearnedAbilitiesAtLevel(mockSpecies, 1)
    expect(abilities).toHaveLength(1)
    expect(abilities[0].abilityId).toBe('test-attack')
  })

  it('returns more abilities at higher levels', () => {
    const abilities = getLearnedAbilitiesAtLevel(mockSpecies, 5)
    expect(abilities).toHaveLength(2)
  })

  it('returns empty array if no abilities learned yet', () => {
    const emptySpecies: MonsterSpecies = {
      ...mockSpecies,
      abilities: [{ abilityId: 'test-attack', learnAtLevel: 10 }],
    }
    const abilities = getLearnedAbilitiesAtLevel(emptySpecies, 1)
    expect(abilities).toHaveLength(0)
  })
})

describe('createMonsterInstance', () => {
  it('creates a monster instance with correct species', () => {
    const instance = createMonsterInstance('test-mon', 3)
    expect(instance).toBeDefined()
    expect(instance!.speciesId).toBe('test-mon')
    expect(instance!.level).toBe(3)
  })

  it('returns undefined for unknown species', () => {
    expect(createMonsterInstance('nonexistent', 1)).toBeUndefined()
  })

  it('clamps level to valid range', () => {
    const instance = createMonsterInstance('test-mon', 0)
    expect(instance!.level).toBe(1)

    const high = createMonsterInstance('test-mon', 100)
    expect(high!.level).toBe(25)
  })

  it('starts with 0 experience and bond level', () => {
    const instance = createMonsterInstance('test-mon', 1)
    expect(instance!.experience).toBe(0)
    expect(instance!.bondLevel).toBe(0)
  })

  it('starts not in squad', () => {
    const instance = createMonsterInstance('test-mon', 1)
    expect(instance!.isInSquad).toBe(false)
  })

  it('has correct stats for level', () => {
    const instance = createMonsterInstance('test-mon', 5)!
    const expectedStats = calculateMonsterStats(mockSpecies, 5)
    expect(instance.stats.maxHp).toBe(expectedStats.maxHp)
    expect(instance.stats.attack).toBe(expectedStats.attack)
  })

  it('has correct abilities for level', () => {
    const instance = createMonsterInstance('test-mon', 5)!
    expect(instance.learnedAbilities).toHaveLength(2)
  })

  it('accepts optional nickname', () => {
    const instance = createMonsterInstance('test-mon', 1, { nickname: 'Sparky' })
    expect(instance!.nickname).toBe('Sparky')
  })

  it('accepts optional inherited traits', () => {
    const instance = createMonsterInstance('test-mon', 1, {
      inheritedTraits: ['fire-boost'],
      parentSpeciesIds: ['parent-a', 'parent-b'],
    })
    expect(instance!.inheritedTraits).toEqual(['fire-boost'])
    expect(instance!.parentSpeciesIds).toEqual(['parent-a', 'parent-b'])
  })

  it('generates unique instance IDs', () => {
    const a = createMonsterInstance('test-mon', 1)!
    const b = createMonsterInstance('test-mon', 1)!
    expect(a.instanceId).not.toBe(b.instanceId)
  })
})

describe('addExperienceToMonster', () => {
  it('adds XP without leveling up', () => {
    const instance = createMonsterInstance('test-mon', 1)!
    const updated = addExperienceToMonster(instance, 50)
    expect(updated.experience).toBe(50)
    expect(updated.level).toBe(1)
  })

  it('does not mutate original', () => {
    const instance = createMonsterInstance('test-mon', 1)!
    const updated = addExperienceToMonster(instance, 50)
    expect(instance.experience).toBe(0)
    expect(updated).not.toBe(instance)
  })

  it('levels up when enough XP is gained', () => {
    const instance = createMonsterInstance('test-mon', 1)!
    // Level 1 requires 100 XP to level up (1 * 100)
    const updated = addExperienceToMonster(instance, 100)
    expect(updated.level).toBe(2)
  })

  it('returns same monster at max level', () => {
    const instance = { ...createMonsterInstance('test-mon', 25)!, level: 25 }
    const result = addExperienceToMonster(instance, 1000)
    expect(result).toBe(instance)
  })

  it('updates stats and abilities on level up', () => {
    const instance = createMonsterInstance('test-mon', 1)!
    const updated = addExperienceToMonster(instance, 100)
    expect(updated.stats.maxHp).toBeGreaterThan(instance.stats.maxHp)
  })

  it('preserves HP ratio on level up', () => {
    const instance = {
      ...createMonsterInstance('test-mon', 1)!,
      stats: {
        ...createMonsterInstance('test-mon', 1)!.stats,
        currentHp: 40, // 50% of 80 maxHp
      },
    }
    const updated = addExperienceToMonster(instance, 100)
    const ratio = updated.stats.currentHp / updated.stats.maxHp
    expect(ratio).toBeCloseTo(0.5, 1)
  })
})

describe('healMonster', () => {
  it('heals HP and MP', () => {
    const instance = {
      ...createMonsterInstance('test-mon', 1)!,
      stats: { ...createMonsterInstance('test-mon', 1)!.stats, currentHp: 30, currentMp: 10 },
    }
    const healed = healMonster(instance, 20, 10)
    expect(healed.stats.currentHp).toBe(50)
    expect(healed.stats.currentMp).toBe(20)
  })

  it('does not exceed max', () => {
    const instance = createMonsterInstance('test-mon', 1)!
    const healed = healMonster(instance, 999, 999)
    expect(healed.stats.currentHp).toBe(instance.stats.maxHp)
    expect(healed.stats.currentMp).toBe(instance.stats.maxMp)
  })
})

describe('damageMonster', () => {
  it('reduces HP', () => {
    const instance = createMonsterInstance('test-mon', 1)!
    const damaged = damageMonster(instance, 30)
    expect(damaged.stats.currentHp).toBe(50)
  })

  it('does not go below 0', () => {
    const instance = createMonsterInstance('test-mon', 1)!
    const damaged = damageMonster(instance, 999)
    expect(damaged.stats.currentHp).toBe(0)
  })
})

describe('isMonsterAlive', () => {
  it('returns true when HP > 0', () => {
    const instance = createMonsterInstance('test-mon', 1)!
    expect(isMonsterAlive(instance)).toBe(true)
  })

  it('returns false when HP is 0', () => {
    const instance = damageMonster(createMonsterInstance('test-mon', 1)!, 999)
    expect(isMonsterAlive(instance)).toBe(false)
  })
})

describe('setMonsterInSquad', () => {
  it('sets isInSquad immutably', () => {
    const instance = createMonsterInstance('test-mon', 1)!
    const updated = setMonsterInSquad(instance, true)
    expect(updated.isInSquad).toBe(true)
    expect(instance.isInSquad).toBe(false)
  })
})

describe('increaseBondLevel', () => {
  it('increases bond level', () => {
    const instance = createMonsterInstance('test-mon', 1)!
    const updated = increaseBondLevel(instance, 10)
    expect(updated.bondLevel).toBe(10)
  })

  it('clamps to 100', () => {
    const instance = createMonsterInstance('test-mon', 1)!
    const updated = increaseBondLevel(instance, 150)
    expect(updated.bondLevel).toBe(100)
  })

  it('does not go below 0', () => {
    const instance = createMonsterInstance('test-mon', 1)!
    const updated = increaseBondLevel(instance, -10)
    expect(updated.bondLevel).toBe(0)
  })
})
