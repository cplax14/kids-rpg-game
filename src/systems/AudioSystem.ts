import Phaser from 'phaser'
import { logger } from '../utils/logger'

interface MusicOptions {
  readonly fadeIn?: number
  readonly loop?: boolean
  readonly volume?: number
}

interface AudioConfig {
  readonly music: Record<string, string>
  readonly sfx: Record<string, string>
  readonly defaultMusicVolume: number
  readonly defaultSfxVolume: number
}

let currentScene: Phaser.Scene | null = null
let currentMusic: Phaser.Sound.BaseSound | null = null
let currentMusicKey: string | null = null
let musicVolume = 0.7
let sfxVolume = 0.8
let isPaused = false

export function initAudioSystem(scene: Phaser.Scene): void {
  currentScene = scene
}

export function setMusicVolume(volume: number): void {
  musicVolume = Math.max(0, Math.min(1, volume))
  if (currentMusic && 'setVolume' in currentMusic) {
    ;(currentMusic as Phaser.Sound.WebAudioSound).setVolume(musicVolume)
  }
}

export function setSfxVolume(volume: number): void {
  sfxVolume = Math.max(0, Math.min(1, volume))
}

export function getMusicVolume(): number {
  return musicVolume
}

export function getSfxVolume(): number {
  return sfxVolume
}

export function playMusic(key: string, options?: MusicOptions): void {
  if (!currentScene) {
    logger.warn('AudioSystem: No scene initialized')
    return
  }

  // Don't restart if same music is already playing
  if (currentMusicKey === key && currentMusic?.isPlaying) {
    return
  }

  // Stop current music
  if (currentMusic) {
    currentMusic.stop()
    currentMusic.destroy()
    currentMusic = null
  }

  // Check if audio exists
  if (!currentScene.cache.audio.exists(key)) {
    logger.warn(`AudioSystem: Audio key "${key}" not found`)
    return
  }

  try {
    const config: Phaser.Types.Sound.SoundConfig = {
      volume: options?.fadeIn ? 0 : (options?.volume ?? musicVolume),
      loop: options?.loop ?? true,
    }

    currentMusic = currentScene.sound.add(key, config)
    currentMusicKey = key

    if (!isPaused) {
      currentMusic.play()

      // Fade in if specified
      if (options?.fadeIn && options.fadeIn > 0) {
        currentScene.tweens.add({
          targets: currentMusic,
          volume: options.volume ?? musicVolume,
          duration: options.fadeIn,
          ease: 'Linear',
        })
      }
    }
  } catch (error) {
    logger.error('AudioSystem: Failed to play music', { key, error })
  }
}

export function stopMusic(fadeOut?: number): void {
  if (!currentMusic || !currentScene) {
    return
  }

  if (fadeOut && fadeOut > 0) {
    currentScene.tweens.add({
      targets: currentMusic,
      volume: 0,
      duration: fadeOut,
      ease: 'Linear',
      onComplete: () => {
        if (currentMusic) {
          currentMusic.stop()
          currentMusic.destroy()
          currentMusic = null
          currentMusicKey = null
        }
      },
    })
  } else {
    currentMusic.stop()
    currentMusic.destroy()
    currentMusic = null
    currentMusicKey = null
  }
}

export function crossfadeMusic(newKey: string, duration?: number): void {
  if (!currentScene) {
    return
  }

  const crossfadeDuration = duration ?? 1000

  // If no current music, just play the new one
  if (!currentMusic || !currentMusic.isPlaying) {
    playMusic(newKey, { fadeIn: crossfadeDuration })
    return
  }

  // Same track, do nothing
  if (currentMusicKey === newKey) {
    return
  }

  // Check if new audio exists
  if (!currentScene.cache.audio.exists(newKey)) {
    logger.warn(`AudioSystem: Audio key "${newKey}" not found`)
    return
  }

  const oldMusic = currentMusic

  // Start new music at volume 0
  try {
    const newMusic = currentScene.sound.add(newKey, {
      volume: 0,
      loop: true,
    })
    newMusic.play()

    // Fade out old, fade in new
    currentScene.tweens.add({
      targets: oldMusic,
      volume: 0,
      duration: crossfadeDuration,
      ease: 'Linear',
      onComplete: () => {
        oldMusic.stop()
        oldMusic.destroy()
      },
    })

    currentScene.tweens.add({
      targets: newMusic,
      volume: musicVolume,
      duration: crossfadeDuration,
      ease: 'Linear',
    })

    currentMusic = newMusic
    currentMusicKey = newKey
  } catch (error) {
    logger.error('AudioSystem: Failed to crossfade music', { newKey, error })
  }
}

export function playSfx(key: string, volume?: number): void {
  if (!currentScene) {
    logger.warn('AudioSystem: No scene initialized')
    return
  }

  if (isPaused) {
    return
  }

  // Check if audio exists
  if (!currentScene.cache.audio.exists(key)) {
    logger.warn(`AudioSystem: SFX key "${key}" not found`)
    return
  }

  try {
    const effectiveVolume = (volume ?? 1) * sfxVolume
    currentScene.sound.play(key, { volume: effectiveVolume })
  } catch (error) {
    logger.error('AudioSystem: Failed to play SFX', { key, error })
  }
}

export function pauseAll(): void {
  isPaused = true
  if (currentMusic && currentMusic.isPlaying) {
    currentMusic.pause()
  }
}

export function resumeAll(): void {
  isPaused = false
  if (currentMusic && currentMusic.isPaused) {
    currentMusic.resume()
  }
}

export function getCurrentMusicKey(): string | null {
  return currentMusicKey
}

export function isAudioPaused(): boolean {
  return isPaused
}

// Audio key constants
export const MUSIC_KEYS = {
  TITLE_THEME: 'title-theme',
  VILLAGE_PEACEFUL: 'village-peaceful',
  FOREST_MYSTICAL: 'forest-mystical',
  CAVE_AMBIENT: 'cave-ambient',
  BATTLE_NORMAL: 'battle-normal',
  BATTLE_BOSS: 'battle-boss',
  VICTORY_FANFARE: 'victory-fanfare',
} as const

export const SFX_KEYS = {
  MENU_SELECT: 'menu-select',
  MENU_CONFIRM: 'menu-confirm',
  ATTACK_HIT: 'attack-hit',
  CAPTURE_THROW: 'capture-throw',
  CAPTURE_SHAKE: 'capture-shake',
  CAPTURE_SUCCESS: 'capture-success',
  CAPTURE_FAIL: 'capture-fail',
  LEVEL_UP: 'level-up',
  HEAL: 'heal',
  CHEST_OPEN: 'chest-open',
  QUEST_ACCEPT: 'quest-accept',
  QUEST_PROGRESS: 'quest-progress',
  QUEST_COMPLETE: 'quest-complete',
} as const

export type MusicKey = typeof MUSIC_KEYS[keyof typeof MUSIC_KEYS]
export type SfxKey = typeof SFX_KEYS[keyof typeof SFX_KEYS]
