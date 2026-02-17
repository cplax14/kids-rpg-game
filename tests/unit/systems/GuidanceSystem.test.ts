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
  loadGuidanceData,
  clearGuidanceRegistry,
  getMilestone,
  getAllMilestones,
  getCurrentMilestone,
  getCurrentMilestoneId,
  isMilestoneComplete,
  areAllMilestonesComplete,
  getMilestoneProgress,
  checkMilestoneAutoComplete,
  getAutoCompletableMilestones,
  DEFAULT_MILESTONES,
  MILESTONE_ORDER,
} from '../../../src/systems/GuidanceSystem'
import type { GameState } from '../../../src/systems/GameStateManager'
import type { GuidanceMilestoneId } from '../../../src/models/types'
import { createEmptyGearSlots } from '../../../src/systems/MonsterGearSystem'

// Test data factories
const createTestState = (
  completedMilestones: GuidanceMilestoneId[] = [],
  overrides: Partial<GameState> = {},
): GameState => ({
  player: {
    id: 'test-player',
    name: 'Test Player',
    level: 1,
    experience: 0,
    experienceToNextLevel: 100,
    stats: {
      maxHp: 100,
      currentHp: 100,
      maxMp: 50,
      currentMp: 50,
      attack: 10,
      defense: 10,
      magicAttack: 10,
      magicDefense: 10,
      speed: 10,
      luck: 5,
    },
    equipment: {
      weapon: null,
      armor: null,
      helmet: null,
      accessory: null,
    },
    position: { x: 500, y: 500 },
    currentAreaId: 'sunlit-village',
    gold: 100,
  },
  inventory: { items: [], maxSlots: 30, equipment: [] },
  squad: [],
  monsterStorage: [],
  discoveredSpecies: [],
  visitedAreas: ['sunlit-village'],
  currentAreaId: 'sunlit-village',
  defeatedBosses: [],
  openedChests: [],
  activeQuests: [],
  completedQuestIds: [],
  achievements: [],
  achievementStats: {
    battlesWon: 0,
    monstersDefeated: 0,
    monstersCaptured: 0,
    goldEarned: 0,
    questsCompleted: 0,
    bossesDefeated: 0,
    areasVisited: 1,
    speciesDiscovered: 0,
    monstersBreed: 0,
    highestPlayerLevel: 1,
  },
  completedGuidanceMilestones: completedMilestones,
  ...overrides,
})

describe('GuidanceSystem', () => {
  beforeEach(() => {
    clearGuidanceRegistry()
    loadGuidanceData(DEFAULT_MILESTONES)
  })

  describe('registry operations', () => {
    it('should load milestone data', () => {
      const milestones = getAllMilestones()
      expect(milestones).toHaveLength(8)
    })

    it('should get milestone by ID', () => {
      const milestone = getMilestone('talk-to-npc')
      expect(milestone).toBeDefined()
      expect(milestone?.message).toContain('villagers')
    })

    it('should return undefined for unknown milestone', () => {
      const milestone = getMilestone('unknown' as GuidanceMilestoneId)
      expect(milestone).toBeUndefined()
    })

    it('should clear registry', () => {
      clearGuidanceRegistry()
      expect(getAllMilestones()).toHaveLength(0)
    })
  })

  describe('MILESTONE_ORDER', () => {
    it('should have correct number of milestones', () => {
      expect(MILESTONE_ORDER).toHaveLength(8)
    })

    it('should start with talk-to-npc', () => {
      expect(MILESTONE_ORDER[0]).toBe('talk-to-npc')
    })

    it('should end with explore-new-area', () => {
      expect(MILESTONE_ORDER[MILESTONE_ORDER.length - 1]).toBe('explore-new-area')
    })
  })

  describe('getCurrentMilestone', () => {
    it('should return first milestone for new player', () => {
      const state = createTestState()
      const milestone = getCurrentMilestone(state)

      expect(milestone?.id).toBe('talk-to-npc')
    })

    it('should return second milestone after first is complete', () => {
      const state = createTestState(['talk-to-npc'])
      const milestone = getCurrentMilestone(state)

      expect(milestone?.id).toBe('leave-village')
    })

    it('should return null when all milestones complete', () => {
      const state = createTestState([...MILESTONE_ORDER])
      const milestone = getCurrentMilestone(state)

      expect(milestone).toBeNull()
    })

    it('should skip already completed milestones', () => {
      const state = createTestState(['talk-to-npc', 'leave-village', 'win-battle'])
      const milestone = getCurrentMilestone(state)

      expect(milestone?.id).toBe('capture-monster')
    })
  })

  describe('getCurrentMilestoneId', () => {
    it('should return first milestone ID for new player', () => {
      const state = createTestState()
      expect(getCurrentMilestoneId(state)).toBe('talk-to-npc')
    })

    it('should return null when all complete', () => {
      const state = createTestState([...MILESTONE_ORDER])
      expect(getCurrentMilestoneId(state)).toBeNull()
    })
  })

  describe('isMilestoneComplete', () => {
    it('should return false for incomplete milestone', () => {
      const state = createTestState()
      expect(isMilestoneComplete(state, 'talk-to-npc')).toBe(false)
    })

    it('should return true for completed milestone', () => {
      const state = createTestState(['talk-to-npc'])
      expect(isMilestoneComplete(state, 'talk-to-npc')).toBe(true)
    })
  })

  describe('areAllMilestonesComplete', () => {
    it('should return false for new player', () => {
      const state = createTestState()
      expect(areAllMilestonesComplete(state)).toBe(false)
    })

    it('should return false with partial completion', () => {
      const state = createTestState(['talk-to-npc', 'leave-village'])
      expect(areAllMilestonesComplete(state)).toBe(false)
    })

    it('should return true when all complete', () => {
      const state = createTestState([...MILESTONE_ORDER])
      expect(areAllMilestonesComplete(state)).toBe(true)
    })
  })

  describe('getMilestoneProgress', () => {
    it('should return 1 of 8 for new player', () => {
      const state = createTestState()
      const progress = getMilestoneProgress(state)

      expect(progress.current).toBe(1)
      expect(progress.total).toBe(8)
    })

    it('should return 3 of 8 after completing 2 milestones', () => {
      const state = createTestState(['talk-to-npc', 'leave-village'])
      const progress = getMilestoneProgress(state)

      expect(progress.current).toBe(3)
      expect(progress.total).toBe(8)
    })

    it('should return 8 of 8 when all complete', () => {
      const state = createTestState([...MILESTONE_ORDER])
      const progress = getMilestoneProgress(state)

      expect(progress.current).toBe(8)
      expect(progress.total).toBe(8)
    })
  })

  describe('checkMilestoneAutoComplete', () => {
    it('should not auto-complete talk-to-npc', () => {
      const state = createTestState()
      expect(checkMilestoneAutoComplete(state, 'talk-to-npc')).toBe(false)
    })

    it('should auto-complete leave-village if visited other area', () => {
      const state = createTestState([], {
        visitedAreas: ['sunlit-village', 'whispering-forest'],
      })
      expect(checkMilestoneAutoComplete(state, 'leave-village')).toBe(true)
    })

    it('should not auto-complete leave-village if only in village', () => {
      const state = createTestState()
      expect(checkMilestoneAutoComplete(state, 'leave-village')).toBe(false)
    })

    it('should auto-complete win-battle if battles won', () => {
      const state = createTestState([], {
        achievementStats: {
          battlesWon: 1,
          monstersDefeated: 1,
          monstersCaptured: 0,
          goldEarned: 50,
          questsCompleted: 0,
          bossesDefeated: 0,
          areasVisited: 1,
          speciesDiscovered: 1,
          monstersBreed: 0,
          highestPlayerLevel: 1,
        },
      })
      expect(checkMilestoneAutoComplete(state, 'win-battle')).toBe(true)
    })

    it('should auto-complete capture-monster if monsters captured', () => {
      const state = createTestState([], {
        achievementStats: {
          battlesWon: 1,
          monstersDefeated: 1,
          monstersCaptured: 1,
          goldEarned: 50,
          questsCompleted: 0,
          bossesDefeated: 0,
          areasVisited: 1,
          speciesDiscovered: 1,
          monstersBreed: 0,
          highestPlayerLevel: 1,
        },
      })
      expect(checkMilestoneAutoComplete(state, 'capture-monster')).toBe(true)
    })

    it('should auto-complete explore-new-area if visited 2+ areas', () => {
      const state = createTestState([], {
        visitedAreas: ['sunlit-village', 'whispering-forest'],
      })
      expect(checkMilestoneAutoComplete(state, 'explore-new-area')).toBe(true)
    })

    it('should not auto-complete open-menu', () => {
      const state = createTestState()
      expect(checkMilestoneAutoComplete(state, 'open-menu')).toBe(false)
    })

    it('should not auto-complete save-game', () => {
      const state = createTestState()
      expect(checkMilestoneAutoComplete(state, 'save-game')).toBe(false)
    })

    it('should not auto-complete visit-shop', () => {
      const state = createTestState()
      expect(checkMilestoneAutoComplete(state, 'visit-shop')).toBe(false)
    })
  })

  describe('getAutoCompletableMilestones', () => {
    it('should return empty array for new player', () => {
      const state = createTestState()
      expect(getAutoCompletableMilestones(state)).toHaveLength(0)
    })

    it('should return milestones that can be auto-completed', () => {
      const state = createTestState([], {
        visitedAreas: ['sunlit-village', 'whispering-forest'],
        achievementStats: {
          battlesWon: 1,
          monstersDefeated: 1,
          monstersCaptured: 1,
          goldEarned: 50,
          questsCompleted: 0,
          bossesDefeated: 0,
          areasVisited: 2,
          speciesDiscovered: 1,
          monstersBreed: 0,
          highestPlayerLevel: 1,
        },
      })

      const autoComplete = getAutoCompletableMilestones(state)
      expect(autoComplete).toContain('leave-village')
      expect(autoComplete).toContain('win-battle')
      expect(autoComplete).toContain('capture-monster')
    })

    it('should not include already completed milestones', () => {
      const state = createTestState(['leave-village'], {
        visitedAreas: ['sunlit-village', 'whispering-forest'],
      })

      const autoComplete = getAutoCompletableMilestones(state)
      expect(autoComplete).not.toContain('leave-village')
    })
  })

  describe('DEFAULT_MILESTONES', () => {
    it('should have all required milestones', () => {
      expect(DEFAULT_MILESTONES).toHaveLength(8)
    })

    it('should have valid structure for each milestone', () => {
      DEFAULT_MILESTONES.forEach((milestone) => {
        expect(milestone.id).toBeDefined()
        expect(milestone.message).toBeDefined()
        expect(milestone.celebrationMessage).toBeDefined()
        expect(typeof milestone.message).toBe('string')
        expect(milestone.message.length).toBeGreaterThan(0)
      })
    })

    it('should have kid-friendly messages', () => {
      DEFAULT_MILESTONES.forEach((milestone) => {
        // Messages should be short and use exclamation marks for enthusiasm
        expect(milestone.message.length).toBeLessThan(100)
        expect(milestone.celebrationMessage.length).toBeLessThan(100)
      })
    })
  })
})
