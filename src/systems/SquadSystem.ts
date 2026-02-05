import type {
  MonsterInstance,
  BattleCombatant,
  CharacterStats,
} from '../models/types'
import { MAX_SQUAD_SIZE } from '../config'
import {
  BOND_PER_BATTLE,
  BOND_PER_WIN,
  BOND_STAT_BONUS_MAX,
  BOND_MAX,
} from '../models/constants'
import { clamp } from '../utils/math'
import { setMonsterInSquad, increaseBondLevel, getSpecies } from './MonsterSystem'
import { generateId } from '../utils/id'

// ── Squad Queries ──

export function isSquadFull(squad: ReadonlyArray<MonsterInstance>): boolean {
  return squad.length >= MAX_SQUAD_SIZE
}

export function getSquadCount(squad: ReadonlyArray<MonsterInstance>): number {
  return squad.length
}

export function findSquadMonster(
  squad: ReadonlyArray<MonsterInstance>,
  instanceId: string,
): MonsterInstance | undefined {
  return squad.find((m) => m.instanceId === instanceId)
}

// ── Squad Mutations (Immutable) ──

export function addToSquad(
  squad: ReadonlyArray<MonsterInstance>,
  monster: MonsterInstance,
): ReadonlyArray<MonsterInstance> | null {
  if (isSquadFull(squad)) {
    return null
  }

  const updatedMonster = setMonsterInSquad(monster, true)
  return [...squad, updatedMonster]
}

export function removeFromSquad(
  squad: ReadonlyArray<MonsterInstance>,
  instanceId: string,
): ReadonlyArray<MonsterInstance> {
  return squad
    .filter((m) => m.instanceId !== instanceId)
    .map((m) => setMonsterInSquad(m, true)) // Keep remaining monsters in squad
}

export function swapSquadPositions(
  squad: ReadonlyArray<MonsterInstance>,
  indexA: number,
  indexB: number,
): ReadonlyArray<MonsterInstance> {
  if (
    indexA < 0 ||
    indexA >= squad.length ||
    indexB < 0 ||
    indexB >= squad.length ||
    indexA === indexB
  ) {
    return squad
  }

  const result = [...squad]
  const temp = result[indexA]
  result[indexA] = result[indexB]
  result[indexB] = temp
  return result
}

// ── Storage Transfer ──

export function moveToStorage(
  squad: ReadonlyArray<MonsterInstance>,
  storage: ReadonlyArray<MonsterInstance>,
  instanceId: string,
): { squad: ReadonlyArray<MonsterInstance>; storage: ReadonlyArray<MonsterInstance> } | null {
  const monster = squad.find((m) => m.instanceId === instanceId)
  if (!monster) {
    return null
  }

  const updatedMonster = setMonsterInSquad(monster, false)
  const newSquad = squad.filter((m) => m.instanceId !== instanceId)
  const newStorage = [...storage, updatedMonster]

  return { squad: newSquad, storage: newStorage }
}

export function moveToSquad(
  squad: ReadonlyArray<MonsterInstance>,
  storage: ReadonlyArray<MonsterInstance>,
  instanceId: string,
): { squad: ReadonlyArray<MonsterInstance>; storage: ReadonlyArray<MonsterInstance> } | null {
  if (isSquadFull(squad)) {
    return null
  }

  const monster = storage.find((m) => m.instanceId === instanceId)
  if (!monster) {
    return null
  }

  const updatedMonster = setMonsterInSquad(monster, true)
  const newStorage = storage.filter((m) => m.instanceId !== instanceId)
  const newSquad = [...squad, updatedMonster]

  return { squad: newSquad, storage: newStorage }
}

// ── Bond System ──

export function applyBondBonus(monster: MonsterInstance): CharacterStats {
  const bondPercent = monster.bondLevel / BOND_MAX
  const bonusMultiplier = 1 + bondPercent * BOND_STAT_BONUS_MAX

  return {
    maxHp: Math.floor(monster.stats.maxHp * bonusMultiplier),
    currentHp: Math.floor(monster.stats.currentHp * bonusMultiplier),
    maxMp: Math.floor(monster.stats.maxMp * bonusMultiplier),
    currentMp: Math.floor(monster.stats.currentMp * bonusMultiplier),
    attack: Math.floor(monster.stats.attack * bonusMultiplier),
    defense: Math.floor(monster.stats.defense * bonusMultiplier),
    magicAttack: Math.floor(monster.stats.magicAttack * bonusMultiplier),
    magicDefense: Math.floor(monster.stats.magicDefense * bonusMultiplier),
    speed: Math.floor(monster.stats.speed * bonusMultiplier),
    luck: monster.stats.luck, // Luck doesn't get bond bonus
  }
}

export function applyPostBattleBond(
  squad: ReadonlyArray<MonsterInstance>,
  won: boolean,
): ReadonlyArray<MonsterInstance> {
  const bondAmount = BOND_PER_BATTLE + (won ? BOND_PER_WIN : 0)

  return squad.map((monster) => increaseBondLevel(monster, bondAmount))
}

// ── Combat Integration ──

export function createSquadCombatants(
  squad: ReadonlyArray<MonsterInstance>,
): ReadonlyArray<BattleCombatant> {
  return squad
    .filter((monster) => monster.stats.currentHp > 0)
    .map((monster) => {
      const species = getSpecies(monster.speciesId)
      const bondedStats = applyBondBonus(monster)

      return {
        combatantId: `squad-${monster.instanceId}`,
        name: monster.nickname ?? species?.name ?? 'Monster',
        isPlayer: true,
        isMonster: true,
        stats: bondedStats,
        abilities: monster.learnedAbilities,
        statusEffects: [],
        capturable: false, // Player's monsters cannot be captured
      }
    })
}

export function createCombatantFromMonster(
  monster: MonsterInstance,
  useBondBonus: boolean = true,
): BattleCombatant {
  const species = getSpecies(monster.speciesId)
  const stats = useBondBonus ? applyBondBonus(monster) : monster.stats

  return {
    combatantId: `squad-${monster.instanceId}`,
    name: monster.nickname ?? species?.name ?? 'Monster',
    isPlayer: true,
    isMonster: true,
    stats,
    abilities: monster.learnedAbilities,
    statusEffects: [],
    capturable: false,
  }
}

// ── Nickname ──

export function setMonsterNickname(
  squad: ReadonlyArray<MonsterInstance>,
  instanceId: string,
  nickname: string | null,
): ReadonlyArray<MonsterInstance> {
  return squad.map((m) =>
    m.instanceId === instanceId
      ? { ...m, nickname }
      : m
  )
}

export function setStorageMonsterNickname(
  storage: ReadonlyArray<MonsterInstance>,
  instanceId: string,
  nickname: string | null,
): ReadonlyArray<MonsterInstance> {
  return storage.map((m) =>
    m.instanceId === instanceId
      ? { ...m, nickname }
      : m
  )
}

// ── Update Monster in Squad (after battle healing, etc.) ──

export function updateSquadMonster(
  squad: ReadonlyArray<MonsterInstance>,
  updatedMonster: MonsterInstance,
): ReadonlyArray<MonsterInstance> {
  return squad.map((m) =>
    m.instanceId === updatedMonster.instanceId ? updatedMonster : m
  )
}

// ── Get alive monsters ──

export function getAliveSquadMonsters(
  squad: ReadonlyArray<MonsterInstance>,
): ReadonlyArray<MonsterInstance> {
  return squad.filter((m) => m.stats.currentHp > 0)
}
