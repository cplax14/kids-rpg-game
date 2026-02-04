import Phaser from 'phaser'
import { SCENE_KEYS, TILE_SIZE, DEPTH, GAME_WIDTH, GAME_HEIGHT, TEXT_STYLES } from '../config'
import { Player } from '../entities/Player'
import { InputSystem } from '../systems/InputSystem'
import type { MonsterSpecies, Ability, BattleCombatant, ItemDrop } from '../models/types'
import {
  loadSpeciesData,
  loadAbilityData,
  getSpecies,
  calculateMonsterStats,
  getLearnedAbilitiesAtLevel,
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
  type GameState,
} from '../systems/GameStateManager'
import { addItem, loadItemData } from '../systems/InventorySystem'
import { loadEquipmentData } from '../systems/EquipmentSystem'
import { loadDialogData } from '../systems/DialogSystem'
import { NPC } from '../entities/NPC'

interface WorldSceneData {
  readonly newGame: boolean
  readonly saveSlot?: number
  readonly battleResult?: 'victory' | 'defeat' | 'fled'
  readonly rewards?: { experience: number; gold: number }
  readonly loot?: ReadonlyArray<ItemDrop>
}

// Encounter data for the area around the village
const VILLAGE_ENCOUNTERS = [
  { speciesId: 'flamepup', weight: 15, minLevel: 1, maxLevel: 4 },
  { speciesId: 'bubblefin', weight: 15, minLevel: 1, maxLevel: 4 },
  { speciesId: 'pebblit', weight: 15, minLevel: 1, maxLevel: 4 },
  { speciesId: 'breezling', weight: 15, minLevel: 1, maxLevel: 3 },
  { speciesId: 'mossbun', weight: 20, minLevel: 1, maxLevel: 3 },
  { speciesId: 'shadowpup', weight: 10, minLevel: 2, maxLevel: 5 },
  { speciesId: 'glowmoth', weight: 10, minLevel: 1, maxLevel: 4 },
]

const ENCOUNTER_STEP_THRESHOLD = 20
const ENCOUNTER_CHANCE = 0.15

export class WorldScene extends Phaser.Scene {
  private player!: Player
  private inputSystem!: InputSystem
  private map!: Phaser.Tilemaps.Tilemap
  private collisionLayer!: Phaser.Tilemaps.TilemapLayer
  private areaNameText!: Phaser.GameObjects.Text
  private stepCounter: number = 0
  private lastPlayerTileX: number = -1
  private lastPlayerTileY: number = -1
  private inSafeZone: boolean = true
  private npcs: NPC[] = []
  private nearbyNpc: NPC | null = null

  constructor() {
    super({ key: SCENE_KEYS.WORLD })
  }

  create(data: WorldSceneData): void {
    this.cameras.main.fadeIn(500, 0, 0, 0)

    // Initialize game state on new game
    if (!hasGameState(this)) {
      setGameState(this, createInitialGameState('Hero'))
    }

    // Load game data into systems
    this.loadGameData()

    this.createMap()
    this.createPlayer(data)
    this.createNPCs()
    this.setupCamera()
    this.setupInput()
    this.showAreaName('Sunlit Village')

    // Apply battle rewards if returning from victory
    if (data.battleResult === 'victory' && data.rewards) {
      this.applyBattleRewards(data.rewards)
    }

    // Apply loot from battle
    if (data.loot && data.loot.length > 0) {
      this.applyLoot(data.loot)
    }
  }

  update(): void {
    const input = this.inputSystem.getState()
    this.player.update(input)

    if (this.player.getIsMoving()) {
      this.checkForEncounter()
    }

    // Reset nearby NPC each frame - overlap callback will re-set if still in range
    const prevNpc = this.nearbyNpc
    this.nearbyNpc = null
    for (const npc of this.npcs) {
      npc.hidePrompt()
    }

    // Check for NPC interaction
    if (input.interact && prevNpc) {
      this.handleNpcInteraction(prevNpc)
    }

    // Open menu on ESC
    if (input.menu) {
      this.openMenu()
    }
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
  }

  private checkForEncounter(): void {
    const pos = this.player.getPosition()
    const tileX = Math.floor(pos.x / TILE_SIZE)
    const tileY = Math.floor(pos.y / TILE_SIZE)

    // Only count when moving to a new tile
    if (tileX === this.lastPlayerTileX && tileY === this.lastPlayerTileY) return
    this.lastPlayerTileX = tileX
    this.lastPlayerTileY = tileY

    // Check if in safe zone (on path tiles near village center)
    const isNearCenter = tileX > 8 && tileX < 22 && tileY > 8 && tileY < 22
    this.inSafeZone = isNearCenter

    if (this.inSafeZone) {
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
    this.player.update({ up: false, down: false, left: false, right: false, interact: false, menu: false, cancel: false })

    // Flash effect
    this.cameras.main.flash(300, 255, 255, 255)

    this.time.delayedCall(400, () => {
      const encounter = this.generateEncounter()
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

      this.cameras.main.fadeOut(300)
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start(SCENE_KEYS.BATTLE, {
          playerCombatants: [playerCombatant],
          enemyCombatants: encounter.combatants,
          enemySpeciesIds: encounter.speciesIds,
        })
      })
    })
  }

  private generateEncounter(): { readonly combatants: ReadonlyArray<BattleCombatant>; readonly speciesIds: ReadonlyArray<string> } | null {
    // Pick 1-2 enemies
    const enemyCount = randomChance(0.3) ? 2 : 1
    const enemies: BattleCombatant[] = []
    const speciesIds: string[] = []

    for (let i = 0; i < enemyCount; i++) {
      const items = VILLAGE_ENCOUNTERS.map((e) => e)
      const weights = VILLAGE_ENCOUNTERS.map((e) => e.weight)
      const picked = weightedRandom(items, weights)

      const species = getSpecies(picked.speciesId)
      if (!species) continue

      const level = randomInt(picked.minLevel, picked.maxLevel)
      const stats = calculateMonsterStats(species, level)
      const abilities = getLearnedAbilitiesAtLevel(species, level)

      enemies.push(
        createCombatantFromEnemy(
          `${species.name} Lv.${level}`,
          stats,
          species.element,
          abilities,
        ),
      )
      speciesIds.push(picked.speciesId)
    }

    return enemies.length > 0 ? { combatants: enemies, speciesIds } : null
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
    const gameState = getGameState(this)

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

    this.npcs = [shopkeeper, healer, guide]

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
  }

  private handleNpcInteraction(npc: NPC): void {
    this.inputSystem.setEnabled(false)
    this.player.update({ up: false, down: false, left: false, right: false, interact: false, menu: false, cancel: false })

    this.scene.launch(SCENE_KEYS.DIALOG, {
      dialogTreeId: npc.getDialogTreeId(),
      npcName: npc.getNpcName(),
      npcType: npc.getNpcType(),
    })

    this.scene.pause()

    this.events.once('resume', () => {
      this.inputSystem.setEnabled(true)
      this.nearbyNpc = null
    })
  }

  private openMenu(): void {
    this.inputSystem.setEnabled(false)
    this.player.update({ up: false, down: false, left: false, right: false, interact: false, menu: false, cancel: false })

    this.scene.launch(SCENE_KEYS.MENU)
    this.scene.pause()

    this.events.once('resume', () => {
      this.inputSystem.setEnabled(true)
    })
  }

  private createMap(): void {
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
      objectsLayer.setCollisionByExclusion([-1, 0, 19])
      this.collisionLayer = objectsLayer
    }
  }

  private createFallbackMap(): void {
    const mapWidth = 30 * TILE_SIZE
    const mapHeight = 30 * TILE_SIZE
    const graphics = this.add.graphics()
    graphics.fillStyle(0x4caf50, 1)
    graphics.fillRect(0, 0, mapWidth, mapHeight)
    graphics.setDepth(DEPTH.GROUND)
  }

  private createPlayer(_data: WorldSceneData): void {
    const spawnX = 15 * TILE_SIZE
    const spawnY = 15 * TILE_SIZE

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
