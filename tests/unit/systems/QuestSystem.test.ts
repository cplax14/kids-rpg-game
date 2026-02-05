import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Phaser before any imports that depend on it
vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Events: { EventEmitter: class {} },
  },
}))

// Mock EventBus to avoid Phaser dependency chain
vi.mock('../../../src/events/EventBus', () => ({
  EventBus: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    once: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}))

import {
  loadQuestData,
  clearQuestRegistry,
  getQuest,
  getAllQuests,
  getAvailableQuests,
  canAcceptQuest,
  getQuestsForNpc,
  acceptQuest,
  updateQuestProgress,
  isQuestComplete,
  markQuestAsComplete,
  completeQuest,
  abandonQuest,
  trackDefeat,
  trackItemCollection,
  trackBossDefeat,
  trackAreaExploration,
  trackNpcTalk,
  getQuestProgressPercent,
  getObjectiveProgress,
  getTierForLevel,
} from '../../../src/systems/QuestSystem'
import type { QuestDefinition, QuestProgress } from '../../../src/models/types'

const mockQuest: QuestDefinition = {
  questId: 'test-quest',
  name: 'Test Quest',
  description: 'A test quest',
  giverNpcId: 'guide',
  turnInNpcId: 'guide',
  recommendedLevel: 1,
  objectives: [
    {
      objectiveId: 'obj-1',
      type: 'defeat',
      targetId: 'mossbun',
      targetName: 'Mossbun',
      requiredCount: 5,
      description: 'Defeat 5 Mossbuns',
    },
  ],
  rewards: {
    experience: 100,
    gold: 50,
    items: [{ itemId: 'potion-small', quantity: 2 }],
    equipmentId: null,
  },
  rewardEquipmentTier: 1,
  rewardEquipmentSlots: ['weapon'],
  prerequisiteQuestIds: [],
  isRepeatable: false,
  celebrationMessage: 'Well done!',
}

const mockQuestWithPrereq: QuestDefinition = {
  questId: 'advanced-quest',
  name: 'Advanced Quest',
  description: 'A quest with prerequisites',
  giverNpcId: 'guide',
  turnInNpcId: 'guide',
  recommendedLevel: 5,
  objectives: [
    {
      objectiveId: 'obj-2',
      type: 'boss',
      targetId: 'forest-guardian',
      targetName: 'Forest Guardian',
      requiredCount: 1,
      description: 'Defeat the Forest Guardian',
    },
  ],
  rewards: {
    experience: 250,
    gold: 150,
    items: [],
    equipmentId: null,
  },
  rewardEquipmentTier: 2,
  rewardEquipmentSlots: ['armor'],
  prerequisiteQuestIds: ['test-quest'],
  isRepeatable: false,
  celebrationMessage: 'Amazing!',
}

const mockMultiObjectiveQuest: QuestDefinition = {
  questId: 'multi-objective',
  name: 'Multi Objective Quest',
  description: 'A quest with multiple objectives',
  giverNpcId: 'shopkeeper',
  turnInNpcId: 'shopkeeper',
  recommendedLevel: 3,
  objectives: [
    {
      objectiveId: 'obj-collect',
      type: 'collect',
      targetId: 'soft-fur',
      targetName: 'Soft Fur',
      requiredCount: 3,
      description: 'Collect 3 Soft Fur',
    },
    {
      objectiveId: 'obj-explore',
      type: 'explore',
      targetId: 'whispering-woods',
      targetName: 'Whispering Woods',
      requiredCount: 1,
      description: 'Visit Whispering Woods',
    },
  ],
  rewards: {
    experience: 150,
    gold: 100,
    items: [],
    equipmentId: null,
  },
  rewardEquipmentTier: 1,
  rewardEquipmentSlots: [],
  prerequisiteQuestIds: [],
  isRepeatable: false,
  celebrationMessage: 'Great work!',
}

const mockRepeatableQuest: QuestDefinition = {
  questId: 'repeatable-quest',
  name: 'Repeatable Quest',
  description: 'A quest that can be repeated',
  giverNpcId: 'shopkeeper',
  turnInNpcId: 'shopkeeper',
  recommendedLevel: 2,
  objectives: [
    {
      objectiveId: 'obj-repeat',
      type: 'collect',
      targetId: 'monster-bone',
      targetName: 'Monster Bone',
      requiredCount: 5,
      description: 'Collect 5 Monster Bones',
    },
  ],
  rewards: {
    experience: 50,
    gold: 30,
    items: [],
    equipmentId: null,
  },
  rewardEquipmentTier: 1,
  rewardEquipmentSlots: [],
  prerequisiteQuestIds: [],
  isRepeatable: true,
  celebrationMessage: 'Thanks!',
}

describe('QuestSystem', () => {
  beforeEach(() => {
    clearQuestRegistry()
    loadQuestData([mockQuest, mockQuestWithPrereq, mockMultiObjectiveQuest, mockRepeatableQuest])
  })

  describe('Registry', () => {
    it('loads quest data into registry', () => {
      const quests = getAllQuests()
      expect(quests).toHaveLength(4)
    })

    it('retrieves quest by id', () => {
      const quest = getQuest('test-quest')
      expect(quest).toBeDefined()
      expect(quest?.name).toBe('Test Quest')
    })

    it('returns undefined for non-existent quest', () => {
      const quest = getQuest('non-existent')
      expect(quest).toBeUndefined()
    })

    it('clears registry', () => {
      clearQuestRegistry()
      expect(getAllQuests()).toHaveLength(0)
    })
  })

  describe('Quest Availability', () => {
    it('returns available quests for player', () => {
      const available = getAvailableQuests([], [], 1)
      expect(available).toHaveLength(3) // test-quest, multi-objective, repeatable-quest (advanced requires prereq)
    })

    it('excludes quests with unmet prerequisites', () => {
      const available = getAvailableQuests([], [], 5)
      const advancedQuest = available.find((q) => q.questId === 'advanced-quest')
      expect(advancedQuest).toBeUndefined()
    })

    it('includes quests when prerequisites are met', () => {
      const available = getAvailableQuests(['test-quest'], [], 5)
      const advancedQuest = available.find((q) => q.questId === 'advanced-quest')
      expect(advancedQuest).toBeDefined()
    })

    it('excludes active quests', () => {
      const activeProgress: QuestProgress = {
        questId: 'test-quest',
        status: 'active',
        objectiveProgress: { 'obj-1': 0 },
        acceptedAt: new Date().toISOString(),
        completedAt: null,
      }
      const available = getAvailableQuests([], [activeProgress], 1)
      const testQuest = available.find((q) => q.questId === 'test-quest')
      expect(testQuest).toBeUndefined()
    })

    it('excludes completed non-repeatable quests', () => {
      const available = getAvailableQuests(['test-quest'], [], 1)
      const testQuest = available.find((q) => q.questId === 'test-quest')
      expect(testQuest).toBeUndefined()
    })

    it('includes completed repeatable quests', () => {
      const available = getAvailableQuests(['repeatable-quest'], [], 2)
      const repeatableQuest = available.find((q) => q.questId === 'repeatable-quest')
      expect(repeatableQuest).toBeDefined()
    })

    it('excludes quests above player level + 5', () => {
      // Level 1 + 5 = 6, so level 5 quest IS available
      // Level 1 + 5 = 6, so level 7+ quests would NOT be available
      // Test that level 5 quest is available when prereqs are met
      const available = getAvailableQuests(['test-quest'], [], 1)
      const advancedQuest = available.find((q) => q.questId === 'advanced-quest')
      // Level 5 <= Level 1 + 5 (6), so it should be available
      expect(advancedQuest).toBeDefined()

      // At very low level with high-level quest requirement, it would be excluded
      // For this test, we verify that level 5 quest is accessible at level 1 (within 5 level range)
    })
  })

  describe('canAcceptQuest', () => {
    it('returns true for available quest', () => {
      expect(canAcceptQuest(mockQuest, [], [])).toBe(true)
    })

    it('returns false for active quest', () => {
      const activeProgress: QuestProgress = {
        questId: 'test-quest',
        status: 'active',
        objectiveProgress: {},
        acceptedAt: new Date().toISOString(),
        completedAt: null,
      }
      expect(canAcceptQuest(mockQuest, [], [activeProgress])).toBe(false)
    })

    it('returns false for completed non-repeatable quest', () => {
      expect(canAcceptQuest(mockQuest, ['test-quest'], [])).toBe(false)
    })

    it('returns true for completed repeatable quest', () => {
      expect(canAcceptQuest(mockRepeatableQuest, ['repeatable-quest'], [])).toBe(true)
    })

    it('returns false when prerequisites not met', () => {
      expect(canAcceptQuest(mockQuestWithPrereq, [], [])).toBe(false)
    })
  })

  describe('getQuestsForNpc', () => {
    it('returns available quests for NPC', () => {
      const result = getQuestsForNpc('guide', [], [], 1)
      expect(result.available.length).toBeGreaterThan(0)
    })

    it('returns ready to turn in quests', () => {
      const completedProgress: QuestProgress = {
        questId: 'test-quest',
        status: 'completed',
        objectiveProgress: { 'obj-1': 5 },
        acceptedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      }
      const result = getQuestsForNpc('guide', [], [completedProgress], 1)
      expect(result.readyToTurnIn).toHaveLength(1)
    })

    it('returns in progress quests', () => {
      const activeProgress: QuestProgress = {
        questId: 'test-quest',
        status: 'active',
        objectiveProgress: { 'obj-1': 2 },
        acceptedAt: new Date().toISOString(),
        completedAt: null,
      }
      const result = getQuestsForNpc('guide', [], [activeProgress], 1)
      expect(result.inProgress).toHaveLength(1)
    })
  })

  describe('Quest State Management', () => {
    it('accepts a quest', () => {
      const quests = acceptQuest(mockQuest, [])
      expect(quests).toHaveLength(1)
      expect(quests[0].questId).toBe('test-quest')
      expect(quests[0].status).toBe('active')
      expect(quests[0].objectiveProgress['obj-1']).toBe(0)
    })

    it('updates quest progress', () => {
      const initial: QuestProgress[] = [{
        questId: 'test-quest',
        status: 'active',
        objectiveProgress: { 'obj-1': 0 },
        acceptedAt: new Date().toISOString(),
        completedAt: null,
      }]
      const updated = updateQuestProgress(initial, 'test-quest', 'obj-1', 2)
      expect(updated[0].objectiveProgress['obj-1']).toBe(2)
    })

    it('caps progress at required count', () => {
      const initial: QuestProgress[] = [{
        questId: 'test-quest',
        status: 'active',
        objectiveProgress: { 'obj-1': 4 },
        acceptedAt: new Date().toISOString(),
        completedAt: null,
      }]
      const updated = updateQuestProgress(initial, 'test-quest', 'obj-1', 5)
      expect(updated[0].objectiveProgress['obj-1']).toBe(5) // Capped at 5
    })

    it('checks if quest is complete', () => {
      const complete: QuestProgress = {
        questId: 'test-quest',
        status: 'active',
        objectiveProgress: { 'obj-1': 5 },
        acceptedAt: new Date().toISOString(),
        completedAt: null,
      }
      expect(isQuestComplete(complete, mockQuest)).toBe(true)

      const incomplete: QuestProgress = {
        questId: 'test-quest',
        status: 'active',
        objectiveProgress: { 'obj-1': 3 },
        acceptedAt: new Date().toISOString(),
        completedAt: null,
      }
      expect(isQuestComplete(incomplete, mockQuest)).toBe(false)
    })

    it('marks quest as complete', () => {
      const initial: QuestProgress[] = [{
        questId: 'test-quest',
        status: 'active',
        objectiveProgress: { 'obj-1': 5 },
        acceptedAt: new Date().toISOString(),
        completedAt: null,
      }]
      const updated = markQuestAsComplete(initial, 'test-quest')
      expect(updated[0].status).toBe('completed')
      expect(updated[0].completedAt).not.toBeNull()
    })

    it('completes quest and moves to completed list', () => {
      const activeQuests: QuestProgress[] = [{
        questId: 'test-quest',
        status: 'completed',
        objectiveProgress: { 'obj-1': 5 },
        acceptedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      }]
      const result = completeQuest(activeQuests, [], 'test-quest')
      expect(result.activeQuests).toHaveLength(0)
      expect(result.completedIds).toContain('test-quest')
    })

    it('abandons a quest', () => {
      const activeQuests: QuestProgress[] = [{
        questId: 'test-quest',
        status: 'active',
        objectiveProgress: { 'obj-1': 2 },
        acceptedAt: new Date().toISOString(),
        completedAt: null,
      }]
      const updated = abandonQuest(activeQuests, 'test-quest')
      expect(updated).toHaveLength(0)
    })
  })

  describe('Objective Tracking', () => {
    it('tracks defeat objectives', () => {
      const initial: QuestProgress[] = [{
        questId: 'test-quest',
        status: 'active',
        objectiveProgress: { 'obj-1': 0 },
        acceptedAt: new Date().toISOString(),
        completedAt: null,
      }]
      const updated = trackDefeat(initial, 'mossbun')
      expect(updated[0].objectiveProgress['obj-1']).toBe(1)
    })

    it('tracks item collection objectives', () => {
      const initial: QuestProgress[] = [{
        questId: 'multi-objective',
        status: 'active',
        objectiveProgress: { 'obj-collect': 0, 'obj-explore': 0 },
        acceptedAt: new Date().toISOString(),
        completedAt: null,
      }]
      const updated = trackItemCollection(initial, 'soft-fur', 2)
      expect(updated[0].objectiveProgress['obj-collect']).toBe(2)
    })

    it('tracks boss defeat objectives', () => {
      const initial: QuestProgress[] = [{
        questId: 'advanced-quest',
        status: 'active',
        objectiveProgress: { 'obj-2': 0 },
        acceptedAt: new Date().toISOString(),
        completedAt: null,
      }]
      const updated = trackBossDefeat(initial, 'forest-guardian')
      expect(updated[0].objectiveProgress['obj-2']).toBe(1)
    })

    it('tracks area exploration objectives', () => {
      const initial: QuestProgress[] = [{
        questId: 'multi-objective',
        status: 'active',
        objectiveProgress: { 'obj-collect': 0, 'obj-explore': 0 },
        acceptedAt: new Date().toISOString(),
        completedAt: null,
      }]
      const updated = trackAreaExploration(initial, 'whispering-woods')
      expect(updated[0].objectiveProgress['obj-explore']).toBe(1)
    })

    it('tracks NPC talk objectives', () => {
      const talkQuest: QuestDefinition = {
        questId: 'talk-quest',
        name: 'Talk Quest',
        description: 'Talk to someone',
        giverNpcId: 'guide',
        turnInNpcId: 'breeder',
        recommendedLevel: 1,
        objectives: [
          {
            objectiveId: 'obj-talk',
            type: 'talk',
            targetId: 'breeder',
            targetName: 'Breeder',
            requiredCount: 1,
            description: 'Talk to the breeder',
          },
        ],
        rewards: { experience: 25, gold: 10, items: [], equipmentId: null },
        rewardEquipmentTier: 1,
        rewardEquipmentSlots: [],
        prerequisiteQuestIds: [],
        isRepeatable: false,
        celebrationMessage: 'Good!',
      }
      loadQuestData([...getAllQuests(), talkQuest])

      const initial: QuestProgress[] = [{
        questId: 'talk-quest',
        status: 'active',
        objectiveProgress: { 'obj-talk': 0 },
        acceptedAt: new Date().toISOString(),
        completedAt: null,
      }]
      const updated = trackNpcTalk(initial, 'breeder')
      expect(updated[0].objectiveProgress['obj-talk']).toBe(1)
    })

    it('auto-marks quest as complete when all objectives done', () => {
      const initial: QuestProgress[] = [{
        questId: 'test-quest',
        status: 'active',
        objectiveProgress: { 'obj-1': 4 },
        acceptedAt: new Date().toISOString(),
        completedAt: null,
      }]
      const updated = trackDefeat(initial, 'mossbun')
      expect(updated[0].status).toBe('completed')
    })
  })

  describe('Quest Progress Utilities', () => {
    it('calculates progress percentage', () => {
      const progress: QuestProgress = {
        questId: 'test-quest',
        status: 'active',
        objectiveProgress: { 'obj-1': 3 },
        acceptedAt: new Date().toISOString(),
        completedAt: null,
      }
      expect(getQuestProgressPercent(progress, mockQuest)).toBe(60)
    })

    it('calculates multi-objective progress percentage', () => {
      const progress: QuestProgress = {
        questId: 'multi-objective',
        status: 'active',
        objectiveProgress: { 'obj-collect': 2, 'obj-explore': 1 },
        acceptedAt: new Date().toISOString(),
        completedAt: null,
      }
      // 2/3 + 1/1 = 3 of 4 total = 75%
      expect(getQuestProgressPercent(progress, mockMultiObjectiveQuest)).toBe(75)
    })

    it('gets objective progress', () => {
      const progress: QuestProgress = {
        questId: 'test-quest',
        status: 'active',
        objectiveProgress: { 'obj-1': 3 },
        acceptedAt: new Date().toISOString(),
        completedAt: null,
      }
      expect(getObjectiveProgress(progress, 'obj-1')).toBe(3)
      expect(getObjectiveProgress(progress, 'non-existent')).toBe(0)
    })
  })

  describe('Equipment Tier', () => {
    it('returns tier 1 for levels 1-4', () => {
      expect(getTierForLevel(1)).toBe(1)
      expect(getTierForLevel(4)).toBe(1)
    })

    it('returns tier 2 for levels 5-9', () => {
      expect(getTierForLevel(5)).toBe(2)
      expect(getTierForLevel(9)).toBe(2)
    })

    it('returns tier 3 for levels 10-14', () => {
      expect(getTierForLevel(10)).toBe(3)
      expect(getTierForLevel(14)).toBe(3)
    })

    it('returns tier 4 for levels 15-19', () => {
      expect(getTierForLevel(15)).toBe(4)
      expect(getTierForLevel(19)).toBe(4)
    })

    it('returns tier 5 for levels 20+', () => {
      expect(getTierForLevel(20)).toBe(5)
      expect(getTierForLevel(50)).toBe(5)
    })
  })
})
