import { describe, it, expect, beforeEach } from 'vitest'
import {
  createClock,
  advanceClock,
  isClockComplete,
  resetClock,
  removeClock,
  getClockProgress,
  getRemainingSegments,
  getClock,
  getAllClocks,
  getClocksByType,
  hasCompleteClock,
  loadClocks,
  createClockWithProgress,
} from '../../../src/systems/ClockSystem'
import type { ProgressClock, ClockType, ClockSegments } from '../../../src/models/types'

describe('ClockSystem - createClock', () => {
  beforeEach(() => {
    // Clear registry before each test
    loadClocks([])
  })

  it('creates a clock with correct properties', () => {
    const clock = createClock('Quest Progress', 4, 'quest', 'icon-quest')
    expect(clock.name).toBe('Quest Progress')
    expect(clock.segments).toBe(4)
    expect(clock.filled).toBe(0)
    expect(clock.clockType).toBe('quest')
    expect(clock.iconKey).toBe('icon-quest')
    expect(clock.clockId).toMatch(/^clock-/)
  })

  it('creates clocks with unique IDs', () => {
    const clock1 = createClock('Clock 1', 4, 'quest')
    const clock2 = createClock('Clock 2', 6, 'event')
    expect(clock1.clockId).not.toBe(clock2.clockId)
  })

  it('adds clock to registry', () => {
    const clock = createClock('Test Clock', 8, 'boss')
    const retrieved = getClock(clock.clockId)
    expect(retrieved).toBeDefined()
    expect(retrieved!.name).toBe('Test Clock')
  })

  it('supports all segment sizes (4, 6, 8)', () => {
    const clock4 = createClock('4-segment', 4, 'quest')
    const clock6 = createClock('6-segment', 6, 'event')
    const clock8 = createClock('8-segment', 8, 'boss')

    expect(clock4.segments).toBe(4)
    expect(clock6.segments).toBe(6)
    expect(clock8.segments).toBe(8)
  })
})

describe('ClockSystem - advanceClock', () => {
  beforeEach(() => {
    loadClocks([])
  })

  it('advances clock by 1 segment by default', () => {
    const clock = createClock('Test', 4, 'quest')
    const updated = advanceClock(clock)
    expect(updated.filled).toBe(1)
  })

  it('advances clock by specified amount', () => {
    const clock = createClock('Test', 8, 'event')
    const updated = advanceClock(clock, 3)
    expect(updated.filled).toBe(3)
  })

  it('caps filled at segment count', () => {
    const clock = createClock('Test', 4, 'quest')
    const updated = advanceClock(clock, 10)
    expect(updated.filled).toBe(4)
  })

  it('updates clock in registry', () => {
    const clock = createClock('Test', 6, 'ability')
    advanceClock(clock, 2)
    const retrieved = getClock(clock.clockId)
    expect(retrieved!.filled).toBe(2)
  })

  it('returns new clock object (immutable)', () => {
    const clock = createClock('Test', 4, 'quest')
    const updated = advanceClock(clock)
    expect(updated).not.toBe(clock)
    expect(clock.filled).toBe(0) // Original unchanged
    expect(updated.filled).toBe(1)
  })
})

describe('ClockSystem - isClockComplete', () => {
  beforeEach(() => {
    loadClocks([])
  })

  it('returns false for empty clock', () => {
    const clock = createClock('Test', 4, 'quest')
    expect(isClockComplete(clock)).toBe(false)
  })

  it('returns false for partially filled clock', () => {
    const clock = createClock('Test', 6, 'event')
    const updated = advanceClock(clock, 3)
    expect(isClockComplete(updated)).toBe(false)
  })

  it('returns true for fully filled clock', () => {
    const clock = createClock('Test', 4, 'quest')
    const updated = advanceClock(clock, 4)
    expect(isClockComplete(updated)).toBe(true)
  })

  it('returns true when filled exceeds segments', () => {
    const clock = createClock('Test', 4, 'quest')
    const updated = advanceClock(clock, 10)
    expect(isClockComplete(updated)).toBe(true)
  })
})

describe('ClockSystem - resetClock', () => {
  beforeEach(() => {
    loadClocks([])
  })

  it('resets filled to 0', () => {
    const clock = createClock('Test', 4, 'quest')
    const advanced = advanceClock(clock, 3)
    const reset = resetClock(advanced)
    expect(reset.filled).toBe(0)
  })

  it('updates clock in registry', () => {
    const clock = createClock('Test', 6, 'event')
    advanceClock(clock, 4)
    const advanced = getClock(clock.clockId)!
    resetClock(advanced)
    const retrieved = getClock(clock.clockId)
    expect(retrieved!.filled).toBe(0)
  })

  it('preserves other clock properties', () => {
    const clock = createClock('Test Clock', 8, 'boss', 'icon-boss')
    const advanced = advanceClock(clock, 5)
    const reset = resetClock(advanced)

    expect(reset.name).toBe('Test Clock')
    expect(reset.segments).toBe(8)
    expect(reset.clockType).toBe('boss')
    expect(reset.iconKey).toBe('icon-boss')
  })
})

describe('ClockSystem - removeClock', () => {
  beforeEach(() => {
    loadClocks([])
  })

  it('removes clock from registry', () => {
    const clock = createClock('Test', 4, 'quest')
    expect(getClock(clock.clockId)).toBeDefined()

    const result = removeClock(clock.clockId)
    expect(result).toBe(true)
    expect(getClock(clock.clockId)).toBeUndefined()
  })

  it('returns false for non-existent clock', () => {
    const result = removeClock('non-existent-id')
    expect(result).toBe(false)
  })
})

describe('ClockSystem - getClockProgress', () => {
  beforeEach(() => {
    loadClocks([])
  })

  it('returns 0 for empty clock', () => {
    const clock = createClock('Test', 4, 'quest')
    expect(getClockProgress(clock)).toBe(0)
  })

  it('returns 25 for 1/4 filled clock', () => {
    const clock = createClock('Test', 4, 'quest')
    const updated = advanceClock(clock, 1)
    expect(getClockProgress(updated)).toBe(25)
  })

  it('returns 50 for half-filled clock', () => {
    const clock = createClock('Test', 6, 'event')
    const updated = advanceClock(clock, 3)
    expect(getClockProgress(updated)).toBe(50)
  })

  it('returns 100 for complete clock', () => {
    const clock = createClock('Test', 8, 'boss')
    const updated = advanceClock(clock, 8)
    expect(getClockProgress(updated)).toBe(100)
  })
})

describe('ClockSystem - getRemainingSegments', () => {
  beforeEach(() => {
    loadClocks([])
  })

  it('returns full segment count for empty clock', () => {
    const clock = createClock('Test', 6, 'event')
    expect(getRemainingSegments(clock)).toBe(6)
  })

  it('returns correct remaining for partially filled', () => {
    const clock = createClock('Test', 8, 'boss')
    const updated = advanceClock(clock, 3)
    expect(getRemainingSegments(updated)).toBe(5)
  })

  it('returns 0 for complete clock', () => {
    const clock = createClock('Test', 4, 'quest')
    const updated = advanceClock(clock, 4)
    expect(getRemainingSegments(updated)).toBe(0)
  })
})

describe('ClockSystem - getAllClocks', () => {
  beforeEach(() => {
    loadClocks([])
  })

  it('returns empty array when no clocks', () => {
    expect(getAllClocks()).toEqual([])
  })

  it('returns all created clocks', () => {
    createClock('Clock 1', 4, 'quest')
    createClock('Clock 2', 6, 'event')
    createClock('Clock 3', 8, 'boss')

    const clocks = getAllClocks()
    expect(clocks).toHaveLength(3)
  })
})

describe('ClockSystem - getClocksByType', () => {
  beforeEach(() => {
    loadClocks([])
  })

  it('returns only clocks of specified type', () => {
    createClock('Quest 1', 4, 'quest')
    createClock('Quest 2', 6, 'quest')
    createClock('Event 1', 4, 'event')
    createClock('Boss 1', 8, 'boss')

    const questClocks = getClocksByType('quest')
    expect(questClocks).toHaveLength(2)
    expect(questClocks.every((c) => c.clockType === 'quest')).toBe(true)
  })

  it('returns empty array for type with no clocks', () => {
    createClock('Quest 1', 4, 'quest')
    const abilityClocks = getClocksByType('ability')
    expect(abilityClocks).toHaveLength(0)
  })
})

describe('ClockSystem - hasCompleteClock', () => {
  beforeEach(() => {
    loadClocks([])
  })

  it('returns false when no complete clocks of type', () => {
    const clock = createClock('Quest', 4, 'quest')
    advanceClock(clock, 2)
    expect(hasCompleteClock('quest')).toBe(false)
  })

  it('returns true when at least one complete clock of type', () => {
    createClock('Quest 1', 4, 'quest')
    const clock2 = createClock('Quest 2', 4, 'quest')
    advanceClock(clock2, 4)

    expect(hasCompleteClock('quest')).toBe(true)
  })

  it('does not count complete clocks of different type', () => {
    const eventClock = createClock('Event', 4, 'event')
    advanceClock(eventClock, 4)

    expect(hasCompleteClock('quest')).toBe(false)
  })
})

describe('ClockSystem - loadClocks', () => {
  beforeEach(() => {
    loadClocks([])
  })

  it('clears existing clocks', () => {
    createClock('Old Clock', 4, 'quest')
    expect(getAllClocks()).toHaveLength(1)

    loadClocks([])
    expect(getAllClocks()).toHaveLength(0)
  })

  it('loads provided clocks into registry', () => {
    const clocks: ProgressClock[] = [
      {
        clockId: 'clock-1',
        name: 'Saved Clock 1',
        segments: 6,
        filled: 3,
        clockType: 'quest',
      },
      {
        clockId: 'clock-2',
        name: 'Saved Clock 2',
        segments: 8,
        filled: 8,
        clockType: 'boss',
      },
    ]

    loadClocks(clocks)

    const loaded = getAllClocks()
    expect(loaded).toHaveLength(2)
    expect(getClock('clock-1')?.filled).toBe(3)
    expect(getClock('clock-2')?.filled).toBe(8)
    expect(isClockComplete(getClock('clock-2')!)).toBe(true)
  })
})

describe('ClockSystem - createClockWithProgress', () => {
  beforeEach(() => {
    // Load clocks clears the registry
    loadClocks([])
  })

  it('creates a clock with initial progress', () => {
    const clock = createClockWithProgress('Partial Quest', 6, 'quest', 3)
    expect(clock.filled).toBe(3)
    expect(clock.segments).toBe(6)
  })

  it('caps initial progress at segment count', () => {
    const clock = createClockWithProgress('Overflowing', 4, 'event', 10)
    expect(clock.filled).toBe(4)
    expect(isClockComplete(clock)).toBe(true)
  })
})
