import type { Battle, BattleCombatant, TargetType } from '../models/types'
import { randomInt } from '../utils/math'

// ── Target Resolution ──

/**
 * Determine which targets are valid for selection based on ability target type
 */
export function getValidTargets(
  battle: Battle,
  actorId: string,
  targetType: TargetType,
): ReadonlyArray<BattleCombatant> {
  const actor = findCombatant(battle, actorId)
  if (!actor) return []

  const aliveEnemies = actor.isPlayer
    ? battle.enemySquad.filter((c) => c.stats.currentHp > 0)
    : battle.playerSquad.filter((c) => c.stats.currentHp > 0)

  const aliveAllies = actor.isPlayer
    ? battle.playerSquad.filter((c) => c.stats.currentHp > 0)
    : battle.enemySquad.filter((c) => c.stats.currentHp > 0)

  switch (targetType) {
    case 'single_enemy':
    case 'adjacent_enemies':
    case 'random_enemies_2':
    case 'random_enemies_3':
      return aliveEnemies

    case 'all_enemies':
      // All enemies are auto-targeted, no selection needed
      return []

    case 'self':
      return actor ? [actor] : []

    case 'single_ally':
      return aliveAllies

    case 'all_allies':
      // All allies are auto-targeted, no selection needed
      return []

    default:
      return []
  }
}

/**
 * Resolve the actual target IDs based on selection and ability type
 * Returns all combatant IDs that will be affected by the action
 */
export function resolveTargets(
  battle: Battle,
  targetType: TargetType,
  primaryTargetId: string | null,
  actorId: string,
): ReadonlyArray<string> {
  const actor = findCombatant(battle, actorId)
  if (!actor) return []

  const aliveEnemies = actor.isPlayer
    ? battle.enemySquad.filter((c) => c.stats.currentHp > 0)
    : battle.playerSquad.filter((c) => c.stats.currentHp > 0)

  const aliveAllies = actor.isPlayer
    ? battle.playerSquad.filter((c) => c.stats.currentHp > 0)
    : battle.enemySquad.filter((c) => c.stats.currentHp > 0)

  switch (targetType) {
    case 'single_enemy':
      if (primaryTargetId) return [primaryTargetId]
      // Fall back to first enemy if no target specified
      return aliveEnemies.length > 0 ? [aliveEnemies[0].combatantId] : []

    case 'all_enemies':
      return aliveEnemies.map((c) => c.combatantId)

    case 'adjacent_enemies':
      return getAdjacentEnemies(battle, primaryTargetId, actor.isPlayer)

    case 'random_enemies_2':
      return getRandomEnemies(battle, 2, actor.isPlayer)

    case 'random_enemies_3':
      return getRandomEnemies(battle, 3, actor.isPlayer)

    case 'self':
      return [actorId]

    case 'single_ally':
      if (primaryTargetId) return [primaryTargetId]
      return []

    case 'all_allies':
      return aliveAllies.map((c) => c.combatantId)

    default:
      return []
  }
}

/**
 * Get adjacent enemies for cleave attacks
 * Returns primary target plus adjacent enemies based on position in squad array
 */
export function getAdjacentEnemies(
  battle: Battle,
  primaryTargetId: string | null,
  actorIsPlayer: boolean,
): ReadonlyArray<string> {
  const enemies = actorIsPlayer ? battle.enemySquad : battle.playerSquad
  const aliveEnemies = enemies.filter((c) => c.stats.currentHp > 0)

  if (aliveEnemies.length === 0) return []
  if (!primaryTargetId) {
    // If no primary target, use first enemy
    const first = aliveEnemies[0]
    return getAdjacentEnemies(battle, first.combatantId, actorIsPlayer)
  }

  // Find index of primary target in alive enemies list
  const primaryIndex = aliveEnemies.findIndex((c) => c.combatantId === primaryTargetId)
  if (primaryIndex === -1) return []

  const result: string[] = [primaryTargetId]

  // Add adjacent enemies (before and after in the list)
  if (primaryIndex > 0) {
    result.push(aliveEnemies[primaryIndex - 1].combatantId)
  }
  if (primaryIndex < aliveEnemies.length - 1) {
    result.push(aliveEnemies[primaryIndex + 1].combatantId)
  }

  return result
}

/**
 * Get random enemies for scatter/multi-target attacks
 * Returns up to `count` random enemies (may return fewer if not enough enemies)
 */
export function getRandomEnemies(
  battle: Battle,
  count: number,
  actorIsPlayer: boolean,
): ReadonlyArray<string> {
  const enemies = actorIsPlayer ? battle.enemySquad : battle.playerSquad
  const aliveEnemies = enemies.filter((c) => c.stats.currentHp > 0)

  if (aliveEnemies.length === 0) return []
  if (aliveEnemies.length <= count) {
    return aliveEnemies.map((c) => c.combatantId)
  }

  // Shuffle and take first `count` enemies
  const shuffled = [...aliveEnemies]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomInt(0, i)
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  return shuffled.slice(0, count).map((c) => c.combatantId)
}

/**
 * Check if a specific target is valid for selection
 */
export function isValidTarget(
  battle: Battle,
  actorId: string,
  targetId: string,
  targetType: TargetType,
): boolean {
  const validTargets = getValidTargets(battle, actorId, targetType)
  return validTargets.some((c) => c.combatantId === targetId)
}

/**
 * Determine if a target type requires player selection
 * Returns false for auto-targeted abilities (all_enemies, all_allies, self, random)
 */
export function requiresTargetSelection(targetType: TargetType): boolean {
  switch (targetType) {
    case 'single_enemy':
    case 'single_ally':
    case 'adjacent_enemies':
      return true

    case 'all_enemies':
    case 'all_allies':
    case 'self':
    case 'random_enemies_2':
    case 'random_enemies_3':
      return false

    default:
      return false
  }
}

/**
 * Get the number of targets an ability will hit
 * Useful for UI display and damage calculation
 */
export function getTargetCount(
  battle: Battle,
  targetType: TargetType,
  primaryTargetId: string | null,
  actorId: string,
): number {
  return resolveTargets(battle, targetType, primaryTargetId, actorId).length
}

/**
 * Calculate damage multiplier for multi-target abilities
 * Multi-target attacks deal reduced damage per target
 */
export function getMultiTargetDamageMultiplier(targetCount: number): number {
  if (targetCount <= 1) return 1.0
  // 75% damage per target for 2+ targets
  return 0.75
}

// ── Internal Helpers ──

function findCombatant(battle: Battle, combatantId: string): BattleCombatant | undefined {
  return (
    battle.playerSquad.find((c) => c.combatantId === combatantId) ??
    battle.enemySquad.find((c) => c.combatantId === combatantId)
  )
}
