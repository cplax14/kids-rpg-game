import type {
  Battle,
  BattleState,
  BattleCombatant,
  BattleAction,
  BattleRewards,
  ActiveStatusEffect,
  Ability,
  CharacterStats,
  ItemDrop,
  MonsterElement,
} from '../models/types'
import {
  calculateDamage,
  calculateFleeChance,
  randomChance,
  randomInt,
  clamp,
  getElementMultiplier,
} from '../utils/math'
import {
  POISON_DAMAGE_PERCENT,
  REGEN_HEAL_PERCENT,
  SLOW_SPEED_MULTIPLIER,
  HASTE_SPEED_MULTIPLIER,
  SHIELD_DEFENSE_MULTIPLIER,
  ATTACK_UP_MULTIPLIER,
  DEFENSE_UP_MULTIPLIER,
} from '../models/constants'
import { generateId } from '../utils/id'

// ── Battle Creation ──

export function createBattle(
  playerCombatants: ReadonlyArray<BattleCombatant>,
  enemyCombatants: ReadonlyArray<BattleCombatant>,
  backgroundKey: string = 'battle-bg-forest',
): Battle {
  const allCombatants = [...playerCombatants, ...enemyCombatants]
  const turnOrder = calculateTurnOrder(allCombatants)

  return {
    state: 'start',
    turnOrder,
    currentTurnIndex: 0,
    playerSquad: playerCombatants,
    enemySquad: enemyCombatants,
    turnCount: 1,
    canFlee: true,
    backgroundKey,
    rewards: null,
  }
}

// ── Turn Order ──

export function calculateTurnOrder(
  combatants: ReadonlyArray<BattleCombatant>,
): ReadonlyArray<BattleCombatant> {
  return [...combatants]
    .filter((c) => c.stats.currentHp > 0)
    .sort((a, b) => {
      const speedA = getEffectiveSpeed(a)
      const speedB = getEffectiveSpeed(b)
      if (speedB !== speedA) return speedB - speedA
      // Tiebreak with small randomness
      return Math.random() - 0.5
    })
}

function getEffectiveSpeed(combatant: BattleCombatant): number {
  let speed = combatant.stats.speed
  for (const se of combatant.statusEffects) {
    if (se.effect.type === 'slow') speed = Math.floor(speed * SLOW_SPEED_MULTIPLIER)
    if (se.effect.type === 'haste') speed = Math.floor(speed * HASTE_SPEED_MULTIPLIER)
  }
  return speed
}

// ── Battle State Transitions ──

export function advanceTurn(battle: Battle): Battle {
  const nextIndex = (battle.currentTurnIndex + 1) % battle.turnOrder.length
  const isNewRound = nextIndex === 0

  return {
    ...battle,
    currentTurnIndex: nextIndex,
    turnCount: isNewRound ? battle.turnCount + 1 : battle.turnCount,
    state: determineNextState(battle),
  }
}

export function getCurrentCombatant(battle: Battle): BattleCombatant | undefined {
  return battle.turnOrder[battle.currentTurnIndex]
}

function determineNextState(battle: Battle): BattleState {
  const allEnemiesDead = battle.enemySquad.every((e) => e.stats.currentHp <= 0)
  const allAlliesDead = battle.playerSquad.every((p) => p.stats.currentHp <= 0)

  if (allEnemiesDead) return 'victory'
  if (allAlliesDead) return 'defeat'

  const next = battle.turnOrder[(battle.currentTurnIndex + 1) % battle.turnOrder.length]
  if (!next || next.stats.currentHp <= 0) return 'animating'
  return next.isPlayer ? 'player_turn' : 'enemy_turn'
}

// ── Action Execution ──

export interface ActionResult {
  readonly battle: Battle
  readonly damage: number
  readonly isCritical: boolean
  readonly isEffective: 'super' | 'weak' | 'normal'
  readonly statusApplied: string | null
  readonly message: string
}

export function executeAction(battle: Battle, action: BattleAction): ActionResult {
  switch (action.type) {
    case 'attack':
      return executeBasicAttack(battle, action)
    case 'ability':
      return executeAbilityAction(battle, action)
    case 'defend':
      return executeDefend(battle, action)
    case 'flee':
      return executeFlee(battle, action)
    case 'capture':
      return executeCaptureAction(battle, action)
    case 'item':
      return executeItemAction(battle, action)
    default:
      return {
        battle,
        damage: 0,
        isCritical: false,
        isEffective: 'normal',
        statusApplied: null,
        message: 'Nothing happened.',
      }
  }
}

function executeCaptureAction(battle: Battle, action: BattleAction): ActionResult {
  // Capture logic is handled in BattleScene as it requires external systems
  // This just transitions to capture_attempt state
  return {
    battle: { ...battle, state: 'capture_attempt' },
    damage: 0,
    isCritical: false,
    isEffective: 'normal',
    statusApplied: null,
    message: 'Attempting to capture...',
  }
}

function executeItemAction(battle: Battle, action: BattleAction): ActionResult {
  // Item logic is handled in BattleScene as it requires inventory system
  return {
    battle,
    damage: 0,
    isCritical: false,
    isEffective: 'normal',
    statusApplied: null,
    message: 'Used item.',
  }
}

function executeBasicAttack(battle: Battle, action: BattleAction): ActionResult {
  const attacker = findCombatant(battle, action.actorId)
  const target = findCombatant(battle, action.targetId ?? '')

  if (!attacker || !target) {
    return createEmptyResult(battle, 'Invalid target.')
  }

  const attackStat = getEffectiveAttack(attacker)
  const defenseStat = getEffectiveDefense(target)

  const { damage, isCritical } = calculateDamage(
    attackStat,
    40, // base attack power
    defenseStat,
    'neutral',
    'neutral',
    attacker.stats.luck,
  )

  const updatedBattle = applyCombatantDamage(battle, target.combatantId, damage)

  return {
    battle: updatedBattle,
    damage,
    isCritical,
    isEffective: 'normal',
    statusApplied: null,
    message: `${attacker.name} attacks ${target.name} for ${damage} damage!${isCritical ? ' Critical hit!' : ''}`,
  }
}

function executeAbilityAction(battle: Battle, action: BattleAction): ActionResult {
  const attacker = findCombatant(battle, action.actorId)
  if (!attacker || !action.abilityId) {
    return createEmptyResult(battle, 'Invalid ability.')
  }

  const ability = attacker.abilities.find((a) => a.abilityId === action.abilityId)
  if (!ability) {
    return createEmptyResult(battle, 'Unknown ability.')
  }

  // Check MP
  if (attacker.stats.currentMp < ability.mpCost) {
    return createEmptyResult(battle, `${attacker.name} doesn't have enough MP!`)
  }

  // Deduct MP
  let updatedBattle = updateCombatantStats(battle, attacker.combatantId, {
    ...attacker.stats,
    currentMp: attacker.stats.currentMp - ability.mpCost,
  })

  // Check accuracy
  if (!randomChance(ability.accuracy / 100)) {
    return {
      battle: updatedBattle,
      damage: 0,
      isCritical: false,
      isEffective: 'normal',
      statusApplied: null,
      message: `${attacker.name} used ${ability.name} but it missed!`,
    }
  }

  // Handle by ability type
  if (ability.type === 'healing') {
    return executeHealingAbility(updatedBattle, attacker, ability, action)
  }

  if (ability.type === 'status' && ability.power === 0) {
    return executeStatusAbility(updatedBattle, attacker, ability, action)
  }

  // Damage abilities
  return executeDamageAbility(updatedBattle, attacker, ability, action)
}

function executeDamageAbility(
  battle: Battle,
  attacker: BattleCombatant,
  ability: Ability,
  action: BattleAction,
): ActionResult {
  const isPhysical = ability.type === 'physical'
  const attackStat = isPhysical ? getEffectiveAttack(attacker) : getEffectiveMagicAttack(attacker)
  const attackerElement = ability.element

  if (ability.targetType === 'all_enemies') {
    return executeAoeAbility(battle, attacker, ability, attackStat, attackerElement)
  }

  const target = findCombatant(battle, action.targetId ?? '')
  if (!target) return createEmptyResult(battle, 'Invalid target.')

  const defenseStat = isPhysical
    ? getEffectiveDefense(target)
    : getEffectiveMagicDefense(target)

  // Determine defender element from their abilities (first elemental ability)
  const defenderElement = guessElement(target)

  const { damage, isCritical } = calculateDamage(
    attackStat,
    ability.power,
    defenseStat,
    attackerElement,
    defenderElement,
    attacker.stats.luck,
  )

  const multiplier = getElementMultiplier(attackerElement, defenderElement)
  const effectiveness: 'super' | 'weak' | 'normal' =
    multiplier > 1.5 ? 'super' : multiplier < 0.75 ? 'weak' : 'normal'

  let updatedBattle = applyCombatantDamage(battle, target.combatantId, damage)

  // Apply status effect if ability has one
  let statusApplied: string | null = null
  if (ability.statusEffect && randomChance(0.5)) {
    updatedBattle = applyStatusEffect(updatedBattle, target.combatantId, {
      effect: ability.statusEffect,
      turnsRemaining: ability.statusEffect.duration,
      appliedBy: attacker.combatantId,
    })
    statusApplied = ability.statusEffect.name
  }

  const effectMsg =
    effectiveness === 'super'
      ? " It's super effective!"
      : effectiveness === 'weak'
        ? " It's not very effective..."
        : ''

  return {
    battle: updatedBattle,
    damage,
    isCritical,
    isEffective: effectiveness,
    statusApplied,
    message: `${attacker.name} used ${ability.name}! ${damage} damage!${isCritical ? ' Critical hit!' : ''}${effectMsg}`,
  }
}

function executeAoeAbility(
  battle: Battle,
  attacker: BattleCombatant,
  ability: Ability,
  attackStat: number,
  attackerElement: MonsterElement,
): ActionResult {
  const targets = attacker.isPlayer ? battle.enemySquad : battle.playerSquad
  let updatedBattle = battle
  let totalDamage = 0
  let anyCritical = false
  const isPhysical = ability.type === 'physical'

  for (const target of targets) {
    if (target.stats.currentHp <= 0) continue

    const defenseStat = isPhysical
      ? getEffectiveDefense(target)
      : getEffectiveMagicDefense(target)
    const defenderElement = guessElement(target)

    const { damage, isCritical } = calculateDamage(
      attackStat,
      ability.power,
      defenseStat,
      attackerElement,
      defenderElement,
      attacker.stats.luck,
    )

    updatedBattle = applyCombatantDamage(updatedBattle, target.combatantId, damage)
    totalDamage += damage
    if (isCritical) anyCritical = true
  }

  return {
    battle: updatedBattle,
    damage: totalDamage,
    isCritical: anyCritical,
    isEffective: 'normal',
    statusApplied: null,
    message: `${attacker.name} used ${ability.name}! ${totalDamage} total damage to all enemies!`,
  }
}

function executeHealingAbility(
  battle: Battle,
  attacker: BattleCombatant,
  ability: Ability,
  action: BattleAction,
): ActionResult {
  if (ability.targetType === 'all_allies') {
    const allies = attacker.isPlayer ? battle.playerSquad : battle.enemySquad
    let updatedBattle = battle
    let totalHealed = 0

    for (const ally of allies) {
      if (ally.stats.currentHp <= 0) continue
      const healAmount = ability.power
      const newHp = Math.min(ally.stats.currentHp + healAmount, ally.stats.maxHp)
      const actualHeal = newHp - ally.stats.currentHp
      updatedBattle = updateCombatantStats(updatedBattle, ally.combatantId, {
        ...ally.stats,
        currentHp: newHp,
      })
      totalHealed += actualHeal
    }

    return {
      battle: updatedBattle,
      damage: 0,
      isCritical: false,
      isEffective: 'normal',
      statusApplied: null,
      message: `${attacker.name} used ${ability.name}! Healed all allies for ${totalHealed} HP!`,
    }
  }

  // Single target heal
  const targetId = action.targetId ?? attacker.combatantId
  const target = findCombatant(battle, targetId)
  if (!target) return createEmptyResult(battle, 'Invalid target.')

  const healAmount = ability.power
  const newHp = Math.min(target.stats.currentHp + healAmount, target.stats.maxHp)
  const actualHeal = newHp - target.stats.currentHp
  const updatedBattle = updateCombatantStats(battle, target.combatantId, {
    ...target.stats,
    currentHp: newHp,
  })

  return {
    battle: updatedBattle,
    damage: 0,
    isCritical: false,
    isEffective: 'normal',
    statusApplied: null,
    message: `${attacker.name} used ${ability.name}! ${target.name} recovered ${actualHeal} HP!`,
  }
}

function executeStatusAbility(
  battle: Battle,
  attacker: BattleCombatant,
  ability: Ability,
  action: BattleAction,
): ActionResult {
  if (!ability.statusEffect) return createEmptyResult(battle, 'No effect.')

  const targetId =
    ability.targetType === 'self' ? attacker.combatantId : (action.targetId ?? '')
  const target = findCombatant(battle, targetId)
  if (!target) return createEmptyResult(battle, 'Invalid target.')

  // Check if already has this status
  const alreadyHas = target.statusEffects.some(
    (se) => se.effect.type === ability.statusEffect!.type,
  )
  if (alreadyHas) {
    return {
      battle,
      damage: 0,
      isCritical: false,
      isEffective: 'normal',
      statusApplied: null,
      message: `${target.name} already has ${ability.statusEffect.name}!`,
    }
  }

  const updatedBattle = applyStatusEffect(battle, target.combatantId, {
    effect: ability.statusEffect,
    turnsRemaining: ability.statusEffect.duration,
    appliedBy: attacker.combatantId,
  })

  return {
    battle: updatedBattle,
    damage: 0,
    isCritical: false,
    isEffective: 'normal',
    statusApplied: ability.statusEffect.name,
    message: `${attacker.name} used ${ability.name}! ${target.name} is now ${ability.statusEffect.name}!`,
  }
}

function executeDefend(battle: Battle, action: BattleAction): ActionResult {
  const actor = findCombatant(battle, action.actorId)
  if (!actor) return createEmptyResult(battle, 'Invalid actor.')

  const updatedBattle = applyStatusEffect(battle, actor.combatantId, {
    effect: {
      id: 'defending',
      name: 'Defending',
      type: 'shield',
      duration: 1,
      magnitude: 0.5,
    },
    turnsRemaining: 1,
    appliedBy: actor.combatantId,
  })

  return {
    battle: updatedBattle,
    damage: 0,
    isCritical: false,
    isEffective: 'normal',
    statusApplied: 'Defending',
    message: `${actor.name} is defending!`,
  }
}

function executeFlee(battle: Battle, action: BattleAction): ActionResult {
  if (!battle.canFlee) {
    return createEmptyResult(battle, "Can't flee from this battle!")
  }

  const actor = findCombatant(battle, action.actorId)
  if (!actor) return createEmptyResult(battle, 'Invalid actor.')

  const avgEnemySpeed =
    battle.enemySquad.reduce((sum, e) => sum + e.stats.speed, 0) / battle.enemySquad.length
  const fleeChance = calculateFleeChance(actor.stats.speed, avgEnemySpeed)

  if (randomChance(fleeChance)) {
    return {
      battle: { ...battle, state: 'fled' },
      damage: 0,
      isCritical: false,
      isEffective: 'normal',
      statusApplied: null,
      message: 'Got away safely!',
    }
  }

  return {
    battle,
    damage: 0,
    isCritical: false,
    isEffective: 'normal',
    statusApplied: null,
    message: "Couldn't escape!",
  }
}

// ── Status Effect Processing ──

export function processStatusEffects(battle: Battle, combatantId: string): Battle {
  const combatant = findCombatant(battle, combatantId)
  if (!combatant) return battle

  let updatedBattle = battle

  for (const se of combatant.statusEffects) {
    switch (se.effect.type) {
      case 'poison': {
        const poisonDmg = Math.max(1, Math.floor(combatant.stats.maxHp * POISON_DAMAGE_PERCENT))
        updatedBattle = applyCombatantDamage(updatedBattle, combatantId, poisonDmg)
        break
      }
      case 'regen': {
        const regenHeal = Math.max(1, Math.floor(combatant.stats.maxHp * REGEN_HEAL_PERCENT))
        const current = findCombatant(updatedBattle, combatantId)
        if (current) {
          const newHp = Math.min(current.stats.currentHp + regenHeal, current.stats.maxHp)
          updatedBattle = updateCombatantStats(updatedBattle, combatantId, {
            ...current.stats,
            currentHp: newHp,
          })
        }
        break
      }
    }
  }

  // Decrement turn counters and remove expired effects
  updatedBattle = tickStatusEffects(updatedBattle, combatantId)

  return updatedBattle
}

function tickStatusEffects(battle: Battle, combatantId: string): Battle {
  const updateEffects = (combatant: BattleCombatant): BattleCombatant => {
    if (combatant.combatantId !== combatantId) return combatant
    return {
      ...combatant,
      statusEffects: combatant.statusEffects
        .map((se) => ({ ...se, turnsRemaining: se.turnsRemaining - 1 }))
        .filter((se) => se.turnsRemaining > 0),
    }
  }

  return {
    ...battle,
    playerSquad: battle.playerSquad.map(updateEffects),
    enemySquad: battle.enemySquad.map(updateEffects),
    turnOrder: battle.turnOrder.map(updateEffects),
  }
}

export function isSleeping(combatant: BattleCombatant): boolean {
  return combatant.statusEffects.some((se) => se.effect.type === 'sleep')
}

// ── Enemy AI ──

export function getEnemyAction(battle: Battle, enemy: BattleCombatant): BattleAction {
  const aliveTargets = battle.playerSquad.filter((p) => p.stats.currentHp > 0)
  if (aliveTargets.length === 0) {
    return { type: 'defend', actorId: enemy.combatantId, targetId: null, abilityId: null, itemId: null }
  }

  // If HP is low and has healing, heal
  const hpPercent = enemy.stats.currentHp / enemy.stats.maxHp
  if (hpPercent < 0.3) {
    const healAbility = enemy.abilities.find((a) => a.type === 'healing' && enemy.stats.currentMp >= a.mpCost)
    if (healAbility) {
      return {
        type: 'ability',
        actorId: enemy.combatantId,
        targetId: enemy.combatantId,
        abilityId: healAbility.abilityId,
        itemId: null,
      }
    }
  }

  // Try to use a damaging ability if MP available
  const usableAbilities = enemy.abilities.filter(
    (a) =>
      (a.type === 'physical' || a.type === 'magical') &&
      a.power > 0 &&
      enemy.stats.currentMp >= a.mpCost,
  )

  if (usableAbilities.length > 0 && randomChance(0.6)) {
    // Pick the best ability - prefer super effective against a random target
    const target = aliveTargets[randomInt(0, aliveTargets.length - 1)]
    const targetElement = guessElement(target)

    const scored = usableAbilities.map((a) => ({
      ability: a,
      score: a.power * getElementMultiplier(a.element, targetElement),
    }))
    scored.sort((a, b) => b.score - a.score)

    const chosen = scored[0].ability
    return {
      type: 'ability',
      actorId: enemy.combatantId,
      targetId: chosen.targetType === 'all_enemies' ? null : target.combatantId,
      abilityId: chosen.abilityId,
      itemId: null,
    }
  }

  // Basic attack
  const target = aliveTargets[randomInt(0, aliveTargets.length - 1)]
  return {
    type: 'attack',
    actorId: enemy.combatantId,
    targetId: target.combatantId,
    abilityId: null,
    itemId: null,
  }
}

// ── Battle Resolution ──

export function calculateBattleRewards(battle: Battle): BattleRewards {
  const baseXpPerEnemy = 25
  const baseGoldPerEnemy = 15

  const totalXp = battle.enemySquad.reduce((sum, enemy) => {
    // More XP for tougher enemies
    const statTotal = enemy.stats.maxHp + enemy.stats.attack + enemy.stats.defense
    return sum + baseXpPerEnemy + Math.floor(statTotal / 10)
  }, 0)

  const totalGold = battle.enemySquad.reduce((sum, enemy) => {
    return sum + baseGoldPerEnemy + randomInt(0, 10)
  }, 0)

  return {
    experience: totalXp,
    gold: totalGold,
    items: [],
    capturedMonster: null,
  }
}

export function checkBattleEnd(battle: Battle): BattleState {
  const allEnemiesDead = battle.enemySquad.every((e) => e.stats.currentHp <= 0)
  if (allEnemiesDead) return 'victory'

  const allPlayersDead = battle.playerSquad.every((p) => p.stats.currentHp <= 0)
  if (allPlayersDead) return 'defeat'

  return battle.state
}

// ── Combatant Helpers ──

export function createCombatantFromPlayer(
  name: string,
  stats: CharacterStats,
  abilities: ReadonlyArray<Ability>,
  speciesId?: string,
): BattleCombatant {
  return {
    combatantId: `player-${generateId()}`,
    name,
    isPlayer: true,
    isMonster: !!speciesId,
    speciesId,
    stats: { ...stats },
    abilities,
    statusEffects: [],
    capturable: false,
  }
}

export function createCombatantFromEnemy(
  name: string,
  stats: CharacterStats,
  element: MonsterElement,
  abilities: ReadonlyArray<Ability>,
  capturable: boolean = true,
  speciesId?: string,
): BattleCombatant {
  return {
    combatantId: `enemy-${generateId()}`,
    name,
    isPlayer: false,
    isMonster: true,
    speciesId,
    stats: { ...stats },
    abilities,
    statusEffects: [],
    capturable,
  }
}

// ── Internal Helpers ──

function findCombatant(battle: Battle, combatantId: string): BattleCombatant | undefined {
  return (
    battle.playerSquad.find((c) => c.combatantId === combatantId) ??
    battle.enemySquad.find((c) => c.combatantId === combatantId)
  )
}

function applyCombatantDamage(battle: Battle, combatantId: string, damage: number): Battle {
  const update = (c: BattleCombatant): BattleCombatant => {
    if (c.combatantId !== combatantId) return c
    return {
      ...c,
      stats: {
        ...c.stats,
        currentHp: Math.max(0, c.stats.currentHp - damage),
      },
    }
  }

  return {
    ...battle,
    playerSquad: battle.playerSquad.map(update),
    enemySquad: battle.enemySquad.map(update),
    turnOrder: battle.turnOrder.map(update),
  }
}

function updateCombatantStats(
  battle: Battle,
  combatantId: string,
  newStats: CharacterStats,
): Battle {
  const update = (c: BattleCombatant): BattleCombatant => {
    if (c.combatantId !== combatantId) return c
    return { ...c, stats: newStats }
  }

  return {
    ...battle,
    playerSquad: battle.playerSquad.map(update),
    enemySquad: battle.enemySquad.map(update),
    turnOrder: battle.turnOrder.map(update),
  }
}

function applyStatusEffect(
  battle: Battle,
  combatantId: string,
  effect: ActiveStatusEffect,
): Battle {
  const update = (c: BattleCombatant): BattleCombatant => {
    if (c.combatantId !== combatantId) return c
    return {
      ...c,
      statusEffects: [...c.statusEffects, effect],
    }
  }

  return {
    ...battle,
    playerSquad: battle.playerSquad.map(update),
    enemySquad: battle.enemySquad.map(update),
    turnOrder: battle.turnOrder.map(update),
  }
}

function getEffectiveAttack(combatant: BattleCombatant): number {
  let attack = combatant.stats.attack
  for (const se of combatant.statusEffects) {
    if (se.effect.type === 'attack_up') attack = Math.floor(attack * ATTACK_UP_MULTIPLIER)
  }
  return attack
}

function getEffectiveMagicAttack(combatant: BattleCombatant): number {
  return combatant.stats.magicAttack
}

function getEffectiveDefense(combatant: BattleCombatant): number {
  let defense = combatant.stats.defense
  for (const se of combatant.statusEffects) {
    if (se.effect.type === 'shield') defense = Math.floor(defense * SHIELD_DEFENSE_MULTIPLIER)
    if (se.effect.type === 'defense_up') defense = Math.floor(defense * DEFENSE_UP_MULTIPLIER)
  }
  return defense
}

function getEffectiveMagicDefense(combatant: BattleCombatant): number {
  return combatant.stats.magicDefense
}

function guessElement(combatant: BattleCombatant): MonsterElement {
  // Determine element from first non-neutral elemental ability
  for (const ability of combatant.abilities) {
    if (ability.element !== 'neutral') return ability.element
  }
  return 'neutral'
}

function createEmptyResult(battle: Battle, message: string): ActionResult {
  return {
    battle,
    damage: 0,
    isCritical: false,
    isEffective: 'normal',
    statusApplied: null,
    message,
  }
}
