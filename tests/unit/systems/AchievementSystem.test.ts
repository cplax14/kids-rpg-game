import { describe, it, expect, beforeEach } from 'vitest'
import type {
  AchievementDefinition,
  AchievementProgress,
  AchievementStats,
} from '../../../src/models/types'
import {
  loadAchievementData,
  getAchievement,
  getAllAchievements,
  getAchievementsByCategory,
  clearAchievementRegistry,
  createInitialAchievementStats,
  incrementStat,
  setStatIfHigher,
  checkAchievementConditions,
  getAchievementProgress,
  getUnlockedAchievements,
  getLockedAchievements,
  initializeAchievementProgress,
  updateAchievementProgress,
  unlockAchievement,
  checkAndUnlockAchievements,
  getAchievementStatistics,
  getAchievementProgressPercent,
  formatAchievementProgress,
} from '../../../src/systems/AchievementSystem'

describe('AchievementSystem', () => {
  const mockAchievements: ReadonlyArray<AchievementDefinition> = [
    {
      achievementId: 'first-victory',
      name: 'First Victory',
      description: 'Win your first battle!',
      category: 'combat',
      rarity: 'bronze',
      iconKey: 'badge-sword',
      conditions: [{ type: 'stat_threshold', statKey: 'battlesWon', requiredValue: 1 }],
      rewardGold: 50,
      rewardItems: [],
      isSecret: false,
    },
    {
      achievementId: 'battle-veteran',
      name: 'Battle Veteran',
      description: 'Win 10 battles.',
      category: 'combat',
      rarity: 'silver',
      iconKey: 'badge-sword',
      conditions: [{ type: 'stat_threshold', statKey: 'battlesWon', requiredValue: 10 }],
      rewardGold: 200,
      rewardItems: [],
      isSecret: false,
    },
    {
      achievementId: 'first-capture',
      name: 'Monster Tamer',
      description: 'Capture your first monster!',
      category: 'collection',
      rarity: 'bronze',
      iconKey: 'badge-pokeball',
      conditions: [{ type: 'stat_threshold', statKey: 'monstersCaptured', requiredValue: 1 }],
      rewardGold: 50,
      rewardItems: [{ itemId: 'capture-sphere', quantity: 3 }],
      isSecret: false,
    },
    {
      achievementId: 'multi-condition',
      name: 'Multi Goal',
      description: 'Complete multiple objectives.',
      category: 'mastery',
      rarity: 'gold',
      iconKey: 'badge-star',
      conditions: [
        { type: 'stat_threshold', statKey: 'battlesWon', requiredValue: 5 },
        { type: 'stat_threshold', statKey: 'monstersCaptured', requiredValue: 3 },
      ],
      rewardGold: 500,
      rewardItems: [],
      isSecret: true,
    },
  ]

  beforeEach(() => {
    clearAchievementRegistry()
    loadAchievementData(mockAchievements)
  })

  describe('Registry', () => {
    it('should load achievement data', () => {
      expect(getAllAchievements()).toHaveLength(4)
    })

    it('should get achievement by id', () => {
      const achievement = getAchievement('first-victory')
      expect(achievement).toBeDefined()
      expect(achievement?.name).toBe('First Victory')
    })

    it('should return undefined for unknown achievement', () => {
      expect(getAchievement('unknown')).toBeUndefined()
    })

    it('should filter achievements by category', () => {
      const combatAchievements = getAchievementsByCategory('combat')
      expect(combatAchievements).toHaveLength(2)
      expect(combatAchievements.every((a) => a.category === 'combat')).toBe(true)
    })

    it('should clear registry', () => {
      clearAchievementRegistry()
      expect(getAllAchievements()).toHaveLength(0)
    })
  })

  describe('Stats', () => {
    it('should create initial stats with zero values', () => {
      const stats = createInitialAchievementStats()
      expect(stats.battlesWon).toBe(0)
      expect(stats.monstersDefeated).toBe(0)
      expect(stats.monstersCaptured).toBe(0)
      expect(stats.highestPlayerLevel).toBe(1)
    })

    it('should increment stat immutably', () => {
      const stats = createInitialAchievementStats()
      const updated = incrementStat(stats, 'battlesWon', 5)

      expect(updated.battlesWon).toBe(5)
      expect(stats.battlesWon).toBe(0) // Original unchanged
    })

    it('should set stat if higher', () => {
      const stats = { ...createInitialAchievementStats(), highestPlayerLevel: 5 }

      const higher = setStatIfHigher(stats, 'highestPlayerLevel', 10)
      expect(higher.highestPlayerLevel).toBe(10)

      const lower = setStatIfHigher(stats, 'highestPlayerLevel', 3)
      expect(lower.highestPlayerLevel).toBe(5) // Unchanged
    })
  })

  describe('Condition Checking', () => {
    it('should check single condition', () => {
      const achievement = getAchievement('first-victory')!
      const stats = { ...createInitialAchievementStats(), battlesWon: 1 }

      const result = checkAchievementConditions(achievement, stats)
      expect(result.allMet).toBe(true)
      expect(result.progress.battlesWon).toBe(1)
    })

    it('should fail condition when not met', () => {
      const achievement = getAchievement('battle-veteran')!
      const stats = { ...createInitialAchievementStats(), battlesWon: 5 }

      const result = checkAchievementConditions(achievement, stats)
      expect(result.allMet).toBe(false)
      expect(result.progress.battlesWon).toBe(5)
    })

    it('should check multiple conditions', () => {
      const achievement = getAchievement('multi-condition')!

      // Both conditions met
      const statsComplete = {
        ...createInitialAchievementStats(),
        battlesWon: 5,
        monstersCaptured: 3,
      }
      const resultComplete = checkAchievementConditions(achievement, statsComplete)
      expect(resultComplete.allMet).toBe(true)

      // Only one condition met
      const statsPartial = {
        ...createInitialAchievementStats(),
        battlesWon: 5,
        monstersCaptured: 1,
      }
      const resultPartial = checkAchievementConditions(achievement, statsPartial)
      expect(resultPartial.allMet).toBe(false)
    })
  })

  describe('Progress Management', () => {
    const mockProgress: ReadonlyArray<AchievementProgress> = [
      {
        achievementId: 'first-victory',
        isUnlocked: true,
        unlockedAt: '2024-01-01T00:00:00.000Z',
        currentProgress: { battlesWon: 1 },
      },
      {
        achievementId: 'battle-veteran',
        isUnlocked: false,
        unlockedAt: null,
        currentProgress: { battlesWon: 5 },
      },
    ]

    it('should get achievement progress', () => {
      const progress = getAchievementProgress(mockProgress, 'first-victory')
      expect(progress).toBeDefined()
      expect(progress?.isUnlocked).toBe(true)
    })

    it('should get unlocked achievements', () => {
      const unlocked = getUnlockedAchievements(mockProgress)
      expect(unlocked).toHaveLength(1)
      expect(unlocked[0].achievementId).toBe('first-victory')
    })

    it('should get locked achievements', () => {
      const locked = getLockedAchievements(mockProgress)
      expect(locked).toHaveLength(1)
      expect(locked[0].achievementId).toBe('battle-veteran')
    })

    it('should initialize missing achievement progress', () => {
      const partial: ReadonlyArray<AchievementProgress> = [
        {
          achievementId: 'first-victory',
          isUnlocked: false,
          unlockedAt: null,
          currentProgress: {},
        },
      ]

      const initialized = initializeAchievementProgress(partial)
      expect(initialized).toHaveLength(4) // All 4 mock achievements
      expect(initialized.find((p) => p.achievementId === 'first-victory')).toBeDefined()
      expect(initialized.find((p) => p.achievementId === 'battle-veteran')).toBeDefined()
    })

    it('should update achievement progress immutably', () => {
      const updated = updateAchievementProgress(mockProgress, 'battle-veteran', { battlesWon: 7 })

      const original = mockProgress.find((p) => p.achievementId === 'battle-veteran')
      const modified = updated.find((p) => p.achievementId === 'battle-veteran')

      expect(original?.currentProgress.battlesWon).toBe(5)
      expect(modified?.currentProgress.battlesWon).toBe(7)
    })

    it('should unlock achievement immutably', () => {
      const updated = unlockAchievement(mockProgress, 'battle-veteran')

      const original = mockProgress.find((p) => p.achievementId === 'battle-veteran')
      const modified = updated.find((p) => p.achievementId === 'battle-veteran')

      expect(original?.isUnlocked).toBe(false)
      expect(modified?.isUnlocked).toBe(true)
      expect(modified?.unlockedAt).toBeDefined()
    })

    it('should not re-unlock already unlocked achievement', () => {
      const updated = unlockAchievement(mockProgress, 'first-victory')
      const progress = updated.find((p) => p.achievementId === 'first-victory')

      expect(progress?.unlockedAt).toBe('2024-01-01T00:00:00.000Z') // Unchanged
    })
  })

  describe('Check and Unlock', () => {
    it('should check and unlock achievements', () => {
      const initialProgress: ReadonlyArray<AchievementProgress> = mockAchievements.map((a) => ({
        achievementId: a.achievementId,
        isUnlocked: false,
        unlockedAt: null,
        currentProgress: {},
      }))

      const stats = {
        ...createInitialAchievementStats(),
        battlesWon: 1,
        monstersCaptured: 1,
      }

      const result = checkAndUnlockAchievements(initialProgress, stats)

      expect(result.newlyUnlocked).toHaveLength(2) // first-victory and first-capture
      expect(result.newlyUnlocked.map((a) => a.achievementId)).toContain('first-victory')
      expect(result.newlyUnlocked.map((a) => a.achievementId)).toContain('first-capture')

      const firstVictory = result.achievements.find((p) => p.achievementId === 'first-victory')
      expect(firstVictory?.isUnlocked).toBe(true)
    })

    it('should not unlock already unlocked achievements', () => {
      const progress: ReadonlyArray<AchievementProgress> = [
        {
          achievementId: 'first-victory',
          isUnlocked: true,
          unlockedAt: '2024-01-01T00:00:00.000Z',
          currentProgress: { battlesWon: 1 },
        },
        {
          achievementId: 'battle-veteran',
          isUnlocked: false,
          unlockedAt: null,
          currentProgress: {},
        },
        {
          achievementId: 'first-capture',
          isUnlocked: false,
          unlockedAt: null,
          currentProgress: {},
        },
        {
          achievementId: 'multi-condition',
          isUnlocked: false,
          unlockedAt: null,
          currentProgress: {},
        },
      ]

      const stats = { ...createInitialAchievementStats(), battlesWon: 5 }
      const result = checkAndUnlockAchievements(progress, stats)

      expect(result.newlyUnlocked).toHaveLength(0) // first-victory already unlocked
    })
  })

  describe('Statistics', () => {
    it('should calculate achievement statistics', () => {
      const progress: ReadonlyArray<AchievementProgress> = [
        {
          achievementId: 'first-victory',
          isUnlocked: true,
          unlockedAt: '2024-01-01T00:00:00.000Z',
          currentProgress: {},
        },
        {
          achievementId: 'battle-veteran',
          isUnlocked: false,
          unlockedAt: null,
          currentProgress: {},
        },
        {
          achievementId: 'first-capture',
          isUnlocked: true,
          unlockedAt: '2024-01-02T00:00:00.000Z',
          currentProgress: {},
        },
        {
          achievementId: 'multi-condition',
          isUnlocked: false,
          unlockedAt: null,
          currentProgress: {},
        },
      ]

      const stats = getAchievementStatistics(progress)

      expect(stats.total).toBe(4)
      expect(stats.unlocked).toBe(2)
      expect(stats.locked).toBe(2)
      expect(stats.percentComplete).toBe(50)
      expect(stats.byCategory.combat.total).toBe(2)
      expect(stats.byCategory.combat.unlocked).toBe(1)
    })
  })

  describe('Progress Display', () => {
    it('should calculate progress percent', () => {
      const achievement = getAchievement('battle-veteran')!
      const progress: AchievementProgress = {
        achievementId: 'battle-veteran',
        isUnlocked: false,
        unlockedAt: null,
        currentProgress: { battlesWon: 5 },
      }

      const percent = getAchievementProgressPercent(progress, achievement)
      expect(percent).toBe(50) // 5/10
    })

    it('should return 100% for unlocked achievements', () => {
      const achievement = getAchievement('first-victory')!
      const progress: AchievementProgress = {
        achievementId: 'first-victory',
        isUnlocked: true,
        unlockedAt: '2024-01-01T00:00:00.000Z',
        currentProgress: { battlesWon: 1 },
      }

      expect(getAchievementProgressPercent(progress, achievement)).toBe(100)
    })

    it('should format single condition progress', () => {
      const achievement = getAchievement('battle-veteran')!
      const progress: AchievementProgress = {
        achievementId: 'battle-veteran',
        isUnlocked: false,
        unlockedAt: null,
        currentProgress: { battlesWon: 5 },
      }

      expect(formatAchievementProgress(progress, achievement)).toBe('5 / 10')
    })

    it('should format multi-condition progress', () => {
      const achievement = getAchievement('multi-condition')!
      const progress: AchievementProgress = {
        achievementId: 'multi-condition',
        isUnlocked: false,
        unlockedAt: null,
        currentProgress: { battlesWon: 5, monstersCaptured: 1 },
      }

      expect(formatAchievementProgress(progress, achievement)).toBe('1 / 2 objectives')
    })

    it('should format completed achievement', () => {
      const achievement = getAchievement('first-victory')!
      const progress: AchievementProgress = {
        achievementId: 'first-victory',
        isUnlocked: true,
        unlockedAt: '2024-01-01T00:00:00.000Z',
        currentProgress: {},
      }

      expect(formatAchievementProgress(progress, achievement)).toBe('Complete!')
    })
  })
})
