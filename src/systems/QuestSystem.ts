import type {
  QuestDefinition,
  QuestProgress,
  QuestStatus,
  QuestObjective,
  QuestType,
  Equipment,
  EquipmentSlot,
} from '../models/types'
import { getAllEquipment } from './EquipmentSystem'

// ── Quest Registry ──

let questRegistry: ReadonlyArray<QuestDefinition> = []

export function loadQuestData(quests: ReadonlyArray<QuestDefinition>): void {
  questRegistry = quests
}

export function getQuest(questId: string): QuestDefinition | undefined {
  return questRegistry.find((q) => q.questId === questId)
}

export function getAllQuests(): ReadonlyArray<QuestDefinition> {
  return questRegistry
}

export function clearQuestRegistry(): void {
  questRegistry = []
}

// ── Quest Availability ──

export function getAvailableQuests(
  completedIds: ReadonlyArray<string>,
  activeQuests: ReadonlyArray<QuestProgress>,
  playerLevel: number,
): ReadonlyArray<QuestDefinition> {
  const activeQuestIds = new Set(activeQuests.map((q) => q.questId))
  const completedSet = new Set(completedIds)

  return questRegistry.filter((quest) => {
    // Already active
    if (activeQuestIds.has(quest.questId)) return false

    // Already completed (unless repeatable)
    if (completedSet.has(quest.questId) && !quest.isRepeatable) return false

    // Check prerequisites
    const hasPrereqs = quest.prerequisiteQuestIds.every((id) => completedSet.has(id))
    if (!hasPrereqs) return false

    // Level check (allow quests within 5 levels above player)
    if (quest.recommendedLevel > playerLevel + 5) return false

    return true
  })
}

export function canAcceptQuest(
  quest: QuestDefinition,
  completedIds: ReadonlyArray<string>,
  activeQuests: ReadonlyArray<QuestProgress>,
): boolean {
  const activeQuestIds = new Set(activeQuests.map((q) => q.questId))
  const completedSet = new Set(completedIds)

  if (activeQuestIds.has(quest.questId)) return false
  if (completedSet.has(quest.questId) && !quest.isRepeatable) return false

  return quest.prerequisiteQuestIds.every((id) => completedSet.has(id))
}

export interface NpcQuestStatus {
  readonly available: ReadonlyArray<QuestDefinition>
  readonly readyToTurnIn: ReadonlyArray<QuestProgress>
  readonly inProgress: ReadonlyArray<QuestProgress>
}

export function getQuestsForNpc(
  npcId: string,
  completedIds: ReadonlyArray<string>,
  activeQuests: ReadonlyArray<QuestProgress>,
  playerLevel: number,
): NpcQuestStatus {
  const completedSet = new Set(completedIds)
  const activeQuestIds = new Set(activeQuests.map((q) => q.questId))

  // Available quests this NPC gives
  const available = questRegistry.filter((quest) => {
    if (quest.giverNpcId !== npcId) return false
    if (activeQuestIds.has(quest.questId)) return false
    if (completedSet.has(quest.questId) && !quest.isRepeatable) return false
    if (!quest.prerequisiteQuestIds.every((id) => completedSet.has(id))) return false
    if (quest.recommendedLevel > playerLevel + 5) return false
    return true
  })

  // Quests ready to turn in to this NPC
  const readyToTurnIn = activeQuests.filter((progress) => {
    const quest = getQuest(progress.questId)
    if (!quest || quest.turnInNpcId !== npcId) return false
    return progress.status === 'completed'
  })

  // Quests in progress from this NPC
  const inProgress = activeQuests.filter((progress) => {
    const quest = getQuest(progress.questId)
    if (!quest || quest.giverNpcId !== npcId) return false
    return progress.status === 'active'
  })

  return { available, readyToTurnIn, inProgress }
}

// ── Quest State Management (Immutable) ──

export function acceptQuest(
  quest: QuestDefinition,
  activeQuests: ReadonlyArray<QuestProgress>,
): ReadonlyArray<QuestProgress> {
  // Initialize progress for all objectives
  const objectiveProgress: Record<string, number> = {}
  for (const obj of quest.objectives) {
    objectiveProgress[obj.objectiveId] = 0
  }

  const newProgress: QuestProgress = {
    questId: quest.questId,
    status: 'active',
    objectiveProgress,
    acceptedAt: new Date().toISOString(),
    completedAt: null,
  }

  return [...activeQuests, newProgress]
}

export function updateQuestProgress(
  activeQuests: ReadonlyArray<QuestProgress>,
  questId: string,
  objectiveId: string,
  increment: number,
): ReadonlyArray<QuestProgress> {
  return activeQuests.map((progress) => {
    if (progress.questId !== questId) return progress

    const currentCount = progress.objectiveProgress[objectiveId] ?? 0
    const quest = getQuest(questId)
    const objective = quest?.objectives.find((o) => o.objectiveId === objectiveId)
    const maxCount = objective?.requiredCount ?? currentCount + increment

    const newCount = Math.min(currentCount + increment, maxCount)

    return {
      ...progress,
      objectiveProgress: {
        ...progress.objectiveProgress,
        [objectiveId]: newCount,
      },
    }
  })
}

export function isQuestComplete(
  progress: QuestProgress,
  quest: QuestDefinition,
): boolean {
  return quest.objectives.every((obj) => {
    const current = progress.objectiveProgress[obj.objectiveId] ?? 0
    return current >= obj.requiredCount
  })
}

export function markQuestAsComplete(
  activeQuests: ReadonlyArray<QuestProgress>,
  questId: string,
): ReadonlyArray<QuestProgress> {
  return activeQuests.map((progress) => {
    if (progress.questId !== questId) return progress
    if (progress.status !== 'active') return progress

    const quest = getQuest(questId)
    if (!quest || !isQuestComplete(progress, quest)) return progress

    return {
      ...progress,
      status: 'completed' as QuestStatus,
      completedAt: new Date().toISOString(),
    }
  })
}

export interface CompleteQuestResult {
  readonly activeQuests: ReadonlyArray<QuestProgress>
  readonly completedIds: ReadonlyArray<string>
}

export function completeQuest(
  activeQuests: ReadonlyArray<QuestProgress>,
  completedIds: ReadonlyArray<string>,
  questId: string,
): CompleteQuestResult {
  const quest = getQuest(questId)
  if (!quest) {
    return { activeQuests, completedIds }
  }

  // Remove from active quests
  const newActiveQuests = activeQuests.filter((p) => p.questId !== questId)

  // Add to completed (if not repeatable, or add anyway for tracking)
  const newCompletedIds = completedIds.includes(questId)
    ? completedIds
    : [...completedIds, questId]

  return {
    activeQuests: newActiveQuests,
    completedIds: newCompletedIds,
  }
}

export function abandonQuest(
  activeQuests: ReadonlyArray<QuestProgress>,
  questId: string,
): ReadonlyArray<QuestProgress> {
  return activeQuests.filter((p) => p.questId !== questId)
}

// ── Objective Tracking Helpers ──

export function trackDefeat(
  activeQuests: ReadonlyArray<QuestProgress>,
  speciesId: string,
): ReadonlyArray<QuestProgress> {
  let updated = activeQuests

  for (const progress of activeQuests) {
    if (progress.status !== 'active') continue

    const quest = getQuest(progress.questId)
    if (!quest) continue

    for (const obj of quest.objectives) {
      if (obj.type === 'defeat' && obj.targetId === speciesId) {
        updated = updateQuestProgress(updated, progress.questId, obj.objectiveId, 1)
      }
    }
  }

  return checkAndMarkComplete(updated)
}

export function trackItemCollection(
  activeQuests: ReadonlyArray<QuestProgress>,
  itemId: string,
  quantity: number,
): ReadonlyArray<QuestProgress> {
  let updated = activeQuests

  for (const progress of activeQuests) {
    if (progress.status !== 'active') continue

    const quest = getQuest(progress.questId)
    if (!quest) continue

    for (const obj of quest.objectives) {
      if (obj.type === 'collect' && obj.targetId === itemId) {
        updated = updateQuestProgress(updated, progress.questId, obj.objectiveId, quantity)
      }
    }
  }

  return checkAndMarkComplete(updated)
}

/**
 * Sync collect objectives with current inventory counts.
 * Called when accepting a quest to count items already in inventory,
 * or when re-syncing quest progress with inventory state.
 */
export function syncCollectObjectivesWithInventory(
  activeQuests: ReadonlyArray<QuestProgress>,
  getItemQuantity: (itemId: string) => number,
): ReadonlyArray<QuestProgress> {
  let updated = activeQuests

  for (const progress of activeQuests) {
    if (progress.status !== 'active') continue

    const quest = getQuest(progress.questId)
    if (!quest) continue

    for (const obj of quest.objectives) {
      if (obj.type === 'collect') {
        const currentInventoryCount = getItemQuantity(obj.targetId)
        const currentProgress = progress.objectiveProgress[obj.objectiveId] ?? 0

        // Only update if inventory count is higher than current progress
        if (currentInventoryCount > currentProgress) {
          const increment = currentInventoryCount - currentProgress
          updated = updateQuestProgress(updated, progress.questId, obj.objectiveId, increment)
        }
      }
    }
  }

  return checkAndMarkComplete(updated)
}

export function trackBossDefeat(
  activeQuests: ReadonlyArray<QuestProgress>,
  bossId: string,
): ReadonlyArray<QuestProgress> {
  let updated = activeQuests

  for (const progress of activeQuests) {
    if (progress.status !== 'active') continue

    const quest = getQuest(progress.questId)
    if (!quest) continue

    for (const obj of quest.objectives) {
      if (obj.type === 'boss' && obj.targetId === bossId) {
        updated = updateQuestProgress(updated, progress.questId, obj.objectiveId, 1)
      }
    }
  }

  return checkAndMarkComplete(updated)
}

export function trackAreaExploration(
  activeQuests: ReadonlyArray<QuestProgress>,
  areaId: string,
): ReadonlyArray<QuestProgress> {
  let updated = activeQuests

  for (const progress of activeQuests) {
    if (progress.status !== 'active') continue

    const quest = getQuest(progress.questId)
    if (!quest) continue

    for (const obj of quest.objectives) {
      if (obj.type === 'explore' && obj.targetId === areaId) {
        updated = updateQuestProgress(updated, progress.questId, obj.objectiveId, 1)
      }
    }
  }

  return checkAndMarkComplete(updated)
}

export function trackNpcTalk(
  activeQuests: ReadonlyArray<QuestProgress>,
  npcId: string,
): ReadonlyArray<QuestProgress> {
  let updated = activeQuests

  for (const progress of activeQuests) {
    if (progress.status !== 'active') continue

    const quest = getQuest(progress.questId)
    if (!quest) continue

    for (const obj of quest.objectives) {
      if (obj.type === 'talk' && obj.targetId === npcId) {
        updated = updateQuestProgress(updated, progress.questId, obj.objectiveId, 1)
      }
    }
  }

  return checkAndMarkComplete(updated)
}

function checkAndMarkComplete(
  activeQuests: ReadonlyArray<QuestProgress>,
): ReadonlyArray<QuestProgress> {
  return activeQuests.map((progress) => {
    if (progress.status !== 'active') return progress

    const quest = getQuest(progress.questId)
    if (!quest) return progress

    if (isQuestComplete(progress, quest)) {
      return {
        ...progress,
        status: 'completed' as QuestStatus,
        completedAt: new Date().toISOString(),
      }
    }

    return progress
  })
}

// ── Level-Appropriate Equipment Rewards ──

interface TierConfig {
  readonly minLevel: number
  readonly maxLevel: number
  readonly tierKeyword: string
}

const EQUIPMENT_TIERS: ReadonlyArray<TierConfig> = [
  { minLevel: 1, maxLevel: 4, tierKeyword: 'wooden' },
  { minLevel: 5, maxLevel: 9, tierKeyword: 'iron' },
  { minLevel: 10, maxLevel: 14, tierKeyword: 'steel' },
  { minLevel: 15, maxLevel: 19, tierKeyword: 'mythril' },
  { minLevel: 20, maxLevel: 99, tierKeyword: 'legendary' },
]

export function getTierForLevel(playerLevel: number): number {
  for (let i = 0; i < EQUIPMENT_TIERS.length; i++) {
    const tier = EQUIPMENT_TIERS[i]
    if (playerLevel >= tier.minLevel && playerLevel <= tier.maxLevel) {
      return i + 1
    }
  }
  return 5 // Max tier for very high levels
}

export function getEquipmentRewardForLevel(
  tier: number,
  slots: ReadonlyArray<EquipmentSlot>,
  playerLevel: number,
): Equipment | null {
  const allEquipment = getAllEquipment()
  if (allEquipment.length === 0) return null

  // Calculate effective tier based on player level
  const effectiveTier = Math.min(tier, getTierForLevel(playerLevel))
  const tierConfig = EQUIPMENT_TIERS[effectiveTier - 1]
  if (!tierConfig) return null

  // Filter equipment by slot, level requirement, and tier keyword
  const candidates = allEquipment.filter((eq) => {
    if (!slots.includes(eq.slot)) return false
    if (eq.levelRequirement > playerLevel) return false

    // Check if equipment name or id contains tier keyword
    const lowerName = eq.name.toLowerCase()
    const lowerId = eq.equipmentId.toLowerCase()
    return lowerName.includes(tierConfig.tierKeyword) || lowerId.includes(tierConfig.tierKeyword)
  })

  // If no tier-specific equipment found, fall back to any equipment in slots
  const fallbackCandidates = candidates.length > 0
    ? candidates
    : allEquipment.filter((eq) => {
        if (!slots.includes(eq.slot)) return false
        return eq.levelRequirement <= playerLevel
      })

  if (fallbackCandidates.length === 0) return null

  // Return random equipment from candidates
  const randomIndex = Math.floor(Math.random() * fallbackCandidates.length)
  return fallbackCandidates[randomIndex]
}

// ── Quest Progress Utilities ──

export function getQuestProgressPercent(
  progress: QuestProgress,
  quest: QuestDefinition,
): number {
  if (quest.objectives.length === 0) return 100

  let total = 0
  let completed = 0

  for (const obj of quest.objectives) {
    total += obj.requiredCount
    completed += Math.min(progress.objectiveProgress[obj.objectiveId] ?? 0, obj.requiredCount)
  }

  return total > 0 ? Math.round((completed / total) * 100) : 0
}

export function getObjectiveProgress(
  progress: QuestProgress,
  objectiveId: string,
): number {
  return progress.objectiveProgress[objectiveId] ?? 0
}

export function getActiveQuestCount(activeQuests: ReadonlyArray<QuestProgress>): number {
  return activeQuests.filter((q) => q.status === 'active').length
}

export function getCompletedQuestCount(activeQuests: ReadonlyArray<QuestProgress>): number {
  return activeQuests.filter((q) => q.status === 'completed').length
}
