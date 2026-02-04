import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  Equipment,
  EquipmentSlot,
  EquipmentSlots,
  PlayerCharacter,
  CharacterStats,
} from '../../../src/models/types'
import {
  loadEquipmentData,
  getEquipment,
  getAllEquipment,
  getEquipmentBySlot,
  equipItem,
  unequipItem,
  calculateEquipmentBonuses,
  applyEquipmentStats,
  compareEquipment,
} from '../../../src/systems/EquipmentSystem'
import { createNewPlayer } from '../../../src/systems/CharacterSystem'

// Mock EventBus to prevent Phaser dependency
vi.mock('../../../src/events/EventBus', () => ({
  EventBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}))

// ── Test Fixtures ──

function makeEquipment(overrides: Partial<Equipment> = {}): Equipment {
  return {
    equipmentId: 'test-sword',
    name: 'Test Sword',
    description: 'A basic sword for testing',
    slot: 'weapon' as EquipmentSlot,
    statModifiers: { attack: 5 },
    levelRequirement: 1,
    iconKey: 'icon-sword',
    buyPrice: 100,
    sellPrice: 50,
    specialEffect: null,
    ...overrides,
  }
}

const woodenSword: Equipment = makeEquipment({
  equipmentId: 'wooden-sword',
  name: 'Wooden Sword',
  slot: 'weapon',
  statModifiers: { attack: 3 },
  levelRequirement: 1,
})

const ironSword: Equipment = makeEquipment({
  equipmentId: 'iron-sword',
  name: 'Iron Sword',
  slot: 'weapon',
  statModifiers: { attack: 8, speed: -1 },
  levelRequirement: 3,
})

const leatherArmor: Equipment = makeEquipment({
  equipmentId: 'leather-armor',
  name: 'Leather Armor',
  slot: 'armor',
  statModifiers: { defense: 4, maxHp: 10 },
  levelRequirement: 1,
})

const ironHelmet: Equipment = makeEquipment({
  equipmentId: 'iron-helmet',
  name: 'Iron Helmet',
  slot: 'helmet',
  statModifiers: { defense: 2, magicDefense: 1 },
  levelRequirement: 2,
})

const luckyCharm: Equipment = makeEquipment({
  equipmentId: 'lucky-charm',
  name: 'Lucky Charm',
  slot: 'accessory',
  statModifiers: { luck: 5, speed: 2 },
  levelRequirement: 1,
})

const legendaryBlade: Equipment = makeEquipment({
  equipmentId: 'legendary-blade',
  name: 'Legendary Blade',
  slot: 'weapon',
  statModifiers: { attack: 25, speed: 5, luck: 3 },
  levelRequirement: 10,
})

const allTestEquipment: ReadonlyArray<Equipment> = [
  woodenSword,
  ironSword,
  leatherArmor,
  ironHelmet,
  luckyCharm,
  legendaryBlade,
]

// ── Tests ──

describe('EquipmentSystem', () => {
  let player: PlayerCharacter

  beforeEach(async () => {
    player = createNewPlayer('TestHero')
    loadEquipmentData(allTestEquipment)

    const { EventBus } = await import('../../../src/events/EventBus')
    vi.mocked(EventBus.emit).mockClear()
  })

  // ── Registry ──

  describe('loadEquipmentData', () => {
    it('loads equipment into the registry', () => {
      loadEquipmentData(allTestEquipment)
      const all = getAllEquipment()
      expect(all).toHaveLength(allTestEquipment.length)
    })

    it('replaces previously loaded equipment data', () => {
      loadEquipmentData([woodenSword])
      expect(getAllEquipment()).toHaveLength(1)

      loadEquipmentData(allTestEquipment)
      expect(getAllEquipment()).toHaveLength(allTestEquipment.length)
    })

    it('accepts an empty array', () => {
      loadEquipmentData([])
      expect(getAllEquipment()).toHaveLength(0)
    })
  })

  describe('getEquipment', () => {
    it('returns equipment by its id', () => {
      const result = getEquipment('wooden-sword')
      expect(result).toBeDefined()
      expect(result?.name).toBe('Wooden Sword')
    })

    it('returns undefined for an unknown id', () => {
      const result = getEquipment('nonexistent-item')
      expect(result).toBeUndefined()
    })

    it('returns the correct equipment when multiple exist', () => {
      const sword = getEquipment('iron-sword')
      const armor = getEquipment('leather-armor')
      expect(sword?.slot).toBe('weapon')
      expect(armor?.slot).toBe('armor')
    })
  })

  describe('getAllEquipment', () => {
    it('returns all registered equipment', () => {
      const all = getAllEquipment()
      expect(all).toHaveLength(allTestEquipment.length)
    })

    it('returns an empty array when no equipment is loaded', () => {
      loadEquipmentData([])
      expect(getAllEquipment()).toHaveLength(0)
    })
  })

  describe('getEquipmentBySlot', () => {
    it('returns only weapons when filtering by weapon slot', () => {
      const weapons = getEquipmentBySlot('weapon')
      expect(weapons.length).toBeGreaterThan(0)
      for (const w of weapons) {
        expect(w.slot).toBe('weapon')
      }
    })

    it('returns only armor when filtering by armor slot', () => {
      const armors = getEquipmentBySlot('armor')
      expect(armors).toHaveLength(1)
      expect(armors[0].equipmentId).toBe('leather-armor')
    })

    it('returns only helmets when filtering by helmet slot', () => {
      const helmets = getEquipmentBySlot('helmet')
      expect(helmets).toHaveLength(1)
      expect(helmets[0].equipmentId).toBe('iron-helmet')
    })

    it('returns only accessories when filtering by accessory slot', () => {
      const accessories = getEquipmentBySlot('accessory')
      expect(accessories).toHaveLength(1)
      expect(accessories[0].equipmentId).toBe('lucky-charm')
    })

    it('returns an empty array for a slot with no equipment', () => {
      loadEquipmentData([woodenSword])
      const helmets = getEquipmentBySlot('helmet')
      expect(helmets).toHaveLength(0)
    })
  })

  // ── Equip / Unequip ──

  describe('equipItem', () => {
    it('equips an item to the correct slot', () => {
      const result = equipItem(player, woodenSword)
      expect(result).not.toBeNull()
      expect(result?.player.equipment.weapon).toEqual(woodenSword)
    })

    it('returns null when player level is below requirement', () => {
      const result = equipItem(player, legendaryBlade)
      expect(result).toBeNull()
    })

    it('returns null for level requirement exactly above player level', () => {
      const result = equipItem(player, ironHelmet)
      expect(result).toBeNull()
      expect(ironHelmet.levelRequirement).toBe(2)
      expect(player.level).toBe(1)
    })

    it('allows equipping when player level exactly meets requirement', () => {
      const leveledPlayer: PlayerCharacter = { ...player, level: 3 }
      const result = equipItem(leveledPlayer, ironSword)
      expect(result).not.toBeNull()
      expect(result?.player.equipment.weapon).toEqual(ironSword)
    })

    it('returns the previously equipped item when swapping', () => {
      const firstResult = equipItem(player, woodenSword)
      expect(firstResult).not.toBeNull()

      const playerWithSword = firstResult!.player
      const leveledPlayer: PlayerCharacter = { ...playerWithSword, level: 3 }
      const swapResult = equipItem(leveledPlayer, ironSword)

      expect(swapResult).not.toBeNull()
      expect(swapResult?.unequipped).toEqual(woodenSword)
      expect(swapResult?.player.equipment.weapon).toEqual(ironSword)
    })

    it('returns null for unequipped when slot was empty', () => {
      const result = equipItem(player, woodenSword)
      expect(result?.unequipped).toBeNull()
    })

    it('does not mutate the original player', () => {
      const originalEquipment = player.equipment
      equipItem(player, woodenSword)
      expect(player.equipment).toBe(originalEquipment)
      expect(player.equipment.weapon).toBeNull()
    })

    it('does not affect other equipment slots when equipping', () => {
      const withArmor = equipItem(player, leatherArmor)!.player
      const withSword = equipItem(withArmor, woodenSword)

      expect(withSword?.player.equipment.armor).toEqual(leatherArmor)
      expect(withSword?.player.equipment.weapon).toEqual(woodenSword)
      expect(withSword?.player.equipment.helmet).toBeNull()
      expect(withSword?.player.equipment.accessory).toBeNull()
    })

    it('emits EQUIPMENT_CHANGED event on successful equip', async () => {
      const { EventBus } = await import('../../../src/events/EventBus')
      equipItem(player, woodenSword)
      expect(EventBus.emit).toHaveBeenCalledWith(
        'inventory:equipment_changed',
        { slot: 'weapon', equipped: 'wooden-sword' },
      )
    })

    it('does not emit event when equip fails due to level', async () => {
      const { EventBus } = await import('../../../src/events/EventBus')
      equipItem(player, legendaryBlade)
      expect(EventBus.emit).not.toHaveBeenCalled()
    })

    it('can equip items in all four slots simultaneously', () => {
      let current = player
      const swordResult = equipItem(current, woodenSword)!
      current = swordResult.player

      const armorResult = equipItem(current, leatherArmor)!
      current = armorResult.player

      const charmResult = equipItem(current, luckyCharm)!
      current = charmResult.player

      expect(current.equipment.weapon).toEqual(woodenSword)
      expect(current.equipment.armor).toEqual(leatherArmor)
      expect(current.equipment.accessory).toEqual(luckyCharm)
      expect(current.equipment.helmet).toBeNull()
    })
  })

  describe('unequipItem', () => {
    it('removes equipment from the specified slot', () => {
      const equipped = equipItem(player, woodenSword)!.player
      const result = unequipItem(equipped, 'weapon')
      expect(result.player.equipment.weapon).toBeNull()
    })

    it('returns the unequipped item', () => {
      const equipped = equipItem(player, woodenSword)!.player
      const result = unequipItem(equipped, 'weapon')
      expect(result.unequipped).toEqual(woodenSword)
    })

    it('returns null unequipped when slot is already empty', () => {
      const result = unequipItem(player, 'weapon')
      expect(result.unequipped).toBeNull()
    })

    it('sets the slot to null when unequipping', () => {
      const equipped = equipItem(player, leatherArmor)!.player
      const result = unequipItem(equipped, 'armor')
      expect(result.player.equipment.armor).toBeNull()
    })

    it('does not mutate the original player', () => {
      const equipped = equipItem(player, woodenSword)!.player
      const originalEquipment = equipped.equipment
      unequipItem(equipped, 'weapon')
      expect(equipped.equipment).toBe(originalEquipment)
      expect(equipped.equipment.weapon).toEqual(woodenSword)
    })

    it('does not affect other equipment slots when unequipping', () => {
      let current = equipItem(player, woodenSword)!.player
      current = equipItem(current, leatherArmor)!.player

      const result = unequipItem(current, 'weapon')
      expect(result.player.equipment.weapon).toBeNull()
      expect(result.player.equipment.armor).toEqual(leatherArmor)
    })

    it('emits EQUIPMENT_CHANGED event when unequipping a filled slot', async () => {
      const { EventBus } = await import('../../../src/events/EventBus')
      const equipped = equipItem(player, woodenSword)!.player
      vi.mocked(EventBus.emit).mockClear()

      unequipItem(equipped, 'weapon')
      expect(EventBus.emit).toHaveBeenCalledWith(
        'inventory:equipment_changed',
        { slot: 'weapon', equipped: null },
      )
    })

    it('does not emit event when unequipping an empty slot', async () => {
      const { EventBus } = await import('../../../src/events/EventBus')
      unequipItem(player, 'helmet')
      expect(EventBus.emit).not.toHaveBeenCalled()
    })
  })

  // ── Stat Calculations ──

  describe('calculateEquipmentBonuses', () => {
    it('returns empty bonuses when no equipment is worn', () => {
      const emptySlots: EquipmentSlots = {
        weapon: null,
        armor: null,
        helmet: null,
        accessory: null,
      }
      const bonuses = calculateEquipmentBonuses(emptySlots)
      expect(Object.keys(bonuses)).toHaveLength(0)
    })

    it('returns bonuses from a single equipped item', () => {
      const slots: EquipmentSlots = {
        weapon: woodenSword,
        armor: null,
        helmet: null,
        accessory: null,
      }
      const bonuses = calculateEquipmentBonuses(slots)
      expect(bonuses.attack).toBe(3)
    })

    it('sums stat modifiers from all equipped items', () => {
      const slots: EquipmentSlots = {
        weapon: woodenSword,
        armor: leatherArmor,
        helmet: null,
        accessory: luckyCharm,
      }
      const bonuses = calculateEquipmentBonuses(slots)
      expect(bonuses.attack).toBe(3)
      expect(bonuses.defense).toBe(4)
      expect(bonuses.maxHp).toBe(10)
      expect(bonuses.luck).toBe(5)
      expect(bonuses.speed).toBe(2)
    })

    it('correctly sums overlapping stat modifiers', () => {
      const helmetWithDefense = makeEquipment({
        equipmentId: 'def-helmet',
        slot: 'helmet',
        statModifiers: { defense: 3 },
        levelRequirement: 1,
      })
      const slots: EquipmentSlots = {
        weapon: null,
        armor: leatherArmor,
        helmet: helmetWithDefense,
        accessory: null,
      }
      const bonuses = calculateEquipmentBonuses(slots)
      expect(bonuses.defense).toBe(7) // 4 from armor + 3 from helmet
    })

    it('handles negative stat modifiers', () => {
      const leveledPlayer: PlayerCharacter = { ...player, level: 3 }
      const equipped = equipItem(leveledPlayer, ironSword)!.player
      const bonuses = calculateEquipmentBonuses(equipped.equipment)
      expect(bonuses.attack).toBe(8)
      expect(bonuses.speed).toBe(-1)
    })

    it('handles all four slots filled', () => {
      const helmetLvl1 = makeEquipment({
        equipmentId: 'basic-helmet',
        slot: 'helmet',
        statModifiers: { defense: 1 },
        levelRequirement: 1,
      })
      const slots: EquipmentSlots = {
        weapon: woodenSword,
        armor: leatherArmor,
        helmet: helmetLvl1,
        accessory: luckyCharm,
      }
      const bonuses = calculateEquipmentBonuses(slots)
      expect(bonuses.attack).toBe(3)
      expect(bonuses.defense).toBe(5) // 4 armor + 1 helmet
      expect(bonuses.maxHp).toBe(10)
      expect(bonuses.luck).toBe(5)
      expect(bonuses.speed).toBe(2)
    })
  })

  describe('applyEquipmentStats', () => {
    it('returns base stats unchanged when no equipment is worn', () => {
      const emptySlots: EquipmentSlots = {
        weapon: null,
        armor: null,
        helmet: null,
        accessory: null,
      }
      const result = applyEquipmentStats(player.stats, emptySlots)
      expect(result.maxHp).toBe(player.stats.maxHp)
      expect(result.attack).toBe(player.stats.attack)
      expect(result.defense).toBe(player.stats.defense)
      expect(result.speed).toBe(player.stats.speed)
      expect(result.luck).toBe(player.stats.luck)
    })

    it('adds equipment bonuses to base stats', () => {
      const slots: EquipmentSlots = {
        weapon: woodenSword,
        armor: leatherArmor,
        helmet: null,
        accessory: luckyCharm,
      }
      const result = applyEquipmentStats(player.stats, slots)
      expect(result.attack).toBe(player.stats.attack + 3)
      expect(result.defense).toBe(player.stats.defense + 4)
      expect(result.maxHp).toBe(player.stats.maxHp + 10)
      expect(result.luck).toBe(player.stats.luck + 5)
      expect(result.speed).toBe(player.stats.speed + 2)
    })

    it('preserves currentHp and currentMp from base stats', () => {
      const damagedStats: CharacterStats = {
        ...player.stats,
        currentHp: 50,
        currentMp: 10,
      }
      const slots: EquipmentSlots = {
        weapon: null,
        armor: leatherArmor,
        helmet: null,
        accessory: null,
      }
      const result = applyEquipmentStats(damagedStats, slots)
      expect(result.currentHp).toBe(50)
      expect(result.currentMp).toBe(10)
      expect(result.maxHp).toBe(player.stats.maxHp + 10)
    })

    it('handles negative modifiers reducing stats', () => {
      const cursedItem = makeEquipment({
        equipmentId: 'cursed-ring',
        slot: 'accessory',
        statModifiers: { speed: -3, luck: -2 },
        levelRequirement: 1,
      })
      const slots: EquipmentSlots = {
        weapon: null,
        armor: null,
        helmet: null,
        accessory: cursedItem,
      }
      const result = applyEquipmentStats(player.stats, slots)
      expect(result.speed).toBe(player.stats.speed - 3)
      expect(result.luck).toBe(player.stats.luck - 2)
    })

    it('does not modify stats without equipment bonuses', () => {
      const slots: EquipmentSlots = {
        weapon: woodenSword,
        armor: null,
        helmet: null,
        accessory: null,
      }
      const result = applyEquipmentStats(player.stats, slots)
      expect(result.magicAttack).toBe(player.stats.magicAttack)
      expect(result.magicDefense).toBe(player.stats.magicDefense)
      expect(result.maxMp).toBe(player.stats.maxMp)
    })
  })

  // ── Equipment Comparison ──

  describe('compareEquipment', () => {
    it('shows positive diff when comparing null to an item', () => {
      const diff = compareEquipment(null, woodenSword)
      expect(diff.attack).toBe(3)
    })

    it('shows only changed stats (no zero-change entries)', () => {
      const diff = compareEquipment(null, woodenSword)
      expect(Object.keys(diff)).toHaveLength(1)
      expect(diff.attack).toBe(3)
    })

    it('shows stat differences between two items', () => {
      const diff = compareEquipment(woodenSword, ironSword)
      expect(diff.attack).toBe(5) // 8 - 3
      expect(diff.speed).toBe(-1) // -1 - 0
    })

    it('shows negative diff when downgrading', () => {
      const diff = compareEquipment(ironSword, woodenSword)
      expect(diff.attack).toBe(-5) // 3 - 8
      expect(diff.speed).toBe(1) // 0 - (-1)
    })

    it('returns empty diff when comparing identical items', () => {
      const diff = compareEquipment(woodenSword, woodenSword)
      expect(Object.keys(diff)).toHaveLength(0)
    })

    it('handles items with multiple stat modifiers', () => {
      const diff = compareEquipment(null, luckyCharm)
      expect(diff.luck).toBe(5)
      expect(diff.speed).toBe(2)
      expect(Object.keys(diff)).toHaveLength(2)
    })

    it('handles comparing items with non-overlapping stats', () => {
      const diff = compareEquipment(woodenSword, luckyCharm)
      expect(diff.attack).toBe(-3) // 0 - 3
      expect(diff.luck).toBe(5) // 5 - 0
      expect(diff.speed).toBe(2) // 2 - 0
    })

    it('correctly compares armor pieces', () => {
      const plateArmor = makeEquipment({
        equipmentId: 'plate-armor',
        slot: 'armor',
        statModifiers: { defense: 10, maxHp: 20, speed: -2 },
        levelRequirement: 5,
      })
      const diff = compareEquipment(leatherArmor, plateArmor)
      expect(diff.defense).toBe(6) // 10 - 4
      expect(diff.maxHp).toBe(10) // 20 - 10
      expect(diff.speed).toBe(-2) // -2 - 0
    })
  })
})
