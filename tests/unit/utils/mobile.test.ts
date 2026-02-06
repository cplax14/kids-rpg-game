import { describe, it, expect } from 'vitest'
import {
  isTouchDevice,
  isMobileDevice,
  shouldShowTouchControls,
  getOrientation,
} from '../../../src/utils/mobile'

describe('mobile utilities', () => {
  describe('isTouchDevice', () => {
    it('should return a boolean', () => {
      const result = isTouchDevice()
      expect(typeof result).toBe('boolean')
    })
  })

  describe('isMobileDevice', () => {
    it('should return a boolean', () => {
      const result = isMobileDevice()
      expect(typeof result).toBe('boolean')
    })
  })

  describe('shouldShowTouchControls', () => {
    it('should return a boolean', () => {
      const result = shouldShowTouchControls()
      expect(typeof result).toBe('boolean')
    })
  })

  describe('getOrientation', () => {
    it('should return portrait or landscape', () => {
      const result = getOrientation()
      expect(['portrait', 'landscape']).toContain(result)
    })
  })
})
