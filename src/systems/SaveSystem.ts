import type { SaveGame, GameSettings } from '../models/types'
import { saveToStorage, loadFromStorage, removeFromStorage } from '../utils/storage'
import { generateSaveId } from '../utils/id'
import { getGameState, setGameState, type GameState } from './GameStateManager'
import { loadSettings, getDefaultSettings } from './SettingsManager'
import { logger } from '../utils/logger'
import { SAVE_SLOTS } from '../config'

const SAVE_VERSION = '1.0.0'

export interface SaveSlotInfo {
  readonly exists: boolean
  readonly playerName?: string
  readonly level?: number
  readonly playTime?: number
  readonly timestamp?: string
  readonly areaId?: string
}

export function createSaveGame(state: GameState, settings: GameSettings, playTime: number): SaveGame {
  return {
    version: SAVE_VERSION,
    timestamp: new Date().toISOString(),
    player: state.player,
    inventory: state.inventory,
    squad: [...state.squad],
    monsterStorage: [...state.monsterStorage],
    discoveredSpecies: [...state.discoveredSpecies],
    visitedAreas: [state.currentAreaId],
    defeatedBosses: [...state.defeatedBosses],
    openedChests: [...state.openedChests],
    currentAreaId: state.currentAreaId,
    questFlags: {},
    playTime,
    settings,
    activeQuests: [...state.activeQuests],
    completedQuestIds: [...state.completedQuestIds],
  }
}

export function loadSaveGame(slot: number): SaveGame | null {
  if (slot < 0 || slot >= SAVE_SLOTS) {
    logger.warn('SaveSystem: Invalid save slot', { slot })
    return null
  }

  try {
    const key = generateSaveId(slot)
    const saveData = loadFromStorage<SaveGame>(key)

    if (!saveData) {
      return null
    }

    // Validate save data structure
    if (!saveData.version || !saveData.player || !saveData.inventory) {
      logger.warn('SaveSystem: Invalid save data structure', { slot })
      return null
    }

    return saveData
  } catch (error) {
    logger.error('SaveSystem: Failed to load save', { slot, error })
    return null
  }
}

export function saveGame(slot: number, saveGame: SaveGame): boolean {
  if (slot < 0 || slot >= SAVE_SLOTS) {
    logger.warn('SaveSystem: Invalid save slot', { slot })
    return false
  }

  try {
    const key = generateSaveId(slot)
    const result = saveToStorage(key, saveGame)

    if (result) {
      logger.info('SaveSystem: Game saved successfully', { slot })
    }

    return result
  } catch (error) {
    logger.error('SaveSystem: Failed to save game', { slot, error })
    return false
  }
}

export function deleteSave(slot: number): void {
  if (slot < 0 || slot >= SAVE_SLOTS) {
    logger.warn('SaveSystem: Invalid save slot', { slot })
    return
  }

  try {
    const key = generateSaveId(slot)
    removeFromStorage(key)
    logger.info('SaveSystem: Save deleted', { slot })
  } catch (error) {
    logger.error('SaveSystem: Failed to delete save', { slot, error })
  }
}

export function getSaveSlotInfo(slot: number): SaveSlotInfo {
  if (slot < 0 || slot >= SAVE_SLOTS) {
    return { exists: false }
  }

  try {
    const key = generateSaveId(slot)
    const saveData = loadFromStorage<SaveGame>(key)

    if (!saveData) {
      return { exists: false }
    }

    return {
      exists: true,
      playerName: saveData.player.name,
      level: saveData.player.level,
      playTime: saveData.playTime,
      timestamp: saveData.timestamp,
      areaId: saveData.currentAreaId,
    }
  } catch (error) {
    logger.error('SaveSystem: Failed to get slot info', { slot, error })
    return { exists: false }
  }
}

export function getAllSaveSlotInfo(): ReadonlyArray<SaveSlotInfo> {
  const slots: SaveSlotInfo[] = []

  for (let i = 0; i < SAVE_SLOTS; i++) {
    slots.push(getSaveSlotInfo(i))
  }

  return slots
}

export function gameStateFromSave(save: SaveGame): GameState {
  return {
    player: save.player,
    inventory: save.inventory,
    squad: [...save.squad],
    monsterStorage: [...save.monsterStorage],
    discoveredSpecies: [...save.discoveredSpecies],
    currentAreaId: save.currentAreaId,
    defeatedBosses: [...save.defeatedBosses],
    openedChests: [...save.openedChests],
    activeQuests: [...(save.activeQuests ?? [])],
    completedQuestIds: [...(save.completedQuestIds ?? [])],
  }
}

export function autoSave(scene: Phaser.Scene, slot: number, playTime: number): boolean {
  try {
    const state = getGameState(scene)
    const settings = loadSettings()
    const save = createSaveGame(state, settings, playTime)
    return saveGame(slot, save)
  } catch (error) {
    logger.error('SaveSystem: Auto-save failed', { slot, error })
    return false
  }
}

export function formatPlayTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m ${seconds}s`
}

export function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) {
      return 'Unknown'
    }
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'Unknown'
  }
}
