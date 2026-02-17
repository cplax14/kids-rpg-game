/**
 * GuidanceSystem - Progressive milestone tracking for new players
 *
 * Guides players through key game mechanics with proactive hints:
 * 1. Talk to NPC → 2. Leave village → 3. Win battle → 4. Capture monster
 * 5. Open menu → 6. Save game → 7. Visit shop → 8. Explore new area
 *
 * Pure functions for milestone calculation and state updates.
 */

import type { GuidanceMilestone, GuidanceMilestoneId } from '../models/types'
import type { GameState } from './GameStateManager'

// ── Milestone Registry ──

let milestonesRegistry: ReadonlyArray<GuidanceMilestone> = []

/**
 * Load milestone data into the registry.
 */
export function loadGuidanceData(milestones: ReadonlyArray<GuidanceMilestone>): void {
  milestonesRegistry = milestones
}

/**
 * Get a milestone by ID.
 */
export function getMilestone(id: GuidanceMilestoneId): GuidanceMilestone | undefined {
  return milestonesRegistry.find((m) => m.id === id)
}

/**
 * Get all milestones in order.
 */
export function getAllMilestones(): ReadonlyArray<GuidanceMilestone> {
  return milestonesRegistry
}

/**
 * Clear the registry (for testing).
 */
export function clearGuidanceRegistry(): void {
  milestonesRegistry = []
}

// ── Milestone Order ──

/**
 * The ordered list of milestones. Players progress through these sequentially.
 */
export const MILESTONE_ORDER: ReadonlyArray<GuidanceMilestoneId> = [
  'talk-to-npc',
  'leave-village',
  'win-battle',
  'capture-monster',
  'open-menu',
  'save-game',
  'visit-shop',
  'explore-new-area',
]

// ── Pure Functions ──

/**
 * Get the current active milestone for a player.
 * Returns null if all milestones are complete.
 */
export function getCurrentMilestone(state: GameState): GuidanceMilestone | null {
  const completed = state.completedGuidanceMilestones

  // Find the first uncompleted milestone
  for (const milestoneId of MILESTONE_ORDER) {
    if (!completed.includes(milestoneId)) {
      return getMilestone(milestoneId) ?? null
    }
  }

  // All milestones complete
  return null
}

/**
 * Get the ID of the current active milestone.
 * Returns null if all milestones are complete.
 */
export function getCurrentMilestoneId(state: GameState): GuidanceMilestoneId | null {
  const completed = state.completedGuidanceMilestones

  for (const milestoneId of MILESTONE_ORDER) {
    if (!completed.includes(milestoneId)) {
      return milestoneId
    }
  }

  return null
}

/**
 * Check if a specific milestone is complete.
 */
export function isMilestoneComplete(
  state: GameState,
  milestoneId: GuidanceMilestoneId,
): boolean {
  return state.completedGuidanceMilestones.includes(milestoneId)
}

/**
 * Check if all milestones are complete.
 */
export function areAllMilestonesComplete(state: GameState): boolean {
  return MILESTONE_ORDER.every((id) => state.completedGuidanceMilestones.includes(id))
}

/**
 * Get the milestone index (1-based) for display.
 */
export function getMilestoneProgress(state: GameState): {
  current: number
  total: number
} {
  const completedCount = state.completedGuidanceMilestones.length
  return {
    current: Math.min(completedCount + 1, MILESTONE_ORDER.length),
    total: MILESTONE_ORDER.length,
  }
}

/**
 * Check if a milestone should be auto-completed based on game state.
 * This handles cases where the player completes actions out of order
 * (e.g., player opens menu before talking to NPC).
 */
export function checkMilestoneAutoComplete(
  state: GameState,
  milestoneId: GuidanceMilestoneId,
): boolean {
  switch (milestoneId) {
    case 'talk-to-npc':
      // No auto-complete logic - requires explicit trigger
      return false

    case 'leave-village':
      // Auto-complete if player has visited any area besides sunlit-village
      return state.visitedAreas.some((area) => area !== 'sunlit-village')

    case 'win-battle':
      // Auto-complete if player has won any battles
      return state.achievementStats.battlesWon > 0

    case 'capture-monster':
      // Auto-complete if player has captured any monsters
      return state.achievementStats.monstersCaptured > 0

    case 'open-menu':
      // No auto-complete - requires explicit trigger
      return false

    case 'save-game':
      // No auto-complete - requires explicit trigger
      return false

    case 'visit-shop':
      // No auto-complete - requires explicit trigger
      return false

    case 'explore-new-area':
      // Auto-complete if player has visited any area beyond the starting village
      return state.visitedAreas.length >= 2

    default:
      return false
  }
}

/**
 * Get all milestones that should be auto-completed based on current state.
 */
export function getAutoCompletableMilestones(
  state: GameState,
): ReadonlyArray<GuidanceMilestoneId> {
  return MILESTONE_ORDER.filter(
    (id) =>
      !state.completedGuidanceMilestones.includes(id) &&
      checkMilestoneAutoComplete(state, id),
  )
}

// ── Default Milestone Data ──

/**
 * Default milestone definitions.
 * These can be loaded from JSON or used directly.
 */
export const DEFAULT_MILESTONES: ReadonlyArray<GuidanceMilestone> = [
  {
    id: 'talk-to-npc',
    message: 'Talk to the villagers to learn about monsters!',
    target: 'npc',
    celebrationMessage: 'Great job talking to the villagers!',
  },
  {
    id: 'leave-village',
    message: 'Explore outside the village to find wild monsters!',
    target: 'exit-south',
    celebrationMessage: 'Adventure awaits!',
  },
  {
    id: 'win-battle',
    message: 'Defeat the wild monster in battle!',
    target: null,
    celebrationMessage: 'You won your first battle!',
  },
  {
    id: 'capture-monster',
    message: 'Weaken a monster and capture it!',
    target: null,
    celebrationMessage: 'You caught a monster!',
  },
  {
    id: 'open-menu',
    message: 'Check your Squad in the menu! Press M',
    target: 'menu-button',
    celebrationMessage: 'Now you know how to manage your team!',
  },
  {
    id: 'save-game',
    message: 'Save your game! Press F5 or use the menu.',
    target: 'save-tab',
    celebrationMessage: 'Your progress is safe!',
  },
  {
    id: 'visit-shop',
    message: 'Visit the shop to buy supplies!',
    target: 'shop',
    celebrationMessage: 'Shopping unlocked!',
  },
  {
    id: 'explore-new-area',
    message: 'Explore the Whispering Woods for new monsters!',
    target: null,
    celebrationMessage: 'Keep exploring to find rare monsters!',
  },
]
