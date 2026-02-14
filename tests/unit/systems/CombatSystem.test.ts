import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createBattle,
  calculateTurnOrder,
  executeAction,
  processStatusEffects,
  isSleeping,
  getEnemyAction,
  calculateBattleRewards,
  checkBattleEnd,
  createCombatantFromPlayer,
  createCombatantFromEnemy,
  getCurrentCombatant,
  advanceTurn,
  incrementBattleSpirit,
  getBattleSpiritDamageMultiplier,
  getBattleSpiritAccuracyBonus,
  isAbilityOnCooldown,
  getAbilityCooldown,
  startAbilityCooldown,
  tickCooldowns,
  getUsableAbilities,
  tickCombatantCooldowns,
  type ActionResult,
} from '../../../src/systems/CombatSystem'
import { BATTLE_SPIRIT_MAX, BATTLE_SPIRIT_DAMAGE_BONUS, BATTLE_SPIRIT_ACCURACY_BONUS } from '../../../src/models/constants'
import type { Battle, BattleCombatant, BattleAction, Ability, CharacterStats } from '../../../src/models/types'

function makeStats(overrides?: Partial<CharacterStats>): CharacterStats {
  return {
    maxHp: 100,
    currentHp: 100,
    maxMp: 50,
    currentMp: 50,
    attack: 20,
    defense: 15,
    magicAttack: 18,
    magicDefense: 12,
    speed: 14,
    luck: 5,
    ...overrides,
  }
}

const tackleAbility: Ability = {
  abilityId: 'tackle',
  name: 'Tackle',
  description: 'A basic tackle',
  element: 'neutral',
  type: 'physical',
  power: 40,
  accuracy: 100,
  mpCost: 0,
  targetType: 'single_enemy',
  statusEffect: null,
  animation: 'tackle',
  cooldownTurns: 0,
}

const healAbility: Ability = {
  abilityId: 'heal',
  name: 'Heal',
  description: 'Heals an ally',
  element: 'light',
  type: 'healing',
  power: 30,
  accuracy: 100,
  mpCost: 8,
  targetType: 'self',
  statusEffect: null,
  animation: 'glow',
  cooldownTurns: 1,
}

const fireAbility: Ability = {
  abilityId: 'ember',
  name: 'Ember',
  description: 'A fire attack',
  element: 'fire',
  type: 'magical',
  power: 45,
  accuracy: 100,
  mpCost: 6,
  targetType: 'single_enemy',
  statusEffect: null,
  animation: 'fire',
  cooldownTurns: 0,
}

const poisonAbility: Ability = {
  abilityId: 'poison-sting',
  name: 'Poison Sting',
  description: 'Poisons the target',
  element: 'neutral',
  type: 'status',
  power: 0,
  accuracy: 100,
  mpCost: 5,
  targetType: 'single_enemy',
  statusEffect: {
    id: 'poison',
    name: 'Poison',
    type: 'poison',
    duration: 3,
    magnitude: 0.1,
  },
  animation: 'poison',
  cooldownTurns: 1,
}

const aoeAbility: Ability = {
  abilityId: 'quake',
  name: 'Quake',
  description: 'Hits all enemies',
  element: 'earth',
  type: 'physical',
  power: 35,
  accuracy: 100,
  mpCost: 10,
  targetType: 'all_enemies',
  statusEffect: null,
  animation: 'quake',
  cooldownTurns: 3,
}

// Ability with cooldown for testing cooldown system
const fireballAbility: Ability = {
  abilityId: 'fireball',
  name: 'Fireball',
  description: 'A powerful fire attack',
  element: 'fire',
  type: 'magical',
  power: 70,
  accuracy: 100,
  mpCost: 8,
  targetType: 'single_enemy',
  statusEffect: null,
  animation: 'fireball',
  cooldownTurns: 2,
}

function makePlayer(overrides?: Partial<BattleCombatant>): BattleCombatant {
  return createCombatantFromPlayer('TestPlayer', makeStats(), [tackleAbility, healAbility])
}

function makeEnemy(overrides?: Partial<BattleCombatant>): BattleCombatant {
  return createCombatantFromEnemy('TestEnemy', makeStats(), 'fire', [tackleAbility, fireAbility])
}

function makeBattle(overrides?: Partial<{ playerStats: Partial<CharacterStats>; enemyStats: Partial<CharacterStats> }>): Battle {
  const player = createCombatantFromPlayer(
    'Hero',
    makeStats(overrides?.playerStats),
    [tackleAbility, healAbility],
  )
  const enemy = createCombatantFromEnemy(
    'Slime',
    makeStats(overrides?.enemyStats),
    'neutral',
    [tackleAbility],
  )
  return createBattle([player], [enemy])
}

describe('createCombatantFromPlayer', () => {
  it('creates a player combatant', () => {
    const combatant = makePlayer()
    expect(combatant.isPlayer).toBe(true)
    expect(combatant.isMonster).toBe(false)
    expect(combatant.capturable).toBe(false)
    expect(combatant.statusEffects).toEqual([])
  })

  it('has unique combatant ID with player prefix', () => {
    const a = makePlayer()
    const b = makePlayer()
    expect(a.combatantId).toMatch(/^player-/)
    expect(a.combatantId).not.toBe(b.combatantId)
  })
})

describe('createCombatantFromEnemy', () => {
  it('creates an enemy combatant', () => {
    const combatant = makeEnemy()
    expect(combatant.isPlayer).toBe(false)
    expect(combatant.isMonster).toBe(true)
    expect(combatant.capturable).toBe(true)
  })

  it('has unique combatant ID with enemy prefix', () => {
    const a = makeEnemy()
    const b = makeEnemy()
    expect(a.combatantId).toMatch(/^enemy-/)
    expect(a.combatantId).not.toBe(b.combatantId)
  })
})

describe('createBattle', () => {
  it('creates a battle with correct initial state', () => {
    const battle = makeBattle()
    expect(battle.state).toBe('start')
    expect(battle.turnCount).toBe(1)
    expect(battle.canFlee).toBe(true)
    expect(battle.rewards).toBeNull()
  })

  it('has player and enemy squads', () => {
    const battle = makeBattle()
    expect(battle.playerSquad).toHaveLength(1)
    expect(battle.enemySquad).toHaveLength(1)
  })

  it('calculates initial turn order', () => {
    const battle = makeBattle()
    expect(battle.turnOrder.length).toBeGreaterThan(0)
  })
})

describe('calculateTurnOrder', () => {
  it('sorts combatants by speed (highest first)', () => {
    const fast = createCombatantFromPlayer('Fast', makeStats({ speed: 30 }), [tackleAbility])
    const slow = createCombatantFromEnemy('Slow', makeStats({ speed: 5 }), 'neutral', [tackleAbility])
    const order = calculateTurnOrder([slow, fast])
    expect(order[0].name).toBe('Fast')
    expect(order[1].name).toBe('Slow')
  })

  it('excludes dead combatants', () => {
    const alive = createCombatantFromPlayer('Alive', makeStats(), [tackleAbility])
    const dead = createCombatantFromEnemy('Dead', makeStats({ currentHp: 0 }), 'neutral', [tackleAbility])
    const order = calculateTurnOrder([alive, dead])
    expect(order).toHaveLength(1)
    expect(order[0].name).toBe('Alive')
  })
})

describe('executeAction - basic attack', () => {
  it('deals damage to target', () => {
    const battle = makeBattle()
    const attacker = battle.playerSquad[0]
    const target = battle.enemySquad[0]

    const action: BattleAction = {
      type: 'attack',
      actorId: attacker.combatantId,
      targetId: target.combatantId,
      abilityId: null,
      itemId: null,
    }

    const result = executeAction(battle, action)
    expect(result.damage).toBeGreaterThan(0)
    const updatedTarget = result.battle.enemySquad[0]
    expect(updatedTarget.stats.currentHp).toBeLessThan(target.stats.currentHp)
  })

  it('returns a message describing the attack', () => {
    const battle = makeBattle()
    const action: BattleAction = {
      type: 'attack',
      actorId: battle.playerSquad[0].combatantId,
      targetId: battle.enemySquad[0].combatantId,
      abilityId: null,
      itemId: null,
    }
    const result = executeAction(battle, action)
    expect(result.message).toContain('attacks')
    expect(result.message).toContain('damage')
  })

  it('does not mutate original battle', () => {
    const battle = makeBattle()
    const originalHp = battle.enemySquad[0].stats.currentHp
    const action: BattleAction = {
      type: 'attack',
      actorId: battle.playerSquad[0].combatantId,
      targetId: battle.enemySquad[0].combatantId,
      abilityId: null,
      itemId: null,
    }
    executeAction(battle, action)
    expect(battle.enemySquad[0].stats.currentHp).toBe(originalHp)
  })
})

describe('executeAction - ability', () => {
  it('uses MP when casting an ability', () => {
    const battle = makeBattle()
    const player = battle.playerSquad[0]
    const enemy = battle.enemySquad[0]

    // Add heal ability to the player
    const playerWithHeal: BattleCombatant = {
      ...player,
      abilities: [tackleAbility, healAbility],
    }
    const battleWithAbility: Battle = {
      ...battle,
      playerSquad: [playerWithHeal],
      turnOrder: [playerWithHeal, enemy],
    }

    const action: BattleAction = {
      type: 'ability',
      actorId: playerWithHeal.combatantId,
      targetId: playerWithHeal.combatantId,
      abilityId: 'heal',
      itemId: null,
    }

    const result = executeAction(battleWithAbility, action)
    const updatedPlayer = result.battle.playerSquad[0]
    expect(updatedPlayer.stats.currentMp).toBe(player.stats.currentMp - healAbility.mpCost)
  })

  it('fails when not enough MP', () => {
    const lowMpStats = makeStats({ currentMp: 0 })
    const player = createCombatantFromPlayer('Hero', lowMpStats, [healAbility])
    const enemy = makeEnemy()
    const battle = createBattle([player], [enemy])

    const action: BattleAction = {
      type: 'ability',
      actorId: player.combatantId,
      targetId: player.combatantId,
      abilityId: 'heal',
      itemId: null,
    }

    const result = executeAction(battle, action)
    expect(result.message).toContain("enough MP")
    expect(result.damage).toBe(0)
  })

  it('heals HP with healing ability', () => {
    const damagedStats = makeStats({ currentHp: 50 })
    const player = createCombatantFromPlayer('Hero', damagedStats, [healAbility])
    const enemy = makeEnemy()
    const battle = createBattle([player], [enemy])

    const action: BattleAction = {
      type: 'ability',
      actorId: player.combatantId,
      targetId: player.combatantId,
      abilityId: 'heal',
      itemId: null,
    }

    const result = executeAction(battle, action)
    const updatedPlayer = result.battle.playerSquad[0]
    expect(updatedPlayer.stats.currentHp).toBe(80) // 50 + 30 heal power
    expect(result.message).toContain('recovered')
  })
})

describe('executeAction - defend', () => {
  it('applies shield status effect', () => {
    const battle = makeBattle()
    const player = battle.playerSquad[0]

    const action: BattleAction = {
      type: 'defend',
      actorId: player.combatantId,
      targetId: null,
      abilityId: null,
      itemId: null,
    }

    const result = executeAction(battle, action)
    const updatedPlayer = result.battle.playerSquad[0]
    expect(updatedPlayer.statusEffects).toHaveLength(1)
    expect(updatedPlayer.statusEffects[0].effect.type).toBe('shield')
    expect(result.message).toContain('defending')
  })
})

describe('executeAction - flee', () => {
  it('sets battle state to fled on successful flee', () => {
    // Use very high speed player vs very slow enemy to guarantee flee
    const fastStats = makeStats({ speed: 999 })
    const slowStats = makeStats({ speed: 1 })
    const player = createCombatantFromPlayer('Hero', fastStats, [tackleAbility])
    const enemy = createCombatantFromEnemy('Slug', slowStats, 'neutral', [tackleAbility])
    const battle = createBattle([player], [enemy])

    const action: BattleAction = {
      type: 'flee',
      actorId: player.combatantId,
      targetId: null,
      abilityId: null,
      itemId: null,
    }

    // Try multiple times since flee has randomness
    let fled = false
    for (let i = 0; i < 50; i++) {
      const result = executeAction(battle, action)
      if (result.battle.state === 'fled') {
        fled = true
        break
      }
    }
    expect(fled).toBe(true)
  })

  it('prevents flee when canFlee is false', () => {
    const battle = { ...makeBattle(), canFlee: false }
    const action: BattleAction = {
      type: 'flee',
      actorId: battle.playerSquad[0].combatantId,
      targetId: null,
      abilityId: null,
      itemId: null,
    }

    const result = executeAction(battle, action)
    expect(result.battle.state).not.toBe('fled')
    expect(result.message).toContain("Can't flee")
  })
})

describe('processStatusEffects', () => {
  it('applies poison damage', () => {
    const player = createCombatantFromPlayer('Hero', makeStats(), [tackleAbility])
    const enemy = makeEnemy()
    let battle = createBattle([player], [enemy])

    // Manually apply poison status to player
    const poisonedPlayer: BattleCombatant = {
      ...battle.playerSquad[0],
      statusEffects: [
        {
          effect: { id: 'poison', name: 'Poison', type: 'poison', duration: 3, magnitude: 0.1 },
          turnsRemaining: 3,
          appliedBy: enemy.combatantId,
        },
      ],
    }
    battle = {
      ...battle,
      playerSquad: [poisonedPlayer],
      turnOrder: [poisonedPlayer, battle.enemySquad[0]],
    }

    const updated = processStatusEffects(battle, poisonedPlayer.combatantId)
    const updatedPlayer = updated.playerSquad[0]
    expect(updatedPlayer.stats.currentHp).toBeLessThan(100)
  })

  it('applies regen healing', () => {
    const damagedStats = makeStats({ currentHp: 50 })
    const player = createCombatantFromPlayer('Hero', damagedStats, [tackleAbility])
    const enemy = makeEnemy()
    let battle = createBattle([player], [enemy])

    const regenPlayer: BattleCombatant = {
      ...battle.playerSquad[0],
      statusEffects: [
        {
          effect: { id: 'regen', name: 'Regen', type: 'regen', duration: 3, magnitude: 0.08 },
          turnsRemaining: 3,
          appliedBy: player.combatantId,
        },
      ],
    }
    battle = {
      ...battle,
      playerSquad: [regenPlayer],
      turnOrder: [regenPlayer, battle.enemySquad[0]],
    }

    const updated = processStatusEffects(battle, regenPlayer.combatantId)
    const updatedPlayer = updated.playerSquad[0]
    expect(updatedPlayer.stats.currentHp).toBeGreaterThan(50)
  })

  it('decrements turn counters and removes expired effects', () => {
    const player = createCombatantFromPlayer('Hero', makeStats(), [tackleAbility])
    const enemy = makeEnemy()
    let battle = createBattle([player], [enemy])

    const buffedPlayer: BattleCombatant = {
      ...battle.playerSquad[0],
      statusEffects: [
        {
          effect: { id: 'shield', name: 'Shield', type: 'shield', duration: 1, magnitude: 0.5 },
          turnsRemaining: 1,
          appliedBy: player.combatantId,
        },
      ],
    }
    battle = {
      ...battle,
      playerSquad: [buffedPlayer],
      turnOrder: [buffedPlayer, battle.enemySquad[0]],
    }

    const updated = processStatusEffects(battle, buffedPlayer.combatantId)
    const updatedPlayer = updated.playerSquad[0]
    // After 1 tick, turnsRemaining goes to 0, should be removed
    expect(updatedPlayer.statusEffects).toHaveLength(0)
  })
})

describe('isSleeping', () => {
  it('returns true for sleeping combatant', () => {
    const combatant: BattleCombatant = {
      ...makePlayer(),
      statusEffects: [
        {
          effect: { id: 'sleep', name: 'Sleep', type: 'sleep', duration: 2, magnitude: 0 },
          turnsRemaining: 2,
          appliedBy: 'someone',
        },
      ],
    }
    expect(isSleeping(combatant)).toBe(true)
  })

  it('returns false for non-sleeping combatant', () => {
    expect(isSleeping(makePlayer())).toBe(false)
  })
})

describe('getEnemyAction', () => {
  it('returns an attack action against alive targets', () => {
    const battle = makeBattle()
    const enemy = battle.enemySquad[0]
    const action = getEnemyAction(battle, enemy)
    expect(action.actorId).toBe(enemy.combatantId)
    expect(['attack', 'ability', 'defend']).toContain(action.type)
  })

  it('returns defend when no targets are alive', () => {
    const deadStats = makeStats({ currentHp: 0 })
    const player = createCombatantFromPlayer('Dead', deadStats, [tackleAbility])
    const enemy = makeEnemy()
    const battle = createBattle([player], [enemy])

    const action = getEnemyAction(battle, enemy)
    expect(action.type).toBe('defend')
  })

  it('tries to heal when HP is low', () => {
    const lowHpStats = makeStats({ currentHp: 10 })
    const enemy = createCombatantFromEnemy('Hurt', lowHpStats, 'neutral', [tackleAbility, healAbility])
    const player = makePlayer()
    const battle = createBattle([player], [enemy])

    // Try multiple times since AI has randomness
    let healed = false
    for (let i = 0; i < 50; i++) {
      const action = getEnemyAction(battle, battle.enemySquad[0])
      if (action.type === 'ability' && action.abilityId === 'heal') {
        healed = true
        break
      }
    }
    expect(healed).toBe(true)
  })
})

describe('calculateBattleRewards', () => {
  it('returns experience and gold', () => {
    const battle = makeBattle()
    const rewards = calculateBattleRewards(battle)
    expect(rewards.experience).toBeGreaterThan(0)
    expect(rewards.gold).toBeGreaterThan(0)
    expect(rewards.items).toEqual([])
    expect(rewards.capturedMonster).toBeNull()
  })

  it('scales with enemy stats', () => {
    const weakBattle = makeBattle({ enemyStats: { maxHp: 10, attack: 5, defense: 5 } })
    const strongBattle = makeBattle({ enemyStats: { maxHp: 200, attack: 50, defense: 50 } })

    const weakRewards = calculateBattleRewards(weakBattle)
    const strongRewards = calculateBattleRewards(strongBattle)
    expect(strongRewards.experience).toBeGreaterThan(weakRewards.experience)
  })
})

describe('checkBattleEnd', () => {
  it('returns victory when all enemies are dead', () => {
    const deadStats = makeStats({ currentHp: 0 })
    const player = createCombatantFromPlayer('Hero', makeStats(), [tackleAbility])
    const enemy = createCombatantFromEnemy('Dead', deadStats, 'neutral', [tackleAbility])
    const battle = createBattle([player], [enemy])

    expect(checkBattleEnd(battle)).toBe('victory')
  })

  it('returns defeat when all players are dead', () => {
    const deadStats = makeStats({ currentHp: 0 })
    const player = createCombatantFromPlayer('Dead', deadStats, [tackleAbility])
    const enemy = makeEnemy()
    const battle = createBattle([player], [enemy])

    expect(checkBattleEnd(battle)).toBe('defeat')
  })

  it('returns current state when battle is ongoing', () => {
    const battle = makeBattle()
    expect(checkBattleEnd(battle)).toBe('start')
  })
})

describe('getCurrentCombatant', () => {
  it('returns the combatant at current turn index', () => {
    const battle = makeBattle()
    const current = getCurrentCombatant(battle)
    expect(current).toBeDefined()
    expect(current!.combatantId).toBe(battle.turnOrder[0].combatantId)
  })
})

describe('executeAction - AoE ability', () => {
  it('damages all enemies', () => {
    const player = createCombatantFromPlayer('Hero', makeStats({ currentMp: 50 }), [aoeAbility])
    const enemy1 = createCombatantFromEnemy('Slime A', makeStats(), 'neutral', [tackleAbility])
    const enemy2 = createCombatantFromEnemy('Slime B', makeStats(), 'neutral', [tackleAbility])
    const battle = createBattle([player], [enemy1, enemy2])

    const action: BattleAction = {
      type: 'ability',
      actorId: battle.playerSquad[0].combatantId,
      targetId: null,
      abilityId: 'quake',
      itemId: null,
    }

    const result = executeAction(battle, action)
    expect(result.damage).toBeGreaterThan(0)
    expect(result.battle.enemySquad[0].stats.currentHp).toBeLessThan(100)
    expect(result.battle.enemySquad[1].stats.currentHp).toBeLessThan(100)
    expect(result.message).toContain('total damage')
  })
})

describe('executeAction - damage ability with element effectiveness', () => {
  it('deals damage with a fire ability', () => {
    const player = createCombatantFromPlayer('Hero', makeStats({ currentMp: 50 }), [fireAbility])
    const enemy = createCombatantFromEnemy('Slime', makeStats(), 'neutral', [tackleAbility])
    const battle = createBattle([player], [enemy])

    const action: BattleAction = {
      type: 'ability',
      actorId: battle.playerSquad[0].combatantId,
      targetId: battle.enemySquad[0].combatantId,
      abilityId: 'ember',
      itemId: null,
    }

    const result = executeAction(battle, action)
    expect(result.damage).toBeGreaterThan(0)
    expect(result.battle.enemySquad[0].stats.currentHp).toBeLessThan(100)
  })

  it('returns no valid targets message for missing target', () => {
    const player = createCombatantFromPlayer('Hero', makeStats(), [fireAbility])
    const enemy = makeEnemy()
    const battle = createBattle([player], [enemy])

    const action: BattleAction = {
      type: 'ability',
      actorId: battle.playerSquad[0].combatantId,
      targetId: 'nonexistent-id',
      targetIds: [],
      abilityId: 'ember',
      itemId: null,
    }

    const result = executeAction(battle, action)
    expect(result.message).toContain('No valid targets')
  })
})

describe('executeAction - heal all allies', () => {
  it('heals all party members', () => {
    const groupHeal: Ability = {
      abilityId: 'group-heal',
      name: 'Group Heal',
      description: 'Heals all allies',
      element: 'light',
      type: 'healing',
      power: 20,
      accuracy: 100,
      mpCost: 12,
      targetType: 'all_allies',
      statusEffect: null,
      animation: 'glow',
    }

    const p1 = createCombatantFromPlayer('Hero', makeStats({ currentHp: 50 }), [groupHeal])
    const p2 = createCombatantFromPlayer('Ally', makeStats({ currentHp: 60 }), [tackleAbility])
    const enemy = makeEnemy()
    const battle = createBattle([p1, p2], [enemy])

    const action: BattleAction = {
      type: 'ability',
      actorId: battle.playerSquad[0].combatantId,
      targetId: null,
      abilityId: 'group-heal',
      itemId: null,
    }

    const result = executeAction(battle, action)
    expect(result.battle.playerSquad[0].stats.currentHp).toBe(70) // 50 + 20
    expect(result.battle.playerSquad[1].stats.currentHp).toBe(80) // 60 + 20
    expect(result.message).toContain('all allies')
  })
})

describe('executeAction - unknown action type', () => {
  it('returns nothing happened message for unknown type', () => {
    const battle = makeBattle()
    const action: BattleAction = {
      type: 'unknown_type' as any,
      actorId: battle.playerSquad[0].combatantId,
      targetId: null,
      abilityId: null,
      itemId: null,
    }

    const result = executeAction(battle, action)
    expect(result.message).toBe('Nothing happened.')
    expect(result.damage).toBe(0)
  })
})

describe('executeAction - ability edge cases', () => {
  it('returns invalid ability for missing abilityId', () => {
    const battle = makeBattle()
    const action: BattleAction = {
      type: 'ability',
      actorId: battle.playerSquad[0].combatantId,
      targetId: battle.enemySquad[0].combatantId,
      abilityId: null,
      itemId: null,
    }

    const result = executeAction(battle, action)
    expect(result.message).toContain('Invalid ability')
  })

  it('returns unknown ability for wrong abilityId', () => {
    const battle = makeBattle()
    const action: BattleAction = {
      type: 'ability',
      actorId: battle.playerSquad[0].combatantId,
      targetId: battle.enemySquad[0].combatantId,
      abilityId: 'nonexistent-ability',
      itemId: null,
    }

    const result = executeAction(battle, action)
    expect(result.message).toContain('Unknown ability')
  })

  it('returns invalid target for basic attack with no target', () => {
    const battle = makeBattle()
    const action: BattleAction = {
      type: 'attack',
      actorId: battle.playerSquad[0].combatantId,
      targetId: 'bad-id',
      abilityId: null,
      itemId: null,
    }

    const result = executeAction(battle, action)
    expect(result.message).toContain('Invalid target')
  })
})

describe('status effect modifiers on stats', () => {
  it('shield increases effective defense (reduces damage taken)', () => {
    const player = createCombatantFromPlayer('Hero', makeStats(), [tackleAbility])
    const enemy = makeEnemy()
    let battle = createBattle([player], [enemy])

    // Get baseline damage
    const baseAction: BattleAction = {
      type: 'attack',
      actorId: battle.enemySquad[0].combatantId,
      targetId: battle.playerSquad[0].combatantId,
      abilityId: null,
      itemId: null,
    }

    // Add shield to player
    const shieldedPlayer: BattleCombatant = {
      ...battle.playerSquad[0],
      statusEffects: [
        {
          effect: { id: 'shield', name: 'Shield', type: 'shield', duration: 3, magnitude: 0.5 },
          turnsRemaining: 3,
          appliedBy: player.combatantId,
        },
      ],
    }
    const shieldedBattle: Battle = {
      ...battle,
      playerSquad: [shieldedPlayer],
      turnOrder: [shieldedPlayer, battle.enemySquad[0]],
    }

    // Run multiple times to get average damage with and without shield
    let totalNormal = 0
    let totalShielded = 0
    const trials = 100
    for (let i = 0; i < trials; i++) {
      const normalResult = executeAction(battle, baseAction)
      totalNormal += normalResult.damage

      const shieldedResult = executeAction(shieldedBattle, baseAction)
      totalShielded += shieldedResult.damage
    }

    // Shielded should take less average damage
    expect(totalShielded / trials).toBeLessThan(totalNormal / trials)
  })

  it('attack_up increases damage dealt', () => {
    const player = createCombatantFromPlayer('Hero', makeStats(), [tackleAbility])
    const enemy = makeEnemy()
    let battle = createBattle([player], [enemy])

    const attackAction: BattleAction = {
      type: 'attack',
      actorId: battle.playerSquad[0].combatantId,
      targetId: battle.enemySquad[0].combatantId,
      abilityId: null,
      itemId: null,
    }

    const buffedPlayer: BattleCombatant = {
      ...battle.playerSquad[0],
      statusEffects: [
        {
          effect: { id: 'attack_up', name: 'Attack Up', type: 'attack_up', duration: 3, magnitude: 0.3 },
          turnsRemaining: 3,
          appliedBy: player.combatantId,
        },
      ],
    }
    const buffedBattle: Battle = {
      ...battle,
      playerSquad: [buffedPlayer],
      turnOrder: [buffedPlayer, battle.enemySquad[0]],
    }

    let totalNormal = 0
    let totalBuffed = 0
    const trials = 100
    for (let i = 0; i < trials; i++) {
      const normalResult = executeAction(battle, attackAction)
      totalNormal += normalResult.damage

      const buffedAction: BattleAction = { ...attackAction, actorId: buffedPlayer.combatantId }
      const buffedResult = executeAction(buffedBattle, buffedAction)
      totalBuffed += buffedResult.damage
    }

    expect(totalBuffed / trials).toBeGreaterThan(totalNormal / trials)
  })

  it('slow reduces effective speed in turn order', () => {
    const fastStats = makeStats({ speed: 30 })
    const slowStats = makeStats({ speed: 10 })
    const fast = createCombatantFromPlayer('Fast', fastStats, [tackleAbility])
    const slow = createCombatantFromEnemy('Slow', slowStats, 'neutral', [tackleAbility])

    // Without debuff, fast goes first
    const normalOrder = calculateTurnOrder([fast, slow])
    expect(normalOrder[0].name).toBe('Fast')

    // With slow debuff on fast, their effective speed becomes 15 (30 * 0.5)
    const slowedFast: BattleCombatant = {
      ...fast,
      statusEffects: [
        {
          effect: { id: 'slow', name: 'Slow', type: 'slow', duration: 3, magnitude: 0.5 },
          turnsRemaining: 3,
          appliedBy: slow.combatantId,
        },
      ],
    }

    // Even with slow debuff, 15 > 10 so fast still goes first
    // But with haste on slow: 10 * 1.5 = 15 = tie (random)
    // Better test: give slow more speed so debuff flips the order
    const mediumStats = makeStats({ speed: 20 })
    const medium = createCombatantFromEnemy('Medium', mediumStats, 'neutral', [tackleAbility])
    const slowedFastForTest: BattleCombatant = {
      ...createCombatantFromPlayer('Debuffed', makeStats({ speed: 30 }), [tackleAbility]),
      statusEffects: [
        {
          effect: { id: 'slow', name: 'Slow', type: 'slow', duration: 3, magnitude: 0.5 },
          turnsRemaining: 3,
          appliedBy: 'enemy',
        },
      ],
    }
    // Debuffed speed: 30 * 0.5 = 15, Medium speed: 20
    // Medium should go first consistently
    let mediumFirst = 0
    for (let i = 0; i < 20; i++) {
      const order = calculateTurnOrder([slowedFastForTest, medium])
      if (order[0].name === 'Medium') mediumFirst++
    }
    expect(mediumFirst).toBe(20)
  })
})

describe('advanceTurn', () => {
  it('advances the turn index', () => {
    const battle = makeBattle()
    const advanced = advanceTurn(battle)
    expect(advanced.currentTurnIndex).toBe(1)
  })

  it('wraps around and increments turn count', () => {
    const battle = { ...makeBattle(), currentTurnIndex: 1 }
    // Turn order has 2 combatants (1 player + 1 enemy)
    const advanced = advanceTurn(battle)
    expect(advanced.currentTurnIndex).toBe(0)
    expect(advanced.turnCount).toBe(2) // was 1, now 2
  })
})

describe('status ability edge cases', () => {
  it('prevents duplicate status effects', () => {
    const player = createCombatantFromPlayer('Hero', makeStats(), [poisonAbility])
    const enemy = createCombatantFromEnemy('Slime', makeStats(), 'neutral', [tackleAbility])
    let battle = createBattle([player], [enemy])

    // Manually add poison to enemy first
    const poisonedEnemy: BattleCombatant = {
      ...battle.enemySquad[0],
      statusEffects: [
        {
          effect: { id: 'poison', name: 'Poison', type: 'poison', duration: 3, magnitude: 0.1 },
          turnsRemaining: 3,
          appliedBy: 'someone',
        },
      ],
    }
    battle = {
      ...battle,
      enemySquad: [poisonedEnemy],
      turnOrder: [battle.playerSquad[0], poisonedEnemy],
    }

    const action: BattleAction = {
      type: 'ability',
      actorId: battle.playerSquad[0].combatantId,
      targetId: poisonedEnemy.combatantId,
      abilityId: 'poison-sting',
      itemId: null,
    }

    const result = executeAction(battle, action)
    expect(result.message).toContain('already has')
  })
})

describe('executeAction - enemy HP protection (tutorial mode)', () => {
  it('basic attack respects enemyMinHp option for enemies', () => {
    // Create a weak enemy that would normally die
    const strongStats = makeStats({ attack: 999 })
    const player = createCombatantFromPlayer('Hero', strongStats, [tackleAbility])
    const weakStats = makeStats({ maxHp: 50, currentHp: 50, defense: 1 })
    const enemy = createCombatantFromEnemy('Weak', weakStats, 'neutral', [tackleAbility])
    const battle = createBattle([player], [enemy])

    const action: BattleAction = {
      type: 'attack',
      actorId: battle.playerSquad[0].combatantId,
      targetId: battle.enemySquad[0].combatantId,
      abilityId: null,
      itemId: null,
    }

    // With enemyMinHp: 5, enemy should never go below 5 HP
    const result = executeAction(battle, action, { enemyMinHp: 5 })
    expect(result.battle.enemySquad[0].stats.currentHp).toBe(5)
    // Battle should NOT end in victory since enemy is still alive
    expect(checkBattleEnd(result.battle)).not.toBe('victory')
  })

  it('ability attack respects enemyMinHp option for enemies', () => {
    const strongStats = makeStats({ attack: 999, magicAttack: 999, currentMp: 50 })
    const player = createCombatantFromPlayer('Hero', strongStats, [fireAbility])
    const weakStats = makeStats({ maxHp: 50, currentHp: 50, defense: 1, magicDefense: 1 })
    const enemy = createCombatantFromEnemy('Weak', weakStats, 'neutral', [tackleAbility])
    const battle = createBattle([player], [enemy])

    const action: BattleAction = {
      type: 'ability',
      actorId: battle.playerSquad[0].combatantId,
      targetId: battle.enemySquad[0].combatantId,
      abilityId: 'ember',
      itemId: null,
    }

    // With enemyMinHp: 5, enemy should never go below 5 HP
    const result = executeAction(battle, action, { enemyMinHp: 5 })
    expect(result.battle.enemySquad[0].stats.currentHp).toBe(5)
  })

  it('does not apply enemyMinHp protection to player combatants', () => {
    const strongStats = makeStats({ attack: 999 })
    const weakStats = makeStats({ maxHp: 50, currentHp: 50, defense: 1 })
    const player = createCombatantFromPlayer('Weak Hero', weakStats, [tackleAbility])
    const enemy = createCombatantFromEnemy('Strong', strongStats, 'neutral', [tackleAbility])
    const battle = createBattle([player], [enemy])

    const action: BattleAction = {
      type: 'attack',
      actorId: battle.enemySquad[0].combatantId,
      targetId: battle.playerSquad[0].combatantId,
      abilityId: null,
      itemId: null,
    }

    // enemyMinHp should NOT protect the player
    const result = executeAction(battle, action, { enemyMinHp: 5 })
    expect(result.battle.playerSquad[0].stats.currentHp).toBe(0)
    expect(checkBattleEnd(result.battle)).toBe('defeat')
  })

  it('without options, enemy HP can go to 0', () => {
    const strongStats = makeStats({ attack: 999 })
    const player = createCombatantFromPlayer('Hero', strongStats, [tackleAbility])
    const weakStats = makeStats({ maxHp: 1, currentHp: 1, defense: 1 })
    const enemy = createCombatantFromEnemy('Weak', weakStats, 'neutral', [tackleAbility])
    const battle = createBattle([player], [enemy])

    const action: BattleAction = {
      type: 'attack',
      actorId: battle.playerSquad[0].combatantId,
      targetId: battle.enemySquad[0].combatantId,
      abilityId: null,
      itemId: null,
    }

    // Without options, enemy can die
    const result = executeAction(battle, action)
    expect(result.battle.enemySquad[0].stats.currentHp).toBe(0)
    expect(checkBattleEnd(result.battle)).toBe('victory')
  })
})

describe('integration - full battle turn', () => {
  it('player attacks enemy, enemy attacks back, HP changes persist', () => {
    const battle = makeBattle()
    const player = battle.playerSquad[0]
    const enemy = battle.enemySquad[0]

    // Player attacks
    const playerAttack: BattleAction = {
      type: 'attack',
      actorId: player.combatantId,
      targetId: enemy.combatantId,
      abilityId: null,
      itemId: null,
    }
    const afterPlayerAttack = executeAction(battle, playerAttack)
    const enemyHpAfterAttack = afterPlayerAttack.battle.enemySquad[0].stats.currentHp
    expect(enemyHpAfterAttack).toBeLessThan(100)

    // Enemy attacks on the updated battle
    const updatedEnemy = afterPlayerAttack.battle.enemySquad[0]
    const enemyAttack: BattleAction = {
      type: 'attack',
      actorId: updatedEnemy.combatantId,
      targetId: afterPlayerAttack.battle.playerSquad[0].combatantId,
      abilityId: null,
      itemId: null,
    }
    const afterEnemyAttack = executeAction(afterPlayerAttack.battle, enemyAttack)
    const playerHpAfterAttack = afterEnemyAttack.battle.playerSquad[0].stats.currentHp
    expect(playerHpAfterAttack).toBeLessThan(100)

    // Enemy HP should still reflect the player's earlier attack
    expect(afterEnemyAttack.battle.enemySquad[0].stats.currentHp).toBe(enemyHpAfterAttack)
  })

  it('status ability applies and processes correctly over turns', () => {
    const player = createCombatantFromPlayer('Hero', makeStats(), [poisonAbility])
    const enemy = createCombatantFromEnemy('Slime', makeStats(), 'neutral', [tackleAbility])
    let battle = createBattle([player], [enemy])

    // Player uses poison sting
    const poisonAction: BattleAction = {
      type: 'ability',
      actorId: battle.playerSquad[0].combatantId,
      targetId: battle.enemySquad[0].combatantId,
      abilityId: 'poison-sting',
      itemId: null,
    }
    const result = executeAction(battle, poisonAction)
    battle = result.battle
    const enemyAfterPoison = battle.enemySquad[0]

    if (enemyAfterPoison.statusEffects.length > 0) {
      // Poison was applied - process status effects
      const afterProcess = processStatusEffects(battle, enemyAfterPoison.combatantId)
      const processedEnemy = afterProcess.enemySquad[0]
      expect(processedEnemy.stats.currentHp).toBeLessThan(100)
    }
  })

  it('battle ends when enemy HP reaches 0', () => {
    const strongStats = makeStats({ attack: 999 })
    const player = createCombatantFromPlayer('Hero', strongStats, [tackleAbility])
    const weakStats = makeStats({ maxHp: 1, currentHp: 1, defense: 1 })
    const enemy = createCombatantFromEnemy('Weak', weakStats, 'neutral', [tackleAbility])
    let battle = createBattle([player], [enemy])

    const action: BattleAction = {
      type: 'attack',
      actorId: battle.playerSquad[0].combatantId,
      targetId: battle.enemySquad[0].combatantId,
      abilityId: null,
      itemId: null,
    }

    const result = executeAction(battle, action)
    expect(result.battle.enemySquad[0].stats.currentHp).toBe(0)
    expect(checkBattleEnd(result.battle)).toBe('victory')
  })
})

// ── Battle Spirit (Escalation Die) Tests ──

describe('Battle Spirit - createBattle', () => {
  it('initializes battleSpirit to 0', () => {
    const battle = makeBattle()
    expect(battle.battleSpirit).toBe(0)
  })
})

describe('Battle Spirit - incrementBattleSpirit', () => {
  it('increments battleSpirit by 1', () => {
    const battle = makeBattle()
    const updated = incrementBattleSpirit(battle)
    expect(updated.battleSpirit).toBe(1)
  })

  it('caps battleSpirit at BATTLE_SPIRIT_MAX', () => {
    let battle = { ...makeBattle(), battleSpirit: BATTLE_SPIRIT_MAX - 1 }
    battle = incrementBattleSpirit(battle)
    expect(battle.battleSpirit).toBe(BATTLE_SPIRIT_MAX)

    // Should not exceed max
    battle = incrementBattleSpirit(battle)
    expect(battle.battleSpirit).toBe(BATTLE_SPIRIT_MAX)
  })

  it('does not mutate original battle', () => {
    const battle = makeBattle()
    incrementBattleSpirit(battle)
    expect(battle.battleSpirit).toBe(0)
  })
})

describe('Battle Spirit - getBattleSpiritDamageMultiplier', () => {
  it('returns 1.0 when spirit is 0', () => {
    const battle = makeBattle()
    expect(getBattleSpiritDamageMultiplier(battle)).toBe(1.0)
  })

  it('returns correct multiplier for each spirit level', () => {
    for (let level = 0; level <= BATTLE_SPIRIT_MAX; level++) {
      const battle = { ...makeBattle(), battleSpirit: level }
      const expected = 1.0 + level * BATTLE_SPIRIT_DAMAGE_BONUS
      expect(getBattleSpiritDamageMultiplier(battle)).toBeCloseTo(expected)
    }
  })

  it('returns 1.4 (40% bonus) at max spirit', () => {
    const battle = { ...makeBattle(), battleSpirit: BATTLE_SPIRIT_MAX }
    expect(getBattleSpiritDamageMultiplier(battle)).toBeCloseTo(1.4)
  })
})

describe('Battle Spirit - getBattleSpiritAccuracyBonus', () => {
  it('returns 0 when spirit is 0', () => {
    const battle = makeBattle()
    expect(getBattleSpiritAccuracyBonus(battle)).toBe(0)
  })

  it('returns correct bonus for each spirit level', () => {
    for (let level = 0; level <= BATTLE_SPIRIT_MAX; level++) {
      const battle = { ...makeBattle(), battleSpirit: level }
      const expected = level * BATTLE_SPIRIT_ACCURACY_BONUS
      expect(getBattleSpiritAccuracyBonus(battle)).toBe(expected)
    }
  })

  it('returns 15 (15% bonus) at max spirit', () => {
    const battle = { ...makeBattle(), battleSpirit: BATTLE_SPIRIT_MAX }
    expect(getBattleSpiritAccuracyBonus(battle)).toBe(15)
  })
})

describe('Battle Spirit - advanceTurn spirit increment', () => {
  it('increments battleSpirit when wrapping to new round', () => {
    const battle = { ...makeBattle(), currentTurnIndex: 1, battleSpirit: 0 }
    // Turn order has 2 combatants (player + enemy)
    const advanced = advanceTurn(battle)
    expect(advanced.currentTurnIndex).toBe(0) // Wrapped around
    expect(advanced.battleSpirit).toBe(1) // Spirit increased
  })

  it('does not increment battleSpirit during same round', () => {
    const battle = { ...makeBattle(), currentTurnIndex: 0, battleSpirit: 0 }
    const advanced = advanceTurn(battle)
    expect(advanced.currentTurnIndex).toBe(1) // Advanced within round
    expect(advanced.battleSpirit).toBe(0) // Spirit unchanged
  })

  it('caps battleSpirit at max on round advance', () => {
    const battle = { ...makeBattle(), currentTurnIndex: 1, battleSpirit: BATTLE_SPIRIT_MAX }
    const advanced = advanceTurn(battle)
    expect(advanced.battleSpirit).toBe(BATTLE_SPIRIT_MAX)
  })
})

describe('Battle Spirit - damage bonus application', () => {
  it('player attack deals more damage with higher spirit', () => {
    const battle = makeBattle()
    const player = battle.playerSquad[0]
    const enemy = battle.enemySquad[0]

    const action: BattleAction = {
      type: 'attack',
      actorId: player.combatantId,
      targetId: enemy.combatantId,
      abilityId: null,
      itemId: null,
    }

    // Run multiple trials to compare average damage at different spirit levels
    const trials = 50
    let totalDamageSpirit0 = 0
    let totalDamageSpirit5 = 0

    for (let i = 0; i < trials; i++) {
      const result0 = executeAction({ ...battle, battleSpirit: 0 }, action)
      totalDamageSpirit0 += result0.damage

      const result5 = executeAction({ ...battle, battleSpirit: 5 }, action)
      totalDamageSpirit5 += result5.damage
    }

    // Spirit 5 should deal significantly more damage than spirit 0
    expect(totalDamageSpirit5 / trials).toBeGreaterThan(totalDamageSpirit0 / trials)
  })

  it('enemy attack damage is NOT affected by battle spirit', () => {
    const battle = makeBattle()
    const enemy = battle.enemySquad[0]
    const player = battle.playerSquad[0]

    const action: BattleAction = {
      type: 'attack',
      actorId: enemy.combatantId,
      targetId: player.combatantId,
      abilityId: null,
      itemId: null,
    }

    // Run multiple trials - damage should be similar regardless of spirit
    const trials = 50
    let totalDamageSpirit0 = 0
    let totalDamageSpirit5 = 0

    for (let i = 0; i < trials; i++) {
      const result0 = executeAction({ ...battle, battleSpirit: 0 }, action)
      totalDamageSpirit0 += result0.damage

      const result5 = executeAction({ ...battle, battleSpirit: 5 }, action)
      totalDamageSpirit5 += result5.damage
    }

    // Average damage should be very similar (within 20% variance)
    const avgDamage0 = totalDamageSpirit0 / trials
    const avgDamage5 = totalDamageSpirit5 / trials
    const ratio = avgDamage5 / avgDamage0
    expect(ratio).toBeGreaterThan(0.8)
    expect(ratio).toBeLessThan(1.2)
  })
})

// ── Ability Cooldown Tests ──

describe('Ability Cooldowns - isAbilityOnCooldown', () => {
  it('returns false when combatant has no cooldowns', () => {
    const combatant = createCombatantFromPlayer('Hero', makeStats(), [fireballAbility])
    expect(isAbilityOnCooldown(combatant, 'fireball')).toBe(false)
  })

  it('returns true when ability is on cooldown', () => {
    const combatant: BattleCombatant = {
      ...createCombatantFromPlayer('Hero', makeStats(), [fireballAbility]),
      cooldowns: [{ abilityId: 'fireball', turnsRemaining: 2 }],
    }
    expect(isAbilityOnCooldown(combatant, 'fireball')).toBe(true)
  })

  it('returns false when ability cooldown has reached 0', () => {
    const combatant: BattleCombatant = {
      ...createCombatantFromPlayer('Hero', makeStats(), [fireballAbility]),
      cooldowns: [{ abilityId: 'fireball', turnsRemaining: 0 }],
    }
    expect(isAbilityOnCooldown(combatant, 'fireball')).toBe(false)
  })

  it('returns false for abilities not in cooldown list', () => {
    const combatant: BattleCombatant = {
      ...createCombatantFromPlayer('Hero', makeStats(), [fireballAbility, tackleAbility]),
      cooldowns: [{ abilityId: 'fireball', turnsRemaining: 2 }],
    }
    expect(isAbilityOnCooldown(combatant, 'tackle')).toBe(false)
  })
})

describe('Ability Cooldowns - getAbilityCooldown', () => {
  it('returns 0 when ability is not on cooldown', () => {
    const combatant = createCombatantFromPlayer('Hero', makeStats(), [fireballAbility])
    expect(getAbilityCooldown(combatant, 'fireball')).toBe(0)
  })

  it('returns remaining turns when ability is on cooldown', () => {
    const combatant: BattleCombatant = {
      ...createCombatantFromPlayer('Hero', makeStats(), [fireballAbility]),
      cooldowns: [{ abilityId: 'fireball', turnsRemaining: 3 }],
    }
    expect(getAbilityCooldown(combatant, 'fireball')).toBe(3)
  })
})

describe('Ability Cooldowns - startAbilityCooldown', () => {
  it('does not add cooldown for abilities with cooldownTurns 0', () => {
    const combatant = createCombatantFromPlayer('Hero', makeStats(), [tackleAbility])
    const updated = startAbilityCooldown(combatant, tackleAbility)
    expect(updated.cooldowns).toHaveLength(0)
  })

  it('adds cooldown for abilities with cooldownTurns > 0', () => {
    const combatant = createCombatantFromPlayer('Hero', makeStats(), [fireballAbility])
    const updated = startAbilityCooldown(combatant, fireballAbility)
    expect(updated.cooldowns).toHaveLength(1)
    expect(updated.cooldowns[0].abilityId).toBe('fireball')
    expect(updated.cooldowns[0].turnsRemaining).toBe(2)
  })

  it('replaces existing cooldown for same ability', () => {
    const combatant: BattleCombatant = {
      ...createCombatantFromPlayer('Hero', makeStats(), [fireballAbility]),
      cooldowns: [{ abilityId: 'fireball', turnsRemaining: 1 }],
    }
    const updated = startAbilityCooldown(combatant, fireballAbility)
    expect(updated.cooldowns).toHaveLength(1)
    expect(updated.cooldowns[0].turnsRemaining).toBe(2)
  })

  it('does not mutate original combatant', () => {
    const combatant = createCombatantFromPlayer('Hero', makeStats(), [fireballAbility])
    startAbilityCooldown(combatant, fireballAbility)
    expect(combatant.cooldowns).toHaveLength(0)
  })
})

describe('Ability Cooldowns - tickCooldowns', () => {
  it('decrements all cooldowns by 1', () => {
    const combatant: BattleCombatant = {
      ...createCombatantFromPlayer('Hero', makeStats(), [fireballAbility, aoeAbility]),
      cooldowns: [
        { abilityId: 'fireball', turnsRemaining: 2 },
        { abilityId: 'quake', turnsRemaining: 3 },
      ],
    }
    const updated = tickCooldowns(combatant)
    expect(updated.cooldowns.find((cd) => cd.abilityId === 'fireball')?.turnsRemaining).toBe(1)
    expect(updated.cooldowns.find((cd) => cd.abilityId === 'quake')?.turnsRemaining).toBe(2)
  })

  it('removes cooldowns that reach 0', () => {
    const combatant: BattleCombatant = {
      ...createCombatantFromPlayer('Hero', makeStats(), [fireballAbility]),
      cooldowns: [{ abilityId: 'fireball', turnsRemaining: 1 }],
    }
    const updated = tickCooldowns(combatant)
    expect(updated.cooldowns).toHaveLength(0)
  })

  it('does not mutate original combatant', () => {
    const combatant: BattleCombatant = {
      ...createCombatantFromPlayer('Hero', makeStats(), [fireballAbility]),
      cooldowns: [{ abilityId: 'fireball', turnsRemaining: 2 }],
    }
    tickCooldowns(combatant)
    expect(combatant.cooldowns[0].turnsRemaining).toBe(2)
  })
})

describe('Ability Cooldowns - getUsableAbilities', () => {
  it('returns all abilities when none are on cooldown and has MP', () => {
    const combatant = createCombatantFromPlayer('Hero', makeStats({ currentMp: 50 }), [tackleAbility, fireballAbility])
    const usable = getUsableAbilities(combatant)
    expect(usable).toHaveLength(2)
  })

  it('excludes abilities on cooldown', () => {
    const combatant: BattleCombatant = {
      ...createCombatantFromPlayer('Hero', makeStats({ currentMp: 50 }), [tackleAbility, fireballAbility]),
      cooldowns: [{ abilityId: 'fireball', turnsRemaining: 2 }],
    }
    const usable = getUsableAbilities(combatant)
    expect(usable).toHaveLength(1)
    expect(usable[0].abilityId).toBe('tackle')
  })

  it('excludes abilities without enough MP', () => {
    const combatant = createCombatantFromPlayer('Hero', makeStats({ currentMp: 0 }), [tackleAbility, fireballAbility])
    const usable = getUsableAbilities(combatant)
    expect(usable).toHaveLength(1)
    expect(usable[0].abilityId).toBe('tackle')
  })

  it('returns empty array when all abilities are on cooldown or no MP', () => {
    const combatant: BattleCombatant = {
      ...createCombatantFromPlayer('Hero', makeStats({ currentMp: 0 }), [fireballAbility]),
      cooldowns: [{ abilityId: 'fireball', turnsRemaining: 2 }],
    }
    const usable = getUsableAbilities(combatant)
    expect(usable).toHaveLength(0)
  })
})

describe('Ability Cooldowns - tickCombatantCooldowns', () => {
  it('ticks cooldowns for specified combatant in battle', () => {
    const player = createCombatantFromPlayer('Hero', makeStats(), [fireballAbility])
    const playerWithCooldown: BattleCombatant = {
      ...player,
      cooldowns: [{ abilityId: 'fireball', turnsRemaining: 2 }],
    }
    const enemy = createCombatantFromEnemy('Slime', makeStats(), 'neutral', [tackleAbility])
    const battle = createBattle([playerWithCooldown], [enemy])

    const updatedBattle = tickCombatantCooldowns(battle, playerWithCooldown.combatantId)
    const updatedPlayer = updatedBattle.playerSquad[0]
    expect(updatedPlayer.cooldowns[0].turnsRemaining).toBe(1)
  })

  it('does not tick cooldowns for other combatants', () => {
    const player: BattleCombatant = {
      ...createCombatantFromPlayer('Hero', makeStats(), [fireballAbility]),
      cooldowns: [{ abilityId: 'fireball', turnsRemaining: 2 }],
    }
    const enemy: BattleCombatant = {
      ...createCombatantFromEnemy('Slime', makeStats(), 'neutral', [fireballAbility]),
      cooldowns: [{ abilityId: 'fireball', turnsRemaining: 3 }],
    }
    const battle = createBattle([player], [enemy])

    const updatedBattle = tickCombatantCooldowns(battle, player.combatantId)
    const updatedEnemy = updatedBattle.enemySquad[0]
    expect(updatedEnemy.cooldowns[0].turnsRemaining).toBe(3) // Unchanged
  })
})

describe('Ability Cooldowns - executeAction with cooldowns', () => {
  it('blocks ability use when on cooldown', () => {
    const player: BattleCombatant = {
      ...createCombatantFromPlayer('Hero', makeStats({ currentMp: 50 }), [fireballAbility]),
      cooldowns: [{ abilityId: 'fireball', turnsRemaining: 2 }],
    }
    const enemy = createCombatantFromEnemy('Slime', makeStats(), 'neutral', [tackleAbility])
    const battle = createBattle([player], [enemy])

    const action: BattleAction = {
      type: 'ability',
      actorId: player.combatantId,
      targetId: enemy.combatantId,
      targetIds: [],
      abilityId: 'fireball',
      itemId: null,
    }

    const result = executeAction(battle, action)
    expect(result.message).toContain('recharging')
    expect(result.message).toContain('2')
    expect(result.damage).toBe(0)
  })

  it('allows ability use when not on cooldown', () => {
    const player = createCombatantFromPlayer('Hero', makeStats({ currentMp: 50 }), [fireballAbility])
    const enemy = createCombatantFromEnemy('Slime', makeStats(), 'neutral', [tackleAbility])
    const battle = createBattle([player], [enemy])

    const action: BattleAction = {
      type: 'ability',
      actorId: player.combatantId,
      targetId: enemy.combatantId,
      targetIds: [],
      abilityId: 'fireball',
      itemId: null,
    }

    const result = executeAction(battle, action)
    expect(result.damage).toBeGreaterThan(0)
  })

  it('starts cooldown after successful ability use', () => {
    const player = createCombatantFromPlayer('Hero', makeStats({ currentMp: 50 }), [fireballAbility])
    const enemy = createCombatantFromEnemy('Slime', makeStats(), 'neutral', [tackleAbility])
    const battle = createBattle([player], [enemy])

    const action: BattleAction = {
      type: 'ability',
      actorId: player.combatantId,
      targetId: enemy.combatantId,
      targetIds: [],
      abilityId: 'fireball',
      itemId: null,
    }

    const result = executeAction(battle, action)
    const updatedPlayer = result.battle.playerSquad[0]
    expect(updatedPlayer.cooldowns).toHaveLength(1)
    expect(updatedPlayer.cooldowns[0].abilityId).toBe('fireball')
    expect(updatedPlayer.cooldowns[0].turnsRemaining).toBe(2)
  })

  it('does not start cooldown for abilities with cooldownTurns 0', () => {
    const player = createCombatantFromPlayer('Hero', makeStats({ currentMp: 50 }), [tackleAbility, fireAbility])
    const enemy = createCombatantFromEnemy('Slime', makeStats(), 'neutral', [tackleAbility])
    const battle = createBattle([player], [enemy])

    const action: BattleAction = {
      type: 'ability',
      actorId: player.combatantId,
      targetId: enemy.combatantId,
      targetIds: [],
      abilityId: 'ember',
      itemId: null,
    }

    const result = executeAction(battle, action)
    const updatedPlayer = result.battle.playerSquad[0]
    expect(updatedPlayer.cooldowns).toHaveLength(0)
  })
})

describe('Ability Cooldowns - createCombatantFromPlayer', () => {
  it('initializes with empty cooldowns array', () => {
    const combatant = createCombatantFromPlayer('Hero', makeStats(), [tackleAbility])
    expect(combatant.cooldowns).toEqual([])
  })
})

describe('Ability Cooldowns - createCombatantFromEnemy', () => {
  it('initializes with empty cooldowns array', () => {
    const combatant = createCombatantFromEnemy('Slime', makeStats(), 'neutral', [tackleAbility])
    expect(combatant.cooldowns).toEqual([])
  })
})

describe('Ability Cooldowns - enemy AI respects cooldowns', () => {
  it('enemy AI does not use abilities on cooldown', () => {
    const player = createCombatantFromPlayer('Hero', makeStats(), [tackleAbility])
    const enemy: BattleCombatant = {
      ...createCombatantFromEnemy('Slime', makeStats({ currentMp: 50 }), 'neutral', [healAbility, tackleAbility]),
      stats: { ...makeStats({ currentMp: 50, currentHp: 10 }) }, // Low HP to trigger heal priority
      cooldowns: [{ abilityId: 'heal', turnsRemaining: 2 }],
    }
    const battle = createBattle([player], [enemy])

    // Run multiple times to verify heal is never used when on cooldown
    let usedHeal = false
    for (let i = 0; i < 50; i++) {
      const action = getEnemyAction(battle, battle.enemySquad[0])
      if (action.type === 'ability' && action.abilityId === 'heal') {
        usedHeal = true
        break
      }
    }
    expect(usedHeal).toBe(false)
  })
})
