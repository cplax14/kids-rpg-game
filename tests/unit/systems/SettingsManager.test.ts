import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getDefaultSettings,
  loadSettings,
  saveSettings,
  updateMusicVolume,
  updateSfxVolume,
  updateTextSpeed,
  toggleScreenShake,
  TEXT_SPEED_MS,
} from '../../../src/systems/SettingsManager'
import type { GameSettings } from '../../../src/models/types'

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
})

describe('SettingsManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key])
  })

  describe('getDefaultSettings', () => {
    it('should return default settings', () => {
      const defaults = getDefaultSettings()

      expect(defaults.musicVolume).toBe(0.7)
      expect(defaults.sfxVolume).toBe(0.8)
      expect(defaults.textSpeed).toBe('normal')
      expect(defaults.screenShake).toBe(true)
    })
  })

  describe('loadSettings', () => {
    it('should return defaults when no saved settings exist', () => {
      const settings = loadSettings()

      expect(settings.musicVolume).toBe(0.7)
      expect(settings.sfxVolume).toBe(0.8)
      expect(settings.textSpeed).toBe('normal')
      expect(settings.screenShake).toBe(true)
    })

    it('should load saved settings from storage', () => {
      mockStorage['kids-rpg:settings'] = JSON.stringify({
        musicVolume: 0.5,
        sfxVolume: 0.6,
        textSpeed: 'fast',
        screenShake: false,
      })

      const settings = loadSettings()

      expect(settings.musicVolume).toBe(0.5)
      expect(settings.sfxVolume).toBe(0.6)
      expect(settings.textSpeed).toBe('fast')
      expect(settings.screenShake).toBe(false)
    })

    it('should clamp invalid volume values', () => {
      mockStorage['kids-rpg:settings'] = JSON.stringify({
        musicVolume: 1.5,
        sfxVolume: -0.5,
        textSpeed: 'normal',
        screenShake: true,
      })

      const settings = loadSettings()

      expect(settings.musicVolume).toBe(1)
      expect(settings.sfxVolume).toBe(0)
    })

    it('should use default for invalid textSpeed', () => {
      mockStorage['kids-rpg:settings'] = JSON.stringify({
        musicVolume: 0.5,
        sfxVolume: 0.5,
        textSpeed: 'invalid',
        screenShake: true,
      })

      const settings = loadSettings()

      expect(settings.textSpeed).toBe('normal')
    })
  })

  describe('saveSettings', () => {
    it('should save settings to storage', () => {
      const settings: GameSettings = {
        musicVolume: 0.5,
        sfxVolume: 0.6,
        textSpeed: 'slow',
        screenShake: false,
      }

      const result = saveSettings(settings)

      expect(result).toBe(true)
      expect(mockStorage['kids-rpg:settings']).toBeDefined()

      const saved = JSON.parse(mockStorage['kids-rpg:settings'])
      expect(saved.musicVolume).toBe(0.5)
      expect(saved.sfxVolume).toBe(0.6)
      expect(saved.textSpeed).toBe('slow')
      expect(saved.screenShake).toBe(false)
    })

    it('should validate and clamp values before saving', () => {
      const settings: GameSettings = {
        musicVolume: 2.0,
        sfxVolume: -1.0,
        textSpeed: 'fast',
        screenShake: true,
      }

      saveSettings(settings)

      const saved = JSON.parse(mockStorage['kids-rpg:settings'])
      expect(saved.musicVolume).toBe(1)
      expect(saved.sfxVolume).toBe(0)
    })
  })

  describe('Settings Updaters', () => {
    const baseSettings: GameSettings = {
      musicVolume: 0.7,
      sfxVolume: 0.8,
      textSpeed: 'normal',
      screenShake: true,
    }

    it('should update music volume immutably', () => {
      const updated = updateMusicVolume(baseSettings, 0.5)

      expect(updated.musicVolume).toBe(0.5)
      expect(baseSettings.musicVolume).toBe(0.7) // Original unchanged
      expect(updated.sfxVolume).toBe(0.8) // Other fields preserved
    })

    it('should update SFX volume immutably', () => {
      const updated = updateSfxVolume(baseSettings, 0.3)

      expect(updated.sfxVolume).toBe(0.3)
      expect(baseSettings.sfxVolume).toBe(0.8) // Original unchanged
    })

    it('should update text speed immutably', () => {
      const updated = updateTextSpeed(baseSettings, 'fast')

      expect(updated.textSpeed).toBe('fast')
      expect(baseSettings.textSpeed).toBe('normal') // Original unchanged
    })

    it('should toggle screen shake immutably', () => {
      const updated = toggleScreenShake(baseSettings)

      expect(updated.screenShake).toBe(false)
      expect(baseSettings.screenShake).toBe(true) // Original unchanged
    })

    it('should clamp volume values', () => {
      const updated = updateMusicVolume(baseSettings, 1.5)
      expect(updated.musicVolume).toBe(1)

      const updated2 = updateSfxVolume(baseSettings, -0.5)
      expect(updated2.sfxVolume).toBe(0)
    })
  })

  describe('TEXT_SPEED_MS', () => {
    it('should have correct text speed values', () => {
      expect(TEXT_SPEED_MS.slow).toBe(80)
      expect(TEXT_SPEED_MS.normal).toBe(40)
      expect(TEXT_SPEED_MS.fast).toBe(15)
    })
  })
})
