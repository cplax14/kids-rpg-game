import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  setMusicVolume,
  setSfxVolume,
  getMusicVolume,
  getSfxVolume,
  MUSIC_KEYS,
  SFX_KEYS,
} from '../../../src/systems/AudioSystem'

describe('AudioSystem', () => {
  beforeEach(() => {
    // Reset volumes to defaults
    setMusicVolume(0.7)
    setSfxVolume(0.8)
  })

  describe('Volume Controls', () => {
    it('should get and set music volume', () => {
      setMusicVolume(0.5)
      expect(getMusicVolume()).toBe(0.5)
    })

    it('should get and set SFX volume', () => {
      setSfxVolume(0.3)
      expect(getSfxVolume()).toBe(0.3)
    })

    it('should clamp music volume to valid range', () => {
      setMusicVolume(1.5)
      expect(getMusicVolume()).toBe(1)

      setMusicVolume(-0.5)
      expect(getMusicVolume()).toBe(0)
    })

    it('should clamp SFX volume to valid range', () => {
      setSfxVolume(2.0)
      expect(getSfxVolume()).toBe(1)

      setSfxVolume(-1)
      expect(getSfxVolume()).toBe(0)
    })
  })

  describe('Audio Keys', () => {
    it('should have all expected music keys', () => {
      expect(MUSIC_KEYS.TITLE_THEME).toBe('title-theme')
      expect(MUSIC_KEYS.VILLAGE_PEACEFUL).toBe('village-peaceful')
      expect(MUSIC_KEYS.FOREST_MYSTICAL).toBe('forest-mystical')
      expect(MUSIC_KEYS.CAVE_AMBIENT).toBe('cave-ambient')
      expect(MUSIC_KEYS.BATTLE_NORMAL).toBe('battle-normal')
      expect(MUSIC_KEYS.BATTLE_BOSS).toBe('battle-boss')
      expect(MUSIC_KEYS.VICTORY_FANFARE).toBe('victory-fanfare')
    })

    it('should have all expected SFX keys', () => {
      expect(SFX_KEYS.MENU_SELECT).toBe('menu-select')
      expect(SFX_KEYS.MENU_CONFIRM).toBe('menu-confirm')
      expect(SFX_KEYS.ATTACK_HIT).toBe('attack-hit')
      expect(SFX_KEYS.CAPTURE_THROW).toBe('capture-throw')
      expect(SFX_KEYS.CAPTURE_SHAKE).toBe('capture-shake')
      expect(SFX_KEYS.CAPTURE_SUCCESS).toBe('capture-success')
      expect(SFX_KEYS.CAPTURE_FAIL).toBe('capture-fail')
      expect(SFX_KEYS.LEVEL_UP).toBe('level-up')
      expect(SFX_KEYS.HEAL).toBe('heal')
      expect(SFX_KEYS.CHEST_OPEN).toBe('chest-open')
    })
  })
})
