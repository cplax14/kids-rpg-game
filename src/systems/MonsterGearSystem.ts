import type {
  MonsterGear,
  MonsterGearSlot,
  MonsterGearSlots,
  MonsterInstance,
  CharacterStats,
} from '../models/types'
import { EventBus } from '../events/EventBus'
import { GAME_EVENTS } from '../events/GameEvents'

// ── Gear Registry ──

let gearRegistry: ReadonlyArray<MonsterGear> = []

export function loadMonsterGearData(gear: ReadonlyArray<MonsterGear>): void {
  gearRegistry = gear
}

export function getGear(gearId: string): MonsterGear | undefined {
  return gearRegistry.find((g) => g.gearId === gearId)
}

export function getAllGear(): ReadonlyArray<MonsterGear> {
  return gearRegistry
}

export function getGearBySlot(slot: MonsterGearSlot): ReadonlyArray<MonsterGear> {
  return gearRegistry.filter((g) => g.slot === slot)
}

export function clearMonsterGearRegistry(): void {
  gearRegistry = []
}

// ── Default Gear Slots ──

export function createEmptyGearSlots(): MonsterGearSlots {
  return {
    collar: null,
    saddle: null,
    charm: null,
    claws: null,
  }
}

// ── Equip / Unequip ──

export interface GearEquipResult {
  readonly monster: MonsterInstance
  readonly unequipped: MonsterGear | null
}

export function canEquipGear(monster: MonsterInstance, gear: MonsterGear): boolean {
  return monster.level >= gear.levelRequirement
}

export function equipGear(
  monster: MonsterInstance,
  gear: MonsterGear,
): GearEquipResult | null {
  if (!canEquipGear(monster, gear)) {
    return null
  }

  const currentlyEquipped = monster.equippedGear[gear.slot]

  const updatedGearSlots: MonsterGearSlots = {
    ...monster.equippedGear,
    [gear.slot]: gear,
  }

  const updatedMonster: MonsterInstance = {
    ...monster,
    equippedGear: updatedGearSlots,
  }

  EventBus.emit(GAME_EVENTS.MONSTER_GEAR_EQUIPPED, {
    monster: updatedMonster,
    gear,
    slot: gear.slot,
  })

  return { monster: updatedMonster, unequipped: currentlyEquipped }
}

export function unequipGear(
  monster: MonsterInstance,
  slot: MonsterGearSlot,
): GearEquipResult {
  const currentlyEquipped = monster.equippedGear[slot]

  const updatedGearSlots: MonsterGearSlots = {
    ...monster.equippedGear,
    [slot]: null,
  }

  const updatedMonster: MonsterInstance = {
    ...monster,
    equippedGear: updatedGearSlots,
  }

  if (currentlyEquipped) {
    EventBus.emit(GAME_EVENTS.MONSTER_GEAR_UNEQUIPPED, {
      monster: updatedMonster,
      gear: currentlyEquipped,
      slot,
    })
  }

  return { monster: updatedMonster, unequipped: currentlyEquipped }
}

// ── Stat Calculations ──

export function calculateGearBonuses(slots: MonsterGearSlots | undefined | null): Partial<CharacterStats> {
  const bonuses: Record<string, number> = {}

  // Handle old saves that don't have equippedGear
  if (!slots) {
    return bonuses as Partial<CharacterStats>
  }

  const equippedGear = [slots.collar, slots.saddle, slots.charm, slots.claws]

  for (const gear of equippedGear) {
    if (!gear) continue
    for (const [key, value] of Object.entries(gear.statModifiers)) {
      if (typeof value === 'number') {
        bonuses[key] = (bonuses[key] ?? 0) + value
      }
    }
  }

  return bonuses as Partial<CharacterStats>
}

export function applyGearStats(
  baseStats: CharacterStats,
  gearSlots: MonsterGearSlots | undefined | null,
): CharacterStats {
  // Handle old saves that don't have equippedGear
  if (!gearSlots) {
    return baseStats
  }

  const bonuses = calculateGearBonuses(gearSlots)

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

// ── Gear Comparison ──

export function compareGear(
  current: MonsterGear | null,
  candidate: MonsterGear,
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

// ── Get total gear value ──

export function getTotalGearValue(slots: MonsterGearSlots | undefined | null): number {
  if (!slots) {
    return 0
  }

  const equippedGear = [slots.collar, slots.saddle, slots.charm, slots.claws]
  let total = 0

  for (const gear of equippedGear) {
    if (gear) {
      total += gear.sellPrice
    }
  }

  return total
}

// ── Check if monster has any gear equipped ──

export function hasAnyGearEquipped(slots: MonsterGearSlots | undefined | null): boolean {
  if (!slots) {
    return false
  }
  return !!(slots.collar || slots.saddle || slots.charm || slots.claws)
}

// ── Get all equipped gear as array ──

export function getEquippedGearList(slots: MonsterGearSlots | undefined | null): ReadonlyArray<MonsterGear> {
  if (!slots) {
    return []
  }
  const gear: MonsterGear[] = []
  if (slots.collar) gear.push(slots.collar)
  if (slots.saddle) gear.push(slots.saddle)
  if (slots.charm) gear.push(slots.charm)
  if (slots.claws) gear.push(slots.claws)
  return gear
}
