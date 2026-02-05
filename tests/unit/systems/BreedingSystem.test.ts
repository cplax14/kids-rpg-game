import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadBreedingRecipes,
  getBreedingRecipe,
  areCompatibleGroups,
  getGroupCompatibility,
  getBreedingCompatibility,
  getPossibleOffspring,
  selectOffspringSpecies,
  inheritTraits,
  rollForMutation,
  applyBreedingItemBoosts,
  createBreedingPair,
  executeBreeding,
  canBreed,
  getCompatibleMonstersForBreeding,
} from '../../../src/systems/BreedingSystem'
import { loadSpeciesData, loadAbilityData } from '../../../src/systems/MonsterSystem'
import { loadTraitData } from '../../../src/systems/TraitSystem'
import type {
  MonsterInstance,
  MonsterSpecies,
  BreedingRecipe,
  Item,
  TraitDefinition,
  Ability,
} from '../../../src/models/types'

const mockAbility: Ability = {
  abilityId: 'tackle',
  name: 'Tackle',
  description: 'A basic attack',
  element: 'neutral',
  type: 'physical',
  power: 40,
  accuracy: 95,
  mpCost: 0,
  targetType: 'single_enemy',
  statusEffect: null,
  animation: 'tackle',
}

const mockSpecies: MonsterSpecies[] = [
  {
    speciesId: 'flamepup',
    name: 'Flamepup',
    description: 'A fire puppy',
    element: 'fire',
    rarity: 'common',
    baseStats: {
      maxHp: 88,
      currentHp: 88,
      maxMp: 25,
      currentMp: 25,
      attack: 16,
      defense: 12,
      magicAttack: 14,
      magicDefense: 13,
      speed: 15,
      luck: 12,
    },
    statGrowth: { hp: 7, mp: 3, attack: 2, defense: 1, magicAttack: 2, magicDefense: 1, speed: 2 },
    abilities: [{ abilityId: 'tackle', learnAtLevel: 1 }],
    captureBaseDifficulty: 0.25,
    spriteKey: 'flamepup',
    evolutionChain: null,
    breedingGroup: 'beast',
    breedingTraits: ['fireproof', 'fierce'],
  },
  {
    speciesId: 'mossbun',
    name: 'Mossbun',
    description: 'A neutral bunny',
    element: 'neutral',
    rarity: 'common',
    baseStats: {
      maxHp: 90,
      currentHp: 90,
      maxMp: 28,
      currentMp: 28,
      attack: 13,
      defense: 14,
      magicAttack: 14,
      magicDefense: 15,
      speed: 15,
      luck: 16,
    },
    statGrowth: { hp: 7, mp: 3, attack: 1, defense: 2, magicAttack: 2, magicDefense: 2, speed: 2 },
    abilities: [{ abilityId: 'tackle', learnAtLevel: 1 }],
    captureBaseDifficulty: 0.2,
    spriteKey: 'mossbun',
    evolutionChain: null,
    breedingGroup: 'beast',
    breedingTraits: ['gentle', 'lucky'],
  },
  {
    speciesId: 'emberbun',
    name: 'Emberbun',
    description: 'A fire bunny hybrid',
    element: 'fire',
    rarity: 'uncommon',
    baseStats: {
      maxHp: 95,
      currentHp: 95,
      maxMp: 30,
      currentMp: 30,
      attack: 15,
      defense: 14,
      magicAttack: 16,
      magicDefense: 15,
      speed: 16,
      luck: 15,
    },
    statGrowth: { hp: 8, mp: 3, attack: 2, defense: 2, magicAttack: 2, magicDefense: 2, speed: 2 },
    abilities: [{ abilityId: 'tackle', learnAtLevel: 1 }],
    captureBaseDifficulty: 0.0,
    spriteKey: 'emberbun',
    evolutionChain: null,
    breedingGroup: 'beast',
    breedingTraits: ['fireproof', 'gentle', 'lucky'],
  },
  {
    speciesId: 'bubblefin',
    name: 'Bubblefin',
    description: 'A water fish',
    element: 'water',
    rarity: 'common',
    baseStats: {
      maxHp: 92,
      currentHp: 92,
      maxMp: 28,
      currentMp: 28,
      attack: 12,
      defense: 14,
      magicAttack: 16,
      magicDefense: 15,
      speed: 14,
      luck: 13,
    },
    statGrowth: { hp: 7, mp: 3, attack: 1, defense: 2, magicAttack: 2, magicDefense: 2, speed: 2 },
    abilities: [{ abilityId: 'tackle', learnAtLevel: 1 }],
    captureBaseDifficulty: 0.22,
    spriteKey: 'bubblefin',
    evolutionChain: null,
    breedingGroup: 'aquatic',
    breedingTraits: ['waterproof', 'gentle'],
  },
]

const mockTraits: TraitDefinition[] = [
  { traitId: 'fireproof', name: 'Fireproof', description: 'Fire res', statModifiers: { magicDefense: 5 }, rarity: 'common' },
  { traitId: 'fierce', name: 'Fierce', description: 'Attack boost', statModifiers: { attack: 10 }, rarity: 'common' },
  { traitId: 'gentle', name: 'Gentle', description: 'M.Def boost', statModifiers: { magicDefense: 10 }, rarity: 'common' },
  { traitId: 'lucky', name: 'Lucky', description: 'Luck boost', statModifiers: { luck: 5 }, rarity: 'common' },
  { traitId: 'waterproof', name: 'Waterproof', description: 'Water res', statModifiers: { magicDefense: 5 }, rarity: 'common' },
  { traitId: 'primal-power', name: 'Primal Power', description: 'Mutation', statModifiers: { attack: 15 }, rarity: 'mutation' },
  { traitId: 'chaos-touched', name: 'Chaos Touched', description: 'Mutation', statModifiers: { attack: 8 }, rarity: 'mutation' },
]

const mockRecipes: BreedingRecipe[] = [
  {
    recipeId: 'flamepup-mossbun',
    parents: ['flamepup', 'mossbun'],
    offspring: [
      { speciesId: 'flamepup', probability: 0.35, bonusTraits: [] },
      { speciesId: 'mossbun', probability: 0.35, bonusTraits: [] },
      { speciesId: 'emberbun', probability: 0.30, bonusTraits: ['fireproof'] },
    ],
    requiredCompatibility: 0.3,
  },
]

const createMockMonster = (
  speciesId: string,
  overrides: Partial<MonsterInstance> = {},
): MonsterInstance => ({
  instanceId: `${speciesId}-${Math.random().toString(36).substring(7)}`,
  speciesId,
  nickname: null,
  level: 5,
  experience: 0,
  stats: {
    maxHp: 100,
    currentHp: 100,
    maxMp: 30,
    currentMp: 30,
    attack: 15,
    defense: 10,
    magicAttack: 12,
    magicDefense: 8,
    speed: 11,
    luck: 5,
  },
  learnedAbilities: [],
  inheritedTraits: [],
  parentSpeciesIds: [],
  isInSquad: false,
  capturedAt: new Date().toISOString(),
  bondLevel: 50,
  ...overrides,
})

const createBreedingItem = (itemId: string, magnitude: number): Item => ({
  itemId,
  name: 'Breeding Item',
  description: 'A breeding item',
  category: 'breeding_item',
  iconKey: `icon-${itemId}`,
  stackable: true,
  maxStack: 5,
  useEffect: { type: 'breeding_boost', magnitude, targetType: 'single_monster' },
  buyPrice: 500,
  sellPrice: 250,
})

beforeEach(() => {
  loadSpeciesData(mockSpecies)
  loadAbilityData([mockAbility])
  loadTraitData(mockTraits)
  loadBreedingRecipes(mockRecipes)
})

describe('getBreedingRecipe', () => {
  it('finds recipe by parent species', () => {
    const recipe = getBreedingRecipe('flamepup', 'mossbun')
    expect(recipe).toBeDefined()
    expect(recipe!.recipeId).toBe('flamepup-mossbun')
  })

  it('finds recipe regardless of parent order', () => {
    const recipe = getBreedingRecipe('mossbun', 'flamepup')
    expect(recipe).toBeDefined()
    expect(recipe!.recipeId).toBe('flamepup-mossbun')
  })

  it('returns undefined for non-existent recipe', () => {
    const recipe = getBreedingRecipe('flamepup', 'bubblefin')
    expect(recipe).toBeUndefined()
  })
})

describe('areCompatibleGroups', () => {
  it('same group is always compatible', () => {
    expect(areCompatibleGroups('beast', 'beast')).toBe(true)
    expect(areCompatibleGroups('dragon', 'dragon')).toBe(true)
  })

  it('beast and dragon are compatible', () => {
    expect(areCompatibleGroups('beast', 'dragon')).toBe(true)
    expect(areCompatibleGroups('dragon', 'beast')).toBe(true)
  })

  it('beast and aquatic have low compatibility', () => {
    expect(areCompatibleGroups('beast', 'aquatic')).toBe(true)
    expect(getGroupCompatibility('beast', 'aquatic')).toBe(0.3)
  })
})

describe('getGroupCompatibility', () => {
  it('returns 1.0 for same group', () => {
    expect(getGroupCompatibility('beast', 'beast')).toBe(1.0)
  })

  it('returns expected values for different groups', () => {
    expect(getGroupCompatibility('beast', 'dragon')).toBe(0.75)
    expect(getGroupCompatibility('beast', 'elemental')).toBe(0.6)
  })

  it('returns 0 for unknown groups', () => {
    expect(getGroupCompatibility('unknown', 'beast')).toBe(0)
  })
})

describe('getBreedingCompatibility', () => {
  it('calculates compatibility for same species', () => {
    const parent1 = createMockMonster('flamepup')
    const parent2 = createMockMonster('flamepup')

    const compat = getBreedingCompatibility(parent1, parent2)
    // Same species + same group = high compatibility, clamped to 1.0
    expect(compat).toBe(1.0)
  })

  it('calculates compatibility for same breeding group', () => {
    const parent1 = createMockMonster('flamepup')
    const parent2 = createMockMonster('mossbun')

    const compat = getBreedingCompatibility(parent1, parent2)
    expect(compat).toBeGreaterThan(0)
    expect(compat).toBeLessThanOrEqual(1.0)
  })

  it('calculates lower compatibility for different groups', () => {
    const parent1 = createMockMonster('flamepup')
    const parent2 = createMockMonster('bubblefin')

    const compat = getBreedingCompatibility(parent1, parent2)
    expect(compat).toBeLessThan(0.5)
  })

  it('bond level affects compatibility', () => {
    // Use different breeding groups to avoid hitting the 1.0 cap
    const highBond1 = createMockMonster('flamepup', { bondLevel: 100 })
    const highBond2 = createMockMonster('bubblefin', { bondLevel: 100 })
    const lowBond1 = createMockMonster('flamepup', { bondLevel: 0 })
    const lowBond2 = createMockMonster('bubblefin', { bondLevel: 0 })

    const highBondCompat = getBreedingCompatibility(highBond1, highBond2)
    const lowBondCompat = getBreedingCompatibility(lowBond1, lowBond2)

    expect(highBondCompat).toBeGreaterThan(lowBondCompat)
  })
})

describe('getPossibleOffspring', () => {
  it('returns recipe offspring when recipe exists', () => {
    const parent1 = createMockMonster('flamepup')
    const parent2 = createMockMonster('mossbun')

    const offspring = getPossibleOffspring(parent1, parent2)
    expect(offspring.length).toBe(3)
    expect(offspring.map((o) => o.resultSpeciesId)).toContain('emberbun')
  })

  it('returns parent species when no recipe exists', () => {
    const parent1 = createMockMonster('flamepup')
    const parent2 = createMockMonster('flamepup')

    const offspring = getPossibleOffspring(parent1, parent2)
    expect(offspring.length).toBe(1)
    expect(offspring[0].resultSpeciesId).toBe('flamepup')
  })
})

describe('selectOffspringSpecies', () => {
  it('selects based on probability roll', () => {
    const parent1 = createMockMonster('flamepup')
    const parent2 = createMockMonster('mossbun')
    const offspring = getPossibleOffspring(parent1, parent2)

    // Roll 0.1 should select first option (flamepup, prob 0.35)
    const selected1 = selectOffspringSpecies(offspring, 0.1)
    expect(selected1?.resultSpeciesId).toBe('flamepup')

    // Roll 0.5 should select second option (mossbun, cumulative 0.70)
    const selected2 = selectOffspringSpecies(offspring, 0.5)
    expect(selected2?.resultSpeciesId).toBe('mossbun')

    // Roll 0.95 should select third option (emberbun, cumulative 1.0)
    const selected3 = selectOffspringSpecies(offspring, 0.95)
    expect(selected3?.resultSpeciesId).toBe('emberbun')
  })

  it('returns undefined for empty offspring list', () => {
    const selected = selectOffspringSpecies([])
    expect(selected).toBeUndefined()
  })
})

describe('inheritTraits', () => {
  it('inherits traits with base chance', () => {
    // Run multiple times to test probability
    const results = Array.from({ length: 100 }, () =>
      inheritTraits(['fireproof', 'fierce'], ['gentle', 'lucky']),
    )

    const avgTraits = results.reduce((sum, r) => sum + r.length, 0) / results.length
    // With 50% base chance, average should be around 2
    expect(avgTraits).toBeGreaterThan(0.5)
    expect(avgTraits).toBeLessThan(3.5)
  })

  it('boost increases inheritance chance', () => {
    const results = Array.from({ length: 100 }, () =>
      inheritTraits(['fireproof'], [], 0.5),
    )

    const inheritsCount = results.filter((r) => r.includes('fireproof')).length
    // With 100% chance (0.5 + 0.5 boost), should always inherit
    expect(inheritsCount).toBe(100)
  })

  it('returns empty array for empty inputs', () => {
    const result = inheritTraits([], [])
    expect(result).toEqual([])
  })
})

describe('rollForMutation', () => {
  it('occasionally returns mutation trait', () => {
    // Run many times with high boost to ensure mutation
    const results = Array.from({ length: 100 }, () => rollForMutation([], 0.95))

    const mutations = results.filter((r) => r !== null)
    expect(mutations.length).toBeGreaterThan(90)
  })

  it('does not return trait monster already has', () => {
    const results = Array.from({ length: 100 }, () =>
      rollForMutation(['primal-power', 'chaos-touched'], 0.95),
    )

    // Should return null since all mutations are already present
    const mutations = results.filter((r) => r !== null)
    expect(mutations.length).toBe(0)
  })
})

describe('applyBreedingItemBoosts', () => {
  it('applies breeding charm compatibility boost', () => {
    const items = [createBreedingItem('breeding-charm', 0.2)]
    const boosts = applyBreedingItemBoosts(items)

    expect(boosts.compatibilityBoost).toBe(0.2)
  })

  it('applies trait crystal trait boost', () => {
    const items = [createBreedingItem('trait-crystal', 0.3)]
    const boosts = applyBreedingItemBoosts(items)

    expect(boosts.traitBoost).toBe(0.3)
  })

  it('applies mutation catalyst mutation boost', () => {
    const items = [createBreedingItem('mutation-catalyst', 0.15)]
    const boosts = applyBreedingItemBoosts(items)

    expect(boosts.mutationBoost).toBe(0.15)
  })

  it('applies harmony bell compatibility boost', () => {
    const items = [createBreedingItem('harmony-bell', 0.25)]
    const boosts = applyBreedingItemBoosts(items)

    expect(boosts.compatibilityBoost).toBe(0.25)
  })

  it('stacks multiple item boosts', () => {
    const items = [
      createBreedingItem('breeding-charm', 0.2),
      createBreedingItem('harmony-bell', 0.25),
    ]
    const boosts = applyBreedingItemBoosts(items)

    expect(boosts.compatibilityBoost).toBe(0.45)
  })

  it('returns zero boosts for empty items', () => {
    const boosts = applyBreedingItemBoosts([])

    expect(boosts.compatibilityBoost).toBe(0)
    expect(boosts.traitBoost).toBe(0)
    expect(boosts.mutationBoost).toBe(0)
  })
})

describe('createBreedingPair', () => {
  it('creates pair for compatible monsters', () => {
    const parent1 = createMockMonster('flamepup')
    const parent2 = createMockMonster('mossbun')

    const pair = createBreedingPair(parent1, parent2)
    expect(pair).not.toBeNull()
    expect(pair!.compatibility).toBeGreaterThan(0)
    expect(pair!.possibleOffspring.length).toBeGreaterThan(0)
  })

  it('applies item boosts to compatibility', () => {
    const parent1 = createMockMonster('flamepup')
    const parent2 = createMockMonster('bubblefin')

    const pairWithoutItems = createBreedingPair(parent1, parent2)
    const pairWithItems = createBreedingPair(parent1, parent2, [
      createBreedingItem('harmony-bell', 0.25),
    ])

    expect(pairWithItems!.compatibility).toBeGreaterThan(pairWithoutItems!.compatibility)
  })

  it('returns null for invalid species', () => {
    const parent1 = createMockMonster('nonexistent')
    const parent2 = createMockMonster('flamepup')

    const pair = createBreedingPair(parent1, parent2)
    expect(pair).toBeNull()
  })
})

describe('executeBreeding', () => {
  it('produces offspring from breeding pair', () => {
    const parent1 = createMockMonster('flamepup')
    const parent2 = createMockMonster('mossbun')
    const pair = createBreedingPair(parent1, parent2)

    const result = executeBreeding(pair!)
    expect(result).not.toBeNull()
    expect(result!.offspring).toBeDefined()
    expect(result!.offspring.level).toBe(1)
    expect(result!.offspring.parentSpeciesIds).toContain('flamepup')
    expect(result!.offspring.parentSpeciesIds).toContain('mossbun')
  })

  it('tracks inherited traits', () => {
    const parent1 = createMockMonster('flamepup', { inheritedTraits: ['fireproof'] })
    const parent2 = createMockMonster('mossbun', { inheritedTraits: ['gentle'] })
    const pair = createBreedingPair(parent1, parent2)

    // Run multiple times to get results with inherited traits
    let hasInheritedTraits = false
    for (let i = 0; i < 20; i++) {
      const result = executeBreeding(pair!)
      if (
        result!.inheritedTraitsFromParent1.length > 0 ||
        result!.inheritedTraitsFromParent2.length > 0
      ) {
        hasInheritedTraits = true
        break
      }
    }

    expect(hasInheritedTraits).toBe(true)
  })

  it('can produce mutations', () => {
    const parent1 = createMockMonster('flamepup')
    const parent2 = createMockMonster('mossbun')
    const pair = createBreedingPair(parent1, parent2)

    // Run many times with mutation catalyst
    let hadMutation = false
    for (let i = 0; i < 100; i++) {
      const result = executeBreeding(pair!, [createBreedingItem('mutation-catalyst', 0.5)])
      if (result!.mutationOccurred) {
        hadMutation = true
        expect(result!.mutationTrait).not.toBeNull()
        break
      }
    }

    expect(hadMutation).toBe(true)
  })
})

describe('canBreed', () => {
  it('returns false for same monster instance', () => {
    const monster = createMockMonster('flamepup')
    expect(canBreed(monster, monster)).toBe(false)
  })

  it('returns true for compatible groups', () => {
    const parent1 = createMockMonster('flamepup')
    const parent2 = createMockMonster('mossbun')
    expect(canBreed(parent1, parent2)).toBe(true)
  })

  it('returns true for same species', () => {
    const parent1 = createMockMonster('flamepup', { instanceId: 'a' })
    const parent2 = createMockMonster('flamepup', { instanceId: 'b' })
    expect(canBreed(parent1, parent2)).toBe(true)
  })
})

describe('getCompatibleMonstersForBreeding', () => {
  it('filters out the selected monster', () => {
    const target = createMockMonster('flamepup', { instanceId: 'target' })
    const candidates = [
      target,
      createMockMonster('flamepup', { instanceId: 'other1' }),
      createMockMonster('mossbun', { instanceId: 'other2' }),
    ]

    const compatible = getCompatibleMonstersForBreeding(target, candidates)
    expect(compatible.length).toBe(2)
    expect(compatible.every((m) => m.instanceId !== 'target')).toBe(true)
  })

  it('filters out incompatible groups', () => {
    // aquatic and beast have low compatibility but still compatible
    const target = createMockMonster('flamepup')
    const candidates = [createMockMonster('bubblefin', { instanceId: 'fish' })]

    const compatible = getCompatibleMonstersForBreeding(target, candidates)
    expect(compatible.length).toBe(1) // aquatic and beast are technically compatible
  })
})
