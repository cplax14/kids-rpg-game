import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock CombatSystem to avoid Phaser dependency
vi.mock('../../../src/systems/CombatSystem', () => ({
  createCombatantFromEnemy: vi.fn((name, stats, element, abilities, capturable = true) => ({
    combatantId: `enemy-mock`,
    name,
    isPlayer: false,
    isMonster: true,
    stats: { ...stats },
    abilities,
    statusEffects: [],
    capturable,
  })),
}))

import {
  loadAreaData,
  loadBossData,
  getArea,
  getBoss,
  getAllAreas,
  getAllBosses,
  generateAreaEncounter,
  createBossEncounter,
  canAccessArea,
  isBossDefeated,
  isChestOpened,
  getAreaBosses,
  getUndefeatedBosses,
} from '../../../src/systems/WorldSystem'
import { loadSpeciesData, loadAbilityData } from '../../../src/systems/MonsterSystem'
import type { GameAreaDefinition, BossDefinition, MonsterSpecies, Ability } from '../../../src/models/types'
import type { GameState } from '../../../src/systems/GameStateManager'

const mockAbility: Ability = {
  abilityId: 'tackle',
  name: 'Tackle',
  description: 'A basic tackle attack',
  element: 'neutral',
  type: 'physical',
  power: 40,
  accuracy: 100,
  mpCost: 0,
  targetType: 'single_enemy',
  statusEffect: null,
  animation: 'tackle',
}

const mockSpecies: MonsterSpecies = {
  speciesId: 'test-monster',
  name: 'Test Monster',
  description: 'A test monster',
  element: 'neutral',
  rarity: 'common',
  baseStats: {
    maxHp: 100,
    currentHp: 100,
    maxMp: 30,
    currentMp: 30,
    attack: 15,
    defense: 12,
    magicAttack: 10,
    magicDefense: 10,
    speed: 14,
    luck: 10,
  },
  statGrowth: {
    hp: 8,
    mp: 3,
    attack: 2,
    defense: 2,
    magicAttack: 1,
    magicDefense: 1,
    speed: 2,
  },
  abilities: [{ abilityId: 'tackle', learnAtLevel: 1 }],
  captureBaseDifficulty: 0.3,
  spriteKey: 'test-monster',
  evolutionChain: null,
  breedingGroup: 'beast',
  breedingTraits: [],
  obtainableVia: 'both',
}

const mockBossSpecies: MonsterSpecies = {
  ...mockSpecies,
  speciesId: 'boss-monster',
  name: 'Boss Monster',
  captureBaseDifficulty: 1.0,
  obtainableVia: 'both',
}

const mockBreedingOnlySpecies: MonsterSpecies = {
  ...mockSpecies,
  speciesId: 'breeding-only-monster',
  name: 'Breeding Only Monster',
  obtainableVia: 'breeding',
}

const mockArea: GameAreaDefinition = {
  areaId: 'test-area',
  name: 'Test Area',
  description: 'A test area',
  recommendedLevel: 5,
  isSafeZone: false,
  mapWidth: 30,
  mapHeight: 30,
  terrainType: 'forest',
  encounters: [
    { speciesId: 'test-monster', weight: 100, minLevel: 3, maxLevel: 5 },
  ],
  transitions: [
    {
      zoneId: 'test-transition',
      targetAreaId: 'other-area',
      targetPosition: { x: 100, y: 100 },
      triggerBounds: { x: 0, y: 0, width: 32, height: 32 },
      requiredLevel: 5,
      requiredBossDefeated: 'test-boss',
    },
  ],
  interactables: [],
  bossIds: ['test-boss'],
  ambientColor: 0x333333,
}

const mockSafeArea: GameAreaDefinition = {
  ...mockArea,
  areaId: 'safe-area',
  name: 'Safe Area',
  isSafeZone: true,
  encounters: [],
  transitions: [],
  bossIds: [],
}

const mockAreaWithBreedingOnly: GameAreaDefinition = {
  ...mockArea,
  areaId: 'breeding-filter-area',
  name: 'Breeding Filter Area',
  encounters: [
    { speciesId: 'test-monster', weight: 50, minLevel: 3, maxLevel: 5 },
    { speciesId: 'breeding-only-monster', weight: 50, minLevel: 3, maxLevel: 5 },
  ],
}

const mockAreaOnlyBreedingEncounters: GameAreaDefinition = {
  ...mockArea,
  areaId: 'only-breeding-area',
  name: 'Only Breeding Area',
  encounters: [
    { speciesId: 'breeding-only-monster', weight: 100, minLevel: 3, maxLevel: 5 },
  ],
}

const mockBoss: BossDefinition = {
  bossId: 'test-boss',
  speciesId: 'boss-monster',
  name: 'Test Boss',
  title: 'The Test',
  level: 10,
  areaId: 'test-area',
  position: { x: 200, y: 200 },
  introDialog: ['Prepare for battle!'],
  defeatDialog: ['You have won...'],
  rewards: {
    experience: 500,
    gold: 300,
    guaranteedItems: [{ itemId: 'potion-large', quantity: 2 }],
    unlocksArea: 'next-area',
  },
}

const createMockGameState = (overrides: Partial<GameState> = {}): GameState => ({
  player: {
    id: 'player-1',
    name: 'Test Player',
    level: 5,
    experience: 0,
    experienceToNextLevel: 100,
    stats: {
      maxHp: 100,
      currentHp: 100,
      maxMp: 50,
      currentMp: 50,
      attack: 15,
      defense: 12,
      magicAttack: 10,
      magicDefense: 10,
      speed: 14,
      luck: 10,
    },
    equipment: {
      weapon: null,
      armor: null,
      helmet: null,
      accessory: null,
    },
    position: { x: 0, y: 0 },
    currentAreaId: 'test-area',
    gold: 100,
  },
  inventory: {
    items: [],
    maxSlots: 30,
    equipment: [],
  },
  squad: [],
  monsterStorage: [],
  discoveredSpecies: [],
  currentAreaId: 'test-area',
  defeatedBosses: [],
  openedChests: [],
  ...overrides,
})

describe('WorldSystem', () => {
  beforeEach(() => {
    loadAreaData([mockArea, mockSafeArea, mockAreaWithBreedingOnly, mockAreaOnlyBreedingEncounters])
    loadBossData([mockBoss])
    loadSpeciesData([mockSpecies, mockBossSpecies, mockBreedingOnlySpecies])
    loadAbilityData([mockAbility])
  })

  describe('Area Registry', () => {
    it('should load and retrieve areas', () => {
      const area = getArea('test-area')
      expect(area).toBeDefined()
      expect(area?.name).toBe('Test Area')
    })

    it('should return undefined for non-existent area', () => {
      const area = getArea('non-existent')
      expect(area).toBeUndefined()
    })

    it('should get all areas', () => {
      const areas = getAllAreas()
      expect(areas.length).toBe(4) // test-area, safe-area, breeding-filter-area, only-breeding-area
    })
  })

  describe('Boss Registry', () => {
    it('should load and retrieve bosses', () => {
      const boss = getBoss('test-boss')
      expect(boss).toBeDefined()
      expect(boss?.name).toBe('Test Boss')
    })

    it('should return undefined for non-existent boss', () => {
      const boss = getBoss('non-existent')
      expect(boss).toBeUndefined()
    })

    it('should get all bosses', () => {
      const bosses = getAllBosses()
      expect(bosses.length).toBe(1)
    })
  })

  describe('Encounter Generation', () => {
    it('should generate encounters for areas with monsters', () => {
      const encounter = generateAreaEncounter('test-area')
      expect(encounter).not.toBeNull()
      expect(encounter?.combatants.length).toBeGreaterThan(0)
      expect(encounter?.speciesIds.length).toBeGreaterThan(0)
    })

    it('should return null for safe zones with no encounters', () => {
      const encounter = generateAreaEncounter('safe-area')
      expect(encounter).toBeNull()
    })

    it('should return null for non-existent areas', () => {
      const encounter = generateAreaEncounter('non-existent')
      expect(encounter).toBeNull()
    })

    it('should filter out breeding-exclusive species from encounters', () => {
      // Run many times to ensure we never get the breeding-only species
      for (let i = 0; i < 50; i++) {
        const encounter = generateAreaEncounter('breeding-filter-area')
        expect(encounter).not.toBeNull()
        // Should only contain the wild species, not the breeding-only one
        expect(encounter?.speciesIds).not.toContain('breeding-only-monster')
        expect(encounter?.speciesIds.every((id) => id === 'test-monster')).toBe(true)
      }
    })

    it('should return null when area only has breeding-exclusive species', () => {
      const encounter = generateAreaEncounter('only-breeding-area')
      // No wild species available, should return null
      expect(encounter).toBeNull()
    })

    it('should generate exactly 1 enemy when isFirstBattle is true', () => {
      // Run multiple times to ensure it's always 1 enemy
      for (let i = 0; i < 20; i++) {
        const encounter = generateAreaEncounter('test-area', { isFirstBattle: true })
        expect(encounter).not.toBeNull()
        expect(encounter?.combatants.length).toBe(1)
        expect(encounter?.speciesIds.length).toBe(1)
      }
    })

    it('should allow 1-2 enemies when isFirstBattle is false or not provided', () => {
      // Run many times to verify we get some 2-enemy encounters
      let gotTwoEnemies = false
      let gotOneEnemy = false

      for (let i = 0; i < 100; i++) {
        const encounter = generateAreaEncounter('test-area', { isFirstBattle: false })
        if (encounter?.combatants.length === 2) {
          gotTwoEnemies = true
        }
        if (encounter?.combatants.length === 1) {
          gotOneEnemy = true
        }
        if (gotTwoEnemies && gotOneEnemy) break
      }

      // With 30% chance for 2 enemies over 100 runs, we should see both
      expect(gotTwoEnemies).toBe(true)
      expect(gotOneEnemy).toBe(true)
    })

    it('should default to normal behavior when options not provided', () => {
      // Without options, should behave like isFirstBattle: false
      let gotTwoEnemies = false

      for (let i = 0; i < 100; i++) {
        const encounter = generateAreaEncounter('test-area')
        if (encounter?.combatants.length === 2) {
          gotTwoEnemies = true
          break
        }
      }

      // Should be possible to get 2 enemies without options
      expect(gotTwoEnemies).toBe(true)
    })

    it('should generate capturable enemies for first battle', () => {
      const encounter = generateAreaEncounter('test-area', { isFirstBattle: true })
      expect(encounter).not.toBeNull()

      // All enemies should be capturable
      encounter?.combatants.forEach((combatant) => {
        expect(combatant.capturable).toBe(true)
      })
    })
  })

  describe('Boss Encounter', () => {
    it('should create boss encounter', () => {
      const encounter = createBossEncounter('test-boss')
      expect(encounter).not.toBeNull()
      expect(encounter?.combatant.capturable).toBe(false)
      expect(encounter?.boss.bossId).toBe('test-boss')
    })

    it('should return null for non-existent boss', () => {
      const encounter = createBossEncounter('non-existent')
      expect(encounter).toBeNull()
    })
  })

  describe('Access Validation', () => {
    it('should allow access when requirements are met', () => {
      const state = createMockGameState({
        defeatedBosses: ['test-boss'],
      })
      const result = canAccessArea('test-area', state)
      expect(result.allowed).toBe(true)
    })

    it('should deny access for insufficient level', () => {
      const state = createMockGameState({
        player: {
          ...createMockGameState().player,
          level: 1,
        },
      })
      const result = canAccessArea('test-area', state)
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Recommended level')
    })

    it('should return false for non-existent area', () => {
      const state = createMockGameState()
      const result = canAccessArea('non-existent', state)
      expect(result.allowed).toBe(false)
    })
  })

  describe('Boss Defeated Check', () => {
    it('should return true for defeated boss', () => {
      const state = createMockGameState({ defeatedBosses: ['test-boss'] })
      expect(isBossDefeated('test-boss', state)).toBe(true)
    })

    it('should return false for undefeated boss', () => {
      const state = createMockGameState()
      expect(isBossDefeated('test-boss', state)).toBe(false)
    })
  })

  describe('Chest Opened Check', () => {
    it('should return true for opened chest', () => {
      const state = createMockGameState({ openedChests: ['chest-1'] })
      expect(isChestOpened('chest-1', state)).toBe(true)
    })

    it('should return false for unopened chest', () => {
      const state = createMockGameState()
      expect(isChestOpened('chest-1', state)).toBe(false)
    })
  })

  describe('Area Bosses', () => {
    it('should get bosses for an area', () => {
      const bosses = getAreaBosses('test-area')
      expect(bosses.length).toBe(1)
      expect(bosses[0].bossId).toBe('test-boss')
    })

    it('should return empty array for area with no bosses', () => {
      const bosses = getAreaBosses('safe-area')
      expect(bosses.length).toBe(0)
    })

    it('should get undefeated bosses', () => {
      const state = createMockGameState()
      const undefeated = getUndefeatedBosses('test-area', state)
      expect(undefeated.length).toBe(1)

      const stateWithDefeated = createMockGameState({ defeatedBosses: ['test-boss'] })
      const undefeated2 = getUndefeatedBosses('test-area', stateWithDefeated)
      expect(undefeated2.length).toBe(0)
    })
  })
})
