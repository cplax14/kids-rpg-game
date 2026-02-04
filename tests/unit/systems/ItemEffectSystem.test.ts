import { describe, it, expect } from 'vitest'
import {
  useItemOnCombatant,
  useItemOnPlayer,
} from '../../../src/systems/ItemEffectSystem'
import type {
  Item,
  BattleCombatant,
  PlayerCharacter,
  CharacterStats,
  ActiveStatusEffect,
  Ability,
} from '../../../src/models/types'

// ── Helpers ──

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

function makeCombatant(overrides?: Partial<BattleCombatant>): BattleCombatant {
  return {
    combatantId: 'combatant-1',
    name: 'Hero',
    isPlayer: true,
    isMonster: false,
    stats: makeStats(),
    abilities: [],
    statusEffects: [],
    capturable: false,
    ...overrides,
  }
}

function makePlayer(overrides?: Partial<PlayerCharacter>): PlayerCharacter {
  return {
    id: 'player-1',
    name: 'Adventurer',
    level: 5,
    experience: 100,
    experienceToNextLevel: 200,
    stats: makeStats(),
    equipment: {
      weapon: null,
      armor: null,
      helmet: null,
      accessory: null,
    },
    position: { x: 0, y: 0 },
    currentAreaId: 'village',
    gold: 500,
    ...overrides,
  }
}

function makeItem(overrides?: Partial<Item>): Item {
  return {
    itemId: 'potion-small',
    name: 'Small Potion',
    description: 'Heals a small amount of HP.',
    category: 'consumable',
    iconKey: 'potion',
    stackable: true,
    maxStack: 99,
    useEffect: null,
    buyPrice: 50,
    sellPrice: 25,
    ...overrides,
  }
}

// ── useItemOnCombatant ──

describe('useItemOnCombatant', () => {
  describe('no effect', () => {
    it('should return failure when item has no useEffect', () => {
      const item = makeItem({ useEffect: null })
      const target = makeCombatant()

      const { combatant, result } = useItemOnCombatant(item, target)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Small Potion has no effect.')
      expect(combatant).toBe(target)
    })

    it('should return failure for an unknown effect type', () => {
      const item = makeItem({
        useEffect: {
          type: 'capture_boost' as any,
          magnitude: 10,
          targetType: 'self',
        },
      })
      const target = makeCombatant()

      const { result } = useItemOnCombatant(item, target)

      expect(result.success).toBe(false)
      expect(result.message).toContain('cannot be used in battle')
    })
  })

  describe('heal_hp', () => {
    it('should heal the combatant HP up to max', () => {
      const item = makeItem({
        useEffect: { type: 'heal_hp', magnitude: 30, targetType: 'single_ally' },
      })
      const target = makeCombatant({ stats: makeStats({ currentHp: 60 }) })

      const { combatant, result } = useItemOnCombatant(item, target)

      expect(result.success).toBe(true)
      expect(result.healAmount).toBe(30)
      expect(combatant.stats.currentHp).toBe(90)
      expect(result.message).toBe('Hero recovered 30 HP!')
    })

    it('should cap healing at maxHp', () => {
      const item = makeItem({
        useEffect: { type: 'heal_hp', magnitude: 50, targetType: 'single_ally' },
      })
      const target = makeCombatant({ stats: makeStats({ currentHp: 80, maxHp: 100 }) })

      const { combatant, result } = useItemOnCombatant(item, target)

      expect(combatant.stats.currentHp).toBe(100)
      expect(result.healAmount).toBe(20)
    })

    it('should not mutate the original combatant', () => {
      const item = makeItem({
        useEffect: { type: 'heal_hp', magnitude: 10, targetType: 'single_ally' },
      })
      const target = makeCombatant({ stats: makeStats({ currentHp: 50 }) })

      const { combatant } = useItemOnCombatant(item, target)

      expect(target.stats.currentHp).toBe(50)
      expect(combatant.stats.currentHp).toBe(60)
    })
  })

  describe('heal_mp', () => {
    it('should heal the combatant MP up to max', () => {
      const item = makeItem({
        useEffect: { type: 'heal_mp', magnitude: 20, targetType: 'single_ally' },
      })
      const target = makeCombatant({ stats: makeStats({ currentMp: 10, maxMp: 50 }) })

      const { combatant, result } = useItemOnCombatant(item, target)

      expect(result.success).toBe(true)
      expect(result.healAmount).toBe(20)
      expect(combatant.stats.currentMp).toBe(30)
    })

    it('should cap MP healing at maxMp', () => {
      const item = makeItem({
        useEffect: { type: 'heal_mp', magnitude: 100, targetType: 'single_ally' },
      })
      const target = makeCombatant({ stats: makeStats({ currentMp: 40, maxMp: 50 }) })

      const { combatant, result } = useItemOnCombatant(item, target)

      expect(combatant.stats.currentMp).toBe(50)
      expect(result.healAmount).toBe(10)
    })
  })

  describe('cure_status', () => {
    const poisonEffect: ActiveStatusEffect = {
      effect: { id: 'poison', name: 'Poison', type: 'poison', duration: 3, magnitude: 5 },
      turnsRemaining: 3,
      appliedBy: 'enemy-1',
    }

    const sleepEffect: ActiveStatusEffect = {
      effect: { id: 'sleep', name: 'Sleep', type: 'sleep', duration: 2, magnitude: 0 },
      turnsRemaining: 2,
      appliedBy: 'enemy-1',
    }

    it('should return failure when combatant has no status effects', () => {
      const item = makeItem({
        useEffect: { type: 'cure_status', magnitude: 0, targetType: 'single_ally' },
      })
      const target = makeCombatant({ statusEffects: [] })

      const { result } = useItemOnCombatant(item, target)

      expect(result.success).toBe(false)
      expect(result.message).toContain('no status effects to cure')
    })

    it('should cure poison specifically with magnitude 0', () => {
      const item = makeItem({
        useEffect: { type: 'cure_status', magnitude: 0, targetType: 'single_ally' },
      })
      const target = makeCombatant({ statusEffects: [poisonEffect, sleepEffect] })

      const { combatant, result } = useItemOnCombatant(item, target)

      expect(result.success).toBe(true)
      expect(result.statusCured).toBe('Poison')
      expect(combatant.statusEffects).toHaveLength(1)
      expect(combatant.statusEffects[0].effect.type).toBe('sleep')
    })

    it('should cure sleep specifically with magnitude 1', () => {
      const item = makeItem({
        useEffect: { type: 'cure_status', magnitude: 1, targetType: 'single_ally' },
      })
      const target = makeCombatant({ statusEffects: [poisonEffect, sleepEffect] })

      const { combatant, result } = useItemOnCombatant(item, target)

      expect(result.success).toBe(true)
      expect(result.statusCured).toBe('Sleep')
      expect(combatant.statusEffects).toHaveLength(1)
      expect(combatant.statusEffects[0].effect.type).toBe('poison')
    })

    it('should cure all status effects with magnitude >= 99', () => {
      const item = makeItem({
        useEffect: { type: 'cure_status', magnitude: 99, targetType: 'single_ally' },
      })
      const target = makeCombatant({ statusEffects: [poisonEffect, sleepEffect] })

      const { combatant, result } = useItemOnCombatant(item, target)

      expect(result.success).toBe(true)
      expect(result.statusCured).toBe('all status effects')
      expect(combatant.statusEffects).toHaveLength(0)
    })
  })

  describe('buff', () => {
    it('should apply attack_up buff by default', () => {
      const item = makeItem({
        itemId: 'power-seed',
        name: 'Power Seed',
        useEffect: { type: 'buff', magnitude: 10, targetType: 'single_ally' },
      })
      const target = makeCombatant()

      const { combatant, result } = useItemOnCombatant(item, target)

      expect(result.success).toBe(true)
      expect(result.buffApplied).toBe('Attack Up')
      expect(combatant.statusEffects).toHaveLength(1)
      expect(combatant.statusEffects[0].effect.type).toBe('attack_up')
      expect(combatant.statusEffects[0].turnsRemaining).toBe(5)
    })

    it('should apply defense_up buff for shield/defense items', () => {
      const item = makeItem({
        itemId: 'shield-potion',
        name: 'Shield Potion',
        useEffect: { type: 'buff', magnitude: 10, targetType: 'single_ally' },
      })
      const target = makeCombatant()

      const { combatant, result } = useItemOnCombatant(item, target)

      expect(result.success).toBe(true)
      expect(result.buffApplied).toBe('Defense Up')
      expect(combatant.statusEffects[0].effect.type).toBe('defense_up')
    })

    it('should apply haste buff for speed/haste items', () => {
      const item = makeItem({
        itemId: 'speed-berry',
        name: 'Speed Berry',
        useEffect: { type: 'buff', magnitude: 5, targetType: 'single_ally' },
      })
      const target = makeCombatant()

      const { combatant, result } = useItemOnCombatant(item, target)

      expect(result.success).toBe(true)
      expect(result.buffApplied).toBe('Haste')
      expect(combatant.statusEffects[0].effect.type).toBe('haste')
    })

    it('should not mutate existing status effects array', () => {
      const item = makeItem({
        itemId: 'power-seed',
        name: 'Power Seed',
        useEffect: { type: 'buff', magnitude: 10, targetType: 'single_ally' },
      })
      const target = makeCombatant({ statusEffects: [] })

      const { combatant } = useItemOnCombatant(item, target)

      expect(target.statusEffects).toHaveLength(0)
      expect(combatant.statusEffects).toHaveLength(1)
    })
  })
})

// ── useItemOnPlayer ──

describe('useItemOnPlayer', () => {
  describe('no effect', () => {
    it('should return failure when item has no useEffect', () => {
      const item = makeItem({ useEffect: null })
      const player = makePlayer()

      const { player: updatedPlayer, result } = useItemOnPlayer(item, player)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Small Potion has no effect.')
      expect(updatedPlayer).toBe(player)
    })
  })

  describe('non-applicable effect', () => {
    it('should return failure for buff effect type outside battle', () => {
      const item = makeItem({
        useEffect: { type: 'buff', magnitude: 10, targetType: 'self' },
      })
      const player = makePlayer()

      const { result } = useItemOnPlayer(item, player)

      expect(result.success).toBe(false)
      expect(result.message).toContain('cannot be used here')
    })

    it('should return failure for cure_status effect type outside battle', () => {
      const item = makeItem({
        useEffect: { type: 'cure_status', magnitude: 0, targetType: 'self' },
      })
      const player = makePlayer()

      const { result } = useItemOnPlayer(item, player)

      expect(result.success).toBe(false)
      expect(result.message).toContain('cannot be used here')
    })
  })

  describe('heal_hp', () => {
    it('should heal the player HP', () => {
      const item = makeItem({
        useEffect: { type: 'heal_hp', magnitude: 40, targetType: 'self' },
      })
      const player = makePlayer({ stats: makeStats({ currentHp: 50 }) })

      const { player: updatedPlayer, result } = useItemOnPlayer(item, player)

      expect(result.success).toBe(true)
      expect(result.healAmount).toBe(40)
      expect(updatedPlayer.stats.currentHp).toBe(90)
      expect(result.message).toBe('Adventurer recovered 40 HP!')
    })

    it('should cap healing at maxHp', () => {
      const item = makeItem({
        useEffect: { type: 'heal_hp', magnitude: 200, targetType: 'self' },
      })
      const player = makePlayer({ stats: makeStats({ currentHp: 80, maxHp: 100 }) })

      const { player: updatedPlayer, result } = useItemOnPlayer(item, player)

      expect(updatedPlayer.stats.currentHp).toBe(100)
      expect(result.healAmount).toBe(20)
    })

    it('should not mutate the original player', () => {
      const item = makeItem({
        useEffect: { type: 'heal_hp', magnitude: 10, targetType: 'self' },
      })
      const player = makePlayer({ stats: makeStats({ currentHp: 50 }) })

      const { player: updatedPlayer } = useItemOnPlayer(item, player)

      expect(player.stats.currentHp).toBe(50)
      expect(updatedPlayer.stats.currentHp).toBe(60)
    })
  })

  describe('heal_mp', () => {
    it('should heal the player MP', () => {
      const item = makeItem({
        useEffect: { type: 'heal_mp', magnitude: 15, targetType: 'self' },
      })
      const player = makePlayer({ stats: makeStats({ currentMp: 20, maxMp: 50 }) })

      const { player: updatedPlayer, result } = useItemOnPlayer(item, player)

      expect(result.success).toBe(true)
      expect(result.healAmount).toBe(15)
      expect(updatedPlayer.stats.currentMp).toBe(35)
    })

    it('should cap MP healing at maxMp', () => {
      const item = makeItem({
        useEffect: { type: 'heal_mp', magnitude: 100, targetType: 'self' },
      })
      const player = makePlayer({ stats: makeStats({ currentMp: 45, maxMp: 50 }) })

      const { player: updatedPlayer, result } = useItemOnPlayer(item, player)

      expect(updatedPlayer.stats.currentMp).toBe(50)
      expect(result.healAmount).toBe(5)
    })
  })
})
