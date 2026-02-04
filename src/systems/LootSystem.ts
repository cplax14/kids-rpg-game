import type { ItemDrop } from '../models/types'
import { randomChance, randomInt } from '../utils/math'

// ── Loot Table Types ──

interface LootEntry {
  readonly itemId: string
  readonly dropChance: number
  readonly minQuantity: number
  readonly maxQuantity: number
}

type LootTable = ReadonlyArray<LootEntry>

// ── Loot Tables by Species ──

const LOOT_TABLES: Readonly<Record<string, LootTable>> = {
  flamepup: [
    { itemId: 'flame-shard', dropChance: 0.4, minQuantity: 1, maxQuantity: 2 },
    { itemId: 'soft-fur', dropChance: 0.3, minQuantity: 1, maxQuantity: 1 },
    { itemId: 'potion-small', dropChance: 0.15, minQuantity: 1, maxQuantity: 1 },
  ],
  bubblefin: [
    { itemId: 'aqua-shard', dropChance: 0.4, minQuantity: 1, maxQuantity: 2 },
    { itemId: 'monster-bone', dropChance: 0.25, minQuantity: 1, maxQuantity: 1 },
    { itemId: 'ether-small', dropChance: 0.15, minQuantity: 1, maxQuantity: 1 },
  ],
  pebblit: [
    { itemId: 'earth-shard', dropChance: 0.4, minQuantity: 1, maxQuantity: 2 },
    { itemId: 'monster-bone', dropChance: 0.35, minQuantity: 1, maxQuantity: 2 },
    { itemId: 'potion-small', dropChance: 0.1, minQuantity: 1, maxQuantity: 1 },
  ],
  breezling: [
    { itemId: 'wind-shard', dropChance: 0.4, minQuantity: 1, maxQuantity: 2 },
    { itemId: 'soft-fur', dropChance: 0.3, minQuantity: 1, maxQuantity: 1 },
    { itemId: 'speed-berry', dropChance: 0.1, minQuantity: 1, maxQuantity: 1 },
  ],
  mossbun: [
    { itemId: 'soft-fur', dropChance: 0.5, minQuantity: 1, maxQuantity: 3 },
    { itemId: 'antidote', dropChance: 0.2, minQuantity: 1, maxQuantity: 1 },
    { itemId: 'earth-shard', dropChance: 0.15, minQuantity: 1, maxQuantity: 1 },
  ],
  shadowpup: [
    { itemId: 'monster-bone', dropChance: 0.35, minQuantity: 1, maxQuantity: 2 },
    { itemId: 'potion-medium', dropChance: 0.1, minQuantity: 1, maxQuantity: 1 },
    { itemId: 'power-seed', dropChance: 0.08, minQuantity: 1, maxQuantity: 1 },
  ],
  glowmoth: [
    { itemId: 'soft-fur', dropChance: 0.35, minQuantity: 1, maxQuantity: 2 },
    { itemId: 'ether-small', dropChance: 0.2, minQuantity: 1, maxQuantity: 1 },
    { itemId: 'wake-herb', dropChance: 0.15, minQuantity: 1, maxQuantity: 1 },
  ],
}

// Default table for species without a specific one
const DEFAULT_LOOT_TABLE: LootTable = [
  { itemId: 'monster-bone', dropChance: 0.25, minQuantity: 1, maxQuantity: 1 },
  { itemId: 'potion-small', dropChance: 0.1, minQuantity: 1, maxQuantity: 1 },
]

// ── Loot Generation ──

export function generateLoot(speciesId: string): ReadonlyArray<ItemDrop> {
  const table = LOOT_TABLES[speciesId] ?? DEFAULT_LOOT_TABLE
  const drops: ItemDrop[] = []

  for (const entry of table) {
    if (randomChance(entry.dropChance)) {
      const quantity = randomInt(entry.minQuantity, entry.maxQuantity)
      drops.push({ itemId: entry.itemId, quantity })
    }
  }

  return drops
}

export function generateBattleLoot(speciesIds: ReadonlyArray<string>): ReadonlyArray<ItemDrop> {
  const allDrops: ItemDrop[] = []

  for (const speciesId of speciesIds) {
    const drops = generateLoot(speciesId)
    for (const drop of drops) {
      const existing = allDrops.find((d) => d.itemId === drop.itemId)
      if (existing) {
        const index = allDrops.indexOf(existing)
        allDrops[index] = { itemId: drop.itemId, quantity: existing.quantity + drop.quantity }
      } else {
        allDrops.push({ ...drop })
      }
    }
  }

  return allDrops
}

export function hasLootTable(speciesId: string): boolean {
  return speciesId in LOOT_TABLES
}
