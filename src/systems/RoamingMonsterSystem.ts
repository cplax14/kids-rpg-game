import type { GameAreaDefinition, AreaEncounterEntry, TerrainType } from '../models/types'
import type { GeneratedMap } from '../utils/mapGenerator'
import { getCollisionTiles } from '../utils/mapGenerator'
import { getSpecies } from './MonsterSystem'
import { weightedRandom, randomInt } from '../utils/math'
import { TILE_SIZE } from '../config'
import { isTutorialComplete } from './TutorialSystem'

// Hand-drawn monster species (by the kids!) — guaranteed for first battle
const HAND_DRAWN_SPECIES: ReadonlyArray<string> = [
  'fireimp', 'aquawing', 'madcheeks', 'chimeradrake', 'emberwing',
  'blazecheetah', 'frostfist', 'iceboxer', 'plantosaur', 'miniflame',
  'tidalfang', 'leafblower', 'aquafang',
]

export interface RoamingMonsterSpawn {
  readonly speciesId: string
  readonly level: number
  readonly x: number
  readonly y: number
}

/**
 * Get all walkable tile positions from a generated map.
 * A tile is walkable if its object layer value is not a collision tile.
 */
export function getWalkablePositions(
  generatedMap: GeneratedMap,
  terrainType: TerrainType,
): ReadonlyArray<{ readonly x: number; readonly y: number }> {
  const collisionTiles = getCollisionTiles(terrainType)
  const positions: { x: number; y: number }[] = []

  for (let y = 0; y < generatedMap.height; y++) {
    for (let x = 0; x < generatedMap.width; x++) {
      const index = y * generatedMap.width + x
      const objectTile = generatedMap.objectLayer[index]

      // Walkable if no collision object on this tile
      if (!collisionTiles.includes(objectTile)) {
        positions.push({
          x: x * TILE_SIZE + TILE_SIZE / 2,
          y: y * TILE_SIZE + TILE_SIZE / 2,
        })
      }
    }
  }

  return positions
}

/**
 * Filter walkable positions to exclude safe zones.
 * For the village, the center area (tiles 8-22 on both axes) is safe.
 */
export function filterSafeZones(
  positions: ReadonlyArray<{ readonly x: number; readonly y: number }>,
  areaId: string,
): ReadonlyArray<{ readonly x: number; readonly y: number }> {
  if (areaId === 'sunlit-village') {
    return positions.filter((pos) => {
      const tileX = Math.floor(pos.x / TILE_SIZE)
      const tileY = Math.floor(pos.y / TILE_SIZE)
      const isNearCenter = tileX > 8 && tileX < 22 && tileY > 8 && tileY < 22
      return !isNearCenter
    })
  }
  return positions
}

/**
 * Pick spawn positions that are spread apart and away from edges.
 */
export function pickSpawnPositions(
  walkablePositions: ReadonlyArray<{ readonly x: number; readonly y: number }>,
  count: number,
  minDistanceBetween: number = TILE_SIZE * 3,
): ReadonlyArray<{ readonly x: number; readonly y: number }> {
  if (walkablePositions.length === 0) return []

  const selected: { x: number; y: number }[] = []
  // Shuffle copy to get random selection
  const shuffled = [...walkablePositions].sort(() => Math.random() - 0.5)

  for (const pos of shuffled) {
    if (selected.length >= count) break

    // Check minimum distance from already-selected positions
    const tooClose = selected.some((s) => {
      const dx = s.x - pos.x
      const dy = s.y - pos.y
      return Math.sqrt(dx * dx + dy * dy) < minDistanceBetween
    })

    if (!tooClose) {
      selected.push({ x: pos.x, y: pos.y })
    }
  }

  // If we couldn't find enough spread-out positions, fill with random ones
  if (selected.length < count) {
    for (const pos of shuffled) {
      if (selected.length >= count) break
      if (!selected.some((s) => s.x === pos.x && s.y === pos.y)) {
        selected.push({ x: pos.x, y: pos.y })
      }
    }
  }

  return selected
}

/**
 * Get the filtered wild encounter pool for an area.
 */
function getWildEncounterPool(area: GameAreaDefinition): ReadonlyArray<AreaEncounterEntry> {
  return area.encounters.filter((e) => {
    const species = getSpecies(e.speciesId)
    return species && species.obtainableVia !== 'evolution'
  })
}

/**
 * Generate roaming monster spawn data for an area.
 */
export function generateRoamingMonsters(
  area: GameAreaDefinition,
  spawnPositions: ReadonlyArray<{ readonly x: number; readonly y: number }>,
): ReadonlyArray<RoamingMonsterSpawn> {
  const wildEncounters = getWildEncounterPool(area)
  if (wildEncounters.length === 0 || spawnPositions.length === 0) return []

  const isFirstBattle = !isTutorialComplete('tutorial-first-battle')

  // For first battle, filter to hand-drawn species if available
  const firstBattlePool = isFirstBattle
    ? wildEncounters.filter((e) => HAND_DRAWN_SPECIES.includes(e.speciesId))
    : []

  const items = wildEncounters.map((e) => e)
  const weights = wildEncounters.map((e) => e.weight)

  const spawns: RoamingMonsterSpawn[] = []

  for (let i = 0; i < spawnPositions.length; i++) {
    const pos = spawnPositions[i]

    let picked: AreaEncounterEntry
    if (i === 0 && isFirstBattle && firstBattlePool.length > 0) {
      // First monster in first battle area should be hand-drawn
      const fbItems = firstBattlePool.map((e) => e)
      const fbWeights = firstBattlePool.map((e) => e.weight)
      picked = weightedRandom(fbItems, fbWeights) as AreaEncounterEntry
    } else {
      picked = weightedRandom(items, weights) as AreaEncounterEntry
    }

    const level = randomInt(picked.minLevel, picked.maxLevel)

    spawns.push({
      speciesId: picked.speciesId,
      level,
      x: pos.x,
      y: pos.y,
    })
  }

  return spawns
}

/**
 * Generate a random second enemy from the area's encounter table.
 * Used when the multi-enemy chance triggers on a roaming encounter.
 */
export function generateRandomAreaEnemy(
  area: GameAreaDefinition,
): RoamingMonsterSpawn | null {
  const wildEncounters = getWildEncounterPool(area)
  if (wildEncounters.length === 0) return null

  const items = wildEncounters.map((e) => e)
  const weights = wildEncounters.map((e) => e.weight)
  const picked = weightedRandom(items, weights) as AreaEncounterEntry
  const level = randomInt(picked.minLevel, picked.maxLevel)

  return {
    speciesId: picked.speciesId,
    level,
    x: 0,
    y: 0,
  }
}
