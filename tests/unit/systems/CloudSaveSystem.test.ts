import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { SaveGame } from '../../../src/models/types'
import type { CloudSaveInfo } from '../../../src/models/auth-types'

// Mock Phaser before any imports that depend on it
vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Events: { EventEmitter: class {} },
  },
}))

// Mock EventBus to avoid Phaser dependency chain
vi.mock('../../../src/events/EventBus', () => ({
  EventBus: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    once: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}))

// Mock Supabase client
const mockFrom = vi.fn()
const mockSupabaseClient = {
  from: mockFrom,
}

vi.mock('../../../src/lib/supabase', () => ({
  getSupabaseClient: vi.fn(() => mockSupabaseClient),
  isSupabaseConfigured: vi.fn(() => true),
}))

vi.mock('../../../src/systems/AuthSystem', () => ({
  isAuthenticated: vi.fn(() => true),
  getUser: vi.fn(() => ({
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    avatarUrl: null,
    provider: 'google',
    createdAt: '2024-01-01T00:00:00Z',
  })),
}))

vi.mock('../../../src/config', () => ({
  CLOUD_SAVE_ENABLED: true,
  SAVE_SLOTS: 3,
  SYNC_CONFIG: {
    conflictThresholdMs: 5 * 60 * 1000,
    autoSyncOnAreaChange: true,
    retryAttempts: 3,
    retryDelayMs: 1000,
  },
}))

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock storage functions
const mockStorage: Record<string, string> = {}
vi.mock('../../../src/utils/storage', () => ({
  saveToStorage: vi.fn((key: string, value: unknown) => {
    mockStorage[key] = JSON.stringify(value)
    return true
  }),
  loadFromStorage: vi.fn((key: string) => {
    const data = mockStorage[key]
    return data ? JSON.parse(data) : null
  }),
  removeFromStorage: vi.fn((key: string) => {
    delete mockStorage[key]
  }),
}))

import { detectConflict } from '../../../src/systems/CloudSaveSystem'

describe('CloudSaveSystem', () => {
  const mockSaveGame: SaveGame = {
    version: '1.0.0',
    timestamp: '2024-06-15T10:00:00.000Z',
    player: {
      id: 'player-1',
      name: 'TestHero',
      level: 10,
      experience: 5000,
      experienceToNextLevel: 8000,
      stats: {
        maxHp: 150,
        currentHp: 150,
        maxMp: 80,
        currentMp: 80,
        attack: 35,
        defense: 25,
        magicAttack: 30,
        magicDefense: 22,
        speed: 20,
        luck: 15,
      },
      equipment: {
        weapon: null,
        armor: null,
        helmet: null,
        accessory: null,
      },
      position: { x: 200, y: 200 },
      currentAreaId: 'forest-path',
      gold: 1500,
    },
    inventory: {
      items: [],
      maxSlots: 30,
      equipment: [],
    },
    squad: [],
    monsterStorage: [],
    discoveredSpecies: ['mossbun', 'flamepup', 'bubblefin'],
    visitedAreas: ['sunlit-village', 'forest-path'],
    defeatedBosses: ['grove-guardian'],
    openedChests: ['chest-1', 'chest-2'],
    currentAreaId: 'forest-path',
    questFlags: {},
    playTime: 7200,
    settings: {
      musicVolume: 0.7,
      sfxVolume: 0.8,
      textSpeed: 'normal',
      screenShake: true,
    },
    activeQuests: [],
    completedQuestIds: [],
  }

  const mockCloudSaveInfo: CloudSaveInfo = {
    id: 'cloud-save-1',
    userId: 'user-123',
    slotNumber: 0,
    version: '1.0.0',
    playerName: 'TestHero',
    playerLevel: 10,
    playTime: 7200,
    currentAreaId: 'forest-path',
    createdAt: '2024-06-15T10:00:00.000Z',
    updatedAt: '2024-06-15T10:00:00.000Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key])
  })

  describe('detectConflict', () => {
    it('should return null when timestamps are close', () => {
      const localSave = {
        ...mockSaveGame,
        timestamp: '2024-06-15T10:00:00.000Z',
      }

      const cloudInfo: CloudSaveInfo = {
        ...mockCloudSaveInfo,
        updatedAt: '2024-06-15T10:02:00.000Z', // 2 minutes difference
      }

      const conflict = detectConflict(localSave, cloudInfo)

      expect(conflict).toBeNull()
    })

    it('should detect conflict when timestamps differ by more than threshold', () => {
      const localSave = {
        ...mockSaveGame,
        timestamp: '2024-06-15T10:00:00.000Z',
      }

      const cloudInfo: CloudSaveInfo = {
        ...mockCloudSaveInfo,
        updatedAt: '2024-06-15T10:10:00.000Z', // 10 minutes difference (> 5 min threshold)
      }

      const conflict = detectConflict(localSave, cloudInfo)

      expect(conflict).not.toBeNull()
      expect(conflict?.slotNumber).toBe(0)
      expect(conflict?.localPlayerName).toBe('TestHero')
      expect(conflict?.cloudPlayerName).toBe('TestHero')
    })

    it('should include time difference in conflict info', () => {
      const localSave = {
        ...mockSaveGame,
        timestamp: '2024-06-15T10:00:00.000Z',
      }

      const cloudInfo: CloudSaveInfo = {
        ...mockCloudSaveInfo,
        updatedAt: '2024-06-15T10:30:00.000Z', // 30 minutes difference
      }

      const conflict = detectConflict(localSave, cloudInfo)

      expect(conflict).not.toBeNull()
      expect(conflict?.timeDifferenceMs).toBe(30 * 60 * 1000) // 30 minutes in ms
    })

    it('should include play time in conflict info', () => {
      const localSave = {
        ...mockSaveGame,
        timestamp: '2024-06-15T10:00:00.000Z',
        playTime: 3600,
      }

      const cloudInfo: CloudSaveInfo = {
        ...mockCloudSaveInfo,
        updatedAt: '2024-06-15T11:00:00.000Z',
        playTime: 7200,
      }

      const conflict = detectConflict(localSave, cloudInfo)

      expect(conflict).not.toBeNull()
      expect(conflict?.localPlayTime).toBe(3600)
      expect(conflict?.cloudPlayTime).toBe(7200)
    })
  })
})
