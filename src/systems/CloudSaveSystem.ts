import type { SaveGame } from '../models/types'
import type {
  CloudSaveInfo,
  CloudSaveSlotInfo,
  CloudSaveRow,
  SyncResult,
  ConflictInfo,
} from '../models/auth-types'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'
import { isAuthenticated, getUser } from './AuthSystem'
import { loadSaveGame, saveGame as saveLocalGame } from './SaveSystem'
import { SAVE_SLOTS, SYNC_CONFIG } from '../config'
import { logger } from '../utils/logger'

const CLOUD_SAVES_TABLE = 'cloud_saves'

function rowToCloudSaveInfo(row: CloudSaveRow): CloudSaveInfo {
  return {
    id: row.id,
    userId: row.user_id,
    slotNumber: row.slot_number,
    version: row.version,
    playerName: row.player_name,
    playerLevel: row.player_level,
    playTime: row.play_time,
    currentAreaId: row.current_area_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function uploadSave(slot: number, save: SaveGame): Promise<boolean> {
  if (!isSupabaseConfigured() || !isAuthenticated()) {
    return false
  }

  const client = getSupabaseClient()
  const user = getUser()

  if (!client || !user) {
    return false
  }

  if (slot < 0 || slot >= SAVE_SLOTS) {
    logger.warn('CloudSaveSystem: Invalid slot number', { slot })
    return false
  }

  try {
    const { error } = await client.from(CLOUD_SAVES_TABLE).upsert(
      {
        user_id: user.id,
        slot_number: slot,
        save_data: save as unknown as Record<string, unknown>,
        version: save.version,
        player_name: save.player.name,
        player_level: save.player.level,
        play_time: save.playTime,
        current_area_id: save.currentAreaId,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,slot_number',
      },
    )

    if (error) {
      logger.error('CloudSaveSystem: Upload failed', { slot, error: error.message })
      return false
    }

    logger.info('CloudSaveSystem: Save uploaded successfully', { slot })
    return true
  } catch (error) {
    logger.error('CloudSaveSystem: Upload failed', { slot, error })
    return false
  }
}

export async function downloadSave(slot: number): Promise<SaveGame | null> {
  if (!isSupabaseConfigured() || !isAuthenticated()) {
    return null
  }

  const client = getSupabaseClient()
  const user = getUser()

  if (!client || !user) {
    return null
  }

  if (slot < 0 || slot >= SAVE_SLOTS) {
    logger.warn('CloudSaveSystem: Invalid slot number', { slot })
    return null
  }

  try {
    const { data, error } = await client
      .from(CLOUD_SAVES_TABLE)
      .select('save_data')
      .eq('user_id', user.id)
      .eq('slot_number', slot)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null
      }
      logger.error('CloudSaveSystem: Download failed', { slot, error: error.message })
      return null
    }

    if (!data?.save_data) {
      return null
    }

    logger.info('CloudSaveSystem: Save downloaded successfully', { slot })
    return data.save_data as unknown as SaveGame
  } catch (error) {
    logger.error('CloudSaveSystem: Download failed', { slot, error })
    return null
  }
}

export async function getCloudSaveInfo(slot: number): Promise<CloudSaveInfo | null> {
  if (!isSupabaseConfigured() || !isAuthenticated()) {
    return null
  }

  const client = getSupabaseClient()
  const user = getUser()

  if (!client || !user) {
    return null
  }

  try {
    const { data, error } = await client
      .from(CLOUD_SAVES_TABLE)
      .select('*')
      .eq('user_id', user.id)
      .eq('slot_number', slot)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      logger.error('CloudSaveSystem: Failed to get save info', { slot, error: error.message })
      return null
    }

    if (!data) {
      return null
    }

    return rowToCloudSaveInfo(data as CloudSaveRow)
  } catch (error) {
    logger.error('CloudSaveSystem: Failed to get save info', { slot, error })
    return null
  }
}

export async function getAllCloudSaveInfo(): Promise<ReadonlyArray<CloudSaveSlotInfo>> {
  const result: CloudSaveSlotInfo[] = []

  for (let i = 0; i < SAVE_SLOTS; i++) {
    const info = await getCloudSaveInfo(i)
    result.push({
      slotNumber: i,
      exists: info !== null,
      info,
    })
  }

  return result
}

export async function deleteCloudSave(slot: number): Promise<boolean> {
  if (!isSupabaseConfigured() || !isAuthenticated()) {
    return false
  }

  const client = getSupabaseClient()
  const user = getUser()

  if (!client || !user) {
    return false
  }

  if (slot < 0 || slot >= SAVE_SLOTS) {
    logger.warn('CloudSaveSystem: Invalid slot number', { slot })
    return false
  }

  try {
    const { error } = await client
      .from(CLOUD_SAVES_TABLE)
      .delete()
      .eq('user_id', user.id)
      .eq('slot_number', slot)

    if (error) {
      logger.error('CloudSaveSystem: Delete failed', { slot, error: error.message })
      return false
    }

    logger.info('CloudSaveSystem: Cloud save deleted', { slot })
    return true
  } catch (error) {
    logger.error('CloudSaveSystem: Delete failed', { slot, error })
    return false
  }
}

export function detectConflict(local: SaveGame, cloudInfo: CloudSaveInfo): ConflictInfo | null {
  const localTimestamp = new Date(local.timestamp).getTime()
  const cloudTimestamp = new Date(cloudInfo.updatedAt).getTime()
  const timeDifference = Math.abs(localTimestamp - cloudTimestamp)

  // If both are within threshold, prefer newer automatically (no conflict)
  if (timeDifference <= SYNC_CONFIG.conflictThresholdMs) {
    return null
  }

  return {
    slotNumber: cloudInfo.slotNumber,
    localTimestamp: local.timestamp,
    cloudTimestamp: cloudInfo.updatedAt,
    localPlayerName: local.player.name,
    cloudPlayerName: cloudInfo.playerName,
    localPlayTime: local.playTime,
    cloudPlayTime: cloudInfo.playTime,
    timeDifferenceMs: timeDifference,
  }
}

export async function syncSlot(slot: number): Promise<SyncResult> {
  if (!isSupabaseConfigured() || !isAuthenticated()) {
    return { success: false, action: 'skipped', error: 'Not authenticated' }
  }

  try {
    const localSave = loadSaveGame(slot)
    const cloudInfo = await getCloudSaveInfo(slot)

    // Case 1: No local save and no cloud save
    if (!localSave && !cloudInfo) {
      return { success: true, action: 'skipped' }
    }

    // Case 2: Local save exists, no cloud save - upload
    if (localSave && !cloudInfo) {
      const uploaded = await uploadSave(slot, localSave)
      return { success: uploaded, action: uploaded ? 'uploaded' : 'error' }
    }

    // Case 3: No local save, cloud save exists - download
    if (!localSave && cloudInfo) {
      const cloudSave = await downloadSave(slot)
      if (cloudSave) {
        const saved = saveLocalGame(slot, cloudSave)
        return { success: saved, action: saved ? 'downloaded' : 'error' }
      }
      return { success: false, action: 'error', error: 'Failed to download cloud save' }
    }

    // Case 4: Both exist - check for conflict
    if (localSave && cloudInfo) {
      const conflict = detectConflict(localSave, cloudInfo)

      if (conflict) {
        return { success: false, action: 'conflict', conflictInfo: conflict }
      }

      // No significant conflict - use newer
      const localTimestamp = new Date(localSave.timestamp).getTime()
      const cloudTimestamp = new Date(cloudInfo.updatedAt).getTime()

      if (localTimestamp >= cloudTimestamp) {
        // Local is newer, upload
        const uploaded = await uploadSave(slot, localSave)
        return { success: uploaded, action: uploaded ? 'uploaded' : 'error' }
      } else {
        // Cloud is newer, download
        const cloudSave = await downloadSave(slot)
        if (cloudSave) {
          const saved = saveLocalGame(slot, cloudSave)
          return { success: saved, action: saved ? 'downloaded' : 'error' }
        }
        return { success: false, action: 'error', error: 'Failed to download cloud save' }
      }
    }

    return { success: true, action: 'skipped' }
  } catch (error) {
    logger.error('CloudSaveSystem: Sync failed', { slot, error })
    return { success: false, action: 'error', error: 'Sync failed' }
  }
}

export async function syncAllSlots(): Promise<ReadonlyArray<SyncResult>> {
  const results: SyncResult[] = []

  for (let i = 0; i < SAVE_SLOTS; i++) {
    const result = await syncSlot(i)
    results.push(result)
  }

  return results
}

export async function resolveConflict(
  slot: number,
  resolution: 'use_local' | 'use_cloud',
): Promise<boolean> {
  if (!isSupabaseConfigured() || !isAuthenticated()) {
    return false
  }

  try {
    if (resolution === 'use_local') {
      const localSave = loadSaveGame(slot)
      if (!localSave) {
        return false
      }
      return await uploadSave(slot, localSave)
    } else {
      const cloudSave = await downloadSave(slot)
      if (!cloudSave) {
        return false
      }
      return saveLocalGame(slot, cloudSave)
    }
  } catch (error) {
    logger.error('CloudSaveSystem: Conflict resolution failed', { slot, resolution, error })
    return false
  }
}

export async function migrateLocalSavesToCloud(): Promise<number> {
  if (!isSupabaseConfigured() || !isAuthenticated()) {
    return 0
  }

  let migrated = 0

  for (let i = 0; i < SAVE_SLOTS; i++) {
    const localSave = loadSaveGame(i)
    const cloudInfo = await getCloudSaveInfo(i)

    // Only migrate if local exists and cloud doesn't
    if (localSave && !cloudInfo) {
      const success = await uploadSave(i, localSave)
      if (success) {
        migrated++
      }
    }
  }

  logger.info('CloudSaveSystem: Migration complete', { migrated })
  return migrated
}

export function hasLocalSavesToMigrate(): boolean {
  for (let i = 0; i < SAVE_SLOTS; i++) {
    const localSave = loadSaveGame(i)
    if (localSave) {
      return true
    }
  }
  return false
}
