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
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = getTileIndex(x, y, width)

      // Skip if already has obstacle or is on a path
      if (objectLayer[index] !== EMPTY_TILE) continue

      // Skip reserved positions
      if (isReservedTile(x, y, reservedPositions, tileSize)) continue

      // Skip edges for cleaner borders
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) continue

      // Random obstacle placement
      const roll = Math.random()

      if (roll < 0.15) {
        objectLayer[index] = randomChance(0.5) ? FOREST_TILES.TREE_1 : FOREST_TILES.TREE_2
      } else if (roll < 0.20) {
        objectLayer[index] = randomChance(0.5) ? FOREST_TILES.ROCK_1 : FOREST_TILES.ROCK_2
      } else if (roll < 0.25) {
        objectLayer[index] = FOREST_TILES.BUSH
      }
    }
  }
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

function addDecorations(
  groundLayer: number[],
  objectLayer: number[],
  width: number,
  height: number,
  terrainType: TerrainType,
): void {
  if (terrainType !== 'forest') return

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = getTileIndex(x, y, width)

      // Only add decorations on grass tiles with no obstacles
      if (objectLayer[index] !== EMPTY_TILE) continue

      const roll = Math.random()

      if (roll < 0.03) {
        groundLayer[index] = FOREST_TILES.FLOWER_1
      } else if (roll < 0.06) {
        groundLayer[index] = FOREST_TILES.FLOWER_2
      } else if (roll < 0.08) {
        groundLayer[index] = FOREST_TILES.FLOWER_3
      } else if (roll < 0.12) {
        groundLayer[index] = FOREST_TILES.TALL_GRASS
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
  }
  return []
}
