import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  clamp,
  randomInt,
  randomFloat,
  randomChance,
  weightedRandom,
  getElementMultiplier,
  calculateDamage,
  calculateFleeChance,
  calculateCaptureRate,
  lerp,
  percentOf,
} from '../../../src/utils/math'

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('returns min when value is below range', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
  })

  it('returns max when value is above range', () => {
    expect(clamp(15, 0, 10)).toBe(10)
  })

  it('handles equal min and max', () => {
    expect(clamp(5, 3, 3)).toBe(3)
  })

  it('handles negative ranges', () => {
    expect(clamp(-5, -10, -1)).toBe(-5)
  })
})

describe('randomInt', () => {
  it('returns integer within range', () => {
    for (let i = 0; i < 100; i++) {
      const result = randomInt(1, 10)
      expect(result).toBeGreaterThanOrEqual(1)
      expect(result).toBeLessThanOrEqual(10)
      expect(Number.isInteger(result)).toBe(true)
    }
  })

  it('returns the value when min equals max', () => {
    expect(randomInt(5, 5)).toBe(5)
  })
})

describe('randomFloat', () => {
  it('returns float within range', () => {
    for (let i = 0; i < 100; i++) {
      const result = randomFloat(0.0, 1.0)
      expect(result).toBeGreaterThanOrEqual(0.0)
      expect(result).toBeLessThan(1.0)
    }
  })
})

describe('randomChance', () => {
  it('returns true for probability 1', () => {
    expect(randomChance(1.0)).toBe(true)
  })

  it('returns false for probability 0', () => {
    expect(randomChance(0)).toBe(false)
  })
})

describe('weightedRandom', () => {
  it('returns item from the list', () => {
    const items = ['a', 'b', 'c']
    const weights = [1, 1, 1]
    const result = weightedRandom(items, weights)
    expect(items).toContain(result)
  })

  it('favors heavily weighted items', () => {
    const items = ['rare', 'common']
    const weights = [1, 1000]
    const counts = { rare: 0, common: 0 }

    for (let i = 0; i < 1000; i++) {
      const result = weightedRandom(items, weights)
      counts[result]++
    }

    expect(counts.common).toBeGreaterThan(counts.rare)
  })

  it('handles single item', () => {
    expect(weightedRandom(['only'], [1])).toBe('only')
  })
})

describe('getElementMultiplier', () => {
  it('returns 2.0 for fire vs earth (super effective)', () => {
    expect(getElementMultiplier('fire', 'earth')).toBe(2.0)
  })

  it('returns 0.5 for fire vs water (not very effective)', () => {
    expect(getElementMultiplier('fire', 'water')).toBe(0.5)
  })

  it('returns 1.0 for neutral vs any', () => {
    expect(getElementMultiplier('neutral', 'fire')).toBe(1.0)
    expect(getElementMultiplier('neutral', 'water')).toBe(1.0)
    expect(getElementMultiplier('neutral', 'neutral')).toBe(1.0)
  })

  it('returns 2.0 for light vs dark', () => {
    expect(getElementMultiplier('light', 'dark')).toBe(2.0)
    expect(getElementMultiplier('dark', 'light')).toBe(2.0)
  })

  it('returns 0.5 for same element', () => {
    expect(getElementMultiplier('fire', 'fire')).toBe(0.5)
    expect(getElementMultiplier('water', 'water')).toBe(0.5)
  })
})

describe('calculateDamage', () => {
  it('returns at least 1 damage', () => {
    const result = calculateDamage(1, 1, 999, 'neutral', 'neutral', 0)
    expect(result.damage).toBeGreaterThanOrEqual(1)
  })

  it('returns higher damage with higher attack', () => {
    const results: number[] = []
    // Run many times to account for variance
    for (let i = 0; i < 100; i++) {
      results.push(calculateDamage(100, 50, 30, 'neutral', 'neutral', 0).damage)
    }
    const avgDamage = results.reduce((a, b) => a + b, 0) / results.length

    const lowResults: number[] = []
    for (let i = 0; i < 100; i++) {
      lowResults.push(calculateDamage(10, 50, 30, 'neutral', 'neutral', 0).damage)
    }
    const avgLow = lowResults.reduce((a, b) => a + b, 0) / lowResults.length

    expect(avgDamage).toBeGreaterThan(avgLow)
  })

  it('returns isCritical boolean', () => {
    const result = calculateDamage(50, 50, 30, 'neutral', 'neutral', 0)
    expect(typeof result.isCritical).toBe('boolean')
  })

  it('applies element effectiveness', () => {
    // Fire vs Earth should deal more than Fire vs Water on average
    const fireEarth: number[] = []
    const fireWater: number[] = []

    for (let i = 0; i < 200; i++) {
      fireEarth.push(calculateDamage(50, 50, 30, 'fire', 'earth', 0).damage)
      fireWater.push(calculateDamage(50, 50, 30, 'fire', 'water', 0).damage)
    }

    const avgFireEarth = fireEarth.reduce((a, b) => a + b, 0) / fireEarth.length
    const avgFireWater = fireWater.reduce((a, b) => a + b, 0) / fireWater.length

    expect(avgFireEarth).toBeGreaterThan(avgFireWater * 1.5)
  })
})

describe('calculateFleeChance', () => {
  it('returns higher chance with faster player', () => {
    const fast = calculateFleeChance(100, 50)
    const slow = calculateFleeChance(50, 100)
    expect(fast).toBeGreaterThan(slow)
  })

  it('clamps between 0.1 and 0.95', () => {
    const result = calculateFleeChance(1000, 1)
    expect(result).toBeLessThanOrEqual(0.95)

    const low = calculateFleeChance(1, 1000)
    expect(low).toBeGreaterThanOrEqual(0.1)
  })
})

describe('calculateCaptureRate', () => {
  it('returns higher rate with lower HP', () => {
    const lowHp = calculateCaptureRate(0.1, 0.5, 1.0, 1.0, 0)
    const highHp = calculateCaptureRate(0.9, 0.5, 1.0, 1.0, 0)
    expect(lowHp).toBeGreaterThan(highHp)
  })

  it('returns higher rate with better device', () => {
    const good = calculateCaptureRate(0.5, 0.5, 2.0, 1.0, 0)
    const basic = calculateCaptureRate(0.5, 0.5, 1.0, 1.0, 0)
    expect(good).toBeGreaterThan(basic)
  })

  it('clamps between 0.05 and 0.95', () => {
    const max = calculateCaptureRate(0.01, 0.0, 3.0, 2.0, 100)
    expect(max).toBeLessThanOrEqual(0.95)

    const min = calculateCaptureRate(0.99, 0.99, 0.1, 1.0, 0)
    expect(min).toBeGreaterThanOrEqual(0.05)
  })

  it('status bonus increases rate', () => {
    const withBonus = calculateCaptureRate(0.5, 0.5, 1.0, 1.5, 0)
    const without = calculateCaptureRate(0.5, 0.5, 1.0, 1.0, 0)
    expect(withBonus).toBeGreaterThan(without)
  })
})

describe('lerp', () => {
  it('returns start at t=0', () => {
    expect(lerp(0, 100, 0)).toBe(0)
  })

  it('returns end at t=1', () => {
    expect(lerp(0, 100, 1)).toBe(100)
  })

  it('returns midpoint at t=0.5', () => {
    expect(lerp(0, 100, 0.5)).toBe(50)
  })

  it('clamps t to [0, 1]', () => {
    expect(lerp(0, 100, -1)).toBe(0)
    expect(lerp(0, 100, 2)).toBe(100)
  })
})

describe('percentOf', () => {
  it('calculates correct percentage', () => {
    expect(percentOf(50, 100)).toBe(50)
    expect(percentOf(1, 4)).toBe(25)
  })

  it('returns 0 when total is 0', () => {
    expect(percentOf(5, 0)).toBe(0)
  })
})
