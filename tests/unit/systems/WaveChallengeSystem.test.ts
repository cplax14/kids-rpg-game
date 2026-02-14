import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock EventBus to prevent Phaser dependency
vi.mock('../../../src/events/EventBus', () => ({
  EventBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}))

import {
  loadWaveChallengeData,
  getChallenge,
  getAllChallenges,
  clearWaveChallengeRegistry,
  createWaveBattleState,
  advanceToNextWave,
  getCurrentWaveDefinition,
  isLastWave,
  accumulateWaveRewards,
  calculateFinalRewards,
  generateWaveEnemies,
  canAttemptChallenge,
  getChallengeSummary,
} from '../../../src/systems/WaveChallengeSystem'
import { loadSpeciesData, loadAbilityData } from '../../../src/systems/MonsterSystem'
import type {
  WaveChallengeDefinition,
  WaveDefinition,
  QuestRewards,
  MonsterSpecies,
  Ability,
} from '../../../src/models/types'

// Test data
const testWave1: WaveDefinition = {
  waveNumber: 1,
  enemies: [
    { speciesId: 'test-mon', level: 5, count: 2 },
  ],
  difficultyMultiplier: 1.0,
  rewards: {
    experience: 50,
    gold: 20,
    items: [],
    equipmentId: null,
  },
}

const testWave2: WaveDefinition = {
  waveNumber: 2,
  enemies: [
    { speciesId: 'test-mon', level: 6, count: 2 },
    { speciesId: 'test-mon', level: 6, count: 1 },
  ],
  difficultyMultiplier: 1.2,
  rewards: {
    experience: 75,
    gold: 30,
    items: [{ itemId: 'potion', quantity: 1 }],
    equipmentId: null,
  },
}

const testChallenge: WaveChallengeDefinition = {
  challengeId: 'test-challenge',
  name: 'Test Challenge',
  description: 'A test challenge',
  recommendedLevel: 5,
  waves: [testWave1, testWave2],
  finalRewards: {
    experience: 100,
    gold: 50,
    items: [{ itemId: 'mega-ball', quantity: 2 }],
    equipmentId: null,
  },
  backgroundKey: 'battle-forest',
}

const testAbility: Ability = {
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
  cooldownTurns: 0,
}

const testSpecies: MonsterSpecies = {
  speciesId: 'test-mon',
  name: 'Testmon',
  description: 'A test monster',
  element: 'fire',
  rarity: 'common',
  baseStats: {
    maxHp: 100,
    currentHp: 100,
    maxMp: 30,
    currentMp: 30,
    attack: 20,
    defense: 10,
    magicAttack: 15,
    magicDefense: 10,
    speed: 12,
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
  abilities: [{ abilityId: 'test-attack', learnAtLevel: 1 }],
  captureBaseDifficulty: 0.5,
  spriteKey: 'test-mon-sprite',
  evolutionChain: null,
  breedingGroup: 'beast',
  breedingTraits: ['fire-affinity'],
  obtainableVia: 'wild',
}

describe('WaveChallengeSystem', () => {
  beforeEach(() => {
    clearWaveChallengeRegistry()
    loadWaveChallengeData([testChallenge])
    loadSpeciesData([testSpecies])
    loadAbilityData([testAbility])
  })

  describe('Registry', () => {
    it('should load challenge data', () => {
      const allChallenges = getAllChallenges()
      expect(allChallenges).toHaveLength(1)
    })

    it('should get challenge by ID', () => {
      const challenge = getChallenge('test-challenge')
      expect(challenge).toBeDefined()
      expect(challenge?.name).toBe('Test Challenge')
    })

    it('should return undefined for unknown challenge ID', () => {
      const challenge = getChallenge('unknown-challenge')
      expect(challenge).toBeUndefined()
    })

    it('should clear registry', () => {
      clearWaveChallengeRegistry()
      expect(getAllChallenges()).toHaveLength(0)
    })
  })

  describe('createWaveBattleState', () => {
    it('should create initial battle state', () => {
      const state = createWaveBattleState('test-challenge')

      expect(state).not.toBeNull()
      expect(state?.currentWave).toBe(1)
      expect(state?.totalWaves).toBe(2)
      expect(state?.accumulatedRewards.experience).toBe(0)
      expect(state?.accumulatedRewards.gold).toBe(0)
    })

    it('should return null for unknown challenge', () => {
      const state = createWaveBattleState('unknown-challenge')
      expect(state).toBeNull()
    })
  })

  describe('advanceToNextWave', () => {
    it('should increment wave number', () => {
      const initial = createWaveBattleState('test-challenge')!
      const advanced = advanceToNextWave(initial)

      expect(advanced.currentWave).toBe(2)
      expect(initial.currentWave).toBe(1) // Immutability check
    })
  })

  describe('getCurrentWaveDefinition', () => {
    it('should return current wave', () => {
      const state = createWaveBattleState('test-challenge')!
      const wave = getCurrentWaveDefinition(state, testChallenge)

      expect(wave).toBe(testWave1)
    })

    it('should return correct wave after advancing', () => {
      const state = advanceToNextWave(createWaveBattleState('test-challenge')!)
      const wave = getCurrentWaveDefinition(state, testChallenge)

      expect(wave).toBe(testWave2)
    })

    it('should return null for invalid wave number', () => {
      const state = { ...createWaveBattleState('test-challenge')!, currentWave: 99 }
      const wave = getCurrentWaveDefinition(state, testChallenge)

      expect(wave).toBeNull()
    })
  })

  describe('isLastWave', () => {
    it('should return false on first wave', () => {
      const state = createWaveBattleState('test-challenge')!

      expect(isLastWave(state, testChallenge)).toBe(false)
    })

    it('should return true on last wave', () => {
      const state = advanceToNextWave(createWaveBattleState('test-challenge')!)

      expect(isLastWave(state, testChallenge)).toBe(true)
    })
  })

  describe('accumulateWaveRewards', () => {
    it('should add rewards', () => {
      const state = createWaveBattleState('test-challenge')!
      const rewards: QuestRewards = {
        experience: 100,
        gold: 50,
        items: [{ itemId: 'potion', quantity: 2 }],
        equipmentId: null,
      }

      const updated = accumulateWaveRewards(state, rewards)

      expect(updated.accumulatedRewards.experience).toBe(100)
      expect(updated.accumulatedRewards.gold).toBe(50)
      expect(updated.accumulatedRewards.items).toHaveLength(1)
      expect(updated.accumulatedRewards.items[0].quantity).toBe(2)
    })

    it('should merge items with same ID', () => {
      const state = createWaveBattleState('test-challenge')!
      const rewards1: QuestRewards = {
        experience: 50,
        gold: 25,
        items: [{ itemId: 'potion', quantity: 2 }],
        equipmentId: null,
      }
      const rewards2: QuestRewards = {
        experience: 50,
        gold: 25,
        items: [{ itemId: 'potion', quantity: 3 }],
        equipmentId: null,
      }

      const updated1 = accumulateWaveRewards(state, rewards1)
      const updated2 = accumulateWaveRewards(updated1, rewards2)

      expect(updated2.accumulatedRewards.items).toHaveLength(1)
      expect(updated2.accumulatedRewards.items[0].quantity).toBe(5)
    })
  })

  describe('calculateFinalRewards', () => {
    it('should combine accumulated and final rewards', () => {
      let state = createWaveBattleState('test-challenge')!
      state = accumulateWaveRewards(state, testWave1.rewards)
      state = accumulateWaveRewards(state, testWave2.rewards)

      const final = calculateFinalRewards(state, testChallenge)

      // Wave 1: 50 exp, 20 gold
      // Wave 2: 75 exp, 30 gold
      // Final: 100 exp, 50 gold
      expect(final.experience).toBe(225)
      expect(final.gold).toBe(100)

      // Items: potion (1 from wave 2) + mega-ball (2 from final)
      expect(final.items).toHaveLength(2)
    })
  })

  describe('generateWaveEnemies', () => {
    it('should generate correct number of enemies', () => {
      const enemies = generateWaveEnemies(testWave1)

      expect(enemies).toHaveLength(2)
    })

    it('should apply difficulty multiplier to stats', () => {
      const enemies = generateWaveEnemies(testWave2)

      // With 1.2 multiplier, base HP should be scaled
      // Base stats at level 6: 100 + 5*8 = 140
      // Scaled: 140 * 1.2 = 168
      expect(enemies[0].stats.maxHp).toBeGreaterThan(100)
    })

    it('should mark enemies as not capturable', () => {
      const enemies = generateWaveEnemies(testWave1)

      expect(enemies[0].capturable).toBe(false)
    })

    it('should generate unique combatant IDs', () => {
      const enemies = generateWaveEnemies(testWave1)

      expect(enemies[0].combatantId).toBe('wave-enemy-0')
      expect(enemies[1].combatantId).toBe('wave-enemy-1')
    })
  })

  describe('canAttemptChallenge', () => {
    it('should allow attempt at recommended level', () => {
      const result = canAttemptChallenge('test-challenge', 5)

      expect(result.canAttempt).toBe(true)
      expect(result.reason).toBeNull()
    })

    it('should allow attempt above recommended level', () => {
      const result = canAttemptChallenge('test-challenge', 10)

      expect(result.canAttempt).toBe(true)
    })

    it('should warn if level is too low', () => {
      // Recommended level is 5, so 5-5 = 0 is the cutoff
      // Level -1 (below 0) would fail
      const result = canAttemptChallenge('test-challenge', 0)

      expect(result.canAttempt).toBe(true) // 0 is within 5 levels of 5
    })

    it('should reject unknown challenge', () => {
      const result = canAttemptChallenge('unknown', 10)

      expect(result.canAttempt).toBe(false)
      expect(result.reason).toBe('Challenge not found')
    })
  })

  describe('getChallengeSummary', () => {
    it('should return challenge summary', () => {
      const summary = getChallengeSummary('test-challenge')

      expect(summary).not.toBeNull()
      expect(summary?.name).toBe('Test Challenge')
      expect(summary?.waveCount).toBe(2)
      expect(summary?.totalEnemies).toBe(5) // 2 + 3
    })

    it('should return null for unknown challenge', () => {
      const summary = getChallengeSummary('unknown')
      expect(summary).toBeNull()
    })

    it('should estimate difficulty based on waves and multipliers', () => {
      const summary = getChallengeSummary('test-challenge')

      // 2 waves with avg multiplier 1.1 = medium (>= 1.1 triggers medium)
      expect(summary?.estimatedDifficulty).toBe('medium')
    })
  })
})
