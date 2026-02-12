import type { Battle, BattleCombatant, BattleAction } from '../models/types'
import { randomInt } from '../utils/math'

// ── Squad Monster AI ──
// Simple AI for player's squad monsters during battle

export function getSquadMonsterAction(
  battle: Battle,
  monster: BattleCombatant,
): BattleAction {
  const aliveEnemies = battle.enemySquad.filter((e) => e.stats.currentHp > 0)

  if (aliveEnemies.length === 0) {
    return createDefendAction(monster)
  }

  // Check if monster should heal
  const hpPercent = monster.stats.currentHp / monster.stats.maxHp
  if (hpPercent < 0.3) {
    const healAbility = monster.abilities.find(
      (a) => a.type === 'healing' && monster.stats.currentMp >= a.mpCost
    )
    if (healAbility) {
      return {
        type: 'ability',
        actorId: monster.combatantId,
        targetId: monster.combatantId,
        targetIds: [],
        abilityId: healAbility.abilityId,
        itemId: null,
      }
    }
  }

  // Check if should heal an ally
  const hurtAllies = battle.playerSquad.filter(
    (p) => p.stats.currentHp > 0 && p.stats.currentHp / p.stats.maxHp < 0.3
  )
  if (hurtAllies.length > 0) {
    const healAllyAbility = monster.abilities.find(
      (a) =>
        a.type === 'healing' &&
        a.targetType === 'single_ally' &&
        monster.stats.currentMp >= a.mpCost
    )
    if (healAllyAbility) {
      const target = hurtAllies[0]
      return {
        type: 'ability',
        actorId: monster.combatantId,
        targetId: target.combatantId,
        targetIds: [],
        abilityId: healAllyAbility.abilityId,
        itemId: null,
      }
    }
  }

  // Try to use a damaging ability
  const damagingAbilities = monster.abilities.filter(
    (a) =>
      (a.type === 'physical' || a.type === 'magical') &&
      a.power > 0 &&
      monster.stats.currentMp >= a.mpCost
  )

  if (damagingAbilities.length > 0) {
    // Pick the strongest ability we can afford
    const bestAbility = damagingAbilities.reduce((best, current) =>
      current.power > best.power ? current : best
    )

    const target = selectBestTarget(aliveEnemies, bestAbility.element)

    return {
      type: 'ability',
      actorId: monster.combatantId,
      targetId: bestAbility.targetType === 'all_enemies' ? null : target.combatantId,
      targetIds: [],
      abilityId: bestAbility.abilityId,
      itemId: null,
    }
  }

  // Default to basic attack
  const target = aliveEnemies[randomInt(0, aliveEnemies.length - 1)]
  return {
    type: 'attack',
    actorId: monster.combatantId,
    targetId: target.combatantId,
    targetIds: [],
    abilityId: null,
    itemId: null,
  }
}

function selectBestTarget(
  enemies: ReadonlyArray<BattleCombatant>,
  abilityElement: string,
): BattleCombatant {
  // Prefer low HP targets
  const sorted = [...enemies].sort(
    (a, b) => a.stats.currentHp - b.stats.currentHp
  )

  // If one is low enough to likely KO, target them
  const lowHpTarget = sorted.find((e) => e.stats.currentHp / e.stats.maxHp < 0.3)
  if (lowHpTarget) {
    return lowHpTarget
  }

  // Otherwise pick randomly
  return enemies[randomInt(0, enemies.length - 1)]
}

function createDefendAction(monster: BattleCombatant): BattleAction {
  return {
    type: 'defend',
    actorId: monster.combatantId,
    targetId: null,
    targetIds: [],
    abilityId: null,
    itemId: null,
  }
}
