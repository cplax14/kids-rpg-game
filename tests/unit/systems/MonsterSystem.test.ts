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
  addExperienceToMonsterWithInfo,
  healMonster,
  damageMonster,
  isMonsterAlive,
  setMonsterInSquad,
  increaseBondLevel,
  getAllAvailableAbilities,
  checkEvolution,
  evolveMonster,
  checkAndEvolve,
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
  obtainableVia: 'both',
}

// Mock species with evolution chain
const mockEvolvableSpecies: MonsterSpecies = {
  speciesId: 'evolvable-mon',
  name: 'Evolvable Monster',
  description: 'A monster that can evolve',
  element: 'fire',
  rarity: 'common',
  baseStats: {
    maxHp: 70,
    currentHp: 70,
    maxMp: 25,
    currentMp: 25,
    attack: 12,
    defense: 8,
    magicAttack: 10,
    magicDefense: 7,
    speed: 10,
    luck: 5,
  },
  statGrowth: {
    hp: 6,
    mp: 2,
    attack: 2,
    defense: 1,
    magicAttack: 1,
    magicDefense: 1,
    speed: 1,
  },
  abilities: [
    { abilityId: 'test-attack', learnAtLevel: 1 },
  ],
  captureBaseDifficulty: 0.3,
  spriteKey: 'evolvable-mon-sprite',
  evolutionChain: {
    evolvesTo: 'evolved-mon',
    levelRequired: 10,
    itemRequired: null,
  },
  breedingGroup: 'beast',
  breedingTraits: [],
  obtainableVia: 'both',
}

// Mock evolved form
const mockEvolvedSpecies: MonsterSpecies = {
  speciesId: 'evolved-mon',
  name: 'Evolved Monster',
  description: 'The evolved form',
  element: 'fire',
  rarity: 'uncommon',
  baseStats: {
    maxHp: 100,
    currentHp: 100,
    maxMp: 40,
    currentMp: 40,
    attack: 18,
    defense: 12,
    magicAttack: 15,
    magicDefense: 10,
    speed: 14,
    luck: 7,
  },
  statGrowth: {
    hp: 9,
    mp: 4,
    attack: 3,
    defense: 2,
    magicAttack: 2,
    magicDefense: 1.5,
    speed: 2,
  },
  abilities: [
    { abilityId: 'test-attack', learnAtLevel: 1 },
    { abilityId: 'test-heal', learnAtLevel: 5 },
  ],
  captureBaseDifficulty: 0.6,
  spriteKey: 'evolved-mon-sprite',
  evolutionChain: null,
  breedingGroup: 'beast',
  breedingTraits: [],
  obtainableVia: 'both',
}

// Mock species with item-required evolution
const mockItemEvolutionSpecies: MonsterSpecies = {
  speciesId: 'item-evolve-mon',
  name: 'Item Evolve Monster',
  description: 'Needs an item to evolve',
  element: 'water',
  rarity: 'common',
  baseStats: mockEvolvableSpecies.baseStats,
  statGrowth: mockEvolvableSpecies.statGrowth,
  abilities: mockEvolvableSpecies.abilities,
  captureBaseDifficulty: 0.3,
  spriteKey: 'item-evolve-sprite',
  evolutionChain: {
    evolvesTo: 'evolved-mon',
    levelRequired: 10,
    itemRequired: 'evolution-stone',
  },
  breedingGroup: 'beast',
  breedingTraits: [],
  obtainableVia: 'both',
}

beforeEach(() => {
  loadSpeciesData([mockSpecies, mockEvolvableSpecies, mockEvolvedSpecies, mockItemEvolutionSpecies])
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
    expect(all).toHaveLength(4) // test-mon, evolvable-mon, evolved-mon, item-evolve-mon
    expect(all.some((s) => s.speciesId === 'test-mon')).toBe(true)
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

describe('addExperienceToMonsterWithInfo', () => {
  it('returns level-up info when monster levels up', () => {
    const instance = createMonsterInstance('test-mon', 1)!
    // Level 1 needs 100 XP to level up (level * 100)
    const result = addExperienceToMonsterWithInfo(instance, 100)

    expect(result.didLevelUp).toBe(true)
    expect(result.previousLevel).toBe(1)
    expect(result.newLevel).toBe(2)
    expect(result.monster.level).toBe(2)
    expect(result.xpGained).toBe(100)
  })

  it('returns no level-up when insufficient XP', () => {
    const instance = createMonsterInstance('test-mon', 1)!
    const result = addExperienceToMonsterWithInfo(instance, 50)

    expect(result.didLevelUp).toBe(false)
    expect(result.previousLevel).toBe(1)
    expect(result.newLevel).toBe(1)
    expect(result.monster.level).toBe(1)
    expect(result.monster.experience).toBe(50)
  })

  it('handles multiple level-ups correctly', () => {
    const instance = createMonsterInstance('test-mon', 1)!
    // Level 1->2 needs 100, level 2->3 needs 200 = 300 total
    const result = addExperienceToMonsterWithInfo(instance, 300)

    expect(result.didLevelUp).toBe(true)
    expect(result.previousLevel).toBe(1)
    expect(result.newLevel).toBe(3)
    expect(result.monster.level).toBe(3)
  })

  it('returns same monster when at max level', () => {
    const instance = {
      ...createMonsterInstance('test-mon', 25)!,
      level: 25,
    }
    const result = addExperienceToMonsterWithInfo(instance, 1000)

    expect(result.didLevelUp).toBe(false)
    expect(result.previousLevel).toBe(25)
    expect(result.newLevel).toBe(25)
    expect(result.monster).toBe(instance)
  })

  it('tracks XP gained accurately', () => {
    const instance = createMonsterInstance('test-mon', 1)!
    const result = addExperienceToMonsterWithInfo(instance, 75)

    expect(result.xpGained).toBe(75)
    expect(result.monster.experience).toBe(75)
  })
})

describe('getAllAvailableAbilities', () => {
  it('returns learned abilities for monster without legacy abilities', () => {
    const instance = createMonsterInstance('test-mon', 5)!
    const abilities = getAllAvailableAbilities(instance)

    // Level 5 should have both test-attack (level 1) and test-heal (level 5)
    expect(abilities.length).toBe(2)
    expect(abilities.some((a) => a.abilityId === 'test-attack')).toBe(true)
    expect(abilities.some((a) => a.abilityId === 'test-heal')).toBe(true)
  })

  it('includes legacy abilities in addition to learned abilities', () => {
    const instance = createMonsterInstance('test-mon', 1)!

    // Manually add a legacy ability
    const monsterWithLegacy = {
      ...instance,
      legacyAbilities: ['test-heal'], // Normally learned at level 5
    }

    const abilities = getAllAvailableAbilities(monsterWithLegacy)

    // Should have test-attack (learned at level 1) + test-heal (legacy)
    expect(abilities.length).toBe(2)
    expect(abilities.some((a) => a.abilityId === 'test-attack')).toBe(true)
    expect(abilities.some((a) => a.abilityId === 'test-heal')).toBe(true)
  })

  it('does not duplicate abilities already in learned abilities', () => {
    const instance = createMonsterInstance('test-mon', 5)!

    // Add legacy ability that's already learned
    const monsterWithDuplicateLegacy = {
      ...instance,
      legacyAbilities: ['test-attack'], // Already learned at level 1
    }

    const abilities = getAllAvailableAbilities(monsterWithDuplicateLegacy)

    // Should still only have 2 abilities (no duplicates)
    expect(abilities.length).toBe(2)
    const attackAbilities = abilities.filter((a) => a.abilityId === 'test-attack')
    expect(attackAbilities.length).toBe(1)
  })

  it('handles monster with empty legacy abilities', () => {
    const instance = createMonsterInstance('test-mon', 1)!
    const monsterWithEmptyLegacy = {
      ...instance,
      legacyAbilities: [],
    }

    const abilities = getAllAvailableAbilities(monsterWithEmptyLegacy)
    expect(abilities.length).toBe(1)
    expect(abilities[0].abilityId).toBe('test-attack')
  })

  it('handles undefined legacy abilities gracefully', () => {
    const instance = createMonsterInstance('test-mon', 1)!
    const abilities = getAllAvailableAbilities(instance)

    // Default legacyAbilities is empty array, should work fine
    expect(abilities.length).toBe(1)
  })

  it('skips invalid legacy ability IDs', () => {
    const instance = createMonsterInstance('test-mon', 1)!
    const monsterWithInvalidLegacy = {
      ...instance,
      legacyAbilities: ['nonexistent-ability'],
    }

    const abilities = getAllAvailableAbilities(monsterWithInvalidLegacy)

    // Should only have the learned ability, invalid legacy skipped
    expect(abilities.length).toBe(1)
    expect(abilities[0].abilityId).toBe('test-attack')
  })
})

describe('checkEvolution', () => {
  it('returns canEvolve: false for species without evolution chain', () => {
    const instance = createMonsterInstance('test-mon', 15)!
    const result = checkEvolution(instance)

    expect(result.canEvolve).toBe(false)
    expect(result.evolvesToSpeciesId).toBe(null)
  })

  it('returns canEvolve: false when level is too low', () => {
    const instance = createMonsterInstance('evolvable-mon', 5)!
    const result = checkEvolution(instance)

    expect(result.canEvolve).toBe(false)
    expect(result.evolvesToSpeciesId).toBe('evolved-mon')
  })

  it('returns canEvolve: true when level requirement is met', () => {
    const instance = createMonsterInstance('evolvable-mon', 10)!
    const result = checkEvolution(instance)

    expect(result.canEvolve).toBe(true)
    expect(result.evolvesToSpeciesId).toBe('evolved-mon')
    expect(result.requiresItem).toBe(false)
  })

  it('returns canEvolve: false when item is required', () => {
    const instance = createMonsterInstance('item-evolve-mon', 15)!
    const result = checkEvolution(instance)

    expect(result.canEvolve).toBe(false)
    expect(result.evolvesToSpeciesId).toBe('evolved-mon')
    expect(result.requiresItem).toBe(true)
    expect(result.requiredItemId).toBe('evolution-stone')
  })
})

describe('evolveMonster', () => {
  it('evolves monster to new species', () => {
    const instance = createMonsterInstance('evolvable-mon', 10)!
    const result = evolveMonster(instance)

    expect(result.evolved).toBe(true)
    expect(result.originalSpeciesId).toBe('evolvable-mon')
    expect(result.newSpeciesId).toBe('evolved-mon')
    expect(result.monster.speciesId).toBe('evolved-mon')
  })

  it('preserves level after evolution', () => {
    const instance = createMonsterInstance('evolvable-mon', 12)!
    const result = evolveMonster(instance)

    expect(result.monster.level).toBe(12)
  })

  it('preserves experience after evolution', () => {
    const instance = {
      ...createMonsterInstance('evolvable-mon', 10)!,
      experience: 500,
    }
    const result = evolveMonster(instance)

    expect(result.monster.experience).toBe(500)
  })

  it('preserves bond level after evolution', () => {
    const instance = {
      ...createMonsterInstance('evolvable-mon', 10)!,
      bondLevel: 75,
    }
    const result = evolveMonster(instance)

    expect(result.monster.bondLevel).toBe(75)
  })

  it('preserves inherited traits after evolution', () => {
    const instance = {
      ...createMonsterInstance('evolvable-mon', 10)!,
      inheritedTraits: ['fireproof', 'fierce'],
    }
    const result = evolveMonster(instance)

    expect(result.monster.inheritedTraits).toEqual(['fireproof', 'fierce'])
  })

  it('preserves generation and breeding data after evolution', () => {
    const instance = {
      ...createMonsterInstance('evolvable-mon', 10)!,
      generation: 2,
      inheritedStatBonus: { attack: 5 },
      legacyAbilities: ['test-heal'],
      isPerfect: true,
    }
    const result = evolveMonster(instance)

    expect(result.monster.generation).toBe(2)
    expect(result.monster.inheritedStatBonus).toEqual({ attack: 5 })
    expect(result.monster.legacyAbilities).toEqual(['test-heal'])
    expect(result.monster.isPerfect).toBe(true)
  })

  it('recalculates stats using new species growth', () => {
    const instance = createMonsterInstance('evolvable-mon', 10)!
    const result = evolveMonster(instance)

    // Evolved species has higher base stats, so evolved monster should have higher stats
    expect(result.monster.stats.maxHp).toBeGreaterThan(instance.stats.maxHp)
    expect(result.monster.stats.attack).toBeGreaterThan(instance.stats.attack)
  })

  it('learns new abilities from evolved species', () => {
    const instance = createMonsterInstance('evolvable-mon', 10)!
    const result = evolveMonster(instance)

    // Evolved species has test-heal at level 5, so level 10 should have both abilities
    expect(result.monster.learnedAbilities.length).toBe(2)
  })

  it('returns evolved: false if cannot evolve', () => {
    const instance = createMonsterInstance('evolvable-mon', 5)!
    const result = evolveMonster(instance)

    expect(result.evolved).toBe(false)
    expect(result.monster).toBe(instance) // Same reference
  })

  it('preserves nickname after evolution', () => {
    const instance = {
      ...createMonsterInstance('evolvable-mon', 10)!,
      nickname: 'Sparky',
    }
    const result = evolveMonster(instance)

    expect(result.monster.nickname).toBe('Sparky')
  })
})

describe('checkAndEvolve', () => {
  it('evolves when eligible', () => {
    const instance = createMonsterInstance('evolvable-mon', 10)!
    const result = checkAndEvolve(instance)

    expect(result.evolved).toBe(true)
    expect(result.monster.speciesId).toBe('evolved-mon')
  })

  it('does not evolve when level too low', () => {
    const instance = createMonsterInstance('evolvable-mon', 5)!
    const result = checkAndEvolve(instance)

    expect(result.evolved).toBe(false)
    expect(result.monster.speciesId).toBe('evolvable-mon')
  })

  it('does not evolve species without evolution chain', () => {
    const instance = createMonsterInstance('test-mon', 25)!
    const result = checkAndEvolve(instance)

    expect(result.evolved).toBe(false)
    expect(result.monster.speciesId).toBe('test-mon')
  })

  it('does not auto-evolve when item is required', () => {
    const instance = createMonsterInstance('item-evolve-mon', 15)!
    const result = checkAndEvolve(instance)

    expect(result.evolved).toBe(false)
    expect(result.monster.speciesId).toBe('item-evolve-mon')
  })
})
