import Phaser from 'phaser'
import { SCENE_KEYS, TILE_SIZE, DEPTH, GAME_WIDTH, GAME_HEIGHT, TEXT_STYLES } from '../config'
import { Player } from '../entities/Player'
import { InputSystem } from '../systems/InputSystem'
import type {
  MonsterSpecies,
  Ability,
  BattleCombatant,
  ItemDrop,
  GameAreaDefinition,
  BossDefinition,
  TransitionZone,
  InteractableObject,
  ChestObject,
  SignObject,
  FountainObject,
  TutorialStep,
} from '../models/types'
import {
  loadSpeciesData,
  loadAbilityData,
  getSpecies,
  calculateMonsterStats,
  getLearnedAbilitiesAtLevel,
  createMonsterInstance,
} from '../systems/MonsterSystem'
import { createCombatantFromPlayer, createCombatantFromEnemy } from '../systems/CombatSystem'
import { addExperience, updatePlayerGold } from '../systems/CharacterSystem'
import { randomInt, randomChance, weightedRandom } from '../utils/math'
import { EventBus } from '../events/EventBus'
import { GAME_EVENTS } from '../events/GameEvents'
import {
  createInitialGameState,
  getGameState,
  setGameState,
  hasGameState,
  updatePlayer,
  updateInventory,
  updateSquad,
  updateDiscoveredSpecies,
  updateCurrentArea,
  updateActiveQuests,
  type GameState,
} from '../systems/GameStateManager'
import { createSquadCombatants } from '../systems/SquadSystem'
import { discoverMultipleSpecies } from '../systems/BestiarySystem'
import { addItem, loadItemData } from '../systems/InventorySystem'
import { loadEquipmentData } from '../systems/EquipmentSystem'
import { loadDialogData } from '../systems/DialogSystem'
import { loadTraitData } from '../systems/TraitSystem'
import { loadBreedingRecipes } from '../systems/BreedingSystem'
import { NPC } from '../entities/NPC'
import { Interactable } from '../entities/Interactable'
import type { TraitDefinition, BreedingRecipe } from '../models/types'
import {
  loadAreaData,
  loadBossData,
  getArea,
  getBoss,
  generateAreaEncounter,
  getUndefeatedBosses,
  createBossEncounter,
} from '../systems/WorldSystem'
import {
  openChest,
  readSign,
  useFountain,
  checkTransition,
  isChestObject,
  isSignObject,
  isFountainObject,
} from '../systems/InteractableSystem'
import { generateMap, getCollisionTiles } from '../utils/mapGenerator'
import { initAudioSystem, playMusic, crossfadeMusic, playSfx, stopMusic, MUSIC_KEYS, SFX_KEYS } from '../systems/AudioSystem'
import { loadTutorialData, checkAndShowTutorial } from '../systems/TutorialSystem'
import { initDebug } from '../utils/debug'
import { autoSave } from '../systems/SaveSystem'
import {
  loadQuestData,
  trackAreaExploration,
  getQuestsForNpc,
} from '../systems/QuestSystem'
import { loadAchievementData } from '../systems/AchievementSystem'
import type { QuestDefinition, AchievementDefinition } from '../models/types'
import { QuestTrackerHUD } from '../ui/hud/QuestTrackerHUD'
import type { QuestIndicatorType } from '../entities/NPC'

interface WorldSceneData {
  readonly newGame: boolean
  readonly saveSlot?: number
  readonly areaId?: string
  readonly spawnPosition?: { x: number; y: number }
  readonly battleResult?: 'victory' | 'defeat' | 'fled'
  readonly rewards?: { experience: number; gold: number }
  readonly loot?: ReadonlyArray<ItemDrop>
  readonly bossDefeated?: string
  readonly bossRewards?: {
    experience: number
    gold: number
    items: ReadonlyArray<ItemDrop>
    unlocksArea?: string
  }
  readonly savedState?: import('../systems/GameStateManager').GameState
  readonly playTime?: number
}

const ENCOUNTER_STEP_THRESHOLD = 20
const ENCOUNTER_CHANCE = 0.15

export class WorldScene extends Phaser.Scene {
  private player!: Player
  private inputSystem!: InputSystem
  private map!: Phaser.Tilemaps.Tilemap | null
  private collisionLayer!: Phaser.Tilemaps.TilemapLayer | null
  private areaNameText!: Phaser.GameObjects.Text
  private stepCounter: number = 0
  private lastPlayerTileX: number = -1
  private lastPlayerTileY: number = -1
  private inSafeZone: boolean = true
  private npcs: NPC[] = []
  private nearbyNpc: NPC | null = null
  private currentAreaId: string = 'sunlit-village'
  private currentArea: GameAreaDefinition | null = null
  private interactables: Interactable[] = []
  private nearbyInteractable: Interactable | null = null
  private transitionZones: Phaser.GameObjects.Zone[] = []
  private transitionInProgress: boolean = false
  private bossEncounterInProgress: boolean = false
  private proceduralMapGraphics: Phaser.GameObjects.Graphics | null = null
  private decorationSprites: Phaser.GameObjects.Sprite[] = []
  private playTime: number = 0
  private playTimeStart: number = 0
  private currentSaveSlot: number = 0
  private questTrackerHUD: QuestTrackerHUD | null = null

  constructor() {
    super({ key: SCENE_KEYS.WORLD })
  }

  create(data: WorldSceneData): void {
    // Reset transition flags on scene create
    this.transitionInProgress = false
    this.bossEncounterInProgress = false

    this.cameras.main.fadeIn(500, 0, 0, 0)

    // Initialize audio system
    initAudioSystem(this)

    // Track play time
    this.playTime = data.playTime ?? 0
    this.playTimeStart = Date.now()
    this.currentSaveSlot = data.saveSlot ?? 0

    const isNewGame = !hasGameState(this)

    // Initialize game state - either from save or new
    if (data.savedState) {
      setGameState(this, data.savedState)
    } else if (isNewGame) {
      setGameState(this, createInitialGameState('Hero'))
    }

    // Load game data into systems
    this.loadGameData()

    // Give starter content only when explicitly starting a new game
    // (not when loading a save - data.newGame is false when loading)
    if (data.newGame) {
      this.giveStarterContent()
    }

    // Apply boss defeat rewards if returning from boss battle
    if (data.bossDefeated && data.bossRewards) {
      this.applyBossRewards(data.bossDefeated, data.bossRewards)
    }

    // Determine which area to load
    const gameState = getGameState(this)
    this.currentAreaId = data.areaId ?? gameState.currentAreaId ?? 'sunlit-village'

    // Update game state with current area
    if (gameState.currentAreaId !== this.currentAreaId) {
      setGameState(this, updateCurrentArea(gameState, this.currentAreaId))
    }

    // Load the area
    this.loadArea(this.currentAreaId, data.spawnPosition)

    this.setupCamera()
    this.setupInput()
    this.showAreaName(this.currentArea?.name ?? 'Unknown Area')

    // Initialize debug mode for development testing
    initDebug(this, getGameState, setGameState)

    // Create quest tracker HUD
    this.questTrackerHUD = new QuestTrackerHUD(this)
    this.updateQuestTracker()

    // Apply battle rewards if returning from victory
    if (data.battleResult === 'victory' && data.rewards) {
      this.applyBattleRewards(data.rewards)
    }

    // Apply loot from battle
    if (data.loot && data.loot.length > 0) {
      this.applyLoot(data.loot)
    }

    // Play area music
    this.playAreaMusic()

    // Show tutorial on first area transition (when entering a new area that isn't the starting village)
    if (!data.newGame && this.currentAreaId !== 'village') {
      // Use setTimeout to ensure scene is fully ready before showing tutorial
      this.time.delayedCall(100, () => {
        checkAndShowTutorial(this, 'first_area_transition')
      })
    }
  }

  update(): void {
    // Guard against update being called before player/input are initialized
    if (!this.player || !this.inputSystem) {
      return
    }

    const input = this.inputSystem.getState()
    this.player.update(input)

    // Manual transition zone check as fallback
    this.checkTransitionZones()

    if (this.player.getIsMoving()) {
      this.checkForEncounter()
    }

    // Reset nearby states each frame
    const prevNpc = this.nearbyNpc
    const prevInteractable = this.nearbyInteractable
    this.nearbyNpc = null
    this.nearbyInteractable = null

    for (const npc of this.npcs) {
      npc.hidePrompt()
    }
    for (const interactable of this.interactables) {
      interactable.hidePrompt()
    }

    // Check for NPC interaction
    if (input.interact && prevNpc) {
      this.handleNpcInteraction(prevNpc)
    }

    // Check for interactable interaction
    if (input.interact && prevInteractable && !prevNpc) {
      this.handleInteractableInteraction(prevInteractable)
    }

    // Open menu on ESC
    if (input.menu) {
      this.openMenu()
    }
  }

  private loadArea(areaId: string, spawnPosition?: { x: number; y: number }): void {
    this.currentArea = getArea(areaId) ?? null

    if (!this.currentArea) {
      this.createFallbackMap()
      this.createPlayer({ newGame: false }, spawnPosition)
      return
    }

    // Clear previous area content
    this.clearAreaContent()

    // Load map based on area type
    if (this.currentArea.terrainType === 'village') {
      this.createVillageMap()
    } else {
      this.createProceduralMap(this.currentArea)
    }

    // Create player (must be before NPCs for overlap detection)
    this.createPlayer({ newGame: false }, spawnPosition)

    // Create NPCs in village areas (after player for overlap detection)
    if (this.currentArea.terrainType === 'village') {
      this.createNPCs()
    }

    // Create transition zones
    this.createTransitionZones(this.currentArea)

    // Create interactables
    this.createInteractables(this.currentArea)

    // Check for boss encounters
    this.setupBossEncounters(this.currentArea)

    // Track area exploration for quests
    this.trackAreaForQuests(this.currentAreaId)

    // Update NPC quest indicators
    this.updateNpcQuestIndicators()

    // Update quest tracker
    this.updateQuestTracker()
  }

  private trackAreaForQuests(areaId: string): void {
    try {
      const state = getGameState(this)
      const updatedQuests = trackAreaExploration(state.activeQuests, areaId)

      if (updatedQuests !== state.activeQuests) {
        setGameState(this, updateActiveQuests(state, updatedQuests))
        this.updateQuestTracker()
      }
    } catch {
      // No game state yet
    }
  }

  private clearAreaContent(): void {
    // Destroy NPCs
    for (const npc of this.npcs) {
      npc.destroy()
    }
    this.npcs = []

    // Destroy interactables
    for (const interactable of this.interactables) {
      interactable.destroy()
    }
    this.interactables = []

    // Destroy transition zones
    for (const zone of this.transitionZones) {
      zone.destroy()
    }
    this.transitionZones = []

    // Destroy procedural map graphics
    if (this.proceduralMapGraphics) {
      this.proceduralMapGraphics.destroy()
      this.proceduralMapGraphics = null
    }

    // Destroy decoration sprites
    for (const sprite of this.decorationSprites) {
      sprite.destroy()
    }
    this.decorationSprites = []

    // Destroy map
    if (this.map) {
      this.map.destroy()
      this.map = null
    }

    this.collisionLayer = null
  }

  private createVillageMap(): void {
    const mapWidth = 30
    const mapHeight = 30

    // Create solid grass background with color variation
    this.proceduralMapGraphics = this.add.graphics()
    this.renderVillageGround(mapWidth, mapHeight)

    // Add decorative sprites from Mixel tilesets
    this.addVillageDecorations(mapWidth, mapHeight)

    // Add village square decorations (cobblestones, stumps, etc.)
    this.addVillageSquareDecorations()

    // Set world bounds
    this.physics.world.setBounds(0, 0, mapWidth * TILE_SIZE, mapHeight * TILE_SIZE)
  }

  private renderVillageGround(mapWidth: number, mapHeight: number): void {
    if (!this.proceduralMapGraphics) return

    // Base grass colors for variety
    const grassColors = [0x4a7c3f, 0x5a8c4a, 0x4d8043, 0x528847]

    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        // Pick grass color based on position for natural variation
        const colorIndex = (x + y * 3 + Math.floor(x / 3) + Math.floor(y / 2)) % grassColors.length
        const color = grassColors[colorIndex]

        this.proceduralMapGraphics.fillStyle(color, 1)
        this.proceduralMapGraphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE)

        // Add dirt path in center cross pattern
        const isMainPath = (x >= 13 && x <= 16 && (y < 7 || y > 22)) ||
                          (y >= 14 && y <= 16 && (x < 7 || x > 22)) ||
                          (x >= 7 && x <= 22 && y >= 7 && y <= 22)

        if (isMainPath && x >= 8 && x <= 21 && y >= 8 && y <= 21) {
          // Village square area - lighter cobblestone
          this.proceduralMapGraphics.fillStyle(0x9e9e8e, 1)
          this.proceduralMapGraphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
        } else if ((x >= 13 && x <= 16) || (y >= 14 && y <= 16)) {
          // Main paths - dirt brown
          if ((x >= 13 && x <= 16) || (y >= 14 && y <= 16)) {
            const isDirt = (x >= 13 && x <= 16) || (y >= 14 && y <= 16)
            if (isDirt && !(x >= 8 && x <= 21 && y >= 8 && y <= 21)) {
              this.proceduralMapGraphics.fillStyle(0x8b7355, 1)
              this.proceduralMapGraphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
            }
          }
        }
      }
    }

    this.proceduralMapGraphics.setDepth(DEPTH.GROUND)
  }

  private addVillageDecorations(mapWidth: number, mapHeight: number): void {
    // Add grass tufts, flowers, and small bushes using Mixel sprites
    const hasNatureDetails = this.textures.exists('tileset-nature')
    const hasBushes = this.textures.exists('tileset-bushes')

    // Seeded random for consistent decoration placement
    const seed = 12345
    const random = (x: number, y: number) => {
      const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453
      return n - Math.floor(n)
    }

    // Nature details frames: 12x4 grid (48 tiles)
    // Row 0 (0-11): Tall grass tufts
    // Row 1 (12-23): Medium grass
    // Row 2 (24-35): Small grass/clover
    // Row 3 (36-47): Yellow flowers
    const grassFrames = [0, 1, 2, 3, 12, 13, 14, 24, 25, 26]
    const flowerFrames = [36, 37, 38, 39, 40, 41]

    // Bush frames: 12x10 grid (120 tiles)
    // Row 0 (0-11): Large to small bushes
    // Frames 9-11 are smaller bushes
    const smallBushFrames = [9, 10, 11]

    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        // Skip village square and paths
        const isPath = (x >= 8 && x <= 21 && y >= 8 && y <= 21) ||
                      (x >= 13 && x <= 16) ||
                      (y >= 14 && y <= 16)
        if (isPath) continue

        const r = random(x, y)

        // 20% chance for grass tuft decoration
        if (r < 0.20 && hasNatureDetails) {
          const frameIdx = Math.floor(random(x + 1, y) * grassFrames.length)
          const frameIndex = grassFrames[frameIdx]
          const sprite = this.add.sprite(
            x * TILE_SIZE + TILE_SIZE / 2,
            y * TILE_SIZE + TILE_SIZE / 2,
            'tileset-nature',
            frameIndex
          )
          sprite.setDepth(DEPTH.BELOW_PLAYER)
          this.decorationSprites.push(sprite)
        }
        // 8% chance for yellow flowers
        else if (r >= 0.20 && r < 0.28 && hasNatureDetails) {
          const frameIdx = Math.floor(random(x + 2, y) * flowerFrames.length)
          const frameIndex = flowerFrames[frameIdx]
          const sprite = this.add.sprite(
            x * TILE_SIZE + TILE_SIZE / 2,
            y * TILE_SIZE + TILE_SIZE / 2,
            'tileset-nature',
            frameIndex
          )
          sprite.setDepth(DEPTH.BELOW_PLAYER)
          this.decorationSprites.push(sprite)
        }
        // 5% chance for small bush
        else if (r >= 0.28 && r < 0.33 && hasBushes) {
          const frameIdx = Math.floor(random(x + 3, y) * smallBushFrames.length)
          const frameIndex = smallBushFrames[frameIdx]
          const sprite = this.add.sprite(
            x * TILE_SIZE + TILE_SIZE / 2,
            y * TILE_SIZE + TILE_SIZE / 2,
            'tileset-bushes',
            frameIndex
          )
          sprite.setDepth(DEPTH.BELOW_PLAYER)
          this.decorationSprites.push(sprite)
        }
      }
    }
  }

  private addVillageSquareDecorations(): void {
    const hasGround = this.textures.exists('tileset-ground')
    const hasRocks = this.textures.exists('tileset-rocks')
    const hasStumps = this.textures.exists('tileset-stumps')
    const hasRuins = this.textures.exists('tileset-ruins')

    // Seeded random for consistent placement
    const seed = 54321
    const random = (x: number, y: number) => {
      const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453
      return n - Math.floor(n)
    }

    // Ground tileset: 12x12 grid
    // Row 0 (0-11): Cobblestone pebble patterns
    // Row 1 (12-23): More pebbles
    const cobblestoneFrames = [0, 1, 2, 3, 4, 5, 12, 13, 14, 15]

    // Rocks tileset: 12x2 grid (24 tiles)
    // Various sized rocks
    const smallRockFrames = [8, 9, 10, 11, 20, 21, 22, 23] // Smaller rocks

    // Stumps tileset: 12x2 grid (24 tiles)
    // Frame 0: Large stump, Frame 1: Medium stump
    const stumpFrames = [0, 1]

    // Village square bounds (center area)
    const squareMinX = 9
    const squareMaxX = 20
    const squareMinY = 9
    const squareMaxY = 20

    // Add scattered cobblestone pebbles to the plaza
    if (hasGround) {
      for (let y = squareMinY; y <= squareMaxY; y++) {
        for (let x = squareMinX; x <= squareMaxX; x++) {
          // Skip NPC positions (approximate)
          const isNpcArea = (x >= 12 && x <= 14 && y >= 12 && y <= 14) || // Shopkeeper
                           (x >= 14 && x <= 16 && y >= 10 && y <= 12) || // Guide
                           (x >= 16 && x <= 18 && y >= 12 && y <= 14) || // Healer
                           (x >= 18 && x <= 20 && y >= 12 && y <= 14)    // Breeder
          if (isNpcArea) continue

          const r = random(x, y)
          // 25% chance for cobblestone decoration
          if (r < 0.25) {
            const frameIdx = Math.floor(random(x + 1, y) * cobblestoneFrames.length)
            const sprite = this.add.sprite(
              x * TILE_SIZE + TILE_SIZE / 2,
              y * TILE_SIZE + TILE_SIZE / 2,
              'tileset-ground',
              cobblestoneFrames[frameIdx]
            )
            sprite.setDepth(DEPTH.GROUND + 1)
            this.decorationSprites.push(sprite)
          }
        }
      }
    }

    // Add tree stumps as "benches" at corners of the square
    if (hasStumps) {
      const stumpPositions = [
        { x: 9, y: 9 },   // Top-left corner
        { x: 20, y: 9 },  // Top-right corner
        { x: 9, y: 20 },  // Bottom-left corner
        { x: 20, y: 20 }, // Bottom-right corner
      ]

      stumpPositions.forEach((pos, i) => {
        const frameIndex = stumpFrames[i % stumpFrames.length]
        const sprite = this.add.sprite(
          pos.x * TILE_SIZE + TILE_SIZE / 2,
          pos.y * TILE_SIZE + TILE_SIZE / 2,
          'tileset-stumps',
          frameIndex
        )
        sprite.setDepth(DEPTH.BELOW_PLAYER)
        this.decorationSprites.push(sprite)
      })
    }

    // Add some decorative rocks around plaza edges
    if (hasRocks) {
      const rockPositions = [
        { x: 8, y: 11 },
        { x: 21, y: 13 },
        { x: 10, y: 21 },
        { x: 19, y: 8 },
      ]

      rockPositions.forEach((pos, i) => {
        const frameIndex = smallRockFrames[i % smallRockFrames.length]
        const sprite = this.add.sprite(
          pos.x * TILE_SIZE + TILE_SIZE / 2,
          pos.y * TILE_SIZE + TILE_SIZE / 2,
          'tileset-rocks',
          frameIndex
        )
        sprite.setDepth(DEPTH.BELOW_PLAYER)
        this.decorationSprites.push(sprite)
      })
    }

    // Add a central feature - maybe a small well or fountain marker
    // Using a rock formation in the center
    if (hasRocks) {
      const centerSprite = this.add.sprite(
        15 * TILE_SIZE + TILE_SIZE / 2,
        17 * TILE_SIZE + TILE_SIZE / 2,
        'tileset-rocks',
        0 // Large rock
      )
      centerSprite.setDepth(DEPTH.BELOW_PLAYER)
      this.decorationSprites.push(centerSprite)
    }
  }

  private createProceduralMap(area: GameAreaDefinition): void {
    const mapWidth = area.mapWidth
    const mapHeight = area.mapHeight

    // Collect entry/exit/reserved positions
    const entryPoints = area.transitions
      .filter((t) => t.targetAreaId !== this.currentAreaId)
      .map((t) => t.targetPosition)

    const exitPoints = area.transitions.map((t) => ({
      x: t.triggerBounds.x + t.triggerBounds.width / 2,
      y: t.triggerBounds.y + t.triggerBounds.height / 2,
    }))

    const reservedPositions = [
      ...area.interactables.map((i) => i.position),
      ...this.getBossPositions(area),
    ]

    // Generate the map
    const generatedMap = generateMap({
      width: mapWidth,
      height: mapHeight,
      terrainType: area.terrainType,
      entryPoints,
      exitPoints,
      reservedPositions,
    })

    // Render the map using graphics
    this.proceduralMapGraphics = this.add.graphics()
    this.renderProceduralMap(generatedMap, area.terrainType)

    // Create collision bodies for obstacles
    this.createProceduralCollisions(generatedMap, area.terrainType, mapWidth, mapHeight)

    // Set world bounds
    this.physics.world.setBounds(0, 0, mapWidth * TILE_SIZE, mapHeight * TILE_SIZE)
  }

  private getBossPositions(area: GameAreaDefinition): ReadonlyArray<{ x: number; y: number }> {
    return area.bossIds
      .map((id) => getBoss(id))
      .filter((boss): boss is BossDefinition => boss !== undefined)
      .map((boss) => boss.position)
  }

  private renderProceduralMap(
    map: { groundLayer: ReadonlyArray<number>; objectLayer: ReadonlyArray<number>; width: number; height: number },
    terrainType: 'village' | 'forest' | 'cave',
  ): void {
    if (!this.proceduralMapGraphics) return

    const tileColors = this.getTileColors(terrainType)

    // Forest grass color palette - brighter, more vibrant greens like the Mixel sample
    // Using a subtle checkerboard pattern with 2 shades for depth
    const forestGrassLight = 0x7cb342  // Bright lime green
    const forestGrassDark = 0x689f38   // Slightly darker green

    // Render ground layer with color variation
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const index = y * map.width + x
        const tile = map.groundLayer[index]

        let color: number
        if (terrainType === 'forest') {
          // Checkerboard pattern for subtle grass variation (like the sample)
          const isLight = (x + y) % 2 === 0
          color = tile === 7 ? 0x8d6e4c : (isLight ? forestGrassLight : forestGrassDark) // dirt or grass
        } else {
          color = tileColors[tile] ?? 0x333333
        }

        this.proceduralMapGraphics.fillStyle(color, 1)
        this.proceduralMapGraphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
      }
    }

    this.proceduralMapGraphics.setDepth(DEPTH.GROUND)

    // Render object layer with sprites
    this.renderProceduralObjects(map, terrainType)
  }

  private renderProceduralObjects(
    map: { objectLayer: ReadonlyArray<number>; width: number; height: number },
    terrainType: 'village' | 'forest' | 'cave',
  ): void {
    const hasLargeTrees = this.textures.exists('tileset-trees-large')
    const hasRocks = this.textures.exists('tileset-rocks')
    const hasMushrooms = this.textures.exists('tileset-mushrooms')
    const hasNature = this.textures.exists('tileset-nature')
    const hasBushes = this.textures.exists('tileset-bushes')

    // Seeded random for sprite variation
    const random = (x: number, y: number, seed: number) => {
      const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453
      return n - Math.floor(n)
    }

    // Large tree frames from tileset-trees-large (64x96 sprites)
    // Tileset is 384x320, at 64x96 that's 6 columns x 3 rows
    // Row 0 (frames 0-5): Full large trees with canopy and trunk
    const largeTreeFrames = [0, 1, 2, 3, 4, 5]

    // Small bush frames for undergrowth
    const smallBushFrames = [9, 10, 11]

    // Rock frames from tileset-rocks (384x64 = 12x2 grid)
    const rockFrames = [0, 1, 2, 3, 4, 5]

    // Mushroom frames from tileset-mushrooms (384x64 = 12x2 grid)
    const mushroomFrames = [0, 1, 2, 3, 4, 5, 12, 13, 14]

    // Flower frames from tileset-nature (yellow flowers row 3)
    const flowerFrames = [36, 37, 38, 39, 40, 41]

    // Tall grass frames from tileset-nature (row 0-1)
    const tallGrassFrames = [0, 1, 2, 3, 12, 13, 14]

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const index = y * map.width + x
        const tile = map.objectLayer[index]

        if (tile < 0) continue

        const posX = x * TILE_SIZE + TILE_SIZE / 2
        const posY = y * TILE_SIZE + TILE_SIZE / 2
        const r = random(x, y, 12345)

        // Trees (tiles 8, 9) - Use LARGE tree sprites (64x96)
        if ((tile === 8 || tile === 9) && hasLargeTrees) {
          const treeVariant = Math.floor(r * largeTreeFrames.length)

          // Large tree sprite (64x96) - anchor at bottom center
          // The sprite is 64 wide x 96 tall, so we offset to align the trunk base with the tile
          const treeSprite = this.add.sprite(posX, posY, 'tileset-trees-large', largeTreeFrames[treeVariant])
          // Set origin to bottom-center so the trunk base aligns with the collision tile
          treeSprite.setOrigin(0.5, 1)
          // Position at bottom of the tile
          treeSprite.setPosition(posX, posY + TILE_SIZE / 2)
          // Y-sort based on the trunk position (bottom of tree)
          treeSprite.setDepth(DEPTH.BELOW_PLAYER + y + 1)
          this.decorationSprites.push(treeSprite)
        }
        // Rocks (tiles 10, 11)
        else if ((tile === 10 || tile === 11) && hasRocks) {
          const frameIdx = Math.floor(r * rockFrames.length)
          const sprite = this.add.sprite(posX, posY, 'tileset-rocks', rockFrames[frameIdx])
          sprite.setDepth(DEPTH.BELOW_PLAYER)
          this.decorationSprites.push(sprite)
        }
        // Flowers (tiles 24, 25, 26)
        else if ((tile === 24 || tile === 25 || tile === 26) && hasNature) {
          const frameIdx = Math.floor(r * flowerFrames.length)
          const sprite = this.add.sprite(posX, posY, 'tileset-nature', flowerFrames[frameIdx])
          sprite.setDepth(DEPTH.BELOW_PLAYER)
          this.decorationSprites.push(sprite)
        }
        // Bushes (tile 27) - small bushes near trees for undergrowth
        else if (tile === 27 && hasBushes) {
          const frameIdx = Math.floor(r * smallBushFrames.length)
          const sprite = this.add.sprite(posX, posY, 'tileset-bushes', smallBushFrames[frameIdx])
          sprite.setDepth(DEPTH.BELOW_PLAYER + y)
          this.decorationSprites.push(sprite)
        }
        // Tall grass (tile 28)
        else if (tile === 28 && hasNature) {
          const frameIdx = Math.floor(r * tallGrassFrames.length)
          const sprite = this.add.sprite(posX, posY, 'tileset-nature', tallGrassFrames[frameIdx])
          sprite.setDepth(DEPTH.BELOW_PLAYER)
          this.decorationSprites.push(sprite)
        }
        // Mushrooms (tile 29)
        else if (tile === 29 && hasMushrooms) {
          const frameIdx = Math.floor(r * mushroomFrames.length)
          const sprite = this.add.sprite(posX, posY, 'tileset-mushrooms', mushroomFrames[frameIdx])
          sprite.setDepth(DEPTH.BELOW_PLAYER)
          this.decorationSprites.push(sprite)
        }
        // Cave crystals (tile 22) - keep as graphics for glow effect
        else if (tile === 22 && this.proceduralMapGraphics) {
          this.proceduralMapGraphics.fillStyle(0x00bcd4, 0.8)
          this.proceduralMapGraphics.fillTriangle(
            posX,
            y * TILE_SIZE + 4,
            posX + 8,
            y * TILE_SIZE + 28,
            posX - 8,
            y * TILE_SIZE + 28,
          )
        }
      }
    }
  }

  private getTileColors(terrainType: 'village' | 'forest' | 'cave'): Record<number, number> {
    if (terrainType === 'forest') {
      // All ground tiles should be grass colors - decorations are rendered as sprites
      return {
        0: 0x2d5a27, // dark grass
        1: 0x3d6b37, // dark grass 2
        7: 0x5a3d2b, // dirt
        // Fallback grass color for any decoration tiles that might appear in ground layer
        24: 0x2d5a27, // flower -> grass (rendered as sprite from object layer)
        25: 0x2d5a27, // flower 2 -> grass
        26: 0x2d5a27, // flower 3 -> grass
        28: 0x2d5a27, // tall grass -> grass (rendered as sprite)
      }
    } else if (terrainType === 'cave') {
      return {
        7: 0x3d3d3d, // stone floor
        10: 0x5a5a5a, // rock
        11: 0x4a4a4a, // rock 2
        13: 0x1a1a1a, // wall
        14: 0x0d0d0d, // wall 2
        22: 0x00bcd4, // crystal
        29: 0x2d2d2d, // dark stone
        30: 0x6a6a7a, // stalagmite
      }
    }
    return {
      0: 0x4caf50, // grass
    }
  }

  private createProceduralCollisions(
    map: { objectLayer: ReadonlyArray<number>; width: number; height: number },
    terrainType: 'village' | 'forest' | 'cave',
    mapWidth: number,
    mapHeight: number,
  ): void {
    const collisionTiles = getCollisionTiles(terrainType)

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const index = y * map.width + x
        const tile = map.objectLayer[index]

        if (collisionTiles.includes(tile)) {
          const body = this.add.zone(
            x * TILE_SIZE + TILE_SIZE / 2,
            y * TILE_SIZE + TILE_SIZE / 2,
            TILE_SIZE - 4,
            TILE_SIZE - 4,
          )
          this.physics.add.existing(body, true)

          if (this.player?.sprite) {
            this.physics.add.collider(this.player.sprite, body)
          }
        }
      }
    }
  }

  private createTransitionZones(area: GameAreaDefinition): void {
    for (const transition of area.transitions) {
      const { x, y, width, height } = transition.triggerBounds

      // Create zone - position at top-left corner since we'll set body position directly
      const zone = this.add.zone(x, y, width, height)
      zone.setOrigin(0, 0) // Top-left origin to match triggerBounds coordinates

      // Add physics body with correct position
      this.physics.add.existing(zone, true)
      const body = zone.body as Phaser.Physics.Arcade.StaticBody
      // Reset body to exact position with explicit size
      body.reset(x, y)
      body.setSize(width, height, false) // false = don't center the body

      zone.setData('transition', transition)

      // Set up overlap detection with player
      this.physics.add.overlap(
        this.player.sprite,
        zone,
        () => this.handleTransition(transition),
        undefined,
        this,
      )

      this.transitionZones.push(zone)

      // Add visual indicator for transition zones (arrow/glow effect)
      this.addTransitionIndicator(transition)
    }
  }

  private checkTransitionZones(): void {
    if (this.transitionInProgress) return

    const playerPos = this.player.getPosition()

    for (const zone of this.transitionZones) {
      const transition = zone.getData('transition') as TransitionZone
      if (!transition) continue

      const { x, y, width, height } = transition.triggerBounds

      // Check if player center is inside the transition bounds
      if (
        playerPos.x >= x &&
        playerPos.x <= x + width &&
        playerPos.y >= y &&
        playerPos.y <= y + height
      ) {
        this.handleTransition(transition)
        return
      }
    }
  }

  private addTransitionIndicator(transition: TransitionZone): void {
    const { x, y, width, height } = transition.triggerBounds
    const centerX = x + width / 2
    const centerY = y + height / 2

    // Create a subtle glow/arrow indicator
    const indicator = this.add.graphics()
    indicator.setDepth(DEPTH.BELOW_PLAYER + 1)

    // Pulsing glow effect
    indicator.fillStyle(0x66bb6a, 0.3)
    indicator.fillRoundedRect(x, y, width, height, 4)

    // Determine exit direction based on zone position relative to map
    const mapWidth = (this.currentArea?.mapWidth ?? 30) * TILE_SIZE
    const mapHeight = (this.currentArea?.mapHeight ?? 30) * TILE_SIZE
    const zoneBottom = y + height
    const zoneRight = x + width

    // Add arrow pointing in direction of exit
    indicator.fillStyle(0xffffff, 0.6)
    if (y <= TILE_SIZE * 4) {
      // North exit - zone is near top
      indicator.fillTriangle(centerX, y + 4, centerX - 10, y + 18, centerX + 10, y + 18)
    } else if (zoneBottom >= mapHeight - TILE_SIZE * 2) {
      // South exit - zone extends to bottom
      indicator.fillTriangle(centerX, y + height - 4, centerX - 10, y + height - 18, centerX + 10, y + height - 18)
    } else if (x <= TILE_SIZE * 4) {
      // West exit - zone is near left
      indicator.fillTriangle(x + 4, centerY, x + 18, centerY - 10, x + 18, centerY + 10)
    } else if (zoneRight >= mapWidth - TILE_SIZE * 2) {
      // East exit - zone extends to right
      indicator.fillTriangle(x + width - 4, centerY, x + width - 18, centerY - 10, x + width - 18, centerY + 10)
    }

    // Pulse animation
    this.tweens.add({
      targets: indicator,
      alpha: 0.4,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    this.decorationSprites.push(indicator as unknown as Phaser.GameObjects.Sprite)
  }

  private createInteractables(area: GameAreaDefinition): void {
    const gameState = getGameState(this)

    for (const definition of area.interactables) {
      const isUsed = gameState.openedChests.includes(definition.objectId)
      const interactable = new Interactable(this, definition, isUsed)

      this.physics.add.overlap(
        this.player.sprite,
        interactable.getInteractionZone(),
        () => {
          this.nearbyInteractable = interactable
          interactable.showPrompt()
        },
      )

      this.interactables.push(interactable)
    }
  }

  private setupBossEncounters(area: GameAreaDefinition): void {
    const gameState = getGameState(this)
    const undefeatedBosses = getUndefeatedBosses(area.areaId, gameState)

    for (const boss of undefeatedBosses) {
      // Create a zone at the boss position
      const zone = this.add.zone(
        boss.position.x,
        boss.position.y,
        TILE_SIZE * 2,
        TILE_SIZE * 2,
      )

      this.physics.add.existing(zone, true)
      zone.setData('boss', boss)

      // Create a visual indicator for the boss
      const bossIndicator = this.add.graphics()
      bossIndicator.fillStyle(0xff0000, 0.5)
      bossIndicator.fillCircle(boss.position.x, boss.position.y, TILE_SIZE)
      bossIndicator.setDepth(DEPTH.BELOW_PLAYER)

      // Boss encounter trigger
      this.physics.add.overlap(
        this.player.sprite,
        zone,
        () => this.triggerBossEncounter(boss),
        undefined,
        this,
      )
    }
  }

  private handleTransition(transition: TransitionZone): void {
    // Prevent multiple transitions (overlap callback fires every frame)
    if (this.transitionInProgress) {
      return
    }

    const gameState = getGameState(this)
    const result = checkTransition(transition, gameState)

    if (!result.allowed) {
      this.showWarningMessage(result.reason ?? 'Cannot enter this area.')
      return
    }

    this.transitionInProgress = true

    // Note: Tutorial for first area transition is shown in the new scene's create()
    // Don't show tutorials during transition as the scene is about to be destroyed

    // Auto-save on area transition
    autoSave(this, this.currentSaveSlot, this.getCurrentPlayTime())

    // Fade out and transition to new area
    this.inputSystem.setEnabled(false)
    this.player.update({
      up: false,
      down: false,
      left: false,
      right: false,
      interact: false,
      menu: false,
      cancel: false,
    })

    this.cameras.main.fadeOut(300)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENE_KEYS.WORLD, {
        newGame: false,
        areaId: transition.targetAreaId,
        spawnPosition: transition.targetPosition,
        playTime: this.getCurrentPlayTime(),
        saveSlot: this.currentSaveSlot,
      })
    })
  }

  private handleInteractableInteraction(interactable: Interactable): void {
    const definition = interactable.getDefinition()

    if (isChestObject(definition)) {
      this.handleChestInteraction(definition as ChestObject, interactable)
    } else if (isSignObject(definition)) {
      this.handleSignInteraction(definition as SignObject)
    } else if (isFountainObject(definition)) {
      this.handleFountainInteraction(definition as FountainObject)
    }
  }

  private handleChestInteraction(chest: ChestObject, interactable: Interactable): void {
    const gameState = getGameState(this)
    const result = openChest(chest, gameState)

    if (result.alreadyOpened) {
      this.showMessage('This chest is empty.')
      return
    }

    playSfx(SFX_KEYS.CHEST_OPEN)
    setGameState(this, result.newState)
    interactable.markAsUsed()

    // Build message
    const itemMessages = result.itemsGained.map(
      (item) => `${item.itemId} x${item.quantity}`,
    )
    const goldMessage = result.goldGained > 0 ? `${result.goldGained} gold` : ''
    const parts = [...itemMessages, goldMessage].filter((m) => m.length > 0)

    this.showMessage(`Found: ${parts.join(', ')}!`)
  }

  private handleSignInteraction(sign: SignObject): void {
    const messages = readSign(sign)

    this.inputSystem.setEnabled(false)
    this.player.update({
      up: false,
      down: false,
      left: false,
      right: false,
      interact: false,
      menu: false,
      cancel: false,
    })

    this.scene.launch(SCENE_KEYS.DIALOG, {
      dialogTreeId: null,
      messages,
      npcName: 'Sign',
      npcType: 'info',
    })

    this.scene.pause()

    this.events.once('resume', () => {
      this.inputSystem.setEnabled(true)
    })
  }

  private handleFountainInteraction(fountain: FountainObject): void {
    const gameState = getGameState(this)
    const result = useFountain(fountain, gameState)

    if (result.healed) {
      playSfx(SFX_KEYS.HEAL)
      setGameState(this, result.newState)
      this.showMessage(`Healed ${result.healAmount} HP!`)
    } else {
      this.showMessage('You are already at full health.')
    }
  }

  private triggerBossEncounter(boss: BossDefinition): void {
    // Prevent multiple triggers (overlap callback fires every frame)
    if (this.bossEncounterInProgress) {
      return
    }

    const gameState = getGameState(this)

    // Check if already defeated
    if (gameState.defeatedBosses.includes(boss.bossId)) {
      return
    }

    this.bossEncounterInProgress = true
    this.inputSystem.setEnabled(false)
    this.player.update({
      up: false,
      down: false,
      left: false,
      right: false,
      interact: false,
      menu: false,
      cancel: false,
    })

    // Create boss encounter
    const encounter = createBossEncounter(boss.bossId)
    if (!encounter) {
      this.bossEncounterInProgress = false
      this.inputSystem.setEnabled(true)
      return
    }

    // Show intro dialog first
    this.scene.launch(SCENE_KEYS.DIALOG, {
      dialogTreeId: null,
      messages: boss.introDialog,
      npcName: boss.name,
      npcType: 'quest',
    })

    this.scene.pause()

    this.events.once('resume', () => {
      // Flash effect
      this.cameras.main.flash(300, 255, 255, 255)

      this.time.delayedCall(400, () => {
        const playerAbilities = this.getPlayerAbilities()
        const playerCombatant = createCombatantFromPlayer(
          gameState.player.name,
          gameState.player.stats,
          playerAbilities,
        )

        const squadCombatants = createSquadCombatants(gameState.squad)

        // Discover boss species
        const newDiscovered = discoverMultipleSpecies(
          gameState.discoveredSpecies,
          [encounter.speciesId],
        )
        if (newDiscovered !== gameState.discoveredSpecies) {
          setGameState(this, updateDiscoveredSpecies(gameState, newDiscovered))
        }

        this.cameras.main.fadeOut(300)
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start(SCENE_KEYS.BATTLE, {
            playerCombatants: [playerCombatant, ...squadCombatants],
            enemyCombatants: [encounter.combatant],
            enemySpeciesIds: [encounter.speciesId],
            isBossBattle: true,
            bossData: boss,
            playerPosition: this.player.getPosition(),
            areaId: this.currentAreaId,
          })
        })
      })
    })
  }

  private applyBossRewards(
    bossId: string,
    rewards: {
      experience: number
      gold: number
      items: ReadonlyArray<ItemDrop>
      unlocksArea?: string
    },
  ): void {
    const state = getGameState(this)

    // Apply XP and gold
    const updatedPlayer = updatePlayerGold(
      addExperience(state.player, rewards.experience),
      rewards.gold,
    )
    let newState = updatePlayer(state, updatedPlayer)

    // Add items
    let inventory = newState.inventory
    for (const drop of rewards.items) {
      const result = addItem(inventory, drop.itemId, drop.quantity)
      if (result) {
        inventory = result
      }
    }
    newState = updateInventory(newState, inventory)

    setGameState(this, newState)

    // Show reward notification
    const text = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT - 60,
      `Boss defeated! +${rewards.experience} XP  +${rewards.gold} Gold`,
      {
        ...TEXT_STYLES.BODY,
        fontSize: '18px',
        color: '#ff9800',
        stroke: '#000000',
        strokeThickness: 3,
      },
    )
    text.setOrigin(0.5)
    text.setScrollFactor(0)
    text.setDepth(DEPTH.UI)

    this.tweens.add({
      targets: text,
      alpha: 0,
      y: GAME_HEIGHT - 90,
      duration: 3000,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    })
  }

  private showWarningMessage(message: string): void {
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, message, {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      color: '#ef5350',
      stroke: '#000000',
      strokeThickness: 3,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      padding: { x: 16, y: 8 },
    })
    text.setOrigin(0.5)
    text.setScrollFactor(0)
    text.setDepth(DEPTH.UI)

    this.tweens.add({
      targets: text,
      alpha: 0,
      duration: 2500,
      delay: 1500,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    })
  }

  private showMessage(message: string): void {
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 60, message, {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      color: '#ffd54f',
      stroke: '#000000',
      strokeThickness: 3,
    })
    text.setOrigin(0.5)
    text.setScrollFactor(0)
    text.setDepth(DEPTH.UI)

    this.tweens.add({
      targets: text,
      alpha: 0,
      y: GAME_HEIGHT - 90,
      duration: 2500,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    })
  }

  private loadGameData(): void {
    const monstersData = this.cache.json.get('monsters-data') as MonsterSpecies[] | undefined
    const abilitiesData = this.cache.json.get('abilities-data') as Ability[] | undefined

    if (monstersData) loadSpeciesData(monstersData)
    if (abilitiesData) loadAbilityData(abilitiesData)

    const itemsData = this.cache.json.get('items-data')
    if (itemsData) loadItemData(itemsData)

    const equipmentData = this.cache.json.get('equipment-data')
    if (equipmentData) loadEquipmentData(equipmentData)

    const dialogsData = this.cache.json.get('dialogs-data')
    if (dialogsData) loadDialogData(dialogsData)

    const traitsData = this.cache.json.get('traits-data') as TraitDefinition[] | undefined
    if (traitsData) loadTraitData(traitsData)

    const breedingRecipesData = this.cache.json.get('breeding-recipes-data') as
      | BreedingRecipe[]
      | undefined
    if (breedingRecipesData) loadBreedingRecipes(breedingRecipesData)

    // Load area and boss data
    const areasData = this.cache.json.get('areas-data') as GameAreaDefinition[] | undefined
    if (areasData) loadAreaData(areasData)

    const bossesData = this.cache.json.get('bosses-data') as BossDefinition[] | undefined
    if (bossesData) loadBossData(bossesData)

    // Load tutorial data
    const tutorialsData = this.cache.json.get('tutorials-data') as TutorialStep[] | undefined
    if (tutorialsData) loadTutorialData(tutorialsData)

    // Load quest data
    const questsData = this.cache.json.get('quests-data') as QuestDefinition[] | undefined
    if (questsData) loadQuestData(questsData)

    // Load achievement data
    const achievementsData = this.cache.json.get('achievements-data') as AchievementDefinition[] | undefined
    if (achievementsData) loadAchievementData(achievementsData)
  }

  private updateQuestTracker(): void {
    if (!this.questTrackerHUD) return
    try {
      const state = getGameState(this)
      this.questTrackerHUD.update(state.activeQuests)
    } catch {
      // No game state yet
    }
  }

  private updateNpcQuestIndicators(): void {
    try {
      const state = getGameState(this)

      for (const npc of this.npcs) {
        const npcId = npc.getNpcId()
        const questStatus = getQuestsForNpc(
          npcId,
          state.completedQuestIds,
          state.activeQuests,
          state.player.level,
        )

        let indicatorType: QuestIndicatorType = 'none'

        if (questStatus.readyToTurnIn.length > 0) {
          indicatorType = 'ready'
        } else if (questStatus.available.length > 0) {
          indicatorType = 'available'
        } else if (questStatus.inProgress.length > 0) {
          indicatorType = 'in_progress'
        }

        npc.setQuestIndicator(indicatorType)
      }
    } catch {
      // No game state yet
    }
  }

  private playAreaMusic(): void {
    const areaConfig = this.cache.json.get('audio-config')
    const areaMusic = areaConfig?.areaMusic?.[this.currentAreaId] as string | undefined

    if (areaMusic) {
      crossfadeMusic(areaMusic, 1000)
    } else {
      // Default to village music
      crossfadeMusic(MUSIC_KEYS.VILLAGE_PEACEFUL, 1000)
    }
  }

  private getCurrentPlayTime(): number {
    const sessionTime = Math.floor((Date.now() - this.playTimeStart) / 1000)
    return this.playTime + sessionTime
  }

  private giveStarterContent(): void {
    const gameState = getGameState(this)

    // Give starter monster: Level 3 Mossbun named "Clover"
    const starterMonster = createMonsterInstance('mossbun', 3, { nickname: 'Clover' })
    if (starterMonster) {
      const monsterInSquad = { ...starterMonster, isInSquad: true }
      let newState = updateSquad(gameState, [monsterInSquad])

      // Discover mossbun in bestiary
      newState = updateDiscoveredSpecies(newState, ['mossbun'])

      // Give starter items: 5 small potions and 5 capture capsules
      let inventory = newState.inventory
      const withPotions = addItem(inventory, 'potion-small', 5)
      if (withPotions) inventory = withPotions
      const withCapsules = addItem(inventory, 'capture-capsule', 5)
      if (withCapsules) inventory = withCapsules
      newState = updateInventory(newState, inventory)

      setGameState(this, newState)
    }
  }

  private checkForEncounter(): void {
    const pos = this.player.getPosition()
    const tileX = Math.floor(pos.x / TILE_SIZE)
    const tileY = Math.floor(pos.y / TILE_SIZE)

    // Only count when moving to a new tile
    if (tileX === this.lastPlayerTileX && tileY === this.lastPlayerTileY) return
    this.lastPlayerTileX = tileX
    this.lastPlayerTileY = tileY

    // Check if in safe zone based on current area
    const hasEncounters = (this.currentArea?.encounters.length ?? 0) > 0
    this.inSafeZone = this.currentArea?.isSafeZone ?? true

    // For village, center area is safe but grass edges can have encounters
    if (this.currentAreaId === 'sunlit-village') {
      const isNearCenter = tileX > 8 && tileX < 22 && tileY > 8 && tileY < 22
      this.inSafeZone = isNearCenter
    }

    // No encounters if: in safe zone OR area has no encounters defined
    if (this.inSafeZone || !hasEncounters) {
      this.stepCounter = 0
      return
    }

    this.stepCounter++

    if (this.stepCounter >= ENCOUNTER_STEP_THRESHOLD && randomChance(ENCOUNTER_CHANCE)) {
      this.stepCounter = 0
      this.triggerRandomEncounter()
    }
  }

  private triggerRandomEncounter(): void {
    this.inputSystem.setEnabled(false)
    this.player.update({
      up: false,
      down: false,
      left: false,
      right: false,
      interact: false,
      menu: false,
      cancel: false,
    })

    // Flash effect
    this.cameras.main.flash(300, 255, 255, 255)

    this.time.delayedCall(400, () => {
      const encounter = generateAreaEncounter(this.currentAreaId)
      if (!encounter) {
        this.inputSystem.setEnabled(true)
        return
      }

      // Create player combatant
      const gameState = getGameState(this)
      const playerAbilities = this.getPlayerAbilities()
      const playerCombatant = createCombatantFromPlayer(
        gameState.player.name,
        gameState.player.stats,
        playerAbilities,
      )

      // Create squad combatants
      const squadCombatants = createSquadCombatants(gameState.squad)

      // Discover encountered species (add to bestiary on encounter)
      const newDiscovered = discoverMultipleSpecies(
        gameState.discoveredSpecies,
        encounter.speciesIds,
      )
      if (newDiscovered !== gameState.discoveredSpecies) {
        setGameState(this, updateDiscoveredSpecies(gameState, newDiscovered))
      }

      this.cameras.main.fadeOut(300)
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start(SCENE_KEYS.BATTLE, {
          playerCombatants: [playerCombatant, ...squadCombatants],
          enemyCombatants: encounter.combatants,
          enemySpeciesIds: encounter.speciesIds,
          playerPosition: this.player.getPosition(),
          areaId: this.currentAreaId,
        })
      })
    })
  }

  private getPlayerAbilities(): ReadonlyArray<Ability> {
    // Player has basic attack abilities
    const abilitiesData = this.cache.json.get('abilities-data') as Ability[] | undefined
    if (!abilitiesData) return []

    const playerAbilityIds = ['tackle', 'heal', 'power-strike']
    return playerAbilityIds
      .map((id) => abilitiesData.find((a) => a.abilityId === id))
      .filter((a): a is Ability => a !== undefined)
  }

  private applyBattleRewards(rewards: { experience: number; gold: number }): void {
    // Update game state with rewards
    const state = getGameState(this)
    const updatedPlayer = updatePlayerGold(
      addExperience(state.player, rewards.experience),
      rewards.gold,
    )
    setGameState(this, updatePlayer(state, updatedPlayer))

    // Show reward notification
    const text = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT - 40,
      `+${rewards.experience} XP  +${rewards.gold} Gold`,
      {
        ...TEXT_STYLES.BODY,
        fontSize: '16px',
        color: '#ffd54f',
        stroke: '#000000',
        strokeThickness: 3,
      },
    )
    text.setOrigin(0.5)
    text.setScrollFactor(0)
    text.setDepth(DEPTH.UI)

    this.tweens.add({
      targets: text,
      alpha: 0,
      y: GAME_HEIGHT - 70,
      duration: 2500,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    })
  }

  private applyLoot(loot: ReadonlyArray<ItemDrop>): void {
    const state = getGameState(this)
    let inventory = state.inventory

    for (const drop of loot) {
      const result = addItem(inventory, drop.itemId, drop.quantity)
      if (result) {
        inventory = result
      }
    }

    setGameState(this, updateInventory(state, inventory))
  }

  private createNPCs(): void {
    // Village shopkeeper
    const shopkeeper = new NPC(this, 13 * TILE_SIZE, 13 * TILE_SIZE, {
      npcId: 'shopkeeper',
      name: 'Shopkeeper',
      spriteKey: 'npc-shop',
      position: { x: 13 * TILE_SIZE, y: 13 * TILE_SIZE },
      dialogTreeId: 'shopkeeper-greeting',
      type: 'shop',
    })

    // Village healer
    const healer = new NPC(this, 17 * TILE_SIZE, 13 * TILE_SIZE, {
      npcId: 'healer',
      name: 'Healer',
      spriteKey: 'npc-healer',
      position: { x: 17 * TILE_SIZE, y: 13 * TILE_SIZE },
      dialogTreeId: 'healer-greeting',
      type: 'healer',
    })

    // Info NPC
    const guide = new NPC(this, 15 * TILE_SIZE, 11 * TILE_SIZE, {
      npcId: 'guide',
      name: 'Village Guide',
      spriteKey: 'npc-info',
      position: { x: 15 * TILE_SIZE, y: 11 * TILE_SIZE },
      dialogTreeId: 'guide-tips',
      type: 'info',
    })

    // Monster Breeder
    const breeder = new NPC(this, 19 * TILE_SIZE, 13 * TILE_SIZE, {
      npcId: 'breeder',
      name: 'Monster Breeder',
      spriteKey: 'npc-breeder',
      position: { x: 19 * TILE_SIZE, y: 13 * TILE_SIZE },
      dialogTreeId: 'breeder-greeting',
      type: 'breeder',
    })

    this.npcs = [shopkeeper, healer, guide, breeder]

    // Set up overlap detection with player
    for (const npc of this.npcs) {
      this.physics.add.overlap(
        this.player.sprite,
        npc.getInteractionZone(),
        () => {
          this.nearbyNpc = npc
          npc.showPrompt()
        },
      )
    }

    // Update quest indicators after creating NPCs
    this.updateNpcQuestIndicators()
  }

  private handleNpcInteraction(npc: NPC): void {
    this.inputSystem.setEnabled(false)
    this.player.update({
      up: false,
      down: false,
      left: false,
      right: false,
      interact: false,
      menu: false,
      cancel: false,
    })

    this.scene.launch(SCENE_KEYS.DIALOG, {
      dialogTreeId: npc.getDialogTreeId(),
      npcName: npc.getNpcName(),
      npcType: npc.getNpcType(),
      npcId: npc.getNpcId(),
    })

    this.scene.pause()

    this.events.once('resume', () => {
      this.inputSystem.setEnabled(true)
      this.nearbyNpc = null

      // Update quest-related state after dialog
      this.updateQuestTracker()
      this.updateNpcQuestIndicators()
    })
  }

  private openMenu(): void {
    playSfx(SFX_KEYS.MENU_SELECT)
    checkAndShowTutorial(this, 'first_menu')

    this.inputSystem.setEnabled(false)
    this.player.update({
      up: false,
      down: false,
      left: false,
      right: false,
      interact: false,
      menu: false,
      cancel: false,
    })

    this.scene.launch(SCENE_KEYS.MENU, { playTime: this.getCurrentPlayTime() })
    this.scene.pause()

    this.events.once('resume', () => {
      this.inputSystem.setEnabled(true)
    })
  }

  private createFallbackMap(): void {
    const mapWidth = 30 * TILE_SIZE
    const mapHeight = 30 * TILE_SIZE
    const graphics = this.add.graphics()
    graphics.fillStyle(0x4caf50, 1)
    graphics.fillRect(0, 0, mapWidth, mapHeight)
    graphics.setDepth(DEPTH.GROUND)

    this.physics.world.setBounds(0, 0, mapWidth, mapHeight)
  }

  private createPlayer(
    _data: WorldSceneData,
    spawnPosition?: { x: number; y: number },
  ): void {
    const spawnX = spawnPosition?.x ?? 15 * TILE_SIZE
    const spawnY = spawnPosition?.y ?? 15 * TILE_SIZE

    this.player = new Player(this, spawnX, spawnY)

    if (this.collisionLayer) {
      this.physics.add.collider(this.player.sprite, this.collisionLayer)
    }

    if (this.map) {
      const mapWidth = this.map.widthInPixels
      const mapHeight = this.map.heightInPixels
      this.physics.world.setBounds(0, 0, mapWidth, mapHeight)
    }
    this.player.sprite.setCollideWorldBounds(true)
  }

  private setupCamera(): void {
    if (this.map) {
      const mapWidth = this.map.widthInPixels
      const mapHeight = this.map.heightInPixels
      this.cameras.main.setBounds(0, 0, mapWidth, mapHeight)
    } else if (this.currentArea) {
      const mapWidth = this.currentArea.mapWidth * TILE_SIZE
      const mapHeight = this.currentArea.mapHeight * TILE_SIZE
      this.cameras.main.setBounds(0, 0, mapWidth, mapHeight)
    }
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1)
    // Zoom 1.5 for 32x32 tiles (was 2 for 16x16 scaled to 32)
    this.cameras.main.setZoom(1.5)
  }

  private setupInput(): void {
    this.inputSystem = new InputSystem(this)
  }

  private showAreaName(name: string): void {
    this.areaNameText = this.add.text(GAME_WIDTH / 2, 50, name, {
      ...TEXT_STYLES.HEADING,
      fontSize: '28px',
      color: '#ffd54f',
      stroke: '#000000',
      strokeThickness: 4,
    })
    this.areaNameText.setOrigin(0.5)
    this.areaNameText.setScrollFactor(0)
    this.areaNameText.setDepth(DEPTH.UI)
    this.areaNameText.setAlpha(0)

    this.tweens.add({
      targets: this.areaNameText,
      alpha: 1,
      duration: 500,
      hold: 2000,
      yoyo: true,
      ease: 'Power2',
    })
  }
}
