import { describe, it, expect, beforeEach, vi } from 'vitest'

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

import {
  createSaveGame,
  loadSaveGame,
  saveGame,
  deleteSave,
  getSaveSlotInfo,
  getAllSaveSlotInfo,
  gameStateFromSave,
  formatPlayTime,
  formatTimestamp,
} from '../../../src/systems/SaveSystem'
import type { GameState } from '../../../src/systems/GameStateManager'
import type { GameSettings, SaveGame } from '../../../src/models/types'

// Mock localStorage
const mockStorage: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockStorage[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorage[key]
  }),
  clear: vi.fn(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key])
  }),
  length: 0,
  key: vi.fn(() => null),
})

describe('SaveSystem', () => {
  const mockGameState: GameState = {
    player: {
      id: 'player-1',
      name: 'TestHero',
      level: 5,
      experience: 500,
      experienceToNextLevel: 1000,
      stats: {
        maxHp: 100,
        currentHp: 80,
        maxMp: 50,
        currentMp: 30,
        attack: 20,
        defense: 15,
        magicAttack: 18,
        magicDefense: 12,
        speed: 14,
        luck: 10,
      },
      equipment: {
        weapon: null,
        armor: null,
        helmet: null,
        accessory: null,
      },
      position: { x: 100, y: 100 },
      currentAreaId: 'sunlit-village',
      gold: 250,
    },
    inventory: {
      items: [],
      maxSlots: 30,
      equipment: [],
    },
    squad: [],
    monsterStorage: [],
    discoveredSpecies: ['mossbun', 'flamepup'],
    currentAreaId: 'sunlit-village',
    defeatedBosses: [],
    openedChests: ['chest-1'],
    activeQuests: [],
    completedQuestIds: [],
  }

  const mockSettings: GameSettings = {
    musicVolume: 0.7,
    sfxVolume: 0.8,
    textSpeed: 'normal',
    screenShake: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key])
  })

  describe('createSaveGame', () => {
    it('should create a save game from game state', () => {
      const playTime = 3600
      const save = createSaveGame(mockGameState, mockSettings, playTime)

      expect(save.version).toBe('1.0.0')
      expect(save.timestamp).toBeDefined()
      expect(save.player.name).toBe('TestHero')
      expect(save.player.level).toBe(5)
      expect(save.playTime).toBe(3600)
      expect(save.settings).toEqual(mockSettings)
      expect(save.currentAreaId).toBe('sunlit-village')
      expect(save.discoveredSpecies).toContain('mossbun')
      expect(save.openedChests).toContain('chest-1')
    })

    it('should create immutable copies of arrays', () => {
      const save = createSaveGame(mockGameState, mockSettings, 0)

      expect(save.squad).not.toBe(mockGameState.squad)
      expect(save.monsterStorage).not.toBe(mockGameState.monsterStorage)
      expect(save.discoveredSpecies).not.toBe(mockGameState.discoveredSpecies)
    })
  })

  describe('saveGame and loadSaveGame', () => {
    it('should save and load a game', () => {
      const save = createSaveGame(mockGameState, mockSettings, 1800)

      const saveResult = saveGame(0, save)
      expect(saveResult).toBe(true)

      const loaded = loadSaveGame(0)
      expect(loaded).not.toBeNull()
      expect(loaded?.player.name).toBe('TestHero')
      expect(loaded?.playTime).toBe(1800)
    })

    it('should return null for invalid slot', () => {
      const save = createSaveGame(mockGameState, mockSettings, 0)

      expect(saveGame(-1, save)).toBe(false)
      expect(saveGame(10, save)).toBe(false)
      expect(loadSaveGame(-1)).toBeNull()
      expect(loadSaveGame(10)).toBeNull()
    })

    it('should return null for empty slot', () => {
      const loaded = loadSaveGame(0)
      expect(loaded).toBeNull()
    })
  })

  describe('deleteSave', () => {
    it('should delete a save', () => {
      const save = createSaveGame(mockGameState, mockSettings, 0)
      saveGame(0, save)

      expect(loadSaveGame(0)).not.toBeNull()

      deleteSave(0)

      expect(loadSaveGame(0)).toBeNull()
    })
  })

  describe('getSaveSlotInfo', () => {
    it('should return exists: false for empty slot', () => {
      const info = getSaveSlotInfo(0)
      expect(info.exists).toBe(false)
    })

    it('should return slot info for saved game', () => {
      const save = createSaveGame(mockGameState, mockSettings, 7200)
      saveGame(0, save)

      const info = getSaveSlotInfo(0)
      expect(info.exists).toBe(true)
      expect(info.playerName).toBe('TestHero')
      expect(info.level).toBe(5)
      expect(info.playTime).toBe(7200)
      expect(info.areaId).toBe('sunlit-village')
      expect(info.timestamp).toBeDefined()
    })
  })

  describe('getAllSaveSlotInfo', () => {
    it('should return info for all slots', () => {
      const allInfo = getAllSaveSlotInfo()
      expect(allInfo.length).toBe(3) // SAVE_SLOTS = 3
      allInfo.forEach((info) => {
        expect(info.exists).toBe(false)
      })
    })
  })

  describe('gameStateFromSave', () => {
    it('should convert save to game state', () => {
      const save = createSaveGame(mockGameState, mockSettings, 0)
      const state = gameStateFromSave(save)

      expect(state.player.name).toBe('TestHero')
      expect(state.currentAreaId).toBe('sunlit-village')
      expect(state.discoveredSpecies).toContain('mossbun')
    })
  })

  describe('formatPlayTime', () => {
    it('should format seconds only', () => {
      expect(formatPlayTime(45)).toBe('0m 45s')
    })

    it('should format minutes and seconds', () => {
      expect(formatPlayTime(125)).toBe('2m 5s')
    })

    it('should format hours and minutes', () => {
      expect(formatPlayTime(3725)).toBe('1h 2m')
    })

    it('should format multiple hours', () => {
      expect(formatPlayTime(7320)).toBe('2h 2m')
    })
  })

  describe('formatTimestamp', () => {
    it('should format a valid timestamp', () => {
      const timestamp = '2024-06-15T14:30:00.000Z'
      const formatted = formatTimestamp(timestamp)
      expect(formatted).toMatch(/\w+ \d+/)
    })

    it('should return Unknown for invalid timestamp', () => {
      expect(formatTimestamp('invalid')).toBe('Unknown')
    })
  })
})
