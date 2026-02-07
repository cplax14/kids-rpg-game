import type { SaveGame, GameSettings } from '../models/types'
import { SaveGameSchema } from '../models/schemas'
import { saveToStorage, loadFromStorage, removeFromStorage } from '../utils/storage'
import { generateSaveId } from '../utils/id'
import { getGameState, type GameState } from './GameStateManager'
import { loadSettings } from './SettingsManager'
import { logger } from '../utils/logger'
import { SAVE_SLOTS, CLOUD_SAVE_ENABLED } from '../config'

const SAVE_VERSION = '1.0.0'
const EXPORT_MAGIC = 'MQRPG_SAVE'

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
    const success = saveGame(slot, save)

    // Trigger cloud sync in background if enabled
    if (success && CLOUD_SAVE_ENABLED) {
      triggerCloudSync(slot, save)
    }

    return success
  } catch (error) {
    logger.error('SaveSystem: Auto-save failed', { slot, error })
    return false
  }
}

// Cloud sync trigger (non-blocking)
function triggerCloudSync(slot: number, save: SaveGame): void {
  // Dynamic import to avoid circular dependency
  import('./AuthSystem').then(({ isAuthenticated }) => {
    if (!isAuthenticated()) {
      return
    }

    import('./CloudSaveSystem').then(({ uploadSave }) => {
      uploadSave(slot, save).catch((error) => {
        logger.warn('SaveSystem: Background cloud sync failed', { slot, error })
      })
    })
  })
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

// ── Save Validation ──

export interface SaveValidationResult {
  readonly valid: boolean
  readonly error?: string
  readonly save?: SaveGame
}

export function validateSaveData(data: unknown): SaveValidationResult {
  try {
    const result = SaveGameSchema.safeParse(data)

    if (!result.success) {
      // Zod v4 uses result.error.issues instead of result.error.errors
      const issues = result.error.issues ?? []
      const firstIssue = issues[0]
      const errorPath = firstIssue?.path?.join('.') ?? 'unknown'
      const errorMessage = firstIssue?.message ?? 'Invalid save data'
      return {
        valid: false,
        error: `Validation failed at ${errorPath}: ${errorMessage}`,
      }
    }

    // Cast through unknown to avoid type overlap issues
    return {
      valid: true,
      save: result.data as unknown as SaveGame,
    }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown validation error',
    }
  }
}

// ── Export/Import ──

export interface ExportedSave {
  readonly magic: string
  readonly version: string
  readonly exportedAt: string
  readonly data: SaveGame
}

export function exportSaveToJson(slot: number): string | null {
  const save = loadSaveGame(slot)
  if (!save) {
    logger.warn('SaveSystem: No save found to export', { slot })
    return null
  }

  const exportData: ExportedSave = {
    magic: EXPORT_MAGIC,
    version: SAVE_VERSION,
    exportedAt: new Date().toISOString(),
    data: save,
  }

  return JSON.stringify(exportData, null, 2)
}

export function downloadSave(slot: number): boolean {
  const json = exportSaveToJson(slot)
  if (!json) {
    return false
  }

  try {
    const save = loadSaveGame(slot)
    const playerName = save?.player.name ?? 'Hero'
    const timestamp = new Date().toISOString().slice(0, 10)
    const filename = `monster-quest-${playerName}-slot${slot + 1}-${timestamp}.json`

    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    logger.info('SaveSystem: Save exported successfully', { slot, filename })
    return true
  } catch (error) {
    logger.error('SaveSystem: Failed to download save', { slot, error })
    return false
  }
}

export interface ImportResult {
  readonly success: boolean
  readonly error?: string
  readonly save?: SaveGame
}

export function importSaveFromJson(json: string): ImportResult {
  try {
    const parsed = JSON.parse(json)

    // Check if it's an exported save with magic header
    if (parsed.magic === EXPORT_MAGIC && parsed.data) {
      const validation = validateSaveData(parsed.data)
      if (!validation.valid) {
        return { success: false, error: validation.error }
      }
      return { success: true, save: validation.save }
    }

    // Try parsing as raw save data (backwards compatibility)
    const validation = validateSaveData(parsed)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    return { success: true, save: validation.save }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { success: false, error: 'Invalid JSON format' }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown import error',
    }
  }
}

export function importSaveToSlot(slot: number, importedSave: SaveGame): boolean {
  if (slot < 0 || slot >= SAVE_SLOTS) {
    logger.warn('SaveSystem: Invalid slot for import', { slot })
    return false
  }

  // Update timestamp to import time
  const saveWithNewTimestamp: SaveGame = {
    ...importedSave,
    timestamp: new Date().toISOString(),
  }

  const success = saveGame(slot, saveWithNewTimestamp)
  if (success) {
    logger.info('SaveSystem: Save imported successfully', { slot })
  }
  return success
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to read file as text'))
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}
