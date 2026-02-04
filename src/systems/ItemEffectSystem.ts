import type {
  Item,
  BattleCombatant,
  PlayerCharacter,
  CharacterStats,
  ActiveStatusEffect,
} from '../models/types'

// ── Result Types ──

export interface ItemUseResult {
  readonly success: boolean
  readonly message: string
  readonly healAmount?: number
  readonly statusCured?: string
  readonly buffApplied?: string
}

export interface CombatantItemResult {
  readonly combatant: BattleCombatant
  readonly result: ItemUseResult
}

export interface PlayerItemResult {
  readonly player: PlayerCharacter
  readonly result: ItemUseResult
}

// ── Battle Usage (on BattleCombatant) ──

export function useItemOnCombatant(item: Item, target: BattleCombatant): CombatantItemResult {
  if (!item.useEffect) {
    return {
      combatant: target,
      result: { success: false, message: `${item.name} has no effect.` },
    }
  }

  switch (item.useEffect.type) {
    case 'heal_hp':
      return applyHealHpCombatant(item, target)
    case 'heal_mp':
      return applyHealMpCombatant(item, target)
    case 'cure_status':
      return applyCureStatusCombatant(item, target)
    case 'buff':
      return applyBuffCombatant(item, target)
    default:
      return {
        combatant: target,
        result: { success: false, message: `${item.name} cannot be used in battle.` },
      }
  }
}

function applyHealHpCombatant(item: Item, target: BattleCombatant): CombatantItemResult {
  const magnitude = item.useEffect!.magnitude
  const newHp = Math.min(target.stats.currentHp + magnitude, target.stats.maxHp)
  const actualHeal = newHp - target.stats.currentHp

  const updatedStats: CharacterStats = { ...target.stats, currentHp: newHp }
  const updatedCombatant: BattleCombatant = { ...target, stats: updatedStats }

  return {
    combatant: updatedCombatant,
    result: {
      success: true,
      message: `${target.name} recovered ${actualHeal} HP!`,
      healAmount: actualHeal,
    },
  }
}

function applyHealMpCombatant(item: Item, target: BattleCombatant): CombatantItemResult {
  const magnitude = item.useEffect!.magnitude
  const newMp = Math.min(target.stats.currentMp + magnitude, target.stats.maxMp)
  const actualHeal = newMp - target.stats.currentMp

  const updatedStats: CharacterStats = { ...target.stats, currentMp: newMp }
  const updatedCombatant: BattleCombatant = { ...target, stats: updatedStats }

  return {
    combatant: updatedCombatant,
    result: {
      success: true,
      message: `${target.name} recovered ${actualHeal} MP!`,
      healAmount: actualHeal,
    },
  }
}

function applyCureStatusCombatant(item: Item, target: BattleCombatant): CombatantItemResult {
  if (target.statusEffects.length === 0) {
    return {
      combatant: target,
      result: { success: false, message: `${target.name} has no status effects to cure.` },
    }
  }

  const magnitude = item.useEffect!.magnitude
  let clearedEffects: ReadonlyArray<ActiveStatusEffect>
  let curedName: string

  if (magnitude >= 99) {
    // Cure all
    curedName = 'all status effects'
    clearedEffects = []
  } else if (magnitude === 0) {
    // Cure poison specifically
    curedName = 'Poison'
    clearedEffects = target.statusEffects.filter((se) => se.effect.type !== 'poison')
  } else if (magnitude === 1) {
    // Cure sleep specifically
    curedName = 'Sleep'
    clearedEffects = target.statusEffects.filter((se) => se.effect.type !== 'sleep')
  } else {
    curedName = 'status effects'
    clearedEffects = []
  }

  const updatedCombatant: BattleCombatant = {
    ...target,
    statusEffects: clearedEffects,
  }

  return {
    combatant: updatedCombatant,
    result: {
      success: true,
      message: `${target.name} was cured of ${curedName}!`,
      statusCured: curedName,
    },
  }
}

function applyBuffCombatant(item: Item, target: BattleCombatant): CombatantItemResult {
  const magnitude = item.useEffect!.magnitude

  // Determine buff type from item name
  let buffType: 'attack_up' | 'defense_up' | 'haste' = 'attack_up'
  let buffName = 'Attack Up'

  if (item.itemId.includes('shield') || item.itemId.includes('defense')) {
    buffType = 'defense_up'
    buffName = 'Defense Up'
  } else if (item.itemId.includes('speed') || item.itemId.includes('haste')) {
    buffType = 'haste'
    buffName = 'Haste'
  }

  const newEffect: ActiveStatusEffect = {
    effect: {
      id: buffType,
      name: buffName,
      type: buffType,
      duration: 5,
      magnitude,
    },
    turnsRemaining: 5,
    appliedBy: target.combatantId,
  }

  const updatedCombatant: BattleCombatant = {
    ...target,
    statusEffects: [...target.statusEffects, newEffect],
  }

  return {
    combatant: updatedCombatant,
    result: {
      success: true,
      message: `${target.name} gained ${buffName}!`,
      buffApplied: buffName,
    },
  }
}

// ── Overworld Usage (on PlayerCharacter) ──

export function useItemOnPlayer(item: Item, player: PlayerCharacter): PlayerItemResult {
  if (!item.useEffect) {
    return {
      player,
      result: { success: false, message: `${item.name} has no effect.` },
    }
  }

  switch (item.useEffect.type) {
    case 'heal_hp':
      return applyHealHpPlayer(item, player)
    case 'heal_mp':
      return applyHealMpPlayer(item, player)
    default:
      return {
        player,
        result: { success: false, message: `${item.name} cannot be used here.` },
      }
  }
}

function applyHealHpPlayer(item: Item, player: PlayerCharacter): PlayerItemResult {
  const magnitude = item.useEffect!.magnitude
  const newHp = Math.min(player.stats.currentHp + magnitude, player.stats.maxHp)
  const actualHeal = newHp - player.stats.currentHp

  const updatedPlayer: PlayerCharacter = {
    ...player,
    stats: { ...player.stats, currentHp: newHp },
  }

  return {
    player: updatedPlayer,
    result: {
      success: true,
      message: `${player.name} recovered ${actualHeal} HP!`,
      healAmount: actualHeal,
    },
  }
}

function applyHealMpPlayer(item: Item, player: PlayerCharacter): PlayerItemResult {
  const magnitude = item.useEffect!.magnitude
  const newMp = Math.min(player.stats.currentMp + magnitude, player.stats.maxMp)
  const actualHeal = newMp - player.stats.currentMp

  const updatedPlayer: PlayerCharacter = {
    ...player,
    stats: { ...player.stats, currentMp: newMp },
  }

  return {
    player: updatedPlayer,
    result: {
      success: true,
      message: `${player.name} recovered ${actualHeal} MP!`,
      healAmount: actualHeal,
    },
  }
}
