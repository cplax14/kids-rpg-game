/**
 * RecoverySystem - Handles defeat recovery mechanics
 *
 * When the player's squad is defeated, they respawn at Sunlit Village
 * with two recovery options:
 * - Paid: 25% gold cost, full restoration
 * - Free: Keep gold, lose random half of consumable items AND monsters (starter protected)
 */

import type {
  MonsterInstance,
  InventorySlot,
  Inventory,
  QuestRewardItem,
  CharacterStats,
} from '../models/types'
import type { GameState } from './GameStateManager'

// ── Types ──

export type RecoveryOptionType = 'paid' | 'free'

export interface RecoveryPenalty {
  readonly goldCost: number
  readonly itemsToLose: ReadonlyArray<QuestRewardItem>
  readonly monstersToLose: ReadonlyArray<string> // instanceIds
  readonly hpRestorePercent: number // 1.0 = full, or 0.1 = 10% (minimum 1 HP)
}

export interface RecoveryPreview {
  readonly paid: RecoveryPenalty
  readonly free: RecoveryPenalty
  readonly canAffordPaid: boolean
  readonly currentGold: number
}

// ── Constants ──

export const RECOVERY_CONSTANTS = {
  PAID_GOLD_PERCENT: 0.25, // 25% of current gold
  FREE_HP_RESTORE_PERCENT: 0.1, // Wake up at 10% HP (minimum 1)
  SPAWN_AREA_ID: 'sunlit-village',
  SPAWN_POSITION: { x: 480, y: 500 }, // Near the village center
} as const

// ── Seeded Random ──

/**
 * Simple seeded random number generator (LCG)
 * Used to ensure the preview shows the same items/monsters as the actual result
 */
function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0xffffffff
  }
}

/**
 * Fisher-Yates shuffle with seeded random
 */
function seededShuffle<T>(array: ReadonlyArray<T>, seed: number): T[] {
  const result = [...array]
  const random = seededRandom(seed)

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }

  return result
}

// ── Recovery Calculations ──

/**
 * Calculate the penalty for paid recovery
 * - Costs 25% of current gold
 * - Full HP/MP restoration
 * - Keep all items and monsters
 */
export function calculatePaidRecovery(state: GameState): RecoveryPenalty {
  const goldCost = Math.floor(state.player.gold * RECOVERY_CONSTANTS.PAID_GOLD_PERCENT)

  return {
    goldCost,
    itemsToLose: [],
    monstersToLose: [],
    hpRestorePercent: 1.0,
  }
}

/**
 * Calculate the penalty for free recovery
 * - No gold cost
 * - Lose random half of consumable items
 * - Lose random half of monsters (starter at index 0 is protected)
 * - Wake up at 10% HP (minimum 1)
 */
export function calculateFreeRecovery(state: GameState, seed: number): RecoveryPenalty {
  return {
    goldCost: 0,
    itemsToLose: selectItemsToLose(state.inventory, seed),
    monstersToLose: selectMonstersToLose(state.squad, seed),
    hpRestorePercent: RECOVERY_CONSTANTS.FREE_HP_RESTORE_PERCENT,
  }
}

/**
 * Select random half of consumable items to lose
 * Key items are never lost
 */
function selectItemsToLose(
  inventory: Inventory,
  seed: number,
): ReadonlyArray<QuestRewardItem> {
  // Filter to only consumables (not key items, not equipment)
  const consumables = inventory.items.filter(
    (slot) => slot.item.category === 'consumable' || slot.item.category === 'capture_device',
  )

  if (consumables.length === 0) return []

  // Shuffle and take half
  const shuffled = seededShuffle(consumables, seed)
  const countToLose = Math.floor(shuffled.length / 2)

  // For each item, lose half of the quantity (rounded down, minimum 1)
  return shuffled.slice(0, countToLose).map((slot) => ({
    itemId: slot.item.itemId,
    quantity: Math.max(1, Math.floor(slot.quantity / 2)),
  }))
}

/**
 * Select random half of monsters to lose
 * The first monster (starter) is ALWAYS protected
 */
function selectMonstersToLose(
  squad: ReadonlyArray<MonsterInstance>,
  seed: number,
): ReadonlyArray<string> {
  // Skip the first monster (index 0) - it's the starter
  const candidates = squad.slice(1)

  if (candidates.length === 0) return []

  // Shuffle and take half (rounded down)
  const shuffled = seededShuffle(candidates, seed)
  const countToLose = Math.floor(shuffled.length / 2)

  return shuffled.slice(0, countToLose).map((m) => m.instanceId)
}

/**
 * Generate a preview of both recovery options
 */
export function generateRecoveryPreview(state: GameState, seed: number): RecoveryPreview {
  const paid = calculatePaidRecovery(state)
  const free = calculateFreeRecovery(state, seed)

  return {
    paid,
    free,
    canAffordPaid: state.player.gold >= paid.goldCost,
    currentGold: state.player.gold,
  }
}

// ── Apply Recovery ──

/**
 * Apply the chosen recovery option to the game state
 * Returns a new GameState with:
 * - Player respawned at Sunlit Village
 * - Gold/items/monsters modified based on choice
 * - HP restored based on choice
 */
export function applyRecovery(
  state: GameState,
  option: RecoveryOptionType,
  seed: number,
): GameState {
  const penalty =
    option === 'paid' ? calculatePaidRecovery(state) : calculateFreeRecovery(state, seed)

  // Apply gold cost
  const newGold = Math.max(0, state.player.gold - penalty.goldCost)

  // Remove lost items from inventory
  const newInventoryItems = removeItemsFromInventory(state.inventory.items, penalty.itemsToLose)

  // Remove lost monsters from squad
  const newSquad = state.squad.filter(
    (m) => !penalty.monstersToLose.includes(m.instanceId),
  )

  // Restore HP/MP for remaining squad
  const healedSquad = newSquad.map((monster) => healMonster(monster, penalty.hpRestorePercent))

  // Update player position to Sunlit Village
  const newPlayer = {
    ...state.player,
    gold: newGold,
    currentAreaId: RECOVERY_CONSTANTS.SPAWN_AREA_ID,
    position: RECOVERY_CONSTANTS.SPAWN_POSITION,
    stats: healPlayerStats(state.player.stats, penalty.hpRestorePercent),
  }

  return {
    ...state,
    player: newPlayer,
    inventory: {
      ...state.inventory,
      items: newInventoryItems,
    },
    squad: healedSquad,
    currentAreaId: RECOVERY_CONSTANTS.SPAWN_AREA_ID,
  }
}

/**
 * Remove specified items from inventory
 */
function removeItemsFromInventory(
  items: ReadonlyArray<InventorySlot>,
  toRemove: ReadonlyArray<QuestRewardItem>,
): ReadonlyArray<InventorySlot> {
  const removeMap = new Map<string, number>()
  for (const item of toRemove) {
    removeMap.set(item.itemId, (removeMap.get(item.itemId) ?? 0) + item.quantity)
  }

  return items
    .map((slot) => {
      const removeCount = removeMap.get(slot.item.itemId) ?? 0
      if (removeCount === 0) return slot

      const newQuantity = slot.quantity - removeCount
      if (newQuantity <= 0) return null

      return { ...slot, quantity: newQuantity }
    })
    .filter((slot): slot is InventorySlot => slot !== null)
}

/**
 * Heal a monster based on recovery percentage
 */
function healMonster(monster: MonsterInstance, hpRestorePercent: number): MonsterInstance {
  const newHp = Math.max(1, Math.floor(monster.stats.maxHp * hpRestorePercent))
  const newMp = Math.max(0, Math.floor(monster.stats.maxMp * hpRestorePercent))

  return {
    ...monster,
    stats: {
      ...monster.stats,
      currentHp: Math.min(newHp, monster.stats.maxHp),
      currentMp: Math.min(newMp, monster.stats.maxMp),
    },
  }
}

/**
 * Heal player stats based on recovery percentage
 */
function healPlayerStats(stats: CharacterStats, hpRestorePercent: number): CharacterStats {
  const newHp = Math.max(1, Math.floor(stats.maxHp * hpRestorePercent))
  const newMp = Math.max(0, Math.floor(stats.maxMp * hpRestorePercent))

  return {
    ...stats,
    currentHp: Math.min(newHp, stats.maxHp),
    currentMp: Math.min(newMp, stats.maxMp),
  }
}

// ── Helper Functions ──

/**
 * Get display name for a monster (nickname or species name)
 */
export function getMonsterDisplayName(monster: MonsterInstance): string {
  return monster.nickname ?? monster.speciesId
}

/**
 * Check if the player has any monsters to lose
 * (more than just the starter)
 */
export function hasExtraMonstersToLose(squad: ReadonlyArray<MonsterInstance>): boolean {
  return squad.length > 1
}

/**
 * Check if the player has any consumable items to lose
 */
export function hasConsumableItemsToLose(inventory: Inventory): boolean {
  return inventory.items.some(
    (slot) => slot.item.category === 'consumable' || slot.item.category === 'capture_device',
  )
}
