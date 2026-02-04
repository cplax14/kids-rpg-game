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

export function addExperience(player: PlayerCharacter, xpGained: number): PlayerCharacter {
  if (player.level >= MAX_LEVEL) return player

  const newXp = player.experience + xpGained
  let currentLevel = player.level
  let remainingXp = newXp

  // Check for multiple level-ups
  while (currentLevel < MAX_LEVEL && remainingXp >= getXpToNextLevel(currentLevel)) {
    currentLevel++
  }

  if (currentLevel > player.level) {
    const newStats = calculateStatsForLevel(currentLevel)

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

    return updatedPlayer
  }

  return {
    ...player,
    experience: newXp,
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
