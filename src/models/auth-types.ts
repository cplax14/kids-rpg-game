// ── Authentication Types ──

export interface AuthUser {
  readonly id: string
  readonly email: string | null
  readonly name: string | null
  readonly avatarUrl: string | null
  readonly provider: 'google' | 'anonymous'
  readonly createdAt: string
}

export interface AuthSession {
  readonly user: AuthUser
  readonly accessToken: string
  readonly expiresAt: number
}

export type AuthState = 'loading' | 'authenticated' | 'unauthenticated'

// ── Cloud Save Types ──

export interface CloudSaveInfo {
  readonly id: string
  readonly userId: string
  readonly slotNumber: number
  readonly version: string
  readonly playerName: string
  readonly playerLevel: number
  readonly playTime: number
  readonly currentAreaId: string
  readonly createdAt: string
  readonly updatedAt: string
}

export interface CloudSaveSlotInfo {
  readonly slotNumber: number
  readonly exists: boolean
  readonly info: CloudSaveInfo | null
}

// ── Sync Types ──

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline'

export interface SyncResult {
  readonly success: boolean
  readonly action: 'uploaded' | 'downloaded' | 'conflict' | 'skipped' | 'error'
  readonly error?: string
  readonly conflictInfo?: ConflictInfo
}

export interface ConflictInfo {
  readonly slotNumber: number
  readonly localTimestamp: string
  readonly cloudTimestamp: string
  readonly localPlayerName: string
  readonly cloudPlayerName: string
  readonly localPlayTime: number
  readonly cloudPlayTime: number
  readonly timeDifferenceMs: number
}

export type ConflictResolution = 'use_local' | 'use_cloud' | 'cancel'

// ── Migration Types ──

export interface MigrationInfo {
  readonly localSlotsWithData: ReadonlyArray<number>
  readonly cloudSlotsWithData: ReadonlyArray<number>
  readonly slotsToMigrate: ReadonlyArray<number>
}

// ── Auth Event Types ──

export type AuthEventType = 'signed_in' | 'signed_out' | 'token_refreshed' | 'user_updated'

export interface AuthEvent {
  readonly type: AuthEventType
  readonly user: AuthUser | null
}

export type AuthStateChangeCallback = (user: AuthUser | null) => void

// ── Database Row Type (matches Supabase schema) ──

export interface CloudSaveRow {
  readonly id: string
  readonly user_id: string
  readonly slot_number: number
  readonly save_data: Record<string, unknown>
  readonly version: string
  readonly player_name: string
  readonly player_level: number
  readonly play_time: number
  readonly current_area_id: string
  readonly created_at: string
  readonly updated_at: string
}
