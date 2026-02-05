import type { GameSettings } from '../models/types'
import { saveToStorage, loadFromStorage } from '../utils/storage'
import { logger } from '../utils/logger'

const SETTINGS_KEY = 'settings'

export function getDefaultSettings(): GameSettings {
  return {
    musicVolume: 0.7,
    sfxVolume: 0.8,
    textSpeed: 'normal',
    screenShake: true,
  }
}

export function loadSettings(): GameSettings {
  try {
    const saved = loadFromStorage<GameSettings>(SETTINGS_KEY)
    if (saved) {
      // Validate and merge with defaults to handle missing fields
      return {
        musicVolume: typeof saved.musicVolume === 'number' ? Math.max(0, Math.min(1, saved.musicVolume)) : 0.7,
        sfxVolume: typeof saved.sfxVolume === 'number' ? Math.max(0, Math.min(1, saved.sfxVolume)) : 0.8,
        textSpeed: ['slow', 'normal', 'fast'].includes(saved.textSpeed) ? saved.textSpeed : 'normal',
        screenShake: typeof saved.screenShake === 'boolean' ? saved.screenShake : true,
      }
    }
  } catch (error) {
    logger.error('Failed to load settings', { error })
  }
  return getDefaultSettings()
}

export function saveSettings(settings: GameSettings): boolean {
  try {
    // Validate before saving
    const validatedSettings: GameSettings = {
      musicVolume: Math.max(0, Math.min(1, settings.musicVolume)),
      sfxVolume: Math.max(0, Math.min(1, settings.sfxVolume)),
      textSpeed: ['slow', 'normal', 'fast'].includes(settings.textSpeed) ? settings.textSpeed : 'normal',
      screenShake: settings.screenShake,
    }
    return saveToStorage(SETTINGS_KEY, validatedSettings)
  } catch (error) {
    logger.error('Failed to save settings', { error })
    return false
  }
}

export function applyAudioSettings(settings: GameSettings): void {
  // Dynamically import to avoid circular dependency and test issues
  import('./AudioSystem').then(({ setMusicVolume, setSfxVolume }) => {
    setMusicVolume(settings.musicVolume)
    setSfxVolume(settings.sfxVolume)
  }).catch(() => {
    // Audio system may not be available in test environment
  })
}

export function updateMusicVolume(settings: GameSettings, volume: number): GameSettings {
  return {
    ...settings,
    musicVolume: Math.max(0, Math.min(1, volume)),
  }
}

export function updateSfxVolume(settings: GameSettings, volume: number): GameSettings {
  return {
    ...settings,
    sfxVolume: Math.max(0, Math.min(1, volume)),
  }
}

export function updateTextSpeed(settings: GameSettings, speed: 'slow' | 'normal' | 'fast'): GameSettings {
  return {
    ...settings,
    textSpeed: speed,
  }
}

export function toggleScreenShake(settings: GameSettings): GameSettings {
  return {
    ...settings,
    screenShake: !settings.screenShake,
  }
}

// Text speed milliseconds per character
export const TEXT_SPEED_MS: Record<'slow' | 'normal' | 'fast', number> = {
  slow: 80,
  normal: 40,
  fast: 15,
}
