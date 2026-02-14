import type { ProgressClock, ClockType, ClockSegments } from '../models/types'
import { generateId } from '../utils/id'

// ── Clock Registry ──

const clockRegistry = new Map<string, ProgressClock>()

/**
 * Load clocks into the registry (for save game restoration).
 */
export function loadClocks(clocks: ReadonlyArray<ProgressClock>): void {
  clockRegistry.clear()
  for (const clock of clocks) {
    clockRegistry.set(clock.clockId, clock)
  }
}

/**
 * Get all active clocks.
 */
export function getAllClocks(): ReadonlyArray<ProgressClock> {
  return Array.from(clockRegistry.values())
}

/**
 * Get a clock by ID.
 */
export function getClock(clockId: string): ProgressClock | undefined {
  return clockRegistry.get(clockId)
}

// ── Clock Operations (Pure Functions) ──

/**
 * Create a new progress clock.
 * @param name Display name for the clock
 * @param segments Number of segments (4, 6, or 8)
 * @param clockType Type of clock (quest, event, ability, boss)
 * @param iconKey Optional icon key for display
 */
export function createClock(
  name: string,
  segments: ClockSegments,
  clockType: ClockType,
  iconKey?: string,
): ProgressClock {
  const clock: ProgressClock = {
    clockId: `clock-${generateId()}`,
    name,
    segments,
    filled: 0,
    clockType,
    iconKey,
  }
  clockRegistry.set(clock.clockId, clock)
  return clock
}

/**
 * Advance a clock by a number of segments.
 * Returns the updated clock.
 * @param clock The clock to advance
 * @param amount Number of segments to fill (default 1)
 */
export function advanceClock(
  clock: ProgressClock,
  amount: number = 1,
): ProgressClock {
  const newFilled = Math.min(clock.filled + amount, clock.segments)
  const updatedClock: ProgressClock = {
    ...clock,
    filled: newFilled,
  }
  clockRegistry.set(clock.clockId, updatedClock)
  return updatedClock
}

/**
 * Check if a clock is complete (all segments filled).
 */
export function isClockComplete(clock: ProgressClock): boolean {
  return clock.filled >= clock.segments
}

/**
 * Reset a clock to empty (0 filled segments).
 */
export function resetClock(clock: ProgressClock): ProgressClock {
  const updatedClock: ProgressClock = {
    ...clock,
    filled: 0,
  }
  clockRegistry.set(clock.clockId, updatedClock)
  return updatedClock
}

/**
 * Remove a clock from the registry.
 */
export function removeClock(clockId: string): boolean {
  return clockRegistry.delete(clockId)
}

/**
 * Get progress as a percentage (0-100).
 */
export function getClockProgress(clock: ProgressClock): number {
  return Math.round((clock.filled / clock.segments) * 100)
}

/**
 * Get remaining segments until complete.
 */
export function getRemainingSegments(clock: ProgressClock): number {
  return clock.segments - clock.filled
}

// ── Clock Helpers ──

/**
 * Find clocks by type.
 */
export function getClocksByType(clockType: ClockType): ReadonlyArray<ProgressClock> {
  return Array.from(clockRegistry.values()).filter(
    (clock) => clock.clockType === clockType,
  )
}

/**
 * Check if any clock of a given type is complete.
 */
export function hasCompleteClock(clockType: ClockType): boolean {
  return getClocksByType(clockType).some(isClockComplete)
}

/**
 * Create a clock and immediately advance it by a given amount.
 * Useful for initializing partially-filled clocks.
 */
export function createClockWithProgress(
  name: string,
  segments: ClockSegments,
  clockType: ClockType,
  initialFilled: number,
  iconKey?: string,
): ProgressClock {
  const clock = createClock(name, segments, clockType, iconKey)
  return advanceClock(clock, initialFilled)
}
