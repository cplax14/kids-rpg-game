import type { PlayerCharacter, CharacterStats, EquipmentSlots, Position } from '../models/types'
import { XP_TABLE, MAX_LEVEL } from '../models/constants'
import { generateId } from '../utils/id'
import { EventBus } from '../events/EventBus'
import { GAME_EVENTS } from '../events/GameEvents'
import { applyEquipmentStats } from './EquipmentSystem'

const BASE_PLAYER_STATS: CharacterStats = {
  maxHp: 120,
  currentHp: 120,
  maxMp: 40,
  currentMp: 40,
  attack: 18,
  defense: 14,
  magicAttack: 12,
  magicDefense: 10,
  speed: 14,
  luck: 8,
}

const PLAYER_STAT_GROWTH = {
  hp: 12,
  mp: 4,
  attack: 3,
  defense: 2,
  magicAttack: 2,
  magicDefense: 2,
  speed: 2,
  luck: 1,
}

// Player abilities learned at specific levels
export const PLAYER_ABILITY_PROGRESSION: ReadonlyArray<{
  readonly level: number
  readonly abilityId: string
}> = [
  { level: 1, abilityId: 'tackle' },
  { level: 1, abilityId: 'heal' },
  { level: 3, abilityId: 'power-strike' },
  { level: 5, abilityId: 'war-cry' },
  { level: 7, abilityId: 'group-heal' },
  { level: 10, abilityId: 'defense-boost' },
  { level: 12, abilityId: 'quick-step' },
  { level: 15, abilityId: 'light-beam' },
  { level: 18, abilityId: 'radiance' },
  { level: 20, abilityId: 'regen' },
]

export function getPlayerAbilitiesAtLevel(level: number): ReadonlyArray<string> {
  return PLAYER_ABILITY_PROGRESSION.filter((entry) => entry.level <= level).map(
    (entry) => entry.abilityId,
  )
}

export function getNewAbilitiesForLevelUp(
  previousLevel: number,
  newLevel: number,
): ReadonlyArray<string> {
  return PLAYER_ABILITY_PROGRESSION.filter(
    (entry) => entry.level > previousLevel && entry.level <= newLevel,
  ).map((entry) => entry.abilityId)
}

export function createNewPlayer(name: string): PlayerCharacter {
  return {
    id: generateId(),
    name,
    level: 1,
    experience: 0,
    experienceToNextLevel: XP_TABLE[2],
    stats: { ...BASE_PLAYER_STATS },
    equipment: {
      weapon: null,
      armor: null,
      helmet: null,
      accessory: null,
    },
    position: { x: 0, y: 0 },
    currentAreaId: 'sunlit-village',
    gold: 100,
  }
}

export function getXpForLevel(level: number): number {
  if (level < 1) return 0
  if (level >= XP_TABLE.length) return XP_TABLE[XP_TABLE.length - 1]
  return XP_TABLE[level]
}

export function getXpToNextLevel(level: number): number {
  if (level >= MAX_LEVEL) return 0
  return getXpForLevel(level + 1)
}

export function calculateStatsForLevel(level: number): CharacterStats {
  const levelsGained = level - 1
  return {
    maxHp: BASE_PLAYER_STATS.maxHp + PLAYER_STAT_GROWTH.hp * levelsGained,
    currentHp: BASE_PLAYER_STATS.maxHp + PLAYER_STAT_GROWTH.hp * levelsGained,
    maxMp: BASE_PLAYER_STATS.maxMp + PLAYER_STAT_GROWTH.mp * levelsGained,
    currentMp: BASE_PLAYER_STATS.maxMp + PLAYER_STAT_GROWTH.mp * levelsGained,
    attack: BASE_PLAYER_STATS.attack + PLAYER_STAT_GROWTH.attack * levelsGained,
    defense: BASE_PLAYER_STATS.defense + PLAYER_STAT_GROWTH.defense * levelsGained,
    magicAttack: BASE_PLAYER_STATS.magicAttack + PLAYER_STAT_GROWTH.magicAttack * levelsGained,
    magicDefense: BASE_PLAYER_STATS.magicDefense + PLAYER_STAT_GROWTH.magicDefense * levelsGained,
    speed: BASE_PLAYER_STATS.speed + PLAYER_STAT_GROWTH.speed * levelsGained,
    luck: BASE_PLAYER_STATS.luck + PLAYER_STAT_GROWTH.luck * levelsGained,
  }
}

export interface StatChange {
  readonly stat: string
  readonly label: string
  readonly previousValue: number
  readonly newValue: number
  readonly change: number
}

export interface PlayerLevelUpResult {
  readonly player: PlayerCharacter
  readonly didLevelUp: boolean
  readonly previousLevel: number
  readonly newLevel: number
  readonly statChanges: ReadonlyArray<StatChange>
  readonly newAbilities: ReadonlyArray<string>
}

export function addExperience(player: PlayerCharacter, xpGained: number): PlayerCharacter {
  return addExperienceWithInfo(player, xpGained).player
}

export function addExperienceWithInfo(player: PlayerCharacter, xpGained: number): PlayerLevelUpResult {
  if (player.level >= MAX_LEVEL) {
    return {
      player,
      didLevelUp: false,
      previousLevel: player.level,
      newLevel: player.level,
      statChanges: [],
      newAbilities: [],
    }
  }

  const previousLevel = player.level
  const newXp = player.experience + xpGained
  let currentLevel = player.level
  let remainingXp = newXp

  // Check for multiple level-ups
  while (currentLevel < MAX_LEVEL && remainingXp >= getXpToNextLevel(currentLevel)) {
    currentLevel++
  }

  if (currentLevel > player.level) {
    const previousStats = player.stats
    const newStats = calculateStatsForLevel(currentLevel)

    // Calculate stat changes
    const statChanges: StatChange[] = [
      {
        stat: 'maxHp',
        label: 'HP',
        previousValue: previousStats.maxHp,
        newValue: newStats.maxHp,
        change: newStats.maxHp - previousStats.maxHp,
      },
      {
        stat: 'maxMp',
        label: 'MP',
        previousValue: previousStats.maxMp,
        newValue: newStats.maxMp,
        change: newStats.maxMp - previousStats.maxMp,
      },
      {
        stat: 'attack',
        label: 'Attack',
        previousValue: previousStats.attack,
        newValue: newStats.attack,
        change: newStats.attack - previousStats.attack,
      },
      {
        stat: 'defense',
        label: 'Defense',
        previousValue: previousStats.defense,
        newValue: newStats.defense,
        change: newStats.defense - previousStats.defense,
      },
      {
        stat: 'magicAttack',
        label: 'M.Atk',
        previousValue: previousStats.magicAttack,
        newValue: newStats.magicAttack,
        change: newStats.magicAttack - previousStats.magicAttack,
      },
      {
        stat: 'magicDefense',
        label: 'M.Def',
        previousValue: previousStats.magicDefense,
        newValue: newStats.magicDefense,
        change: newStats.magicDefense - previousStats.magicDefense,
      },
      {
        stat: 'speed',
        label: 'Speed',
        previousValue: previousStats.speed,
        newValue: newStats.speed,
        change: newStats.speed - previousStats.speed,
      },
      {
        stat: 'luck',
        label: 'Luck',
        previousValue: previousStats.luck,
        newValue: newStats.luck,
        change: newStats.luck - previousStats.luck,
      },
    ]

    // Get new abilities learned
    const newAbilities = getNewAbilitiesForLevelUp(previousLevel, currentLevel)

    // Preserve current HP/MP ratios
    const hpRatio = player.stats.currentHp / player.stats.maxHp
    const mpRatio = player.stats.maxMp > 0 ? player.stats.currentMp / player.stats.maxMp : 1

    const updatedPlayer: PlayerCharacter = {
      ...player,
      level: currentLevel,
      experience: remainingXp,
      experienceToNextLevel: getXpToNextLevel(currentLevel),
      stats: {
        ...newStats,
        currentHp: Math.ceil(newStats.maxHp * hpRatio),
        currentMp: Math.ceil(newStats.maxMp * mpRatio),
      },
    }

    EventBus.emit(GAME_EVENTS.PLAYER_LEVEL_UP, {
      player: updatedPlayer,
      newLevel: currentLevel,
    })

    return {
      player: updatedPlayer,
      didLevelUp: true,
      previousLevel,
      newLevel: currentLevel,
      statChanges,
      newAbilities,
    }
  }

  return {
    player: {
      ...player,
      experience: newXp,
    },
    didLevelUp: false,
    previousLevel,
    newLevel: previousLevel,
    statChanges: [],
    newAbilities: [],
  }
}

export function healPlayer(
  player: PlayerCharacter,
  hpAmount: number,
  mpAmount: number,
): PlayerCharacter {
  return {
    ...player,
    stats: {
      ...player.stats,
      currentHp: Math.min(player.stats.currentHp + hpAmount, player.stats.maxHp),
      currentMp: Math.min(player.stats.currentMp + mpAmount, player.stats.maxMp),
    },
  }
}

export function fullHeal(player: PlayerCharacter): PlayerCharacter {
  return {
    ...player,
    stats: {
      ...player.stats,
      currentHp: player.stats.maxHp,
      currentMp: player.stats.maxMp,
    },
  }
}

export function damagePlayer(player: PlayerCharacter, amount: number): PlayerCharacter {
  return {
    ...player,
    stats: {
      ...player.stats,
      currentHp: Math.max(0, player.stats.currentHp - amount),
    },
  }
}

export function updatePlayerPosition(player: PlayerCharacter, position: Position): PlayerCharacter {
  return {
    ...player,
    position,
  }
}

export function updatePlayerGold(player: PlayerCharacter, amount: number): PlayerCharacter {
  const newGold = Math.max(0, player.gold + amount)
  EventBus.emit(GAME_EVENTS.GOLD_CHANGED, { amount, newTotal: newGold })
  return {
    ...player,
    gold: newGold,
  }
}

export function isPlayerAlive(player: PlayerCharacter): boolean {
  return player.stats.currentHp > 0
}

export function getEffectiveStats(player: PlayerCharacter): CharacterStats {
  return applyEquipmentStats(player.stats, player.equipment)
}
