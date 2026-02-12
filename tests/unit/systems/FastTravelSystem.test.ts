import { describe, it, expect } from 'vitest'
import {
  isFastTravelHubAvailable,
  getUnlockedFastTravelDestinations,
  canFastTravelTo,
  getFastTravelSpawnPosition,
  getFastTravelAreaName,
  FAST_TRAVEL_AREAS,
} from '../../../src/systems/FastTravelSystem'

describe('FastTravelSystem', () => {
  describe('FAST_TRAVEL_AREAS constant', () => {
    it('should have correct area progression', () => {
      expect(FAST_TRAVEL_AREAS).toHaveLength(4)
      expect(FAST_TRAVEL_AREAS[0].areaId).toBe('crystal-caves')
      expect(FAST_TRAVEL_AREAS[1].areaId).toBe('volcanic-peak')
      expect(FAST_TRAVEL_AREAS[2].areaId).toBe('seaside-grotto')
      expect(FAST_TRAVEL_AREAS[3].areaId).toBe('shadow-marsh')
    })

    it('should have correct boss requirements', () => {
      expect(FAST_TRAVEL_AREAS[0].requiredBoss).toBe('elderwood')
      expect(FAST_TRAVEL_AREAS[1].requiredBoss).toBe('crystallix')
      expect(FAST_TRAVEL_AREAS[2].requiredBoss).toBe('emberlord')
      expect(FAST_TRAVEL_AREAS[3].requiredBoss).toBe('pearlqueen')
    })
  })

  describe('isFastTravelHubAvailable', () => {
    it('should return false when no bosses defeated', () => {
      expect(isFastTravelHubAvailable([])).toBe(false)
    })

    it('should return false when elderwood not defeated', () => {
      expect(isFastTravelHubAvailable(['crystallix', 'emberlord'])).toBe(false)
    })

    it('should return true when elderwood defeated', () => {
      expect(isFastTravelHubAvailable(['elderwood'])).toBe(true)
    })

    it('should return true when multiple bosses including elderwood defeated', () => {
      expect(isFastTravelHubAvailable(['elderwood', 'crystallix', 'emberlord'])).toBe(true)
    })
  })

  describe('getUnlockedFastTravelDestinations', () => {
    it('should return empty array when no bosses defeated', () => {
      const result = getUnlockedFastTravelDestinations([], ['sunlit-village'])
      expect(result).toHaveLength(0)
    })

    it('should return empty array when boss defeated but area not visited', () => {
      const result = getUnlockedFastTravelDestinations(
        ['elderwood'],
        ['sunlit-village', 'whispering-forest'],
      )
      expect(result).toHaveLength(0)
    })

    it('should return Crystal Caves when elderwood defeated and caves visited', () => {
      const result = getUnlockedFastTravelDestinations(
        ['elderwood'],
        ['sunlit-village', 'whispering-forest', 'crystal-caves'],
      )
      expect(result).toHaveLength(1)
      expect(result[0].areaId).toBe('crystal-caves')
    })

    it('should return multiple destinations when multiple bosses defeated and areas visited', () => {
      const result = getUnlockedFastTravelDestinations(
        ['elderwood', 'crystallix', 'emberlord'],
        ['sunlit-village', 'whispering-forest', 'crystal-caves', 'volcanic-peak', 'seaside-grotto'],
      )
      expect(result).toHaveLength(3)
      expect(result.map((d) => d.areaId)).toEqual([
        'crystal-caves',
        'volcanic-peak',
        'seaside-grotto',
      ])
    })

    it('should not include areas visited but boss not defeated', () => {
      // Player somehow visited volcanic-peak but didn't defeat crystallix
      const result = getUnlockedFastTravelDestinations(
        ['elderwood'],
        ['sunlit-village', 'whispering-forest', 'crystal-caves', 'volcanic-peak'],
      )
      expect(result).toHaveLength(1)
      expect(result[0].areaId).toBe('crystal-caves')
    })
  })

  describe('canFastTravelTo', () => {
    it('should always allow travel to sunlit-village', () => {
      expect(canFastTravelTo('sunlit-village', [], [])).toBe(true)
      expect(canFastTravelTo('sunlit-village', ['elderwood'], ['crystal-caves'])).toBe(true)
    })

    it('should return false for unknown area', () => {
      expect(canFastTravelTo('unknown-area', ['elderwood'], ['sunlit-village'])).toBe(false)
    })

    it('should return false when boss not defeated', () => {
      expect(
        canFastTravelTo('crystal-caves', [], ['sunlit-village', 'crystal-caves']),
      ).toBe(false)
    })

    it('should return false when area not visited', () => {
      expect(
        canFastTravelTo('crystal-caves', ['elderwood'], ['sunlit-village']),
      ).toBe(false)
    })

    it('should return true when boss defeated and area visited', () => {
      expect(
        canFastTravelTo('crystal-caves', ['elderwood'], ['sunlit-village', 'crystal-caves']),
      ).toBe(true)
    })

    it('should correctly validate volcanic-peak requirements', () => {
      // crystallix must be defeated
      expect(
        canFastTravelTo(
          'volcanic-peak',
          ['elderwood'],
          ['sunlit-village', 'crystal-caves', 'volcanic-peak'],
        ),
      ).toBe(false)

      expect(
        canFastTravelTo(
          'volcanic-peak',
          ['elderwood', 'crystallix'],
          ['sunlit-village', 'crystal-caves', 'volcanic-peak'],
        ),
      ).toBe(true)
    })
  })

  describe('getFastTravelSpawnPosition', () => {
    it('should return position for sunlit-village', () => {
      const pos = getFastTravelSpawnPosition('sunlit-village')
      expect(pos.x).toBe(480)
      expect(pos.y).toBe(480)
    })

    it('should return position for crystal-caves', () => {
      const pos = getFastTravelSpawnPosition('crystal-caves')
      expect(pos.x).toBe(200)
      expect(pos.y).toBe(640)
    })

    it('should return default position for unknown area', () => {
      const pos = getFastTravelSpawnPosition('unknown-area')
      expect(pos.x).toBe(200)
      expect(pos.y).toBe(320)
    })
  })

  describe('getFastTravelAreaName', () => {
    it('should return "Sunlit Village" for sunlit-village', () => {
      expect(getFastTravelAreaName('sunlit-village')).toBe('Sunlit Village')
    })

    it('should return correct name for crystal-caves', () => {
      expect(getFastTravelAreaName('crystal-caves')).toBe('Crystal Caves')
    })

    it('should return correct name for volcanic-peak', () => {
      expect(getFastTravelAreaName('volcanic-peak')).toBe('Volcanic Peak')
    })

    it('should return correct name for seaside-grotto', () => {
      expect(getFastTravelAreaName('seaside-grotto')).toBe('Seaside Grotto')
    })

    it('should return correct name for shadow-marsh', () => {
      expect(getFastTravelAreaName('shadow-marsh')).toBe('Shadow Marsh')
    })

    it('should return "Unknown Area" for unknown area', () => {
      expect(getFastTravelAreaName('unknown-area')).toBe('Unknown Area')
    })
  })
})
