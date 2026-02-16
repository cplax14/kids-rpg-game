import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock EventBus to prevent Phaser dependency
vi.mock('../../../src/events/EventBus', () => ({
  EventBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}))
import {
  calculatePaidRecovery,
  calculateFreeRecovery,
  generateRecoveryPreview,
  applyRecovery,
  RECOVERY_CONSTANTS,
  hasExtraMonstersToLose,
  hasConsumableItemsToLose,
} from '../../../src/systems/RecoverySystem'
import type { GameState } from '../../../src/systems/GameStateManager'
import type { MonsterInstance, Inventory, PlayerCharacter, Item } from '../../../src/models/types'
import { createEmptyGearSlots } from '../../../src/systems/MonsterGearSystem'

// Test data factories
const createTestItem = (id: string, category: 'consumable' | 'key_item' = 'consumable'): Item => ({
  itemId: id,
  name: `Test ${id}`,
  description: 'A test item',
  category,
  iconKey: 'test-icon',
  stackable: true,
  maxStack: 99,
  useEffect: null,
  buyPrice: 100,
  sellPrice: 50,
})

const createTestMonster = (id: string, level: number = 5): MonsterInstance => ({
  instanceId: id,
  speciesId: 'test-species',
  nickname: null,
  level,
  experience: 0,
  stats: {
    maxHp: 100,
    currentHp: 0, // Defeated
    maxMp: 50,
    currentMp: 0,
    attack: 20,
    defense: 15,
    magicAttack: 18,
    magicDefense: 12,
    speed: 10,
    luck: 5,
  },
  learnedAbilities: [],
  inheritedTraits: [],
  parentSpeciesIds: [],
  isInSquad: true,
  capturedAt: new Date().toISOString(),
  bondLevel: 0,
  generation: 0,
  inheritedStatBonus: {},
  legacyAbilities: [],
  isPerfect: false,
  equippedGear: createEmptyGearSlots(),
})

const createTestPlayer = (gold: number = 100): PlayerCharacter => ({
  id: 'test-player',
  name: 'Test Player',
  level: 5,
  experience: 0,
  experienceToNextLevel: 100,
  stats: {
    maxHp: 100,
    currentHp: 0, // Defeated
    maxMp: 50,
    currentMp: 0,
    attack: 20,
    defense: 15,
    magicAttack: 18,
    magicDefense: 12,
    speed: 10,
    luck: 5,
  },
  equipment: {
    weapon: null,
    armor: null,
    helmet: null,
    accessory: null,
  },
  position: { x: 500, y: 500 },
  currentAreaId: 'whispering-forest',
  gold,
})

const createTestInventory = (itemCount: number = 4): Inventory => ({
  items: Array.from({ length: itemCount }, (_, i) => ({
    item: createTestItem(`potion-${i}`),
    quantity: 5,
  })),
  maxSlots: 30,
  equipment: [],
})

const createTestState = (options?: {
  gold?: number
  squadSize?: number
  itemCount?: number
}): GameState => {
  const squadSize = options?.squadSize ?? 3
  return {
    player: createTestPlayer(options?.gold ?? 100),
    inventory: createTestInventory(options?.itemCount ?? 4),
    squad: Array.from({ length: squadSize }, (_, i) =>
      createTestMonster(`monster-${i}`, 5 + i),
    ),
    monsterStorage: [],
    discoveredSpecies: [],
    visitedAreas: ['sunlit-village', 'whispering-forest'],
    currentAreaId: 'whispering-forest',
    defeatedBosses: [],
    openedChests: [],
    activeQuests: [],
    completedQuestIds: [],
    achievements: [],
    achievementStats: {
      battlesWon: 5,
      monstersDefeated: 20,
      monstersCaptured: 3,
      goldEarned: 500,
      questsCompleted: 1,
      bossesDefeated: 0,
      areasVisited: 2,
      speciesDiscovered: 5,
      monstersBreed: 0,
      highestPlayerLevel: 5,
    },
  }
}

describe('RecoverySystem', () => {
  describe('calculatePaidRecovery', () => {
    it('should cost 25% of current gold', () => {
      const state = createTestState({ gold: 100 })
      const penalty = calculatePaidRecovery(state)

      expect(penalty.goldCost).toBe(25) // 25% of 100
    })

    it('should round down gold cost', () => {
      const state = createTestState({ gold: 99 })
      const penalty = calculatePaidRecovery(state)

      expect(penalty.goldCost).toBe(24) // floor(99 * 0.25) = 24
    })

    it('should not lose any items', () => {
      const state = createTestState()
      const penalty = calculatePaidRecovery(state)

      expect(penalty.itemsToLose).toHaveLength(0)
    })

    it('should not lose any monsters', () => {
      const state = createTestState()
      const penalty = calculatePaidRecovery(state)

      expect(penalty.monstersToLose).toHaveLength(0)
    })

    it('should restore full HP', () => {
      const state = createTestState()
      const penalty = calculatePaidRecovery(state)

      expect(penalty.hpRestorePercent).toBe(1.0)
    })
  })

  describe('calculateFreeRecovery', () => {
    it('should cost no gold', () => {
      const state = createTestState({ gold: 1000 })
      const penalty = calculateFreeRecovery(state, 12345)

      expect(penalty.goldCost).toBe(0)
    })

    it('should select half of consumable items to lose', () => {
      const state = createTestState({ itemCount: 4 })
      const penalty = calculateFreeRecovery(state, 12345)

      // 4 items, lose half = 2 items
      expect(penalty.itemsToLose.length).toBe(2)
    })

    it('should never select the first monster (starter) to lose', () => {
      const state = createTestState({ squadSize: 4 })
      const penalty = calculateFreeRecovery(state, 12345)

      // First monster is monster-0, should never be in the loss list
      expect(penalty.monstersToLose).not.toContain('monster-0')
    })

    it('should select half of non-starter monsters to lose', () => {
      const state = createTestState({ squadSize: 5 }) // 5 monsters: 1 starter + 4 others
      const penalty = calculateFreeRecovery(state, 12345)

      // 4 non-starter monsters, lose half = 2 monsters
      expect(penalty.monstersToLose.length).toBe(2)
    })

    it('should lose no monsters if only starter remains', () => {
      const state = createTestState({ squadSize: 1 })
      const penalty = calculateFreeRecovery(state, 12345)

      expect(penalty.monstersToLose).toHaveLength(0)
    })

    it('should restore only 10% HP', () => {
      const state = createTestState()
      const penalty = calculateFreeRecovery(state, 12345)

      expect(penalty.hpRestorePercent).toBe(RECOVERY_CONSTANTS.FREE_HP_RESTORE_PERCENT)
    })

    it('should be deterministic with same seed', () => {
      const state = createTestState({ squadSize: 5, itemCount: 6 })
      const seed = 99999

      const penalty1 = calculateFreeRecovery(state, seed)
      const penalty2 = calculateFreeRecovery(state, seed)

      expect(penalty1.itemsToLose).toEqual(penalty2.itemsToLose)
      expect(penalty1.monstersToLose).toEqual(penalty2.monstersToLose)
    })

    it('should produce different results with different seeds', () => {
      const state = createTestState({ squadSize: 5, itemCount: 6 })

      const penalty1 = calculateFreeRecovery(state, 11111)
      const penalty2 = calculateFreeRecovery(state, 22222)

      // With different seeds, at least one thing should differ
      // (statistically, both should differ, but we check at least one)
      const itemsDiffer = JSON.stringify(penalty1.itemsToLose) !== JSON.stringify(penalty2.itemsToLose)
      const monstersDiffer = JSON.stringify(penalty1.monstersToLose) !== JSON.stringify(penalty2.monstersToLose)

      expect(itemsDiffer || monstersDiffer).toBe(true)
    })
  })

  describe('generateRecoveryPreview', () => {
    it('should include both recovery options', () => {
      const state = createTestState()
      const preview = generateRecoveryPreview(state, 12345)

      expect(preview.paid).toBeDefined()
      expect(preview.free).toBeDefined()
    })

    it('should indicate if player can afford paid recovery', () => {
      const richState = createTestState({ gold: 1000 })
      const richPreview = generateRecoveryPreview(richState, 12345)
      expect(richPreview.canAffordPaid).toBe(true)

      const poorState = createTestState({ gold: 0 })
      const poorPreview = generateRecoveryPreview(poorState, 12345)
      expect(poorPreview.canAffordPaid).toBe(true) // 25% of 0 is 0, which is affordable
    })

    it('should include current gold amount', () => {
      const state = createTestState({ gold: 500 })
      const preview = generateRecoveryPreview(state, 12345)

      expect(preview.currentGold).toBe(500)
    })
  })

  describe('applyRecovery', () => {
    describe('paid recovery', () => {
      it('should deduct 25% gold', () => {
        const state = createTestState({ gold: 100 })
        const result = applyRecovery(state, 'paid', 12345)

        expect(result.player.gold).toBe(75)
      })

      it('should keep all items', () => {
        const state = createTestState({ itemCount: 4 })
        const result = applyRecovery(state, 'paid', 12345)

        expect(result.inventory.items).toHaveLength(4)
      })

      it('should keep all monsters', () => {
        const state = createTestState({ squadSize: 4 })
        const result = applyRecovery(state, 'paid', 12345)

        expect(result.squad).toHaveLength(4)
      })

      it('should restore full HP to all monsters', () => {
        const state = createTestState({ squadSize: 2 })
        const result = applyRecovery(state, 'paid', 12345)

        result.squad.forEach((monster) => {
          expect(monster.stats.currentHp).toBe(monster.stats.maxHp)
        })
      })

      it('should set spawn area to Sunlit Village', () => {
        const state = createTestState()
        const result = applyRecovery(state, 'paid', 12345)

        expect(result.currentAreaId).toBe(RECOVERY_CONSTANTS.SPAWN_AREA_ID)
        expect(result.player.currentAreaId).toBe(RECOVERY_CONSTANTS.SPAWN_AREA_ID)
      })
    })

    describe('free recovery', () => {
      it('should not deduct any gold', () => {
        const state = createTestState({ gold: 100 })
        const result = applyRecovery(state, 'free', 12345)

        expect(result.player.gold).toBe(100)
      })

      it('should remove lost items from inventory', () => {
        const state = createTestState({ itemCount: 4 })
        const result = applyRecovery(state, 'free', 12345)

        // Should have fewer total item quantity
        const originalQuantity = state.inventory.items.reduce((sum, slot) => sum + slot.quantity, 0)
        const newQuantity = result.inventory.items.reduce((sum, slot) => sum + slot.quantity, 0)
        expect(newQuantity).toBeLessThan(originalQuantity)
      })

      it('should remove lost monsters from squad', () => {
        const state = createTestState({ squadSize: 5 })
        const result = applyRecovery(state, 'free', 12345)

        // Should have fewer monsters
        expect(result.squad.length).toBeLessThan(5)
      })

      it('should never remove the starter monster', () => {
        const state = createTestState({ squadSize: 4 })
        const result = applyRecovery(state, 'free', 12345)

        // First monster (monster-0) should still be present
        expect(result.squad.find((m) => m.instanceId === 'monster-0')).toBeDefined()
      })

      it('should restore 10% HP (minimum 1)', () => {
        const state = createTestState({ squadSize: 2 })
        const result = applyRecovery(state, 'free', 12345)

        result.squad.forEach((monster) => {
          const expectedHp = Math.max(1, Math.floor(monster.stats.maxHp * 0.1))
          expect(monster.stats.currentHp).toBe(expectedHp)
        })
      })

      it('should set spawn area to Sunlit Village', () => {
        const state = createTestState()
        const result = applyRecovery(state, 'free', 12345)

        expect(result.currentAreaId).toBe(RECOVERY_CONSTANTS.SPAWN_AREA_ID)
      })
    })

    it('should return immutable new state', () => {
      const state = createTestState()
      const result = applyRecovery(state, 'paid', 12345)

      expect(result).not.toBe(state)
      expect(result.player).not.toBe(state.player)
      expect(result.inventory).not.toBe(state.inventory)
      expect(result.squad).not.toBe(state.squad)
    })
  })

  describe('helper functions', () => {
    describe('hasExtraMonstersToLose', () => {
      it('should return true when squad has more than starter', () => {
        const squad = [createTestMonster('m1'), createTestMonster('m2')]
        expect(hasExtraMonstersToLose(squad)).toBe(true)
      })

      it('should return false when squad only has starter', () => {
        const squad = [createTestMonster('m1')]
        expect(hasExtraMonstersToLose(squad)).toBe(false)
      })

      it('should return false for empty squad', () => {
        expect(hasExtraMonstersToLose([])).toBe(false)
      })
    })

    describe('hasConsumableItemsToLose', () => {
      it('should return true when inventory has consumables', () => {
        const inventory = createTestInventory(3)
        expect(hasConsumableItemsToLose(inventory)).toBe(true)
      })

      it('should return false when inventory is empty', () => {
        const inventory: Inventory = { items: [], maxSlots: 30, equipment: [] }
        expect(hasConsumableItemsToLose(inventory)).toBe(false)
      })

      it('should return false when only key items exist', () => {
        const inventory: Inventory = {
          items: [{ item: createTestItem('key-item', 'key_item'), quantity: 1 }],
          maxSlots: 30,
          equipment: [],
        }
        expect(hasConsumableItemsToLose(inventory)).toBe(false)
      })
    })
  })
})
