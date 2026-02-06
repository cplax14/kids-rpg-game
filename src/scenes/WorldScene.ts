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
import type { QuestDefinition } from '../models/types'
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
  private playTime: number = 0
  private playTimeStart: number = 0
  private currentSaveSlot: number = 0
  private questTrackerHUD: QuestTrackerHUD | null = null

  constructor() {
    super({ key: SCENE_KEYS.WORLD })
  }

  create(data: WorldSceneData): void {
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

    // Destroy map
    if (this.map) {
      this.map.destroy()
      this.map = null
    }

    this.collisionLayer = null
  }

  private createVillageMap(): void {
    this.map = this.make.tilemap({ key: 'village-map' })

    const tileset = this.map.addTilesetImage('village-tileset', 'village-tileset')

    if (!tileset) {
      this.createFallbackMap()
      return
    }

    const groundLayer = this.map.createLayer('Ground', tileset, 0, 0)
    if (groundLayer) {
      groundLayer.setDepth(DEPTH.GROUND)
    }

    const objectsLayer = this.map.createLayer('Objects', tileset, 0, 0)
    if (objectsLayer) {
      objectsLayer.setDepth(DEPTH.BELOW_PLAYER)
      objectsLayer.setCollisionByExclusion([-1, 18])
      this.collisionLayer = objectsLayer
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

    // Render ground layer
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const index = y * map.width + x
        const tile = map.groundLayer[index]
        const color = tileColors[tile] ?? 0x333333

        this.proceduralMapGraphics.fillStyle(color, 1)
        this.proceduralMapGraphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
      }
    }

    // Render object layer
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const index = y * map.width + x
        const tile = map.objectLayer[index]

        if (tile >= 0) {
          const color = tileColors[tile] ?? 0x666666
          this.proceduralMapGraphics.fillStyle(color, 1)

          // Draw different shapes for different objects
          if (tile === 8 || tile === 9) {
            // Trees - draw trunk and foliage
            this.proceduralMapGraphics.fillStyle(0x3d2a1a, 1)
            this.proceduralMapGraphics.fillRect(
              x * TILE_SIZE + 12,
              y * TILE_SIZE + 16,
              8,
              16,
            )
            this.proceduralMapGraphics.fillStyle(color, 1)
            this.proceduralMapGraphics.fillCircle(
              x * TILE_SIZE + 16,
              y * TILE_SIZE + 12,
              12,
            )
          } else if (tile === 22) {
            // Crystal - draw with glow
            this.proceduralMapGraphics.fillStyle(0x00bcd4, 0.8)
            this.proceduralMapGraphics.fillTriangle(
              x * TILE_SIZE + 16,
              y * TILE_SIZE + 4,
              x * TILE_SIZE + 24,
              y * TILE_SIZE + 28,
              x * TILE_SIZE + 8,
              y * TILE_SIZE + 28,
            )
          } else {
            // Other obstacles
            this.proceduralMapGraphics.fillRect(
              x * TILE_SIZE + 4,
              y * TILE_SIZE + 4,
              TILE_SIZE - 8,
              TILE_SIZE - 8,
            )
          }
        }
      }
    }

    this.proceduralMapGraphics.setDepth(DEPTH.GROUND)
  }

  private getTileColors(terrainType: 'village' | 'forest' | 'cave'): Record<number, number> {
    if (terrainType === 'forest') {
      return {
        0: 0x2d5a27, // dark grass
        1: 0x3d6b37, // dark grass 2
        7: 0x5a3d2b, // dirt
        8: 0x1a3d14, // tree
        9: 0x0d2b0d, // tree 2
        10: 0x5a5a5a, // rock
        11: 0x4a4a4a, // rock 2
        24: 0xe91e63, // flower
        25: 0xff9800, // flower 2
        26: 0x9c27b0, // flower 3
        27: 0x3d6b37, // bush
        28: 0x4a7a44, // tall grass
        29: 0x8b6914, // mushroom
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
      const zone = this.add.zone(
        transition.triggerBounds.x + transition.triggerBounds.width / 2,
        transition.triggerBounds.y + transition.triggerBounds.height / 2,
        transition.triggerBounds.width,
        transition.triggerBounds.height,
      )

      this.physics.add.existing(zone, true)
      zone.setData('transition', transition)

      this.physics.add.overlap(
        this.player.sprite,
        zone,
        () => this.handleTransition(transition),
        undefined,
        this,
      )

      this.transitionZones.push(zone)
    }
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
      // Show warning message
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
    this.cameras.main.setZoom(2)
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
