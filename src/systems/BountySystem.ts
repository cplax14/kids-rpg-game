import type {
  BountyDefinition,
  BountyPool,
  BountyProgress,
  BountyBoardState,
  QuestRewards,
  QuestRewardItem,
  StreakReward,
  QuestObjective,
} from '../models/types'
import { EventBus } from '../events/EventBus'
import { GAME_EVENTS } from '../events/GameEvents'

// ── Bounty Registry ──

let bountyRegistry: ReadonlyArray<BountyDefinition> = []
let poolRegistry: ReadonlyArray<BountyPool> = []

export function loadBountyData(bounties: ReadonlyArray<BountyDefinition>): void {
  bountyRegistry = bounties
}

export function loadBountyPools(pools: ReadonlyArray<BountyPool>): void {
  poolRegistry = pools
}

export function getBounty(bountyId: string): BountyDefinition | undefined {
  return bountyRegistry.find((b) => b.bountyId === bountyId)
}

export function getAllBounties(): ReadonlyArray<BountyDefinition> {
  return bountyRegistry
}

export function getPool(poolId: string): BountyPool | undefined {
  return poolRegistry.find((p) => p.poolId === poolId)
}

export function getAllPools(): ReadonlyArray<BountyPool> {
  return poolRegistry
}

export function clearBountyRegistry(): void {
  bountyRegistry = []
  poolRegistry = []
}

// ── Streak Rewards ──

const STREAK_REWARDS: ReadonlyArray<StreakReward> = [
  { streakDays: 3, goldMultiplier: 1.25, bonusItems: [] },
  { streakDays: 5, goldMultiplier: 1.5, bonusItems: [{ itemId: 'potion', quantity: 2 }] },
  { streakDays: 7, goldMultiplier: 2.0, bonusItems: [{ itemId: 'super-potion', quantity: 2 }] },
  { streakDays: 14, goldMultiplier: 2.5, bonusItems: [{ itemId: 'mega-ball', quantity: 2 }] },
  { streakDays: 30, goldMultiplier: 3.0, bonusItems: [{ itemId: 'trait-crystal', quantity: 1 }] },
]

export function getStreakReward(streakCount: number): StreakReward | null {
  // Find the highest streak reward the player qualifies for
  let bestReward: StreakReward | null = null

  for (const reward of STREAK_REWARDS) {
    if (streakCount >= reward.streakDays) {
      bestReward = reward
    }
  }

  return bestReward
}

// ── Daily Refresh ──

export function getCurrentDateString(): string {
  return new Date().toISOString().split('T')[0]
}

export function shouldRefreshBounties(lastRefreshDate: string, currentDate: string): boolean {
  return lastRefreshDate !== currentDate
}

/**
 * Generate a deterministic seed from a date string
 * This ensures the same bounties appear for all players on the same day
 */
function dateToSeed(dateString: string): number {
  let hash = 0
  for (let i = 0; i < dateString.length; i++) {
    const char = dateString.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/**
 * Simple seeded random number generator
 */
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = Math.imul(48271, s) | 0 % 2147483647
    return (s & 2147483647) / 2147483647
  }
}

/**
 * Select bounties from each pool for the day
 * Typically 1 easy, 1 medium, 1 hard bounty
 */
export function selectDailyBounties(
  pools: ReadonlyArray<BountyPool>,
  currentDate: string,
): ReadonlyArray<string> {
  const seed = dateToSeed(currentDate)
  const random = seededRandom(seed)
  const selectedBounties: string[] = []

  // Sort pools by tier to ensure consistent ordering
  const sortedPools = [...pools].sort((a, b) => {
    const tierOrder = { easy: 0, medium: 1, hard: 2 }
    return tierOrder[a.tier] - tierOrder[b.tier]
  })

  for (const pool of sortedPools) {
    if (pool.bountyIds.length > 0) {
      // Pick a random bounty from the pool
      const index = Math.floor(random() * pool.bountyIds.length)
      selectedBounties.push(pool.bountyIds[index])
    }
  }

  return selectedBounties
}

export function createEmptyBoardState(): BountyBoardState {
  return {
    lastRefreshDate: '',
    availableBounties: [],
    activeBounty: null,
    completedToday: [],
    streakCount: 0,
    lastStreakDate: null,
  }
}

export function refreshBountyBoard(
  state: BountyBoardState,
  currentDate: string,
): BountyBoardState {
  if (!shouldRefreshBounties(state.lastRefreshDate, currentDate)) {
    return state
  }

  const availableBounties = selectDailyBounties(poolRegistry, currentDate)

  const newState: BountyBoardState = {
    ...state,
    lastRefreshDate: currentDate,
    availableBounties,
    activeBounty: null, // Clear active bounty on refresh
    completedToday: [], // Clear completed list for new day
  }

  EventBus.emit(GAME_EVENTS.BOUNTY_BOARD_REFRESHED, {
    availableBounties,
    date: currentDate,
  })

  return newState
}

// ── Bounty Management ──

export function acceptBounty(
  state: BountyBoardState,
  bountyId: string,
): BountyBoardState | null {
  // Can't accept if already have active bounty
  if (state.activeBounty !== null) {
    return null
  }

  // Can't accept if bounty not available
  if (!state.availableBounties.includes(bountyId)) {
    return null
  }

  // Can't accept if already completed today
  if (state.completedToday.includes(bountyId)) {
    return null
  }

  const bounty = getBounty(bountyId)
  if (!bounty) {
    return null
  }

  // Initialize progress for all objectives
  const objectiveProgress: Record<string, number> = {}
  for (const objective of bounty.objectives) {
    objectiveProgress[objective.objectiveId] = 0
  }

  const progress: BountyProgress = {
    bountyId,
    status: 'active',
    objectiveProgress,
    acceptedAt: new Date().toISOString(),
  }

  const newState: BountyBoardState = {
    ...state,
    activeBounty: progress,
  }

  EventBus.emit(GAME_EVENTS.BOUNTY_ACCEPTED, { bounty, progress })

  return newState
}

export function updateBountyProgress(
  state: BountyBoardState,
  objectiveId: string,
  increment: number,
): BountyBoardState {
  if (!state.activeBounty || state.activeBounty.status !== 'active') {
    return state
  }

  const bounty = getBounty(state.activeBounty.bountyId)
  if (!bounty) {
    return state
  }

  // Check if this objective exists in the bounty
  const objective = bounty.objectives.find((o) => o.objectiveId === objectiveId)
  if (!objective) {
    return state
  }

  const currentProgress = state.activeBounty.objectiveProgress[objectiveId] ?? 0
  const newProgress = Math.min(currentProgress + increment, objective.requiredCount)

  const updatedObjectiveProgress = {
    ...state.activeBounty.objectiveProgress,
    [objectiveId]: newProgress,
  }

  // Check if bounty is complete
  const isComplete = bounty.objectives.every(
    (obj) => (updatedObjectiveProgress[obj.objectiveId] ?? 0) >= obj.requiredCount,
  )

  const updatedProgress: BountyProgress = {
    ...state.activeBounty,
    objectiveProgress: updatedObjectiveProgress,
    status: isComplete ? 'completed' : 'active',
  }

  const newState: BountyBoardState = {
    ...state,
    activeBounty: updatedProgress,
  }

  if (isComplete) {
    EventBus.emit(GAME_EVENTS.BOUNTY_COMPLETED, { bounty, progress: updatedProgress })
  }

  return newState
}

export function isBountyComplete(
  progress: BountyProgress,
  bounty: BountyDefinition,
): boolean {
  return bounty.objectives.every(
    (obj) => (progress.objectiveProgress[obj.objectiveId] ?? 0) >= obj.requiredCount,
  )
}

// ── Claiming Rewards ──

export function claimBountyRewards(
  state: BountyBoardState,
  currentDate: string,
): { state: BountyBoardState; rewards: QuestRewards } | null {
  if (!state.activeBounty || state.activeBounty.status !== 'completed') {
    return null
  }

  const bounty = getBounty(state.activeBounty.bountyId)
  if (!bounty) {
    return null
  }

  // Calculate streak
  const { newStreak, streakReward } = calculateStreakUpdate(state, currentDate)

  // Apply streak bonus to rewards
  const finalRewards = applyStreakBonus(bounty.baseRewards, streakReward)

  const newState: BountyBoardState = {
    ...state,
    activeBounty: null,
    completedToday: [...state.completedToday, bounty.bountyId],
    streakCount: newStreak,
    lastStreakDate: currentDate,
  }

  EventBus.emit(GAME_EVENTS.BOUNTY_CLAIMED, {
    bounty,
    rewards: finalRewards,
    streak: streakReward,
  })

  if (newStreak !== state.streakCount) {
    EventBus.emit(GAME_EVENTS.BOUNTY_STREAK_UPDATED, {
      previousStreak: state.streakCount,
      newStreak,
      streakReward,
    })
  }

  return { state: newState, rewards: finalRewards }
}

// ── Streak Calculations ──

function calculateStreakUpdate(
  state: BountyBoardState,
  currentDate: string,
): { newStreak: number; streakReward: StreakReward | null } {
  const previousStreak = calculateStreak(state.lastStreakDate, currentDate, state.streakCount)
  const newStreak = previousStreak + 1
  const streakReward = getStreakReward(newStreak)

  return { newStreak, streakReward }
}

export function calculateStreak(
  lastStreakDate: string | null,
  currentDate: string,
  currentStreak: number,
): number {
  if (!lastStreakDate) {
    return 0 // Starting fresh
  }

  // Parse dates
  const lastDate = new Date(lastStreakDate)
  const today = new Date(currentDate)

  // Calculate difference in days
  const diffTime = today.getTime() - lastDate.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    // Same day, streak continues
    return currentStreak
  } else if (diffDays === 1) {
    // Next day, streak continues
    return currentStreak
  } else {
    // More than one day gap, streak resets
    return 0
  }
}

export function applyStreakBonus(
  baseRewards: QuestRewards,
  streak: StreakReward | null,
): QuestRewards {
  if (!streak) {
    return baseRewards
  }

  // Apply gold multiplier
  const bonusGold = Math.floor(baseRewards.gold * streak.goldMultiplier)

  // Merge bonus items
  const mergedItems = mergeRewardItems(baseRewards.items, streak.bonusItems)

  return {
    ...baseRewards,
    gold: bonusGold,
    items: mergedItems,
  }
}

function mergeRewardItems(
  existing: ReadonlyArray<QuestRewardItem>,
  bonus: ReadonlyArray<QuestRewardItem>,
): ReadonlyArray<QuestRewardItem> {
  const itemMap = new Map<string, number>()

  for (const item of existing) {
    itemMap.set(item.itemId, (itemMap.get(item.itemId) ?? 0) + item.quantity)
  }

  for (const item of bonus) {
    itemMap.set(item.itemId, (itemMap.get(item.itemId) ?? 0) + item.quantity)
  }

  return Array.from(itemMap.entries()).map(([itemId, quantity]) => ({
    itemId,
    quantity,
  }))
}

// ── Abandon Bounty ──

export function abandonBounty(state: BountyBoardState): BountyBoardState {
  if (!state.activeBounty) {
    return state
  }

  return {
    ...state,
    activeBounty: null,
  }
}

// ── Query Helpers ──

export function getAvailableBountiesForDisplay(
  state: BountyBoardState,
): ReadonlyArray<{ bounty: BountyDefinition; canAccept: boolean; completed: boolean }> {
  return state.availableBounties
    .map((bountyId) => {
      const bounty = getBounty(bountyId)
      if (!bounty) return null

      const isActive = state.activeBounty?.bountyId === bountyId
      const completed = state.completedToday.includes(bountyId)

      return {
        bounty,
        canAccept: !isActive && !completed && state.activeBounty === null,
        completed,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
}

export function getBountyObjectiveProgress(
  progress: BountyProgress,
  objective: QuestObjective,
): { current: number; required: number; isComplete: boolean } {
  const current = progress.objectiveProgress[objective.objectiveId] ?? 0
  return {
    current,
    required: objective.requiredCount,
    isComplete: current >= objective.requiredCount,
  }
}
