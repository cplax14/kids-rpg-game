import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  loadItemData,
  getItem,
  getAllItems,
  hasItem,
  getItemQuantity,
  getAvailableSlots,
  canAddItem,
  addItem,
  removeItem,
  useItem,
  sortInventory,
  getConsumableItems,
  getCaptureDevices,
} from '../../../src/systems/InventorySystem'
import type { Item, Inventory, InventorySlot } from '../../../src/models/types'

// Mock EventBus to prevent Phaser dependency
vi.mock('../../../src/events/EventBus', () => ({
  EventBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}))

// ── Test Item Data ──

const testPotion: Item = {
  itemId: 'test-potion',
  name: 'Test Potion',
  description: 'A test healing item',
  category: 'consumable',
  iconKey: 'icon-potion',
  stackable: true,
  maxStack: 10,
  useEffect: { type: 'heal_hp', magnitude: 30, targetType: 'single_ally' },
  buyPrice: 50,
  sellPrice: 25,
}

const testManaPotion: Item = {
  itemId: 'test-mana-potion',
  name: 'Test Mana Potion',
  description: 'A test mana item',
  category: 'consumable',
  iconKey: 'icon-mana',
  stackable: true,
  maxStack: 5,
  useEffect: { type: 'heal_mp', magnitude: 20, targetType: 'single_ally' },
  buyPrice: 75,
  sellPrice: 35,
}

const testCaptureNet: Item = {
  itemId: 'test-net',
  name: 'Test Capture Net',
  description: 'A basic capture device',
  category: 'capture_device',
  iconKey: 'icon-net',
  stackable: true,
  maxStack: 20,
  useEffect: { type: 'capture_boost', magnitude: 10, targetType: 'single_monster' },
  buyPrice: 100,
  sellPrice: 50,
}

const testKeyItem: Item = {
  itemId: 'test-key',
  name: 'Ancient Key',
  description: 'A mysterious key',
  category: 'key_item',
  iconKey: 'icon-key',
  stackable: false,
  maxStack: 1,
  useEffect: null,
  buyPrice: 0,
  sellPrice: 0,
}

const testMaterial: Item = {
  itemId: 'test-gem',
  name: 'Bright Gem',
  description: 'A sparkling gem',
  category: 'material',
  iconKey: 'icon-gem',
  stackable: true,
  maxStack: 99,
  useEffect: null,
  buyPrice: 200,
  sellPrice: 100,
}

const testBreedingItem: Item = {
  itemId: 'test-seed',
  name: 'Growth Seed',
  description: 'Boosts breeding',
  category: 'breeding_item',
  iconKey: 'icon-seed',
  stackable: true,
  maxStack: 10,
  useEffect: { type: 'breeding_boost', magnitude: 15, targetType: 'self' },
  buyPrice: 300,
  sellPrice: 150,
}

const allTestItems: ReadonlyArray<Item> = [
  testPotion,
  testManaPotion,
  testCaptureNet,
  testKeyItem,
  testMaterial,
  testBreedingItem,
]

function createEmptyInventory(maxSlots = 10): Inventory {
  return {
    items: [],
    maxSlots,
    equipment: [],
  }
}

function createInventoryWithItems(
  slots: ReadonlyArray<InventorySlot>,
  maxSlots = 10,
): Inventory {
  return {
    items: slots,
    maxSlots,
    equipment: [],
  }
}

// ── Tests ──

describe('InventorySystem', () => {
  beforeEach(() => {
    loadItemData(allTestItems)
  })

  // ── Item Registry ──

  describe('loadItemData / getItem / getAllItems', () => {
    it('should load items into the registry', () => {
      const items = getAllItems()

      expect(items).toHaveLength(allTestItems.length)
    })

    it('should retrieve a specific item by id', () => {
      const item = getItem('test-potion')

      expect(item).toBeDefined()
      expect(item?.name).toBe('Test Potion')
      expect(item?.category).toBe('consumable')
    })

    it('should return undefined for a non-existent item id', () => {
      const item = getItem('does-not-exist')

      expect(item).toBeUndefined()
    })

    it('should return all loaded items', () => {
      const items = getAllItems()

      const ids = items.map((i) => i.itemId)
      expect(ids).toContain('test-potion')
      expect(ids).toContain('test-net')
      expect(ids).toContain('test-key')
    })

    it('should replace registry when loadItemData is called again', () => {
      loadItemData([testPotion])

      expect(getAllItems()).toHaveLength(1)
      expect(getItem('test-net')).toBeUndefined()
    })
  })

  // ── addItem ──

  describe('addItem', () => {
    it('should add a new item to an empty inventory', () => {
      const inventory = createEmptyInventory()

      const result = addItem(inventory, 'test-potion', 3)

      expect(result).not.toBeNull()
      expect(result!.items).toHaveLength(1)
      expect(result!.items[0].item.itemId).toBe('test-potion')
      expect(result!.items[0].quantity).toBe(3)
    })

    it('should stack items when adding to an existing stackable slot', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 3 },
      ])

      const result = addItem(inventory, 'test-potion', 4)

      expect(result).not.toBeNull()
      expect(result!.items).toHaveLength(1)
      expect(result!.items[0].quantity).toBe(7)
    })

    it('should return null when stacking would exceed maxStack', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 8 },
      ])

      const result = addItem(inventory, 'test-potion', 5)

      expect(result).toBeNull()
    })

    it('should allow stacking up to exactly maxStack', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 7 },
      ])

      const result = addItem(inventory, 'test-potion', 3)

      expect(result).not.toBeNull()
      expect(result!.items[0].quantity).toBe(10)
    })

    it('should return null when adding to a full inventory with no existing stack', () => {
      const inventory = createInventoryWithItems(
        [
          { item: testPotion, quantity: 1 },
          { item: testManaPotion, quantity: 1 },
        ],
        2,
      )

      const result = addItem(inventory, 'test-net', 1)

      expect(result).toBeNull()
    })

    it('should return null when the item does not exist in the registry', () => {
      const inventory = createEmptyInventory()

      const result = addItem(inventory, 'nonexistent-item', 1)

      expect(result).toBeNull()
    })

    it('should return null when quantity is zero', () => {
      const inventory = createEmptyInventory()

      const result = addItem(inventory, 'test-potion', 0)

      expect(result).toBeNull()
    })

    it('should return null when quantity is negative', () => {
      const inventory = createEmptyInventory()

      const result = addItem(inventory, 'test-potion', -5)

      expect(result).toBeNull()
    })

    it('should return null when adding to a non-stackable item that already exists', () => {
      const inventory = createInventoryWithItems([
        { item: testKeyItem, quantity: 1 },
      ])

      const result = addItem(inventory, 'test-key', 1)

      expect(result).toBeNull()
    })

    it('should add a non-stackable item to a new slot when not already present', () => {
      const inventory = createEmptyInventory()

      const result = addItem(inventory, 'test-key', 1)

      expect(result).not.toBeNull()
      expect(result!.items).toHaveLength(1)
      expect(result!.items[0].item.itemId).toBe('test-key')
      expect(result!.items[0].quantity).toBe(1)
    })

    it('should return null when adding quantity exceeding maxStack for a new item', () => {
      const inventory = createEmptyInventory()

      const result = addItem(inventory, 'test-potion', 15)

      expect(result).toBeNull()
    })

    it('should preserve other slots when adding to a specific stack', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 2 },
        { item: testCaptureNet, quantity: 5 },
      ])

      const result = addItem(inventory, 'test-potion', 1)

      expect(result).not.toBeNull()
      expect(result!.items).toHaveLength(2)
      expect(result!.items[0].quantity).toBe(3)
      expect(result!.items[1].item.itemId).toBe('test-net')
      expect(result!.items[1].quantity).toBe(5)
    })
  })

  // ── removeItem ──

  describe('removeItem', () => {
    it('should partially remove items from a slot', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 5 },
      ])

      const result = removeItem(inventory, 'test-potion', 3)

      expect(result).not.toBeNull()
      expect(result!.items).toHaveLength(1)
      expect(result!.items[0].quantity).toBe(2)
    })

    it('should remove the slot entirely when quantity reaches zero', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 3 },
      ])

      const result = removeItem(inventory, 'test-potion', 3)

      expect(result).not.toBeNull()
      expect(result!.items).toHaveLength(0)
    })

    it('should return null when removing more than available quantity', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 2 },
      ])

      const result = removeItem(inventory, 'test-potion', 5)

      expect(result).toBeNull()
    })

    it('should return null when the item is not in the inventory', () => {
      const inventory = createEmptyInventory()

      const result = removeItem(inventory, 'test-potion', 1)

      expect(result).toBeNull()
    })

    it('should return null when quantity is zero', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 3 },
      ])

      const result = removeItem(inventory, 'test-potion', 0)

      expect(result).toBeNull()
    })

    it('should return null when quantity is negative', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 3 },
      ])

      const result = removeItem(inventory, 'test-potion', -1)

      expect(result).toBeNull()
    })

    it('should preserve other slots when removing from a specific slot', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 5 },
        { item: testCaptureNet, quantity: 10 },
      ])

      const result = removeItem(inventory, 'test-potion', 5)

      expect(result).not.toBeNull()
      expect(result!.items).toHaveLength(1)
      expect(result!.items[0].item.itemId).toBe('test-net')
      expect(result!.items[0].quantity).toBe(10)
    })
  })

  // ── useItem ──

  describe('useItem', () => {
    it('should decrement item quantity by 1', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 3 },
      ])

      const result = useItem(inventory, 'test-potion')

      expect(result).not.toBeNull()
      expect(result!.items).toHaveLength(1)
      expect(result!.items[0].quantity).toBe(2)
    })

    it('should remove the slot when the last item is used', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 1 },
      ])

      const result = useItem(inventory, 'test-potion')

      expect(result).not.toBeNull()
      expect(result!.items).toHaveLength(0)
    })

    it('should return null when the item is not in the inventory', () => {
      const inventory = createEmptyInventory()

      const result = useItem(inventory, 'test-potion')

      expect(result).toBeNull()
    })

    it('should return null for a non-existent item id', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 3 },
      ])

      const result = useItem(inventory, 'does-not-exist')

      expect(result).toBeNull()
    })
  })

  // ── hasItem ──

  describe('hasItem', () => {
    it('should return true when the item exists in the inventory', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 1 },
      ])

      expect(hasItem(inventory, 'test-potion')).toBe(true)
    })

    it('should return false when the item does not exist in the inventory', () => {
      const inventory = createEmptyInventory()

      expect(hasItem(inventory, 'test-potion')).toBe(false)
    })

    it('should return false for a non-existent item id', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 1 },
      ])

      expect(hasItem(inventory, 'nonexistent')).toBe(false)
    })
  })

  // ── getItemQuantity ──

  describe('getItemQuantity', () => {
    it('should return the quantity of an item in the inventory', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 7 },
      ])

      expect(getItemQuantity(inventory, 'test-potion')).toBe(7)
    })

    it('should return 0 when the item is not in the inventory', () => {
      const inventory = createEmptyInventory()

      expect(getItemQuantity(inventory, 'test-potion')).toBe(0)
    })

    it('should return 0 for a non-existent item id', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 3 },
      ])

      expect(getItemQuantity(inventory, 'nonexistent')).toBe(0)
    })
  })

  // ── canAddItem ──

  describe('canAddItem', () => {
    it('should return true when there is room for a new item', () => {
      const inventory = createEmptyInventory()

      expect(canAddItem(inventory, 'test-potion', 5)).toBe(true)
    })

    it('should return true when an existing stackable slot has room', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 3 },
      ])

      expect(canAddItem(inventory, 'test-potion', 5)).toBe(true)
    })

    it('should return false when stacking would exceed maxStack', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 8 },
      ])

      expect(canAddItem(inventory, 'test-potion', 5)).toBe(false)
    })

    it('should return false when inventory is full and item is not stackable with existing slots', () => {
      const inventory = createInventoryWithItems(
        [
          { item: testPotion, quantity: 1 },
          { item: testManaPotion, quantity: 1 },
        ],
        2,
      )

      expect(canAddItem(inventory, 'test-net', 1)).toBe(false)
    })

    it('should return false for a non-existent item without an existing slot', () => {
      const inventory = createEmptyInventory()

      expect(canAddItem(inventory, 'does-not-exist', 1)).toBe(false)
    })

    it('should return true when stacking to exactly maxStack', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 5 },
      ])

      expect(canAddItem(inventory, 'test-potion', 5)).toBe(true)
    })

    it('should return false for non-stackable items that already exist', () => {
      const inventory = createInventoryWithItems([
        { item: testKeyItem, quantity: 1 },
      ])

      expect(canAddItem(inventory, 'test-key', 1)).toBe(false)
    })

    it('should return false when quantity exceeds maxStack for new item', () => {
      const inventory = createEmptyInventory()

      expect(canAddItem(inventory, 'test-potion', 15)).toBe(false)
    })
  })

  // ── getAvailableSlots ──

  describe('getAvailableSlots', () => {
    it('should return maxSlots for an empty inventory', () => {
      const inventory = createEmptyInventory(10)

      expect(getAvailableSlots(inventory)).toBe(10)
    })

    it('should return the difference between maxSlots and used slots', () => {
      const inventory = createInventoryWithItems(
        [
          { item: testPotion, quantity: 1 },
          { item: testCaptureNet, quantity: 1 },
        ],
        10,
      )

      expect(getAvailableSlots(inventory)).toBe(8)
    })

    it('should return 0 for a full inventory', () => {
      const inventory = createInventoryWithItems(
        [
          { item: testPotion, quantity: 1 },
          { item: testCaptureNet, quantity: 1 },
        ],
        2,
      )

      expect(getAvailableSlots(inventory)).toBe(0)
    })
  })

  // ── sortInventory ──

  describe('sortInventory', () => {
    it('should sort items by category order: consumable, capture_device, material, breeding_item, key_item', () => {
      const inventory = createInventoryWithItems([
        { item: testKeyItem, quantity: 1 },
        { item: testMaterial, quantity: 5 },
        { item: testCaptureNet, quantity: 3 },
        { item: testBreedingItem, quantity: 2 },
        { item: testPotion, quantity: 4 },
      ])

      const result = sortInventory(inventory)

      expect(result.items[0].item.category).toBe('consumable')
      expect(result.items[1].item.category).toBe('capture_device')
      expect(result.items[2].item.category).toBe('material')
      expect(result.items[3].item.category).toBe('breeding_item')
      expect(result.items[4].item.category).toBe('key_item')
    })

    it('should sort items alphabetically within the same category', () => {
      const inventory = createInventoryWithItems([
        { item: testManaPotion, quantity: 1 },
        { item: testPotion, quantity: 1 },
      ])

      const result = sortInventory(inventory)

      expect(result.items[0].item.name).toBe('Test Mana Potion')
      expect(result.items[1].item.name).toBe('Test Potion')
    })

    it('should return a new inventory object, not mutate the original', () => {
      const inventory = createInventoryWithItems([
        { item: testCaptureNet, quantity: 3 },
        { item: testPotion, quantity: 1 },
      ])

      const result = sortInventory(inventory)

      expect(result).not.toBe(inventory)
      expect(result.items).not.toBe(inventory.items)
    })

    it('should handle an empty inventory', () => {
      const inventory = createEmptyInventory()

      const result = sortInventory(inventory)

      expect(result.items).toHaveLength(0)
    })

    it('should preserve maxSlots and equipment after sorting', () => {
      const inventory = createInventoryWithItems(
        [
          { item: testCaptureNet, quantity: 3 },
          { item: testPotion, quantity: 1 },
        ],
        15,
      )

      const result = sortInventory(inventory)

      expect(result.maxSlots).toBe(15)
      expect(result.equipment).toEqual(inventory.equipment)
    })
  })

  // ── getConsumableItems ──

  describe('getConsumableItems', () => {
    it('should return only consumable items', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 3 },
        { item: testCaptureNet, quantity: 5 },
        { item: testManaPotion, quantity: 2 },
        { item: testKeyItem, quantity: 1 },
      ])

      const consumables = getConsumableItems(inventory)

      expect(consumables).toHaveLength(2)
      expect(consumables[0].item.itemId).toBe('test-potion')
      expect(consumables[1].item.itemId).toBe('test-mana-potion')
    })

    it('should return an empty array when no consumables exist', () => {
      const inventory = createInventoryWithItems([
        { item: testCaptureNet, quantity: 5 },
        { item: testKeyItem, quantity: 1 },
      ])

      const consumables = getConsumableItems(inventory)

      expect(consumables).toHaveLength(0)
    })

    it('should return an empty array for an empty inventory', () => {
      const inventory = createEmptyInventory()

      const consumables = getConsumableItems(inventory)

      expect(consumables).toHaveLength(0)
    })
  })

  // ── getCaptureDevices ──

  describe('getCaptureDevices', () => {
    it('should return only capture device items', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 3 },
        { item: testCaptureNet, quantity: 5 },
        { item: testKeyItem, quantity: 1 },
      ])

      const devices = getCaptureDevices(inventory)

      expect(devices).toHaveLength(1)
      expect(devices[0].item.itemId).toBe('test-net')
      expect(devices[0].quantity).toBe(5)
    })

    it('should return an empty array when no capture devices exist', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 3 },
        { item: testKeyItem, quantity: 1 },
      ])

      const devices = getCaptureDevices(inventory)

      expect(devices).toHaveLength(0)
    })

    it('should return an empty array for an empty inventory', () => {
      const inventory = createEmptyInventory()

      const devices = getCaptureDevices(inventory)

      expect(devices).toHaveLength(0)
    })
  })

  // ── Immutability Checks ──

  describe('immutability', () => {
    it('addItem should not mutate the original inventory', () => {
      const inventory = createEmptyInventory()
      const originalItems = inventory.items

      addItem(inventory, 'test-potion', 3)

      expect(inventory.items).toBe(originalItems)
      expect(inventory.items).toHaveLength(0)
    })

    it('addItem with stacking should not mutate the original inventory', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 2 },
      ])
      const originalItems = inventory.items
      const originalQuantity = inventory.items[0].quantity

      addItem(inventory, 'test-potion', 3)

      expect(inventory.items).toBe(originalItems)
      expect(inventory.items[0].quantity).toBe(originalQuantity)
    })

    it('removeItem should not mutate the original inventory', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 5 },
      ])
      const originalItems = inventory.items
      const originalQuantity = inventory.items[0].quantity

      removeItem(inventory, 'test-potion', 3)

      expect(inventory.items).toBe(originalItems)
      expect(inventory.items).toHaveLength(1)
      expect(inventory.items[0].quantity).toBe(originalQuantity)
    })

    it('removeItem that empties a slot should not mutate the original inventory', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 2 },
        { item: testCaptureNet, quantity: 5 },
      ])
      const originalItems = inventory.items

      removeItem(inventory, 'test-potion', 2)

      expect(inventory.items).toBe(originalItems)
      expect(inventory.items).toHaveLength(2)
    })

    it('useItem should not mutate the original inventory', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 3 },
      ])
      const originalItems = inventory.items

      useItem(inventory, 'test-potion')

      expect(inventory.items).toBe(originalItems)
      expect(inventory.items[0].quantity).toBe(3)
    })

    it('sortInventory should not mutate the original inventory', () => {
      const inventory = createInventoryWithItems([
        { item: testCaptureNet, quantity: 3 },
        { item: testPotion, quantity: 1 },
      ])
      const firstItemId = inventory.items[0].item.itemId

      sortInventory(inventory)

      expect(inventory.items[0].item.itemId).toBe(firstItemId)
    })

    it('addItem should return a new inventory object', () => {
      const inventory = createEmptyInventory()

      const result = addItem(inventory, 'test-potion', 1)

      expect(result).not.toBeNull()
      expect(result).not.toBe(inventory)
    })

    it('removeItem should return a new inventory object', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 3 },
      ])

      const result = removeItem(inventory, 'test-potion', 1)

      expect(result).not.toBeNull()
      expect(result).not.toBe(inventory)
    })
  })

  // ── Edge Cases ──

  describe('edge cases', () => {
    it('should handle adding a single item to an inventory with maxSlots of 1', () => {
      const inventory = createEmptyInventory(1)

      const result = addItem(inventory, 'test-potion', 1)

      expect(result).not.toBeNull()
      expect(result!.items).toHaveLength(1)
    })

    it('should fail to add a second distinct item when maxSlots is 1', () => {
      const inventory = createInventoryWithItems(
        [{ item: testPotion, quantity: 1 }],
        1,
      )

      const result = addItem(inventory, 'test-net', 1)

      expect(result).toBeNull()
    })

    it('should handle removing exactly all items from a single-slot inventory', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 1 },
      ])

      const result = removeItem(inventory, 'test-potion', 1)

      expect(result).not.toBeNull()
      expect(result!.items).toHaveLength(0)
    })

    it('should handle useItem on a key_item (non-stackable, quantity 1)', () => {
      const inventory = createInventoryWithItems([
        { item: testKeyItem, quantity: 1 },
      ])

      const result = useItem(inventory, 'test-key')

      expect(result).not.toBeNull()
      expect(result!.items).toHaveLength(0)
    })

    it('should handle multiple sequential operations correctly', () => {
      let inventory: Inventory | null = createEmptyInventory()

      inventory = addItem(inventory, 'test-potion', 3)
      expect(inventory).not.toBeNull()

      inventory = addItem(inventory!, 'test-net', 5)
      expect(inventory).not.toBeNull()

      inventory = removeItem(inventory!, 'test-potion', 1)
      expect(inventory).not.toBeNull()
      expect(getItemQuantity(inventory!, 'test-potion')).toBe(2)
      expect(getItemQuantity(inventory!, 'test-net')).toBe(5)

      inventory = useItem(inventory!, 'test-net')
      expect(inventory).not.toBeNull()
      expect(getItemQuantity(inventory!, 'test-net')).toBe(4)
    })

    it('should correctly report available slots after add and remove operations', () => {
      let inventory: Inventory | null = createEmptyInventory(5)
      expect(getAvailableSlots(inventory)).toBe(5)

      inventory = addItem(inventory, 'test-potion', 1)
      expect(getAvailableSlots(inventory!)).toBe(4)

      inventory = addItem(inventory!, 'test-net', 1)
      expect(getAvailableSlots(inventory!)).toBe(3)

      inventory = removeItem(inventory!, 'test-potion', 1)
      expect(getAvailableSlots(inventory!)).toBe(4)
    })

    it('should handle an item with maxStack of 1 that is stackable', () => {
      const singleStackItem: Item = {
        itemId: 'single-stack',
        name: 'Single Stack',
        description: 'Can only hold 1',
        category: 'material',
        iconKey: 'icon-single',
        stackable: true,
        maxStack: 1,
        useEffect: null,
        buyPrice: 10,
        sellPrice: 5,
      }
      loadItemData([...allTestItems, singleStackItem])

      const inventory = createEmptyInventory()
      const result = addItem(inventory, 'single-stack', 1)

      expect(result).not.toBeNull()
      expect(result!.items[0].quantity).toBe(1)

      const result2 = addItem(result!, 'single-stack', 1)
      expect(result2).toBeNull()
    })

    it('should handle sorting an inventory with a single item', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 3 },
      ])

      const result = sortInventory(inventory)

      expect(result.items).toHaveLength(1)
      expect(result.items[0].item.itemId).toBe('test-potion')
    })

    it('getConsumableItems and getCaptureDevices should not include other categories', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 1 },
        { item: testManaPotion, quantity: 1 },
        { item: testCaptureNet, quantity: 1 },
        { item: testKeyItem, quantity: 1 },
        { item: testMaterial, quantity: 1 },
        { item: testBreedingItem, quantity: 1 },
      ])

      const consumables = getConsumableItems(inventory)
      const devices = getCaptureDevices(inventory)

      expect(consumables).toHaveLength(2)
      expect(devices).toHaveLength(1)

      consumables.forEach((slot) => {
        expect(slot.item.category).toBe('consumable')
      })
      devices.forEach((slot) => {
        expect(slot.item.category).toBe('capture_device')
      })
    })

    it('canAddItem should return true for stacking in a full inventory', () => {
      const inventory = createInventoryWithItems(
        [
          { item: testPotion, quantity: 3 },
          { item: testCaptureNet, quantity: 5 },
        ],
        2,
      )

      expect(canAddItem(inventory, 'test-potion', 2)).toBe(true)
    })

    it('hasItem should return false after removing all of that item', () => {
      const inventory = createInventoryWithItems([
        { item: testPotion, quantity: 2 },
      ])

      const result = removeItem(inventory, 'test-potion', 2)

      expect(result).not.toBeNull()
      expect(hasItem(result!, 'test-potion')).toBe(false)
    })
  })
})
