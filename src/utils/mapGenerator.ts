import type { Position, TerrainType } from '../models/types'
import { randomInt, randomChance } from './math'

export interface MapConfig {
  readonly width: number
  readonly height: number
  readonly terrainType: TerrainType
  readonly entryPoints: ReadonlyArray<Position>
  readonly exitPoints: ReadonlyArray<Position>
  readonly reservedPositions: ReadonlyArray<Position>
}

export interface GeneratedMap {
  readonly groundLayer: ReadonlyArray<number>
  readonly objectLayer: ReadonlyArray<number>
  readonly width: number
  readonly height: number
}

// Tile indices for different terrain types
const FOREST_TILES = {
  GRASS_1: 0,
  GRASS_2: 1,
  DIRT: 7,
  TREE_1: 8,
  TREE_2: 9,
  ROCK_1: 10,
  ROCK_2: 11,
  BUSH: 27,
  FLOWER_1: 24,
  FLOWER_2: 25,
  FLOWER_3: 26,
  TALL_GRASS: 28,
  MUSHROOM: 29,
} as const

const CAVE_TILES = {
  STONE_FLOOR: 7,
  STONE_DARK: 29,
  WALL_1: 13,
  WALL_2: 14,
  ROCK_1: 10,
  ROCK_2: 11,
  CRYSTAL: 22,
  STALAGMITE: 30,
} as const

const VOLCANO_TILES = {
  LAVA_FLOOR: 40,
  OBSIDIAN_FLOOR: 41,
  LAVA_POOL: 42,
  VOLCANIC_WALL: 43,
  STEAM_VENT: 44,
  EMBER: 45,
  COOLED_ROCK: 46,
} as const

const GROTTO_TILES = {
  SAND_FLOOR: 50,
  WET_SAND: 51,
  SHALLOW_WATER: 52,
  DEEP_WATER: 53,
  CORAL_WALL: 54,
  SEAWEED: 55,
  SHELL: 56,
} as const

const SWAMP_TILES = {
  MUD_FLOOR: 60,
  MURKY_WATER: 61,
  DEEP_BOG: 62,
  TWISTED_ROOT: 63,
  DEAD_TREE: 64,
  GLOW_MUSHROOM: 65,
  FOG_PATCH: 66,
} as const

const EMPTY_TILE = -1

function createEmptyLayer(width: number, height: number, fill: number = EMPTY_TILE): number[] {
  return new Array(width * height).fill(fill)
}

function getTileIndex(x: number, y: number, width: number): number {
  return y * width + x
}

function isValidPosition(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && x < width && y >= 0 && y < height
}

function positionToTile(pos: Position, tileSize: number): Position {
  return {
    x: Math.floor(pos.x / tileSize),
    y: Math.floor(pos.y / tileSize),
  }
}

function isReservedTile(
  x: number,
  y: number,
  reservedPositions: ReadonlyArray<Position>,
  tileSize: number,
): boolean {
  return reservedPositions.some((pos) => {
    const tile = positionToTile(pos, tileSize)
    const dx = Math.abs(tile.x - x)
    const dy = Math.abs(tile.y - y)
    return dx <= 2 && dy <= 2
  })
}

function fillGroundLayer(
  layer: number[],
  width: number,
  height: number,
  terrainType: TerrainType,
): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = getTileIndex(x, y, width)
      if (terrainType === 'forest') {
        layer[index] = randomChance(0.7) ? FOREST_TILES.GRASS_1 : FOREST_TILES.GRASS_2
      } else if (terrainType === 'cave') {
        layer[index] = randomChance(0.8) ? CAVE_TILES.STONE_FLOOR : CAVE_TILES.STONE_DARK
      } else if (terrainType === 'volcano') {
        layer[index] = randomChance(0.6) ? VOLCANO_TILES.LAVA_FLOOR : VOLCANO_TILES.OBSIDIAN_FLOOR
      } else if (terrainType === 'grotto') {
        layer[index] = randomChance(0.7) ? GROTTO_TILES.SAND_FLOOR : GROTTO_TILES.WET_SAND
      } else if (terrainType === 'swamp') {
        layer[index] = randomChance(0.6) ? SWAMP_TILES.MUD_FLOOR : SWAMP_TILES.MURKY_WATER
      } else {
        layer[index] = FOREST_TILES.GRASS_1
      }
    }
  }
}

function createPathBetweenPoints(
  objectLayer: number[],
  width: number,
  height: number,
  start: Position,
  end: Position,
  pathWidth: number = 2,
): void {
  let { x: currentX, y: currentY } = start
  const { x: targetX, y: targetY } = end

  while (currentX !== targetX || currentY !== targetY) {
    // Clear path tiles around current position
    for (let dy = -pathWidth; dy <= pathWidth; dy++) {
      for (let dx = -pathWidth; dx <= pathWidth; dx++) {
        const px = currentX + dx
        const py = currentY + dy
        if (isValidPosition(px, py, width, height)) {
          const index = getTileIndex(px, py, width)
          objectLayer[index] = EMPTY_TILE
        }
      }
    }

    // Move towards target with some randomness
    if (randomChance(0.7)) {
      if (currentX < targetX) currentX++
      else if (currentX > targetX) currentX--
    } else {
      if (currentY < targetY) currentY++
      else if (currentY > targetY) currentY--
    }

    // Alternate movement to create natural paths
    if (randomChance(0.5)) {
      if (currentY < targetY) currentY++
      else if (currentY > targetY) currentY--
    } else {
      if (currentX < targetX) currentX++
      else if (currentX > targetX) currentX--
    }
  }
}

function placeForestObstacles(
  objectLayer: number[],
  width: number,
  height: number,
  reservedPositions: ReadonlyArray<Position>,
  tileSize: number,
): void {
  // First pass: place trees with clustering (scaled sprites will overlap nicely)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = getTileIndex(x, y, width)

      // Skip if already has obstacle or is on a path
      if (objectLayer[index] !== EMPTY_TILE) continue

      // Skip reserved positions
      if (isReservedTile(x, y, reservedPositions, tileSize)) continue

      // Skip edges for cleaner borders
      // Large trees (64x96) need more clearance: 2 tiles from edges
      // y <= 2 ensures the 96px tall tree canopy doesn't go off-screen
      if (x <= 1 || x >= width - 2 || y <= 2 || y >= height - 1) continue

      // Check for nearby trees to create clustering
      // With large 64x96 trees, we need to space them out more
      const hasNearbyTree = checkNearbyTile(objectLayer, x, y, width, height, [FOREST_TILES.TREE_1, FOREST_TILES.TREE_2])

      // Lower tree density for large sprites: 12% base, +10% if clustering
      // Large trees (64x96) overlap naturally, so fewer tiles needed
      const treeProbability = hasNearbyTree ? 0.22 : 0.12
      const roll = Math.random()

      if (roll < treeProbability) {
        objectLayer[index] = randomChance(0.5) ? FOREST_TILES.TREE_1 : FOREST_TILES.TREE_2
      }
    }
  }

  // Second pass: place rocks and bushes (bushes near trees for cohesion)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = getTileIndex(x, y, width)

      // Skip if already has obstacle
      if (objectLayer[index] !== EMPTY_TILE) continue

      // Skip reserved positions
      if (isReservedTile(x, y, reservedPositions, tileSize)) continue

      // Skip edges
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) continue

      const hasNearbyTree = checkNearbyTile(objectLayer, x, y, width, height, [FOREST_TILES.TREE_1, FOREST_TILES.TREE_2])

      const roll = Math.random()

      if (roll < 0.04) {
        // Rocks scattered throughout (less frequent)
        objectLayer[index] = randomChance(0.5) ? FOREST_TILES.ROCK_1 : FOREST_TILES.ROCK_2
      } else if (hasNearbyTree && roll < 0.15) {
        // Bushes only near trees for cohesive forest feel
        objectLayer[index] = FOREST_TILES.BUSH
      }
    }
  }
}

function checkNearbyTile(
  layer: number[],
  x: number,
  y: number,
  width: number,
  height: number,
  tileTypes: readonly number[],
): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (isValidPosition(nx, ny, width, height)) {
        const idx = getTileIndex(nx, ny, width)
        if (tileTypes.includes(layer[idx])) return true
      }
    }
  }
  return false
}

function placeCaveObstacles(
  objectLayer: number[],
  width: number,
  height: number,
  reservedPositions: ReadonlyArray<Position>,
  tileSize: number,
): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = getTileIndex(x, y, width)

      // Skip if already has obstacle or is on a path
      if (objectLayer[index] !== EMPTY_TILE) continue

      // Skip reserved positions
      if (isReservedTile(x, y, reservedPositions, tileSize)) continue

      // Create walls around edges
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        objectLayer[index] = randomChance(0.5) ? CAVE_TILES.WALL_1 : CAVE_TILES.WALL_2
        continue
      }

      // Random obstacle placement
      const roll = Math.random()

      if (roll < 0.12) {
        objectLayer[index] = randomChance(0.5) ? CAVE_TILES.ROCK_1 : CAVE_TILES.ROCK_2
      } else if (roll < 0.18) {
        objectLayer[index] = CAVE_TILES.STALAGMITE
      } else if (roll < 0.22) {
        objectLayer[index] = CAVE_TILES.CRYSTAL
      }
    }
  }
}

function placeVolcanoObstacles(
  objectLayer: number[],
  width: number,
  height: number,
  reservedPositions: ReadonlyArray<Position>,
  tileSize: number,
): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = getTileIndex(x, y, width)

      // Skip if already has obstacle or is on a path
      if (objectLayer[index] !== EMPTY_TILE) continue

      // Skip reserved positions
      if (isReservedTile(x, y, reservedPositions, tileSize)) continue

      // Create volcanic walls around edges
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        objectLayer[index] = VOLCANO_TILES.VOLCANIC_WALL
        continue
      }

      // Random obstacle and decoration placement
      const roll = Math.random()

      if (roll < 0.08) {
        // Lava pools (obstacle)
        objectLayer[index] = VOLCANO_TILES.LAVA_POOL
      } else if (roll < 0.14) {
        // Cooled rock formations (obstacle)
        objectLayer[index] = VOLCANO_TILES.COOLED_ROCK
      } else if (roll < 0.20) {
        // Steam vents (decoration)
        objectLayer[index] = VOLCANO_TILES.STEAM_VENT
      } else if (roll < 0.25) {
        // Embers (decoration)
        objectLayer[index] = VOLCANO_TILES.EMBER
      }
    }
  }
}

function placeGrottoObstacles(
  objectLayer: number[],
  width: number,
  height: number,
  reservedPositions: ReadonlyArray<Position>,
  tileSize: number,
): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = getTileIndex(x, y, width)

      // Skip if already has obstacle or is on a path
      if (objectLayer[index] !== EMPTY_TILE) continue

      // Skip reserved positions
      if (isReservedTile(x, y, reservedPositions, tileSize)) continue

      // Create coral walls around edges
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        objectLayer[index] = GROTTO_TILES.CORAL_WALL
        continue
      }

      // Check for nearby water for clustering
      const hasNearbyWater = checkNearbyTile(objectLayer, x, y, width, height, [
        GROTTO_TILES.SHALLOW_WATER,
        GROTTO_TILES.DEEP_WATER,
      ])

      // Random obstacle and decoration placement
      const roll = Math.random()

      if (roll < 0.06) {
        // Deep water pools (obstacle)
        objectLayer[index] = GROTTO_TILES.DEEP_WATER
      } else if (roll < 0.12 || (hasNearbyWater && roll < 0.18)) {
        // Shallow water (passable, cluster near deep water)
        objectLayer[index] = GROTTO_TILES.SHALLOW_WATER
      } else if (roll < 0.16) {
        // Coral walls
        objectLayer[index] = GROTTO_TILES.CORAL_WALL
      } else if (roll < 0.22) {
        // Seaweed (decoration)
        objectLayer[index] = GROTTO_TILES.SEAWEED
      } else if (roll < 0.26) {
        // Shells (decoration)
        objectLayer[index] = GROTTO_TILES.SHELL
      }
    }
  }
}

function placeSwampObstacles(
  objectLayer: number[],
  width: number,
  height: number,
  reservedPositions: ReadonlyArray<Position>,
  tileSize: number,
): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = getTileIndex(x, y, width)

      // Skip if already has obstacle or is on a path
      if (objectLayer[index] !== EMPTY_TILE) continue

      // Skip reserved positions
      if (isReservedTile(x, y, reservedPositions, tileSize)) continue

      // Skip edges for dead tree placement clearance
      if (x <= 1 || x >= width - 2 || y <= 2 || y >= height - 1) {
        if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
          objectLayer[index] = SWAMP_TILES.TWISTED_ROOT
        }
        continue
      }

      // Check for nearby trees for clustering
      const hasNearbyTree = checkNearbyTile(objectLayer, x, y, width, height, [SWAMP_TILES.DEAD_TREE])

      // Random obstacle and decoration placement
      const roll = Math.random()

      if (roll < 0.06) {
        // Deep bog (obstacle)
        objectLayer[index] = SWAMP_TILES.DEEP_BOG
      } else if (roll < 0.14 || (hasNearbyTree && roll < 0.18)) {
        // Dead trees (cluster for eerie forest feel)
        objectLayer[index] = SWAMP_TILES.DEAD_TREE
      } else if (roll < 0.20) {
        // Twisted roots (obstacle)
        objectLayer[index] = SWAMP_TILES.TWISTED_ROOT
      } else if (roll < 0.26) {
        // Glowing mushrooms (decoration, eerie light source)
        objectLayer[index] = SWAMP_TILES.GLOW_MUSHROOM
      } else if (roll < 0.30) {
        // Fog patches (decoration)
        objectLayer[index] = SWAMP_TILES.FOG_PATCH
      }
    }
  }
}

function addDecorations(
  _groundLayer: number[],
  objectLayer: number[],
  width: number,
  height: number,
  terrainType: TerrainType,
): void {
  if (terrainType !== 'forest') return

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = getTileIndex(x, y, width)

      // Only add decorations on empty tiles (no obstacles)
      if (objectLayer[index] !== EMPTY_TILE) continue

      // Skip edges
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) continue

      // Place decorations in objectLayer so they render as sprites
      const roll = Math.random()

      if (roll < 0.08) {
        // Tall grass is more common in forest clearings
        objectLayer[index] = FOREST_TILES.TALL_GRASS
      } else if (roll < 0.12) {
        // Mushrooms scattered around
        objectLayer[index] = FOREST_TILES.MUSHROOM
      } else if (roll < 0.15) {
        // Small flowers occasionally (rendered as sprites, not colored squares)
        const flowerRoll = Math.random()
        if (flowerRoll < 0.33) {
          objectLayer[index] = FOREST_TILES.FLOWER_1
        } else if (flowerRoll < 0.66) {
          objectLayer[index] = FOREST_TILES.FLOWER_2
        } else {
          objectLayer[index] = FOREST_TILES.FLOWER_3
        }
      }
    }
  }
}

export function generateMap(config: MapConfig): GeneratedMap {
  const { width, height, terrainType, entryPoints, exitPoints, reservedPositions } = config
  const tileSize = 32

  const groundLayer = createEmptyLayer(width, height, 0)
  const objectLayer = createEmptyLayer(width, height, EMPTY_TILE)

  // Fill ground with terrain-appropriate tiles
  fillGroundLayer(groundLayer, width, height, terrainType)

  // Combine all important points that need paths
  const allPoints = [...entryPoints, ...exitPoints, ...reservedPositions]

  // Create paths between entry points, exit points, and reserved positions
  if (allPoints.length >= 2) {
    // Connect entry to center
    const centerX = Math.floor(width / 2)
    const centerY = Math.floor(height / 2)
    const center: Position = { x: centerX, y: centerY }

    for (const entry of entryPoints) {
      const entryTile = positionToTile(entry, tileSize)
      createPathBetweenPoints(objectLayer, width, height, entryTile, center)
    }

    for (const exit of exitPoints) {
      const exitTile = positionToTile(exit, tileSize)
      createPathBetweenPoints(objectLayer, width, height, center, exitTile)
    }

    // Connect reserved positions (bosses, interactables)
    for (const reserved of reservedPositions) {
      const tile = positionToTile(reserved, tileSize)
      createPathBetweenPoints(objectLayer, width, height, center, tile, 3)
    }
  }

  // Place obstacles based on terrain type
  if (terrainType === 'forest') {
    placeForestObstacles(objectLayer, width, height, reservedPositions, tileSize)
  } else if (terrainType === 'cave') {
    placeCaveObstacles(objectLayer, width, height, reservedPositions, tileSize)
  } else if (terrainType === 'volcano') {
    placeVolcanoObstacles(objectLayer, width, height, reservedPositions, tileSize)
  } else if (terrainType === 'grotto') {
    placeGrottoObstacles(objectLayer, width, height, reservedPositions, tileSize)
  } else if (terrainType === 'swamp') {
    placeSwampObstacles(objectLayer, width, height, reservedPositions, tileSize)
  }

  // Add decorative elements
  addDecorations(groundLayer, objectLayer, width, height, terrainType)

  return {
    groundLayer,
    objectLayer,
    width,
    height,
  }
}

export function getCollisionTiles(terrainType: TerrainType): ReadonlyArray<number> {
  if (terrainType === 'forest') {
    return [
      FOREST_TILES.TREE_1,
      FOREST_TILES.TREE_2,
      FOREST_TILES.ROCK_1,
      FOREST_TILES.ROCK_2,
    ]
  } else if (terrainType === 'cave') {
    return [
      CAVE_TILES.WALL_1,
      CAVE_TILES.WALL_2,
      CAVE_TILES.ROCK_1,
      CAVE_TILES.ROCK_2,
      CAVE_TILES.STALAGMITE,
    ]
  } else if (terrainType === 'volcano') {
    return [
      VOLCANO_TILES.LAVA_POOL,
      VOLCANO_TILES.VOLCANIC_WALL,
      VOLCANO_TILES.COOLED_ROCK,
    ]
  } else if (terrainType === 'grotto') {
    return [
      GROTTO_TILES.DEEP_WATER,
      GROTTO_TILES.CORAL_WALL,
    ]
  } else if (terrainType === 'swamp') {
    return [
      SWAMP_TILES.DEEP_BOG,
      SWAMP_TILES.TWISTED_ROOT,
      SWAMP_TILES.DEAD_TREE,
    ]
  }
  return []
}
