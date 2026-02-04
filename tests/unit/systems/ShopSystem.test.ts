import { describe, it, expect, vi } from 'vitest'

// Mock transitive dependencies that pull in Phaser
vi.mock('../../../src/events/EventBus', () => ({
  EventBus: { emit: vi.fn(), on: vi.fn(), once: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() },
}))

import {
  getShopInventory,
  calculateBuyPrice,
  calculateSellPrice,
  calculateItemSellPrice,
  calculateEquipmentSellPrice,
  canAfford,
  hasInventorySpace,
  getShopItemDetails,
  getAvailableShops,
  type ShopItem,
  type ShopInventory,
} from '../../../src/systems/ShopSystem'
import { loadItemData } from '../../../src/systems/InventorySystem'
import { loadEquipmentData } from '../../../src/systems/EquipmentSystem'
import type { Item, Equipment, PlayerCharacter, Inventory, CharacterStats } from '../../../src/models/types'

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

function makeShopItem(overrides?: Partial<ShopItem>): ShopItem {
  return {
    id: 'potion-small',
    type: 'item',
    buyPrice: 50,
    sellPrice: 25,
    ...overrides,
  }
}

function makeShop(overrides?: Partial<ShopInventory>): ShopInventory {
  return {
    shopId: 'test-shop',
    items: [],
    buyMultiplier: 1.0,
    sellMultiplier: 0.5,
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

function makeInventory(overrides?: Partial<Inventory>): Inventory {
  return {
    items: [],
    maxSlots: 20,
    equipment: [],
    ...overrides,
  }
}

// ── getShopInventory ──

describe('getShopInventory', () => {
  it('should return the village-shop inventory', () => {
    const shop = getShopInventory('village-shop')

    expect(shop).toBeDefined()
    expect(shop!.shopId).toBe('village-shop')
    expect(shop!.items.length).toBeGreaterThan(0)
  })

  it('should return undefined for a non-existent shop', () => {
    const shop = getShopInventory('non-existent-shop')

    expect(shop).toBeUndefined()
  })

  it('should include both item and equipment types', () => {
    const shop = getShopInventory('village-shop')!
    const types = new Set(shop.items.map((i) => i.type))

    expect(types.has('item')).toBe(true)
    expect(types.has('equipment')).toBe(true)
  })
})

// ── calculateBuyPrice ──

describe('calculateBuyPrice', () => {
  it('should return the buy price multiplied by shop multiplier', () => {
    const shopItem = makeShopItem({ buyPrice: 100 })
    const shop = makeShop({ buyMultiplier: 1.0 })

    expect(calculateBuyPrice(shopItem, shop)).toBe(100)
  })

  it('should apply a multiplier greater than 1', () => {
    const shopItem = makeShopItem({ buyPrice: 100 })
    const shop = makeShop({ buyMultiplier: 1.5 })

    expect(calculateBuyPrice(shopItem, shop)).toBe(150)
  })

  it('should floor the result for fractional prices', () => {
    const shopItem = makeShopItem({ buyPrice: 33 })
    const shop = makeShop({ buyMultiplier: 1.1 })

    // 33 * 1.1 = 36.3 => floor = 36
    expect(calculateBuyPrice(shopItem, shop)).toBe(36)
  })
})

// ── calculateItemSellPrice ──

describe('calculateItemSellPrice', () => {
  it('should return the item sell price multiplied by shop sell multiplier', () => {
    const item = makeItem({ sellPrice: 100 })
    const shop = makeShop({ sellMultiplier: 0.5 })

    expect(calculateItemSellPrice(item, shop)).toBe(50)
  })

  it('should floor the result for fractional prices', () => {
    const item = makeItem({ sellPrice: 33 })
    const shop = makeShop({ sellMultiplier: 0.5 })

    // 33 * 0.5 = 16.5 => floor = 16
    expect(calculateItemSellPrice(item, shop)).toBe(16)
  })

  it('should return 0 when sell price is 0', () => {
    const item = makeItem({ sellPrice: 0 })
    const shop = makeShop({ sellMultiplier: 0.5 })

    expect(calculateItemSellPrice(item, shop)).toBe(0)
  })
})

// ── canAfford ──

describe('canAfford', () => {
  it('should return true when player has enough gold', () => {
    const player = makePlayer({ gold: 500 })

    expect(canAfford(player, 300)).toBe(true)
  })

  it('should return true when player has exactly enough gold', () => {
    const player = makePlayer({ gold: 100 })

    expect(canAfford(player, 100)).toBe(true)
  })

  it('should return false when player does not have enough gold', () => {
    const player = makePlayer({ gold: 50 })

    expect(canAfford(player, 100)).toBe(false)
  })

  it('should return true when price is 0', () => {
    const player = makePlayer({ gold: 0 })

    expect(canAfford(player, 0)).toBe(true)
  })
})

// ── hasInventorySpace ──

describe('hasInventorySpace', () => {
  it('should return true when inventory has free slots', () => {
    const inventory = makeInventory({ items: [], maxSlots: 20 })

    expect(hasInventorySpace(inventory)).toBe(true)
  })

  it('should return false when inventory is full', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      item: makeItem({ itemId: `item-${i}` }),
      quantity: 1,
    }))
    const inventory = makeInventory({ items, maxSlots: 20 })

    expect(hasInventorySpace(inventory)).toBe(false)
  })

  it('should return true when inventory has exactly one slot remaining', () => {
    const items = Array.from({ length: 19 }, (_, i) => ({
      item: makeItem({ itemId: `item-${i}` }),
      quantity: 1,
    }))
    const inventory = makeInventory({ items, maxSlots: 20 })

    expect(hasInventorySpace(inventory)).toBe(true)
  })
})

// ── calculateSellPrice ──

describe('calculateSellPrice', () => {
  it('should return the sell price multiplied by shop multiplier', () => {
    const shopItem = makeShopItem({ sellPrice: 60 })
    const shop = makeShop({ sellMultiplier: 0.5 })

    expect(calculateSellPrice(shopItem, shop)).toBe(30)
  })

  it('should floor fractional results', () => {
    const shopItem = makeShopItem({ sellPrice: 33 })
    const shop = makeShop({ sellMultiplier: 0.5 })

    expect(calculateSellPrice(shopItem, shop)).toBe(16)
  })
})

// ── calculateEquipmentSellPrice ──

describe('calculateEquipmentSellPrice', () => {
  it('should return the equipment sell price multiplied by shop multiplier', () => {
    const equipment: Equipment = {
      equipmentId: 'wooden-sword',
      name: 'Wooden Sword',
      description: 'A basic sword.',
      slot: 'weapon',
      statModifiers: { attack: 3 },
      levelRequirement: 1,
      iconKey: 'icon-sword',
      buyPrice: 120,
      sellPrice: 60,
    }
    const shop = makeShop({ sellMultiplier: 0.5 })

    expect(calculateEquipmentSellPrice(equipment, shop)).toBe(30)
  })
})

// ── getShopItemDetails ──

describe('getShopItemDetails', () => {
  it('should return item details for an item-type shop entry', () => {
    loadItemData([
      {
        itemId: 'potion-small',
        name: 'Small Potion',
        description: 'Heals 30 HP.',
        category: 'consumable',
        iconKey: 'potion',
        stackable: true,
        maxStack: 99,
        useEffect: { type: 'heal_hp', magnitude: 30, targetType: 'single_ally' },
        buyPrice: 50,
        sellPrice: 25,
      },
    ])

    const details = getShopItemDetails(makeShopItem({ id: 'potion-small', type: 'item' }))

    expect(details).not.toBeNull()
    expect(details!.name).toBe('Small Potion')
    expect(details!.description).toBe('Heals 30 HP.')
  })

  it('should return null for an item not in the registry', () => {
    loadItemData([])

    const details = getShopItemDetails(makeShopItem({ id: 'unknown-item', type: 'item' }))

    expect(details).toBeNull()
  })

  it('should return equipment details for an equipment-type shop entry', () => {
    loadEquipmentData([
      {
        equipmentId: 'wooden-sword',
        name: 'Wooden Sword',
        description: 'A basic sword.',
        slot: 'weapon',
        statModifiers: { attack: 3 },
        levelRequirement: 1,
        iconKey: 'icon-sword',
        buyPrice: 120,
        sellPrice: 60,
      },
    ])

    const details = getShopItemDetails(makeShopItem({ id: 'wooden-sword', type: 'equipment' }))

    expect(details).not.toBeNull()
    expect(details!.name).toBe('Wooden Sword')
  })

  it('should return null for equipment not in the registry', () => {
    loadEquipmentData([])

    const details = getShopItemDetails(makeShopItem({ id: 'unknown-equip', type: 'equipment' }))

    expect(details).toBeNull()
  })
})

// ── getAvailableShops ──

describe('getAvailableShops', () => {
  it('should include village-shop', () => {
    const shops = getAvailableShops()

    expect(shops).toContain('village-shop')
  })

  it('should return an array of shop IDs', () => {
    const shops = getAvailableShops()

    expect(Array.isArray(shops)).toBe(true)
    expect(shops.length).toBeGreaterThan(0)
  })
})
