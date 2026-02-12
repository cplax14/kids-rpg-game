import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getValidTargets,
  resolveTargets,
  getAdjacentEnemies,
  getRandomEnemies,
  isValidTarget,
  requiresTargetSelection,
  getTargetCount,
  getMultiTargetDamageMultiplier,
} from '../../../src/systems/TargetingSystem'
import type { Battle, BattleCombatant, CharacterStats } from '../../../src/models/types'

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

function makeCombatant(
  id: string,
  isPlayer: boolean,
  overrides?: Partial<BattleCombatant>,
): BattleCombatant {
  return {
    combatantId: id,
    name: `Combatant ${id}`,
    isPlayer,
    isMonster: true,
    stats: makeStats(overrides?.stats),
    abilities: [],
    statusEffects: [],
    capturable: !isPlayer,
    ...overrides,
  }
}

function makeBattle(
  playerSquad: BattleCombatant[],
  enemySquad: BattleCombatant[],
): Battle {
  return {
    state: 'player_turn',
    turnOrder: [...playerSquad, ...enemySquad],
    currentTurnIndex: 0,
    playerSquad,
    enemySquad,
    turnCount: 1,
    canFlee: true,
    backgroundKey: 'battle-bg-forest',
    rewards: null,
  }
}

describe('TargetingSystem', () => {
  let player1: BattleCombatant
  let player2: BattleCombatant
  let player3: BattleCombatant
  let enemy1: BattleCombatant
  let enemy2: BattleCombatant
  let enemy3: BattleCombatant
  let battle: Battle

  beforeEach(() => {
    player1 = makeCombatant('player-1', true, { name: 'Hero' })
    player2 = makeCombatant('player-2', true, { name: 'Ally 1' })
    player3 = makeCombatant('player-3', true, { name: 'Ally 2' })
    enemy1 = makeCombatant('enemy-1', false, { name: 'Slime A' })
    enemy2 = makeCombatant('enemy-2', false, { name: 'Slime B' })
    enemy3 = makeCombatant('enemy-3', false, { name: 'Slime C' })

    battle = makeBattle(
      [player1, player2, player3],
      [enemy1, enemy2, enemy3],
    )
  })

  describe('getValidTargets', () => {
    it('returns all alive enemies for single_enemy', () => {
      const targets = getValidTargets(battle, player1.combatantId, 'single_enemy')
      expect(targets).toHaveLength(3)
      expect(targets.map((t) => t.combatantId)).toContain('enemy-1')
      expect(targets.map((t) => t.combatantId)).toContain('enemy-2')
      expect(targets.map((t) => t.combatantId)).toContain('enemy-3')
    })

    it('excludes dead enemies from single_enemy', () => {
      const deadEnemy = makeCombatant('enemy-1', false, {
        stats: makeStats({ currentHp: 0 }),
      })
      battle = makeBattle([player1], [deadEnemy, enemy2, enemy3])

      const targets = getValidTargets(battle, player1.combatantId, 'single_enemy')
      expect(targets).toHaveLength(2)
      expect(targets.map((t) => t.combatantId)).not.toContain('enemy-1')
    })

    it('returns empty array for all_enemies (auto-targeted)', () => {
      const targets = getValidTargets(battle, player1.combatantId, 'all_enemies')
      expect(targets).toHaveLength(0)
    })

    it('returns actor only for self', () => {
      const targets = getValidTargets(battle, player1.combatantId, 'self')
      expect(targets).toHaveLength(1)
      expect(targets[0].combatantId).toBe('player-1')
    })

    it('returns alive allies for single_ally', () => {
      const targets = getValidTargets(battle, player1.combatantId, 'single_ally')
      expect(targets).toHaveLength(3)
      expect(targets.map((t) => t.combatantId)).toContain('player-1')
      expect(targets.map((t) => t.combatantId)).toContain('player-2')
      expect(targets.map((t) => t.combatantId)).toContain('player-3')
    })

    it('returns enemies for player using adjacent_enemies', () => {
      const targets = getValidTargets(battle, player1.combatantId, 'adjacent_enemies')
      expect(targets).toHaveLength(3)
    })

    it('returns player squad as targets when enemy actor uses single_enemy', () => {
      const targets = getValidTargets(battle, enemy1.combatantId, 'single_enemy')
      expect(targets).toHaveLength(3)
      expect(targets.map((t) => t.combatantId)).toContain('player-1')
      expect(targets.map((t) => t.combatantId)).toContain('player-2')
      expect(targets.map((t) => t.combatantId)).toContain('player-3')
    })

    it('returns empty array for unknown actor', () => {
      const targets = getValidTargets(battle, 'unknown-id', 'single_enemy')
      expect(targets).toHaveLength(0)
    })
  })

  describe('resolveTargets', () => {
    it('returns single target for single_enemy', () => {
      const targets = resolveTargets(battle, 'single_enemy', 'enemy-2', player1.combatantId)
      expect(targets).toEqual(['enemy-2'])
    })

    it('falls back to first enemy for single_enemy with no target', () => {
      const targets = resolveTargets(battle, 'single_enemy', null, player1.combatantId)
      expect(targets).toHaveLength(1)
      expect(targets[0]).toBe('enemy-1')
    })

    it('returns all enemies for all_enemies', () => {
      const targets = resolveTargets(battle, 'all_enemies', null, player1.combatantId)
      expect(targets).toHaveLength(3)
      expect(targets).toContain('enemy-1')
      expect(targets).toContain('enemy-2')
      expect(targets).toContain('enemy-3')
    })

    it('returns actor id for self', () => {
      const targets = resolveTargets(battle, 'self', null, player1.combatantId)
      expect(targets).toEqual(['player-1'])
    })

    it('returns all allies for all_allies', () => {
      const targets = resolveTargets(battle, 'all_allies', null, player1.combatantId)
      expect(targets).toHaveLength(3)
      expect(targets).toContain('player-1')
      expect(targets).toContain('player-2')
      expect(targets).toContain('player-3')
    })

    it('returns single target for single_ally', () => {
      const targets = resolveTargets(battle, 'single_ally', 'player-2', player1.combatantId)
      expect(targets).toEqual(['player-2'])
    })

    it('returns empty array for single_ally with no target', () => {
      const targets = resolveTargets(battle, 'single_ally', null, player1.combatantId)
      expect(targets).toEqual([])
    })
  })

  describe('getAdjacentEnemies', () => {
    it('returns primary target plus adjacent for middle target', () => {
      const targets = getAdjacentEnemies(battle, 'enemy-2', true)
      expect(targets).toHaveLength(3)
      expect(targets).toContain('enemy-1')
      expect(targets).toContain('enemy-2')
      expect(targets).toContain('enemy-3')
    })

    it('returns primary plus one for first target', () => {
      const targets = getAdjacentEnemies(battle, 'enemy-1', true)
      expect(targets).toHaveLength(2)
      expect(targets).toContain('enemy-1')
      expect(targets).toContain('enemy-2')
    })

    it('returns primary plus one for last target', () => {
      const targets = getAdjacentEnemies(battle, 'enemy-3', true)
      expect(targets).toHaveLength(2)
      expect(targets).toContain('enemy-2')
      expect(targets).toContain('enemy-3')
    })

    it('returns only primary when single enemy', () => {
      const singleEnemyBattle = makeBattle([player1], [enemy1])
      const targets = getAdjacentEnemies(singleEnemyBattle, 'enemy-1', true)
      expect(targets).toHaveLength(1)
      expect(targets).toContain('enemy-1')
    })

    it('excludes dead enemies from adjacency', () => {
      const deadEnemy2 = makeCombatant('enemy-2', false, {
        stats: makeStats({ currentHp: 0 }),
      })
      battle = makeBattle([player1], [enemy1, deadEnemy2, enemy3])

      const targets = getAdjacentEnemies(battle, 'enemy-1', true)
      // enemy-1 is alive, enemy-2 is dead (skipped in alive list), enemy-3 is adjacent to enemy-1 now
      expect(targets).toHaveLength(2)
      expect(targets).toContain('enemy-1')
      expect(targets).toContain('enemy-3')
    })

    it('falls back to first enemy when no primary specified', () => {
      const targets = getAdjacentEnemies(battle, null, true)
      expect(targets).toContain('enemy-1')
    })

    it('returns empty array when no enemies alive', () => {
      const deadBattle = makeBattle([player1], [
        makeCombatant('enemy-1', false, { stats: makeStats({ currentHp: 0 }) }),
      ])
      const targets = getAdjacentEnemies(deadBattle, 'enemy-1', true)
      expect(targets).toHaveLength(0)
    })
  })

  describe('getRandomEnemies', () => {
    it('returns requested count of enemies', () => {
      const targets = getRandomEnemies(battle, 2, true)
      expect(targets).toHaveLength(2)
      targets.forEach((t) => {
        expect(['enemy-1', 'enemy-2', 'enemy-3']).toContain(t)
      })
    })

    it('returns all enemies when count exceeds available', () => {
      const targets = getRandomEnemies(battle, 5, true)
      expect(targets).toHaveLength(3)
    })

    it('returns empty array when no enemies alive', () => {
      const deadBattle = makeBattle([player1], [
        makeCombatant('enemy-1', false, { stats: makeStats({ currentHp: 0 }) }),
      ])
      const targets = getRandomEnemies(deadBattle, 2, true)
      expect(targets).toHaveLength(0)
    })

    it('excludes dead enemies', () => {
      const deadEnemy = makeCombatant('enemy-2', false, {
        stats: makeStats({ currentHp: 0 }),
      })
      battle = makeBattle([player1], [enemy1, deadEnemy, enemy3])

      const targets = getRandomEnemies(battle, 3, true)
      expect(targets).toHaveLength(2)
      expect(targets).not.toContain('enemy-2')
    })

    it('targets player squad when actor is enemy', () => {
      const targets = getRandomEnemies(battle, 2, false)
      expect(targets).toHaveLength(2)
      targets.forEach((t) => {
        expect(['player-1', 'player-2', 'player-3']).toContain(t)
      })
    })
  })

  describe('isValidTarget', () => {
    it('returns true for valid enemy target', () => {
      expect(isValidTarget(battle, player1.combatantId, 'enemy-1', 'single_enemy')).toBe(true)
    })

    it('returns false for ally as enemy target', () => {
      expect(isValidTarget(battle, player1.combatantId, 'player-2', 'single_enemy')).toBe(false)
    })

    it('returns true for valid ally target', () => {
      expect(isValidTarget(battle, player1.combatantId, 'player-2', 'single_ally')).toBe(true)
    })

    it('returns false for dead target', () => {
      const deadEnemy = makeCombatant('enemy-1', false, {
        stats: makeStats({ currentHp: 0 }),
      })
      battle = makeBattle([player1], [deadEnemy, enemy2])

      expect(isValidTarget(battle, player1.combatantId, 'enemy-1', 'single_enemy')).toBe(false)
    })
  })

  describe('requiresTargetSelection', () => {
    it('returns true for single_enemy', () => {
      expect(requiresTargetSelection('single_enemy')).toBe(true)
    })

    it('returns true for single_ally', () => {
      expect(requiresTargetSelection('single_ally')).toBe(true)
    })

    it('returns true for adjacent_enemies', () => {
      expect(requiresTargetSelection('adjacent_enemies')).toBe(true)
    })

    it('returns false for all_enemies', () => {
      expect(requiresTargetSelection('all_enemies')).toBe(false)
    })

    it('returns false for all_allies', () => {
      expect(requiresTargetSelection('all_allies')).toBe(false)
    })

    it('returns false for self', () => {
      expect(requiresTargetSelection('self')).toBe(false)
    })

    it('returns false for random_enemies_2', () => {
      expect(requiresTargetSelection('random_enemies_2')).toBe(false)
    })

    it('returns false for random_enemies_3', () => {
      expect(requiresTargetSelection('random_enemies_3')).toBe(false)
    })
  })

  describe('getTargetCount', () => {
    it('returns 1 for single_enemy', () => {
      const count = getTargetCount(battle, 'single_enemy', 'enemy-1', player1.combatantId)
      expect(count).toBe(1)
    })

    it('returns 3 for all_enemies with 3 alive', () => {
      const count = getTargetCount(battle, 'all_enemies', null, player1.combatantId)
      expect(count).toBe(3)
    })

    it('returns correct count for adjacent_enemies', () => {
      const count = getTargetCount(battle, 'adjacent_enemies', 'enemy-2', player1.combatantId)
      expect(count).toBe(3)
    })

    it('returns 2 for random_enemies_2', () => {
      const count = getTargetCount(battle, 'random_enemies_2', null, player1.combatantId)
      expect(count).toBe(2)
    })
  })

  describe('getMultiTargetDamageMultiplier', () => {
    it('returns 1.0 for single target', () => {
      expect(getMultiTargetDamageMultiplier(1)).toBe(1.0)
    })

    it('returns 0.75 for 2 targets', () => {
      expect(getMultiTargetDamageMultiplier(2)).toBe(0.75)
    })

    it('returns 0.75 for 3 targets', () => {
      expect(getMultiTargetDamageMultiplier(3)).toBe(0.75)
    })

    it('returns 1.0 for zero targets', () => {
      expect(getMultiTargetDamageMultiplier(0)).toBe(1.0)
    })
  })
})
