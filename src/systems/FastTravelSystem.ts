import type { Position } from '../models/types'

// ── Fast Travel Configuration ──

export interface FastTravelDestination {
  readonly areaId: string
  readonly areaName: string
  readonly requiredBoss: string
}

/**
 * Areas eligible for fast travel (past Whispering Forest)
 * Each area requires defeating the previous area's boss to unlock
 */
export const FAST_TRAVEL_AREAS: ReadonlyArray<FastTravelDestination> = [
  { areaId: 'crystal-caves', areaName: 'Crystal Caves', requiredBoss: 'elderwood' },
  { areaId: 'volcanic-peak', areaName: 'Volcanic Peak', requiredBoss: 'crystallix' },
  { areaId: 'seaside-grotto', areaName: 'Seaside Grotto', requiredBoss: 'emberlord' },
  { areaId: 'shadow-marsh', areaName: 'Shadow Marsh', requiredBoss: 'pearlqueen' },
]

/**
 * Spawn positions for fast travel destinations
 * These are positioned near the area entrance/waypoint location
 */
const FAST_TRAVEL_SPAWN_POSITIONS: Readonly<Record<string, Position>> = {
  'sunlit-village': { x: 480, y: 480 },  // Village center
  'crystal-caves': { x: 200, y: 640 },   // Near entrance from forest
  'volcanic-peak': { x: 200, y: 640 },   // Near entrance from caves
  'seaside-grotto': { x: 200, y: 576 },  // Near entrance from volcano
  'shadow-marsh': { x: 200, y: 544 },    // Near entrance from grotto
}

// ── Pure Functions ──

/**
 * Check if the Village hub waypoint is available
 * Hub requires defeating Elderwood (the first boss blocking Crystal Caves)
 */
export function isFastTravelHubAvailable(
  defeatedBosses: ReadonlyArray<string>,
): boolean {
  return defeatedBosses.includes('elderwood')
}

/**
 * Get list of unlocked fast travel destinations for the hub menu
 * A destination is unlocked if:
 * 1. The required boss has been defeated
 * 2. The player has visited that area at least once
 */
export function getUnlockedFastTravelDestinations(
  defeatedBosses: ReadonlyArray<string>,
  visitedAreas: ReadonlyArray<string>,
): ReadonlyArray<FastTravelDestination> {
  return FAST_TRAVEL_AREAS.filter((dest) => {
    const bossDefeated = defeatedBosses.includes(dest.requiredBoss)
    const hasVisited = visitedAreas.includes(dest.areaId)
    return bossDefeated && hasVisited
  })
}

/**
 * Validate that fast travel to a target area is allowed
 */
export function canFastTravelTo(
  areaId: string,
  defeatedBosses: ReadonlyArray<string>,
  visitedAreas: ReadonlyArray<string>,
): boolean {
  // Village is always accessible
  if (areaId === 'sunlit-village') {
    return true
  }

  // Find the destination config
  const destination = FAST_TRAVEL_AREAS.find((d) => d.areaId === areaId)
  if (!destination) {
    return false
  }

  // Check requirements
  const bossDefeated = defeatedBosses.includes(destination.requiredBoss)
  const hasVisited = visitedAreas.includes(areaId)

  return bossDefeated && hasVisited
}

/**
 * Get the spawn position for a fast travel destination
 */
export function getFastTravelSpawnPosition(areaId: string): Position {
  return FAST_TRAVEL_SPAWN_POSITIONS[areaId] ?? { x: 200, y: 320 }
}

/**
 * Get the area name for display in the fast travel dialog
 */
export function getFastTravelAreaName(areaId: string): string {
  if (areaId === 'sunlit-village') {
    return 'Sunlit Village'
  }

  const destination = FAST_TRAVEL_AREAS.find((d) => d.areaId === areaId)
  return destination?.areaName ?? 'Unknown Area'
}
