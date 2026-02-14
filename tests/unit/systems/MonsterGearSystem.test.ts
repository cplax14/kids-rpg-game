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
  loadMonsterGearData,
  getGear,
  getAllGear,
  getGearBySlot,
  clearMonsterGearRegistry,
  createEmptyGearSlots,
  canEquipGear,
  equipGear,
  unequipGear,
  calculateGearBonuses,
  applyGearStats,
  compareGear,
  getTotalGearValue,
  hasAnyGearEquipped,
  getEquippedGearList,
} from '../../../src/systems/MonsterGearSystem'
import type {
  MonsterGear,
  MonsterInstance,
  CharacterStats,
  MonsterGearSlots,
} from '../../../src/models/types'

// Test data
const testCollar: MonsterGear = {
  gearId: 'test-collar',
  name: 'Test Collar',
  description: 'A test collar',
  slot: 'collar',
  rarity: 'common',
  statModifiers: { defense: 5 },
  levelRequirement: 1,
  iconKey: 'test-collar-icon',
  buyPrice: 100,
  sellPrice: 50,
}

const testSaddle: MonsterGear = {
  gearId: 'test-saddle',
  name: 'Test Saddle',
  description: 'A test saddle',
  slot: 'saddle',
  rarity: 'uncommon',
  statModifiers: { speed: 8, attack: 3 },
  levelRequirement: 5,
  iconKey: 'test-saddle-icon',
  buyPrice: 200,
  sellPrice: 100,
}

const testCharm: MonsterGear = {
  gearId: 'test-charm',
  name: 'Test Charm',
  description: 'A test charm',
  slot: 'charm',
  rarity: 'rare',
  statModifiers: { magicAttack: 10, maxMp: 20 },
  levelRequirement: 10,
  iconKey: 'test-charm-icon',
  buyPrice: 400,
  sellPrice: 200,
}

const testClaws: MonsterGear = {
  gearId: 'test-claws',
  name: 'Test Claws',
  description: 'Test claws',
  slot: 'claws',
  rarity: 'epic',
  statModifiers: { attack: 15 },
  levelRequirement: 15,
  iconKey: 'test-claws-icon',
  buyPrice: 800,
  sellPrice: 400,
}

const createTestMonster = (level: number = 10): MonsterInstance => ({
  instanceId: 'test-monster-1',
  speciesId: 'test-species',
  nickname: null,
  level,
  experience: 0,
  stats: {
    maxHp: 100,
    currentHp: 100,
    maxMp: 50,
    currentMp: 50,
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

describe('MonsterGearSystem', () => {
  beforeEach(() => {
    clearMonsterGearRegistry()
    loadMonsterGearData([testCollar, testSaddle, testCharm, testClaws])
  })

  describe('Backwards Compatibility (old saves without equippedGear)', () => {
    it('calculateGearBonuses should handle undefined slots', () => {
      const bonuses = calculateGearBonuses(undefined)
      expect(Object.keys(bonuses)).toHaveLength(0)
    })

    it('calculateGearBonuses should handle null slots', () => {
      const bonuses = calculateGearBonuses(null)
      expect(Object.keys(bonuses)).toHaveLength(0)
    })

    it('applyGearStats should return base stats when slots undefined', () => {
      const baseStats: CharacterStats = {
        maxHp: 100,
        currentHp: 100,
        maxMp: 50,
        currentMp: 50,
        attack: 20,
        defense: 15,
        magicAttack: 18,
        magicDefense: 12,
        speed: 10,
        luck: 5,
      }

      const result = applyGearStats(baseStats, undefined)
      expect(result).toBe(baseStats)
    })

    it('applyGearStats should return base stats when slots null', () => {
      const baseStats: CharacterStats = {
        maxHp: 100,
        currentHp: 100,
        maxMp: 50,
        currentMp: 50,
        attack: 20,
        defense: 15,
        magicAttack: 18,
        magicDefense: 12,
        speed: 10,
        luck: 5,
      }

      const result = applyGearStats(baseStats, null)
      expect(result).toBe(baseStats)
    })

    it('getTotalGearValue should return 0 for undefined slots', () => {
      expect(getTotalGearValue(undefined)).toBe(0)
    })

    it('hasAnyGearEquipped should return false for undefined slots', () => {
      expect(hasAnyGearEquipped(undefined)).toBe(false)
    })

    it('getEquippedGearList should return empty array for undefined slots', () => {
      expect(getEquippedGearList(undefined)).toEqual([])
    })
  })

  describe('Registry', () => {
    it('should load gear data', () => {
      const allGear = getAllGear()
      expect(allGear).toHaveLength(4)
    })

    it('should get gear by ID', () => {
      const gear = getGear('test-collar')
      expect(gear).toBeDefined()
      expect(gear?.name).toBe('Test Collar')
    })

    it('should return undefined for unknown gear ID', () => {
      const gear = getGear('unknown-gear')
      expect(gear).toBeUndefined()
    })

    it('should get gear by slot', () => {
      const collars = getGearBySlot('collar')
      expect(collars).toHaveLength(1)
      expect(collars[0].gearId).toBe('test-collar')

      const charms = getGearBySlot('charm')
      expect(charms).toHaveLength(1)
      expect(charms[0].gearId).toBe('test-charm')
    })

    it('should clear registry', () => {
      clearMonsterGearRegistry()
      expect(getAllGear()).toHaveLength(0)
    })
  })

  describe('createEmptyGearSlots', () => {
    it('should create empty gear slots', () => {
      const slots = createEmptyGearSlots()
      expect(slots.collar).toBeNull()
      expect(slots.saddle).toBeNull()
      expect(slots.charm).toBeNull()
      expect(slots.claws).toBeNull()
    })
  })

  describe('canEquipGear', () => {
    it('should allow equipping gear when level requirement is met', () => {
      const monster = createTestMonster(10)
      expect(canEquipGear(monster, testCollar)).toBe(true) // requires level 1
      expect(canEquipGear(monster, testSaddle)).toBe(true) // requires level 5
      expect(canEquipGear(monster, testCharm)).toBe(true) // requires level 10
    })

    it('should not allow equipping gear when level requirement is not met', () => {
      const monster = createTestMonster(5)
      expect(canEquipGear(monster, testCharm)).toBe(false) // requires level 10
      expect(canEquipGear(monster, testClaws)).toBe(false) // requires level 15
    })
  })

  describe('equipGear', () => {
    it('should equip gear to empty slot', () => {
      const monster = createTestMonster(10)
      const result = equipGear(monster, testCollar)

      expect(result).not.toBeNull()
      expect(result?.monster.equippedGear.collar).toBe(testCollar)
      expect(result?.unequipped).toBeNull()
    })

    it('should return null when level requirement not met', () => {
      const monster = createTestMonster(5)
      const result = equipGear(monster, testClaws) // requires level 15

      expect(result).toBeNull()
    })

    it('should replace existing gear and return unequipped item', () => {
      const monster = createTestMonster(10)
      const result1 = equipGear(monster, testCollar)
      expect(result1).not.toBeNull()

      const newCollar: MonsterGear = {
        ...testCollar,
        gearId: 'better-collar',
        name: 'Better Collar',
        statModifiers: { defense: 10 },
      }

      const result2 = equipGear(result1!.monster, newCollar)

      expect(result2).not.toBeNull()
      expect(result2?.monster.equippedGear.collar?.gearId).toBe('better-collar')
      expect(result2?.unequipped).toBe(testCollar)
    })
  })

  describe('unequipGear', () => {
    it('should unequip gear from slot', () => {
      const monster = createTestMonster(10)
      const equipped = equipGear(monster, testCollar)!
      const result = unequipGear(equipped.monster, 'collar')

      expect(result.monster.equippedGear.collar).toBeNull()
      expect(result.unequipped).toBe(testCollar)
    })

    it('should return null unequipped when slot is empty', () => {
      const monster = createTestMonster(10)
      const result = unequipGear(monster, 'collar')

      expect(result.monster.equippedGear.collar).toBeNull()
      expect(result.unequipped).toBeNull()
    })
  })

  describe('calculateGearBonuses', () => {
    it('should calculate bonuses from single equipped gear', () => {
      const slots: MonsterGearSlots = {
        collar: testCollar,
        saddle: null,
        charm: null,
        claws: null,
      }

      const bonuses = calculateGearBonuses(slots)
      expect(bonuses.defense).toBe(5)
    })

    it('should sum bonuses from multiple gear pieces', () => {
      const slots: MonsterGearSlots = {
        collar: testCollar, // defense: 5
        saddle: testSaddle, // speed: 8, attack: 3
        charm: testCharm, // magicAttack: 10, maxMp: 20
        claws: testClaws, // attack: 15
      }

      const bonuses = calculateGearBonuses(slots)
      expect(bonuses.defense).toBe(5)
      expect(bonuses.speed).toBe(8)
      expect(bonuses.attack).toBe(18) // 3 + 15
      expect(bonuses.magicAttack).toBe(10)
      expect(bonuses.maxMp).toBe(20)
    })

    it('should return empty object for no equipped gear', () => {
      const slots = createEmptyGearSlots()
      const bonuses = calculateGearBonuses(slots)
      expect(Object.keys(bonuses)).toHaveLength(0)
    })
  })

  describe('applyGearStats', () => {
    it('should apply gear bonuses to base stats', () => {
      const baseStats: CharacterStats = {
        maxHp: 100,
        currentHp: 100,
        maxMp: 50,
        currentMp: 50,
        attack: 20,
        defense: 15,
        magicAttack: 18,
        magicDefense: 12,
        speed: 10,
        luck: 5,
      }

      const slots: MonsterGearSlots = {
        collar: testCollar, // defense: 5
        saddle: testSaddle, // speed: 8, attack: 3
        charm: null,
        claws: null,
      }

      const result = applyGearStats(baseStats, slots)

      expect(result.defense).toBe(20) // 15 + 5
      expect(result.speed).toBe(18) // 10 + 8
      expect(result.attack).toBe(23) // 20 + 3
      // Unchanged stats
      expect(result.maxHp).toBe(100)
      expect(result.currentHp).toBe(100)
      expect(result.magicAttack).toBe(18)
    })

    it('should not modify stats when no gear equipped', () => {
      const baseStats: CharacterStats = {
        maxHp: 100,
        currentHp: 100,
        maxMp: 50,
        currentMp: 50,
        attack: 20,
        defense: 15,
        magicAttack: 18,
        magicDefense: 12,
        speed: 10,
        luck: 5,
      }

      const slots = createEmptyGearSlots()
      const result = applyGearStats(baseStats, slots)

      expect(result).toEqual(baseStats)
    })
  })

  describe('compareGear', () => {
    it('should show stat differences when comparing gear', () => {
      const currentGear: MonsterGear = {
        ...testCollar,
        statModifiers: { defense: 5, attack: 2 },
      }

      const newGear: MonsterGear = {
        ...testCollar,
        gearId: 'better-collar',
        statModifiers: { defense: 10, speed: 3 },
      }

      const diff = compareGear(currentGear, newGear)

      expect(diff.defense).toBe(5) // 10 - 5
      expect(diff.attack).toBe(-2) // 0 - 2
      expect(diff.speed).toBe(3) // 3 - 0
    })

    it('should compare against no gear', () => {
      const diff = compareGear(null, testCollar)
      expect(diff.defense).toBe(5)
    })
  })

  describe('getTotalGearValue', () => {
    it('should calculate total sell value of equipped gear', () => {
      const slots: MonsterGearSlots = {
        collar: testCollar, // sellPrice: 50
        saddle: testSaddle, // sellPrice: 100
        charm: null,
        claws: null,
      }

      const value = getTotalGearValue(slots)
      expect(value).toBe(150)
    })

    it('should return 0 for no equipped gear', () => {
      const slots = createEmptyGearSlots()
      const value = getTotalGearValue(slots)
      expect(value).toBe(0)
    })
  })

  describe('hasAnyGearEquipped', () => {
    it('should return true when any gear is equipped', () => {
      const slots: MonsterGearSlots = {
        collar: testCollar,
        saddle: null,
        charm: null,
        claws: null,
      }

      expect(hasAnyGearEquipped(slots)).toBe(true)
    })

    it('should return false when no gear is equipped', () => {
      const slots = createEmptyGearSlots()
      expect(hasAnyGearEquipped(slots)).toBe(false)
    })
  })

  describe('getEquippedGearList', () => {
    it('should return array of equipped gear', () => {
      const slots: MonsterGearSlots = {
        collar: testCollar,
        saddle: testSaddle,
        charm: null,
        claws: null,
      }

      const list = getEquippedGearList(slots)
      expect(list).toHaveLength(2)
      expect(list).toContain(testCollar)
      expect(list).toContain(testSaddle)
    })

    it('should return empty array for no equipped gear', () => {
      const slots = createEmptyGearSlots()
      const list = getEquippedGearList(slots)
      expect(list).toHaveLength(0)
    })
  })
})
