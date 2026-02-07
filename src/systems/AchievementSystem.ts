import type {
  AchievementDefinition,
  AchievementProgress,
  AchievementStats,
  AchievementCategory,
  AchievementCondition,
} from '../models/types'

// ── Achievement Registry ──

let achievementRegistry: ReadonlyArray<AchievementDefinition> = []

export function loadAchievementData(achievements: ReadonlyArray<AchievementDefinition>): void {
  achievementRegistry = achievements
}

export function getAchievement(achievementId: string): AchievementDefinition | undefined {
  return achievementRegistry.find((a) => a.achievementId === achievementId)
}

export function getAllAchievements(): ReadonlyArray<AchievementDefinition> {
  return achievementRegistry
}

export function getAchievementsByCategory(
  category: AchievementCategory,
): ReadonlyArray<AchievementDefinition> {
  return achievementRegistry.filter((a) => a.category === category)
}

export function clearAchievementRegistry(): void {
  achievementRegistry = []
}

// ── Initial Stats Factory ──

export function createInitialAchievementStats(): AchievementStats {
  return {
    battlesWon: 0,
    monstersDefeated: 0,
    monstersCaptured: 0,
    goldEarned: 0,
    questsCompleted: 0,
    bossesDefeated: 0,
    areasVisited: 0,
    speciesDiscovered: 0,
    monstersBreed: 0,
    highestPlayerLevel: 1,
  }
}

// ── Stat Updates (Immutable) ──

export function incrementStat(
  stats: AchievementStats,
  statKey: keyof AchievementStats,
  amount: number,
): AchievementStats {
  const currentValue = stats[statKey]
  return {
    ...stats,
    [statKey]: currentValue + amount,
  }
}

export function setStatIfHigher(
  stats: AchievementStats,
  statKey: keyof AchievementStats,
  value: number,
): AchievementStats {
  const currentValue = stats[statKey]
  if (value > currentValue) {
    return {
      ...stats,
      [statKey]: value,
    }
  }
  return stats
}

// ── Condition Checking ──

function checkCondition(
  condition: AchievementCondition,
  stats: AchievementStats,
): { met: boolean; currentValue: number } {
  const statValue = stats[condition.statKey as keyof AchievementStats] ?? 0
  const met = statValue >= condition.requiredValue
  return { met, currentValue: statValue }
}

export function checkAchievementConditions(
  achievement: AchievementDefinition,
  stats: AchievementStats,
): { allMet: boolean; progress: Record<string, number> } {
  const progress: Record<string, number> = {}
  let allMet = true

  for (const condition of achievement.conditions) {
    const result = checkCondition(condition, stats)
    progress[condition.statKey] = result.currentValue
    if (!result.met) {
      allMet = false
    }
  }

  return { allMet, progress }
}

// ── Progress Management (Immutable) ──

export function getAchievementProgress(
  achievements: ReadonlyArray<AchievementProgress>,
  achievementId: string,
): AchievementProgress | undefined {
  return achievements.find((a) => a.achievementId === achievementId)
}

export function getUnlockedAchievements(
  achievements: ReadonlyArray<AchievementProgress>,
): ReadonlyArray<AchievementProgress> {
  return achievements.filter((a) => a.isUnlocked)
}

export function getLockedAchievements(
  achievements: ReadonlyArray<AchievementProgress>,
): ReadonlyArray<AchievementProgress> {
  return achievements.filter((a) => !a.isUnlocked)
}

export function initializeAchievementProgress(
  existingProgress: ReadonlyArray<AchievementProgress>,
): ReadonlyArray<AchievementProgress> {
  const existingIds = new Set(existingProgress.map((p) => p.achievementId))

  const newProgress: AchievementProgress[] = []

  for (const achievement of achievementRegistry) {
    if (!existingIds.has(achievement.achievementId)) {
      newProgress.push({
        achievementId: achievement.achievementId,
        isUnlocked: false,
        unlockedAt: null,
        currentProgress: {},
      })
    }
  }

  return [...existingProgress, ...newProgress]
}

export function updateAchievementProgress(
  achievements: ReadonlyArray<AchievementProgress>,
  achievementId: string,
  progress: Record<string, number>,
): ReadonlyArray<AchievementProgress> {
  return achievements.map((a) => {
    if (a.achievementId !== achievementId) return a
    return {
      ...a,
      currentProgress: { ...a.currentProgress, ...progress },
    }
  })
}

export function unlockAchievement(
  achievements: ReadonlyArray<AchievementProgress>,
  achievementId: string,
): ReadonlyArray<AchievementProgress> {
  return achievements.map((a) => {
    if (a.achievementId !== achievementId) return a
    if (a.isUnlocked) return a
    return {
      ...a,
      isUnlocked: true,
      unlockedAt: new Date().toISOString(),
    }
  })
}

// ── Check and Unlock (Main Entry Point) ──

export interface AchievementCheckResult {
  readonly achievements: ReadonlyArray<AchievementProgress>
  readonly newlyUnlocked: ReadonlyArray<AchievementDefinition>
}

export function checkAndUnlockAchievements(
  achievements: ReadonlyArray<AchievementProgress>,
  stats: AchievementStats,
): AchievementCheckResult {
  const newlyUnlocked: AchievementDefinition[] = []
  let updatedAchievements = achievements

  for (const definition of achievementRegistry) {
    const progress = getAchievementProgress(updatedAchievements, definition.achievementId)

    // Skip if already unlocked
    if (progress?.isUnlocked) continue

    const result = checkAchievementConditions(definition, stats)

    // Update progress tracking
    updatedAchievements = updateAchievementProgress(
      updatedAchievements,
      definition.achievementId,
      result.progress,
    )

    // Unlock if all conditions met
    if (result.allMet) {
      updatedAchievements = unlockAchievement(updatedAchievements, definition.achievementId)
      newlyUnlocked.push(definition)
    }
  }

  return {
    achievements: updatedAchievements,
    newlyUnlocked,
  }
}

// ── Statistics ──

export function getAchievementStatistics(
  achievements: ReadonlyArray<AchievementProgress>,
): {
  total: number
  unlocked: number
  locked: number
  percentComplete: number
  byCategory: Record<AchievementCategory, { total: number; unlocked: number }>
} {
  const unlocked = achievements.filter((a) => a.isUnlocked).length
  const total = achievements.length
  const locked = total - unlocked
  const percentComplete = total > 0 ? Math.round((unlocked / total) * 100) : 0

  const byCategory: Record<AchievementCategory, { total: number; unlocked: number }> = {
    combat: { total: 0, unlocked: 0 },
    collection: { total: 0, unlocked: 0 },
    exploration: { total: 0, unlocked: 0 },
    social: { total: 0, unlocked: 0 },
    mastery: { total: 0, unlocked: 0 },
  }

  for (const progress of achievements) {
    const definition = getAchievement(progress.achievementId)
    if (!definition) continue

    byCategory[definition.category].total++
    if (progress.isUnlocked) {
      byCategory[definition.category].unlocked++
    }
  }

  return { total, unlocked, locked, percentComplete, byCategory }
}

// ── Progress Display Helpers ──

export function getAchievementProgressPercent(
  progress: AchievementProgress,
  definition: AchievementDefinition,
): number {
  if (progress.isUnlocked) return 100
  if (definition.conditions.length === 0) return 0

  let totalRequired = 0
  let totalCurrent = 0

  for (const condition of definition.conditions) {
    totalRequired += condition.requiredValue
    const current = progress.currentProgress[condition.statKey] ?? 0
    totalCurrent += Math.min(current, condition.requiredValue)
  }

  return totalRequired > 0 ? Math.round((totalCurrent / totalRequired) * 100) : 0
}

export function formatAchievementProgress(
  progress: AchievementProgress,
  definition: AchievementDefinition,
): string {
  if (progress.isUnlocked) return 'Complete!'

  if (definition.conditions.length === 1) {
    const condition = definition.conditions[0]
    const current = progress.currentProgress[condition.statKey] ?? 0
    return `${current} / ${condition.requiredValue}`
  }

  const completed = definition.conditions.filter((c) => {
    const current = progress.currentProgress[c.statKey] ?? 0
    return current >= c.requiredValue
  }).length

  return `${completed} / ${definition.conditions.length} objectives`
}
