import type { Item, Equipment, Inventory, PlayerCharacter } from '../models/types'
import { getItem } from './InventorySystem'
import { getEquipment } from './EquipmentSystem'

// ── Shop Types ──

export interface ShopItem {
  readonly id: string
  readonly type: 'item' | 'equipment'
  readonly buyPrice: number
  readonly sellPrice: number
}

export interface ShopInventory {
  readonly shopId: string
  readonly items: ReadonlyArray<ShopItem>
  readonly buyMultiplier: number
  readonly sellMultiplier: number
}

// ── Shop Definitions ──

const SHOP_INVENTORIES: Readonly<Record<string, ShopInventory>> = {
  'village-shop': {
    shopId: 'village-shop',
    items: [
      // Consumables
      { id: 'potion-small', type: 'item', buyPrice: 50, sellPrice: 25 },
      { id: 'potion-medium', type: 'item', buyPrice: 150, sellPrice: 75 },
      { id: 'ether-small', type: 'item', buyPrice: 80, sellPrice: 40 },
      { id: 'antidote', type: 'item', buyPrice: 40, sellPrice: 20 },
      { id: 'wake-herb', type: 'item', buyPrice: 40, sellPrice: 20 },
      { id: 'capture-capsule', type: 'item', buyPrice: 100, sellPrice: 50 },
      { id: 'super-capsule', type: 'item', buyPrice: 300, sellPrice: 150 },
      // Starter equipment
      { id: 'wooden-sword', type: 'equipment', buyPrice: 120, sellPrice: 60 },
      { id: 'wooden-staff', type: 'equipment', buyPrice: 120, sellPrice: 60 },
      { id: 'wooden-bow', type: 'equipment', buyPrice: 150, sellPrice: 75 },
      { id: 'leather-vest', type: 'equipment', buyPrice: 100, sellPrice: 50 },
      { id: 'leather-cap', type: 'equipment', buyPrice: 80, sellPrice: 40 },
      { id: 'copper-ring', type: 'equipment', buyPrice: 200, sellPrice: 100 },
    ],
    buyMultiplier: 1.0,
    sellMultiplier: 0.5,
  },
}

// ── Shop Queries ──

export function getShopInventory(shopId: string): ShopInventory | undefined {
  return SHOP_INVENTORIES[shopId]
}

export function calculateBuyPrice(shopItem: ShopItem, shop: ShopInventory): number {
  return Math.floor(shopItem.buyPrice * shop.buyMultiplier)
}

export function calculateSellPrice(shopItem: ShopItem, shop: ShopInventory): number {
  return Math.floor(shopItem.sellPrice * shop.sellMultiplier)
}

export function calculateItemSellPrice(item: Item, shop: ShopInventory): number {
  return Math.floor(item.sellPrice * shop.sellMultiplier)
}

export function calculateEquipmentSellPrice(equipment: Equipment, shop: ShopInventory): number {
  return Math.floor(equipment.sellPrice * shop.sellMultiplier)
}

export function canAfford(player: PlayerCharacter, price: number): boolean {
  return player.gold >= price
}

export function hasInventorySpace(inventory: Inventory): boolean {
  return inventory.items.length < inventory.maxSlots
}

// ── Shop Item Details ──

export function getShopItemDetails(
  shopItem: ShopItem,
): { readonly name: string; readonly description: string } | null {
  if (shopItem.type === 'item') {
    const item = getItem(shopItem.id)
    if (!item) return null
    return { name: item.name, description: item.description }
  } else {
    const equipment = getEquipment(shopItem.id)
    if (!equipment) return null
    return { name: equipment.name, description: equipment.description }
  }
}

export function getAvailableShops(): ReadonlyArray<string> {
  return Object.keys(SHOP_INVENTORIES)
}
