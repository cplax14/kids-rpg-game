import type {
  Equipment,
  EquipmentSlot,
  EquipmentSlots,
  PlayerCharacter,
  CharacterStats,
} from '../models/types'
import { EventBus } from '../events/EventBus'
import { GAME_EVENTS } from '../events/GameEvents'

// ── Equipment Registry ──

let equipmentRegistry: ReadonlyArray<Equipment> = []

export function loadEquipmentData(equipment: ReadonlyArray<Equipment>): void {
  equipmentRegistry = equipment
}

export function getEquipment(equipmentId: string): Equipment | undefined {
  return equipmentRegistry.find((e) => e.equipmentId === equipmentId)
}

export function getAllEquipment(): ReadonlyArray<Equipment> {
  return equipmentRegistry
}

export function getEquipmentBySlot(slot: EquipmentSlot): ReadonlyArray<Equipment> {
  return equipmentRegistry.filter((e) => e.slot === slot)
}

// ── Equip / Unequip ──

export interface EquipResult {
  readonly player: PlayerCharacter
  readonly unequipped: Equipment | null
}

export function equipItem(player: PlayerCharacter, equipment: Equipment): EquipResult | null {
  if (player.level < equipment.levelRequirement) return null

  const currentlyEquipped = player.equipment[equipment.slot]

  const updatedEquipment: EquipmentSlots = {
    ...player.equipment,
    [equipment.slot]: equipment,
  }

  const updatedPlayer: PlayerCharacter = {
    ...player,
    equipment: updatedEquipment,
  }

  EventBus.emit(GAME_EVENTS.EQUIPMENT_CHANGED, {
    slot: equipment.slot,
    equipped: equipment.equipmentId,
  })

  return { player: updatedPlayer, unequipped: currentlyEquipped }
}

export function unequipItem(
  player: PlayerCharacter,
  slot: EquipmentSlot,
): EquipResult {
  const currentlyEquipped = player.equipment[slot]

  const updatedEquipment: EquipmentSlots = {
    ...player.equipment,
    [slot]: null,
  }

  const updatedPlayer: PlayerCharacter = {
    ...player,
    equipment: updatedEquipment,
  }

  if (currentlyEquipped) {
    EventBus.emit(GAME_EVENTS.EQUIPMENT_CHANGED, {
      slot,
      equipped: null,
    })
  }

  return { player: updatedPlayer, unequipped: currentlyEquipped }
}

// ── Stat Calculations ──

export function calculateEquipmentBonuses(slots: EquipmentSlots): Partial<CharacterStats> {
  const bonuses: Record<string, number> = {}
  const equippedItems = [slots.weapon, slots.armor, slots.helmet, slots.accessory]

  for (const item of equippedItems) {
    if (!item) continue
    for (const [key, value] of Object.entries(item.statModifiers)) {
      if (typeof value === 'number') {
        bonuses[key] = (bonuses[key] ?? 0) + value
      }
    }
  }

  return bonuses as Partial<CharacterStats>
}

export function applyEquipmentStats(
  baseStats: CharacterStats,
  equipmentSlots: EquipmentSlots,
): CharacterStats {
  const bonuses = calculateEquipmentBonuses(equipmentSlots)

  return {
    maxHp: baseStats.maxHp + (bonuses.maxHp ?? 0),
    currentHp: baseStats.currentHp,
    maxMp: baseStats.maxMp + (bonuses.maxMp ?? 0),
    currentMp: baseStats.currentMp,
    attack: baseStats.attack + (bonuses.attack ?? 0),
    defense: baseStats.defense + (bonuses.defense ?? 0),
    magicAttack: baseStats.magicAttack + (bonuses.magicAttack ?? 0),
    magicDefense: baseStats.magicDefense + (bonuses.magicDefense ?? 0),
    speed: baseStats.speed + (bonuses.speed ?? 0),
    luck: baseStats.luck + (bonuses.luck ?? 0),
  }
}

// ── Equipment Comparison ──

export function compareEquipment(
  current: Equipment | null,
  candidate: Equipment,
): Partial<Record<keyof CharacterStats, number>> {
  const diff: Partial<Record<keyof CharacterStats, number>> = {}
  const currentMods = current?.statModifiers ?? {}
  const candidateMods = candidate.statModifiers

  const allKeys = new Set([
    ...Object.keys(currentMods),
    ...Object.keys(candidateMods),
  ]) as Set<keyof CharacterStats>

  for (const key of allKeys) {
    const currentVal = (currentMods[key] as number | undefined) ?? 0
    const candidateVal = (candidateMods[key] as number | undefined) ?? 0
    const change = candidateVal - currentVal
    if (change !== 0) {
      diff[key] = change
    }
  }

  return diff
}
