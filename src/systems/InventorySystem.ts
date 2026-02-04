import type { Item, Inventory, InventorySlot } from '../models/types'
import { MAX_INVENTORY_SLOTS } from '../config'
import { EventBus } from '../events/EventBus'
import { GAME_EVENTS } from '../events/GameEvents'

// ── Item Registry ──

let itemRegistry: ReadonlyArray<Item> = []

export function loadItemData(items: ReadonlyArray<Item>): void {
  itemRegistry = items
}

export function getItem(itemId: string): Item | undefined {
  return itemRegistry.find((i) => i.itemId === itemId)
}

export function getAllItems(): ReadonlyArray<Item> {
  return itemRegistry
}

// ── Inventory Queries ──

export function hasItem(inventory: Inventory, itemId: string): boolean {
  return inventory.items.some((slot) => slot.item.itemId === itemId)
}

export function getItemQuantity(inventory: Inventory, itemId: string): number {
  const slot = inventory.items.find((s) => s.item.itemId === itemId)
  return slot ? slot.quantity : 0
}

export function getAvailableSlots(inventory: Inventory): number {
  return inventory.maxSlots - inventory.items.length
}

export function canAddItem(inventory: Inventory, itemId: string, quantity: number): boolean {
  const existingSlot = inventory.items.find((s) => s.item.itemId === itemId)

  if (existingSlot) {
    return existingSlot.item.stackable && existingSlot.quantity + quantity <= existingSlot.item.maxStack
  }

  const item = getItem(itemId)
  if (!item) return false

  return inventory.items.length < inventory.maxSlots && quantity <= item.maxStack
}

// ── Inventory Mutations (Immutable) ──

export function addItem(
  inventory: Inventory,
  itemId: string,
  quantity: number,
): Inventory | null {
  const item = getItem(itemId)
  if (!item) return null
  if (quantity <= 0) return null

  const existingIndex = inventory.items.findIndex((s) => s.item.itemId === itemId)

  if (existingIndex >= 0) {
    const existing = inventory.items[existingIndex]
    if (!existing.item.stackable) return null

    const newQuantity = existing.quantity + quantity
    if (newQuantity > existing.item.maxStack) return null

    const updatedSlot: InventorySlot = { item: existing.item, quantity: newQuantity }
    const updatedItems = inventory.items.map((s, i) => (i === existingIndex ? updatedSlot : s))

    EventBus.emit(GAME_EVENTS.ITEM_ADDED, { itemId, quantity })
    return { ...inventory, items: updatedItems }
  }

  if (inventory.items.length >= inventory.maxSlots) return null
  if (quantity > item.maxStack) return null

  const newSlot: InventorySlot = { item, quantity }

  EventBus.emit(GAME_EVENTS.ITEM_ADDED, { itemId, quantity })
  return { ...inventory, items: [...inventory.items, newSlot] }
}

export function removeItem(
  inventory: Inventory,
  itemId: string,
  quantity: number,
): Inventory | null {
  if (quantity <= 0) return null

  const existingIndex = inventory.items.findIndex((s) => s.item.itemId === itemId)
  if (existingIndex < 0) return null

  const existing = inventory.items[existingIndex]
  if (existing.quantity < quantity) return null

  const newQuantity = existing.quantity - quantity

  if (newQuantity <= 0) {
    const updatedItems = inventory.items.filter((_, i) => i !== existingIndex)
    EventBus.emit(GAME_EVENTS.ITEM_REMOVED, { itemId, quantity })
    return { ...inventory, items: updatedItems }
  }

  const updatedSlot: InventorySlot = { item: existing.item, quantity: newQuantity }
  const updatedItems = inventory.items.map((s, i) => (i === existingIndex ? updatedSlot : s))

  EventBus.emit(GAME_EVENTS.ITEM_REMOVED, { itemId, quantity })
  return { ...inventory, items: updatedItems }
}

export function useItem(inventory: Inventory, itemId: string): Inventory | null {
  const result = removeItem(inventory, itemId, 1)
  if (result) {
    EventBus.emit(GAME_EVENTS.ITEM_USED, { itemId })
  }
  return result
}

// ── Sorting ──

export function sortInventory(inventory: Inventory): Inventory {
  const sorted = [...inventory.items].sort((a, b) => {
    // Sort by category first, then by name
    const categoryOrder: Record<string, number> = {
      consumable: 0,
      capture_device: 1,
      material: 2,
      breeding_item: 3,
      key_item: 4,
    }
    const catA = categoryOrder[a.item.category] ?? 99
    const catB = categoryOrder[b.item.category] ?? 99
    if (catA !== catB) return catA - catB
    return a.item.name.localeCompare(b.item.name)
  })

  return { ...inventory, items: sorted }
}

// ── Filtered Queries ──

export function getConsumableItems(inventory: Inventory): ReadonlyArray<InventorySlot> {
  return inventory.items.filter((s) => s.item.category === 'consumable')
}

export function getCaptureDevices(inventory: Inventory): ReadonlyArray<InventorySlot> {
  return inventory.items.filter((s) => s.item.category === 'capture_device')
}
