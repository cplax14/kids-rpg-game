import Phaser from 'phaser'
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, COLORS, DEPTH, TEXT_STYLES } from '../config'
import { getMonsterFrame, getMonsterIconKey } from '../config/spriteMapping'
import type { Battle, BattleCombatant, BattleAction, MonsterElement, ItemDrop, MonsterInstance, BossDefinition } from '../models/types'
import { initAudioSystem, playMusic, crossfadeMusic, playSfx, stopMusic, MUSIC_KEYS, SFX_KEYS } from '../systems/AudioSystem'
import { checkAndShowTutorial, isTutorialComplete } from '../systems/TutorialSystem'
import { BattleTooltip } from '../ui/components/BattleTooltip'
import {
  createBattle,
  executeAction,
  processStatusEffects,
  getEnemyAction,
  isSleeping,
  calculateBattleRewards,
  checkBattleEnd,
  calculateTurnOrder,
  getCurrentCombatant,
  type ActionResult,
} from '../systems/CombatSystem'
import { BattleHUD, type CommandChoice } from '../ui/hud/BattleHUD'
import { EventBus } from '../events/EventBus'
import { GAME_EVENTS } from '../events/GameEvents'
import { generateBattleLoot } from '../systems/LootSystem'
import {
  getGameState,
  setGameState,
  updateInventory,
  updateSquad,
  updateMonsterStorage,
  updateDiscoveredSpecies,
  addDefeatedBoss,
  updateActiveQuests,
} from '../systems/GameStateManager'
import { trackDefeat, trackBossDefeat } from '../systems/QuestSystem'
import { useItem, getConsumableItems, getCaptureDevices, getItem } from '../systems/InventorySystem'
import { useItemOnCombatant } from '../systems/ItemEffectSystem'
import { getSpecies } from '../systems/MonsterSystem'
import {
  attemptCapture,
  calculateShakeCount,
  createCapturedMonster,
} from '../systems/CaptureSystem'
import { addToSquad, applyPostBattleBond, isSquadFull } from '../systems/SquadSystem'
import { discoverSpecies, discoverMultipleSpecies } from '../systems/BestiarySystem'
import { getSquadMonsterAction } from '../systems/SquadAI'
import { playCaptureAnimation } from '../ui/animations/CaptureAnimation'
import { requiresTargetSelection, getValidTargets } from '../systems/TargetingSystem'
import type { TargetPosition } from '../ui/hud/TargetSelector'

interface BattleSceneData {
  readonly playerCombatants: ReadonlyArray<BattleCombatant>
  readonly enemyCombatants: ReadonlyArray<BattleCombatant>
  readonly backgroundKey?: string
  readonly enemySpeciesIds?: ReadonlyArray<string>
  readonly isBossBattle?: boolean
  readonly bossData?: BossDefinition
  readonly playerPosition?: { x: number; y: number }
  readonly areaId?: string
}

type AreaType = 'village' | 'forest' | 'cave' | 'volcano' | 'grotto' | 'swamp'

type BattlePhase = 'intro' | 'player_input' | 'targeting' | 'executing' | 'enemy_turn' | 'victory' | 'defeat' | 'fled'

interface PendingAction {
  readonly choice: CommandChoice
  readonly abilityId: string | null
}

type BattleSprite = Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite

// Time window for detecting double-clicks (ms)
const DOUBLE_CLICK_THRESHOLD = 400

export class BattleScene extends Phaser.Scene {
  private battle!: Battle
  private hud!: BattleHUD
  private phase: BattlePhase = 'intro'
  private playerSprites: BattleSprite[] = []
  private enemySprites: BattleSprite[] = []
  private sceneData!: BattleSceneData
  private currentTurnIndex: number = 0
  private isBossBattle: boolean = false
  private bossData: BossDefinition | null = null
  private playerPosition: { x: number; y: number } | null = null
  private areaId: string = 'sunlit-village'
  private pendingAction: PendingAction | null = null
  private lastTargetedEnemyId: string | null = null
  private lastCommandTime: number = 0
  private lastCommandChoice: CommandChoice | null = null
  private lastCommandAbilityId: string | null = null
  private captureHintShown: boolean = false
  private activeTooltip: BattleTooltip | null = null

  constructor() {
    super({ key: SCENE_KEYS.BATTLE })
  }

  create(data: BattleSceneData): void {
    this.sceneData = data
    this.phase = 'intro'
    this.isBossBattle = data.isBossBattle ?? false
    this.bossData = data.bossData ?? null
    this.playerPosition = data.playerPosition ?? null
    this.areaId = data.areaId ?? 'sunlit-village'
    this.captureHintShown = false
    this.activeTooltip = null

    // Initialize audio system
    initAudioSystem(this)

    // Play battle music
    if (this.isBossBattle) {
      playMusic(MUSIC_KEYS.BATTLE_BOSS, { fadeIn: 500 })
    } else {
      playMusic(MUSIC_KEYS.BATTLE_NORMAL, { fadeIn: 500 })
    }

    this.battle = createBattle(
      data.playerCombatants,
      data.enemyCombatants,
      data.backgroundKey,
    )

    this.createBackground()
    this.createCombatantSprites()

    this.hud = new BattleHUD(this)
    this.hud.setCommandCallback((choice, targetId, abilityId) => {
      this.handlePlayerCommand(choice, targetId, abilityId)
    })

    this.hud.updatePlayerStats(this.battle.playerSquad)
    this.hud.updateEnemyStats(this.battle.enemySquad, this.isBossBattle)

    // Intro sequence
    this.cameras.main.fadeIn(300)
    this.time.delayedCall(500, () => {
      const introMessage = this.isBossBattle && this.bossData
        ? `${this.bossData.name}, ${this.bossData.title}, appears!`
        : 'A wild monster appeared!'

      // Show first battle tutorial
      checkAndShowTutorial(this, 'first_battle')

      this.hud.showMessage(introMessage).then(() => {
        this.startNextTurn()
      })
    })
  }

  private createBackground(): void {
    const areaType = this.getAreaType()
    const bg = this.add.graphics()

    if (areaType === 'volcano') {
      this.createVolcanoBackground(bg)
    } else if (areaType === 'grotto') {
      this.createGrottoBackground(bg)
    } else if (areaType === 'swamp') {
      this.createSwampBackground(bg)
    } else if (areaType === 'cave') {
      this.createCaveBackground(bg)
    } else if (areaType === 'forest') {
      this.createForestBackground(bg)
    } else {
      this.createVillageBackground(bg)
    }

    bg.setDepth(DEPTH.GROUND)
  }

  private getAreaType(): AreaType {
    if (this.areaId.includes('volcanic') || this.areaId.includes('volcano')) {
      return 'volcano'
    } else if (this.areaId.includes('grotto') || this.areaId.includes('seaside')) {
      return 'grotto'
    } else if (this.areaId.includes('marsh') || this.areaId.includes('shadow') || this.areaId.includes('swamp')) {
      return 'swamp'
    } else if (this.areaId.includes('cave') || this.areaId.includes('crystal')) {
      return 'cave'
    } else if (this.areaId.includes('forest') || this.areaId.includes('whispering')) {
      return 'forest'
    }
    return 'village'
  }

  private createVillageBackground(bg: Phaser.GameObjects.Graphics): void {
    // Bright sunny sky gradient
    bg.fillGradientStyle(0x87ceeb, 0x87ceeb, 0xadd8e6, 0xadd8e6)
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT * 0.6)

    // Warm green grass
    bg.fillStyle(0x7cb342, 1)
    bg.fillRect(0, GAME_HEIGHT * 0.6, GAME_WIDTH, GAME_HEIGHT * 0.4)

    // Add some grass variation
    bg.fillStyle(0x689f38, 0.5)
    for (let i = 0; i < 20; i++) {
      const x = (i * 73) % GAME_WIDTH
      const y = GAME_HEIGHT * 0.65 + (i * 17) % (GAME_HEIGHT * 0.3)
      bg.fillCircle(x, y, 15 + (i % 10))
    }

    // Battle platform for enemies (cobblestone look)
    bg.fillStyle(0xa1887f, 0.8)
    bg.fillEllipse(GAME_WIDTH * 0.25, GAME_HEIGHT * 0.48, 380, 70)
    bg.fillStyle(0x8d6e63, 0.6)
    bg.fillEllipse(GAME_WIDTH * 0.25, GAME_HEIGHT * 0.46, 350, 55)

    // Battle platform for player
    bg.fillStyle(0xa1887f, 0.8)
    bg.fillEllipse(GAME_WIDTH * 0.72, GAME_HEIGHT * 0.68, 420, 70)
    bg.fillStyle(0x8d6e63, 0.6)
    bg.fillEllipse(GAME_WIDTH * 0.72, GAME_HEIGHT * 0.66, 380, 55)
  }

  private createForestBackground(bg: Phaser.GameObjects.Graphics): void {
    // Darker, mystical sky with green tint
    bg.fillGradientStyle(0x4a6741, 0x5d8a54, 0x2d5a27, 0x1a3d12)
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT * 0.6)

    // Dark forest floor
    bg.fillStyle(0x2d4a27, 1)
    bg.fillRect(0, GAME_HEIGHT * 0.6, GAME_WIDTH, GAME_HEIGHT * 0.4)

    // Add moss and undergrowth patches
    bg.fillStyle(0x3d6b37, 0.7)
    for (let i = 0; i < 25; i++) {
      const x = (i * 61) % GAME_WIDTH
      const y = GAME_HEIGHT * 0.62 + (i * 23) % (GAME_HEIGHT * 0.35)
      bg.fillCircle(x, y, 20 + (i % 15))
    }

    // Draw background trees (silhouettes)
    bg.fillStyle(0x1a3d12, 0.8)
    for (let i = 0; i < 8; i++) {
      const x = i * 180 + 50
      const treeHeight = 150 + (i % 3) * 40
      // Tree trunk
      bg.fillRect(x - 8, GAME_HEIGHT * 0.6 - treeHeight + 80, 16, treeHeight - 80)
      // Tree canopy (triangle)
      bg.fillTriangle(x, GAME_HEIGHT * 0.6 - treeHeight, x - 50, GAME_HEIGHT * 0.6 - 50, x + 50, GAME_HEIGHT * 0.6 - 50)
    }

    // Battle platform for enemies (mossy stone)
    bg.fillStyle(0x5d4e37, 0.9)
    bg.fillEllipse(GAME_WIDTH * 0.25, GAME_HEIGHT * 0.48, 380, 70)
    bg.fillStyle(0x4a6741, 0.5)
    bg.fillEllipse(GAME_WIDTH * 0.25, GAME_HEIGHT * 0.46, 340, 50)

    // Battle platform for player
    bg.fillStyle(0x5d4e37, 0.9)
    bg.fillEllipse(GAME_WIDTH * 0.72, GAME_HEIGHT * 0.68, 420, 70)
    bg.fillStyle(0x4a6741, 0.5)
    bg.fillEllipse(GAME_WIDTH * 0.72, GAME_HEIGHT * 0.66, 370, 50)
  }

  private createCaveBackground(bg: Phaser.GameObjects.Graphics): void {
    // Dark cave ceiling
    bg.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x2d2d44, 0x2d2d44)
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT * 0.5)

    // Cave walls gradient
    bg.fillGradientStyle(0x2d2d44, 0x2d2d44, 0x3d3d5c, 0x3d3d5c)
    bg.fillRect(0, GAME_HEIGHT * 0.5, GAME_WIDTH, GAME_HEIGHT * 0.2)

    // Cave floor
    bg.fillStyle(0x4d4d6e, 1)
    bg.fillRect(0, GAME_HEIGHT * 0.7, GAME_WIDTH, GAME_HEIGHT * 0.3)

    // Add glowing crystals
    const crystalColors = [0x00bcd4, 0x7c4dff, 0xe040fb, 0x00e5ff]
    for (let i = 0; i < 12; i++) {
      const x = (i * 120 + 30) % GAME_WIDTH
      const y = GAME_HEIGHT * 0.3 + (i * 47) % (GAME_HEIGHT * 0.35)
      const color = crystalColors[i % crystalColors.length]
      bg.fillStyle(color, 0.6)
      bg.fillTriangle(x, y - 25, x - 10, y + 10, x + 10, y + 10)
      // Crystal glow
      bg.fillStyle(color, 0.2)
      bg.fillCircle(x, y, 20)
    }

    // Stalactites from ceiling
    bg.fillStyle(0x3d3d5c, 1)
    for (let i = 0; i < 15; i++) {
      const x = (i * 97 + 20) % GAME_WIDTH
      const height = 40 + (i * 13) % 60
      bg.fillTriangle(x, 0, x - 12, height, x + 12, height)
    }

    // Battle platform for enemies (crystal-infused stone)
    bg.fillStyle(0x5d5d7e, 0.9)
    bg.fillEllipse(GAME_WIDTH * 0.25, GAME_HEIGHT * 0.48, 380, 70)
    bg.fillStyle(0x00bcd4, 0.3)
    bg.fillEllipse(GAME_WIDTH * 0.25, GAME_HEIGHT * 0.46, 320, 45)

    // Battle platform for player
    bg.fillStyle(0x5d5d7e, 0.9)
    bg.fillEllipse(GAME_WIDTH * 0.72, GAME_HEIGHT * 0.68, 420, 70)
    bg.fillStyle(0x7c4dff, 0.3)
    bg.fillEllipse(GAME_WIDTH * 0.72, GAME_HEIGHT * 0.66, 360, 45)
  }

  private createVolcanoBackground(bg: Phaser.GameObjects.Graphics): void {
    // Fiery red-orange sky with smoke
    bg.fillGradientStyle(0x8b0000, 0xb22222, 0xff4500, 0xff6347)
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT * 0.5)

    // Darker smoky upper area
    bg.fillStyle(0x2d1f1f, 0.6)
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT * 0.2)

    // Volcanic rocky ground
    bg.fillGradientStyle(0x3d2817, 0x4a3222, 0x2d1f1a, 0x1a1210)
    bg.fillRect(0, GAME_HEIGHT * 0.5, GAME_WIDTH, GAME_HEIGHT * 0.5)

    // Lava rivers and pools
    bg.fillStyle(0xff4500, 0.9)
    for (let i = 0; i < 8; i++) {
      const x = (i * 180 + 40) % GAME_WIDTH
      const y = GAME_HEIGHT * 0.75 + (i * 31) % (GAME_HEIGHT * 0.2)
      const width = 60 + (i % 4) * 20
      bg.fillEllipse(x, y, width, 15)
      // Lava glow
      bg.fillStyle(0xff6347, 0.4)
      bg.fillEllipse(x, y, width + 20, 25)
      bg.fillStyle(0xff4500, 0.9)
    }

    // Embers floating in the air
    bg.fillStyle(0xffa500, 0.8)
    for (let i = 0; i < 20; i++) {
      const x = (i * 73 + 10) % GAME_WIDTH
      const y = GAME_HEIGHT * 0.15 + (i * 41) % (GAME_HEIGHT * 0.5)
      const size = 2 + (i % 4)
      bg.fillCircle(x, y, size)
    }

    // Distant volcanic mountains/peaks
    bg.fillStyle(0x1a0f0a, 0.9)
    bg.fillTriangle(100, GAME_HEIGHT * 0.5, 0, GAME_HEIGHT * 0.5, 50, GAME_HEIGHT * 0.25)
    bg.fillTriangle(300, GAME_HEIGHT * 0.5, 180, GAME_HEIGHT * 0.5, 240, GAME_HEIGHT * 0.15)
    bg.fillTriangle(550, GAME_HEIGHT * 0.5, 400, GAME_HEIGHT * 0.5, 475, GAME_HEIGHT * 0.2)
    // Lava glow at peaks
    bg.fillStyle(0xff4500, 0.5)
    bg.fillCircle(240, GAME_HEIGHT * 0.18, 15)
    bg.fillCircle(475, GAME_HEIGHT * 0.23, 12)

    // Battle platform for enemies (obsidian with lava cracks)
    bg.fillStyle(0x2d2d2d, 0.95)
    bg.fillEllipse(GAME_WIDTH * 0.25, GAME_HEIGHT * 0.48, 380, 70)
    bg.fillStyle(0xff4500, 0.4)
    bg.fillEllipse(GAME_WIDTH * 0.25, GAME_HEIGHT * 0.48, 300, 40)
    bg.fillStyle(0x1a1a1a, 0.8)
    bg.fillEllipse(GAME_WIDTH * 0.25, GAME_HEIGHT * 0.46, 340, 50)

    // Battle platform for player
    bg.fillStyle(0x2d2d2d, 0.95)
    bg.fillEllipse(GAME_WIDTH * 0.72, GAME_HEIGHT * 0.68, 420, 70)
    bg.fillStyle(0xff4500, 0.4)
    bg.fillEllipse(GAME_WIDTH * 0.72, GAME_HEIGHT * 0.68, 340, 40)
    bg.fillStyle(0x1a1a1a, 0.8)
    bg.fillEllipse(GAME_WIDTH * 0.72, GAME_HEIGHT * 0.66, 370, 50)
  }

  private createGrottoBackground(bg: Phaser.GameObjects.Graphics): void {
    // Underwater blue-green gradient sky (cave ceiling with light filtering through)
    bg.fillGradientStyle(0x006994, 0x0099b3, 0x40e0d0, 0x7fffd4)
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT * 0.55)

    // Light rays from above
    bg.fillStyle(0x7fffd4, 0.15)
    for (let i = 0; i < 6; i++) {
      const x = 100 + i * 200
      bg.fillTriangle(x, 0, x - 60, GAME_HEIGHT * 0.55, x + 60, GAME_HEIGHT * 0.55)
    }

    // Sandy/coral floor
    bg.fillGradientStyle(0xdeb887, 0xd4a76a, 0xc4956a, 0xb08050)
    bg.fillRect(0, GAME_HEIGHT * 0.55, GAME_WIDTH, GAME_HEIGHT * 0.45)

    // Shallow water pools
    bg.fillStyle(0x40e0d0, 0.5)
    for (let i = 0; i < 10; i++) {
      const x = (i * 140 + 30) % GAME_WIDTH
      const y = GAME_HEIGHT * 0.7 + (i * 23) % (GAME_HEIGHT * 0.25)
      bg.fillEllipse(x, y, 50 + (i % 3) * 20, 12)
    }

    // Coral and seaweed decorations
    const coralColors = [0xff6b6b, 0xff8e72, 0xffa07a, 0xe75480]
    for (let i = 0; i < 12; i++) {
      const x = (i * 110 + 20) % GAME_WIDTH
      const y = GAME_HEIGHT * 0.55
      const color = coralColors[i % coralColors.length]
      bg.fillStyle(color, 0.8)
      // Coral branches
      bg.fillRect(x - 3, y - 30 - (i % 20), 6, 30 + (i % 20))
      bg.fillCircle(x, y - 35 - (i % 20), 10)
      bg.fillCircle(x - 8, y - 25 - (i % 15), 7)
      bg.fillCircle(x + 8, y - 28 - (i % 15), 8)
    }

    // Seaweed
    bg.fillStyle(0x2e8b57, 0.7)
    for (let i = 0; i < 8; i++) {
      const x = (i * 170 + 80) % GAME_WIDTH
      const height = 40 + (i % 3) * 15
      bg.fillRect(x, GAME_HEIGHT * 0.55 - height, 4, height)
      bg.fillRect(x + 8, GAME_HEIGHT * 0.55 - height + 10, 4, height - 10)
    }

    // Bubbles
    bg.fillStyle(0xffffff, 0.4)
    for (let i = 0; i < 15; i++) {
      const x = (i * 89 + 25) % GAME_WIDTH
      const y = GAME_HEIGHT * 0.2 + (i * 37) % (GAME_HEIGHT * 0.4)
      bg.fillCircle(x, y, 3 + (i % 4))
    }

    // Battle platform for enemies (coral-encrusted rock)
    bg.fillStyle(0xc4956a, 0.95)
    bg.fillEllipse(GAME_WIDTH * 0.25, GAME_HEIGHT * 0.48, 380, 70)
    bg.fillStyle(0x40e0d0, 0.4)
    bg.fillEllipse(GAME_WIDTH * 0.25, GAME_HEIGHT * 0.46, 320, 45)

    // Battle platform for player
    bg.fillStyle(0xc4956a, 0.95)
    bg.fillEllipse(GAME_WIDTH * 0.72, GAME_HEIGHT * 0.68, 420, 70)
    bg.fillStyle(0x7fffd4, 0.3)
    bg.fillEllipse(GAME_WIDTH * 0.72, GAME_HEIGHT * 0.66, 360, 45)
  }

  private createSwampBackground(bg: Phaser.GameObjects.Graphics): void {
    // Dark, murky greenish-purple sky (foggy twilight)
    bg.fillGradientStyle(0x2d2d3d, 0x3d3d4d, 0x4a4a5a, 0x3d4a3d)
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT * 0.5)

    // Fog layers
    bg.fillStyle(0x6b6b7b, 0.3)
    bg.fillRect(0, GAME_HEIGHT * 0.35, GAME_WIDTH, GAME_HEIGHT * 0.15)
    bg.fillStyle(0x5a5a6a, 0.2)
    bg.fillRect(0, GAME_HEIGHT * 0.25, GAME_WIDTH, GAME_HEIGHT * 0.1)

    // Murky swamp ground
    bg.fillGradientStyle(0x3d2817, 0x2d3d27, 0x2a3a2a, 0x1a2a1a)
    bg.fillRect(0, GAME_HEIGHT * 0.5, GAME_WIDTH, GAME_HEIGHT * 0.5)

    // Murky water pools
    bg.fillStyle(0x2f4f2f, 0.7)
    for (let i = 0; i < 12; i++) {
      const x = (i * 120 + 20) % GAME_WIDTH
      const y = GAME_HEIGHT * 0.65 + (i * 29) % (GAME_HEIGHT * 0.3)
      bg.fillEllipse(x, y, 70 + (i % 4) * 15, 18)
      // Murky reflection
      bg.fillStyle(0x4a6a4a, 0.3)
      bg.fillEllipse(x, y - 3, 50 + (i % 4) * 10, 10)
      bg.fillStyle(0x2f4f2f, 0.7)
    }

    // Dead trees silhouettes
    bg.fillStyle(0x1a1a1a, 0.9)
    for (let i = 0; i < 6; i++) {
      const x = i * 220 + 80
      const height = 120 + (i % 3) * 30
      // Gnarled trunk
      bg.fillRect(x - 6, GAME_HEIGHT * 0.5 - height, 12, height)
      // Dead branches
      bg.fillTriangle(x, GAME_HEIGHT * 0.5 - height, x - 40, GAME_HEIGHT * 0.5 - height + 30, x, GAME_HEIGHT * 0.5 - height + 20)
      bg.fillTriangle(x, GAME_HEIGHT * 0.5 - height + 10, x + 35, GAME_HEIGHT * 0.5 - height + 35, x, GAME_HEIGHT * 0.5 - height + 25)
    }

    // Glowing mushrooms
    const mushroomColors = [0x9370db, 0x8a2be2, 0x7b68ee, 0x6a5acd]
    for (let i = 0; i < 10; i++) {
      const x = (i * 137 + 50) % GAME_WIDTH
      const y = GAME_HEIGHT * 0.75 + (i * 19) % (GAME_HEIGHT * 0.2)
      const color = mushroomColors[i % mushroomColors.length]
      // Mushroom glow
      bg.fillStyle(color, 0.3)
      bg.fillCircle(x, y - 5, 15)
      // Mushroom cap
      bg.fillStyle(color, 0.8)
      bg.fillEllipse(x, y - 8, 12, 6)
      // Stem
      bg.fillStyle(0xdcdcdc, 0.7)
      bg.fillRect(x - 2, y - 5, 4, 10)
    }

    // Wisps / will-o-wisps
    bg.fillStyle(0x98fb98, 0.5)
    for (let i = 0; i < 8; i++) {
      const x = (i * 167 + 100) % GAME_WIDTH
      const y = GAME_HEIGHT * 0.3 + (i * 43) % (GAME_HEIGHT * 0.25)
      bg.fillCircle(x, y, 5)
      bg.fillStyle(0x98fb98, 0.2)
      bg.fillCircle(x, y, 12)
      bg.fillStyle(0x98fb98, 0.5)
    }

    // Battle platform for enemies (rotting log/mud mound)
    bg.fillStyle(0x4a3a2a, 0.95)
    bg.fillEllipse(GAME_WIDTH * 0.25, GAME_HEIGHT * 0.48, 380, 70)
    bg.fillStyle(0x3d4d3d, 0.5)
    bg.fillEllipse(GAME_WIDTH * 0.25, GAME_HEIGHT * 0.46, 320, 45)

    // Battle platform for player
    bg.fillStyle(0x4a3a2a, 0.95)
    bg.fillEllipse(GAME_WIDTH * 0.72, GAME_HEIGHT * 0.68, 420, 70)
    bg.fillStyle(0x2f4f2f, 0.4)
    bg.fillEllipse(GAME_WIDTH * 0.72, GAME_HEIGHT * 0.66, 360, 45)
  }

  private createCombatantSprites(): void {
    const hasCharacters32 = this.textures.exists('characters-32')

    // Determine enemy scale based on boss battle
    const enemyScale = this.isBossBattle ? 6 : 4  // Boss is 6x, regular is 4x
    const playerScale = 2.5  // Player party at 2.5x

    // Enemy sprites (left side) - centered for boss battles
    this.enemySprites = this.battle.enemySquad.map((enemy, index) => {
      // Position boss in center, regular enemies spread out
      const x = this.isBossBattle
        ? GAME_WIDTH * 0.22
        : GAME_WIDTH * 0.15 + index * 140
      const y = this.isBossBattle ? GAME_HEIGHT * 0.35 : GAME_HEIGHT * 0.38

      let sprite: BattleSprite

      if (enemy.speciesId) {
        // Try to use 32x32 monster icon
        const iconKey = getMonsterIconKey(enemy.speciesId)
        if (this.textures.exists(iconKey)) {
          const creatureSprite = this.add.sprite(x, y, iconKey)
          creatureSprite.setScale(enemyScale)
          creatureSprite.setDepth(DEPTH.PLAYER)
          sprite = creatureSprite
        } else {
          // Fallback to legacy 16x16 creatures-sheet
          const frameIndex = getMonsterFrame(enemy.speciesId)
          const creatureSprite = this.add.sprite(x, y, 'creatures-sheet', frameIndex)
          creatureSprite.setScale(enemyScale * 1.5) // 16x16 needs more scaling
          creatureSprite.setDepth(DEPTH.PLAYER)
          sprite = creatureSprite
        }
      } else {
        // Fallback to colored rectangle
        const color = this.getElementColor(this.guessEnemyElement(enemy))
        const size = this.isBossBattle ? 128 : 96
        const rectSprite = this.add.rectangle(x, y, size, size, color)
        rectSprite.setDepth(DEPTH.PLAYER)
        rectSprite.setStrokeStyle(3, 0xffffff, 0.8)
        sprite = rectSprite
      }

      // Name label above - adjust for boss size
      const labelY = this.isBossBattle ? y - 110 : y - 70
      const fontSize = this.isBossBattle ? '16px' : '14px'
      const label = this.add.text(x, labelY, enemy.name, {
        ...TEXT_STYLES.SMALL,
        fontSize,
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      label.setOrigin(0.5)
      label.setDepth(DEPTH.PLAYER + 1)

      // Entry animation - boss has more dramatic entrance
      sprite.setAlpha(0)
      sprite.setScale(this.isBossBattle ? 1 : 0.5)
      this.tweens.add({
        targets: sprite,
        alpha: 1,
        scaleX: enemyScale,
        scaleY: enemyScale,
        duration: this.isBossBattle ? 600 : 400,
        delay: index * 150,
        ease: this.isBossBattle ? 'Bounce.easeOut' : 'Back.easeOut',
      })

      return sprite
    })

    // Player sprites - 2-row layout based on squad size
    // Layout: 1=center, 2=side-by-side, 3=2+1, 4=2+2, 5=3+2, 6=3+3
    const squadCount = this.battle.playerSquad.length
    const positions = this.calculateSquadPositions(squadCount)

    this.playerSprites = this.battle.playerSquad.map((player, index) => {
      const { x, y } = positions[index]

      let sprite: BattleSprite

      if (player.isMonster && player.speciesId) {
        // Try to use 32x32 monster icon for squad monsters
        const iconKey = getMonsterIconKey(player.speciesId)
        if (this.textures.exists(iconKey)) {
          const creatureSprite = this.add.sprite(x, y, iconKey)
          creatureSprite.setScale(playerScale)
          creatureSprite.setDepth(DEPTH.PLAYER)
          creatureSprite.setFlipX(true) // Face the enemies
          sprite = creatureSprite
        } else {
          // Fallback to legacy 16x16 creatures-sheet
          const frameIndex = getMonsterFrame(player.speciesId)
          const creatureSprite = this.add.sprite(x, y, 'creatures-sheet', frameIndex)
          creatureSprite.setScale(playerScale * 1.5)
          creatureSprite.setDepth(DEPTH.PLAYER)
          creatureSprite.setFlipX(true)
          sprite = creatureSprite
        }
      } else if (!player.isMonster && hasCharacters32) {
        // Use 32x32 character sprite for player hero
        // Row 2 (index 2) is a suitable hero character, idle down frame is col 1
        const heroFrame = 2 * 12 + 1 // Row 2, column 1
        const heroSprite = this.add.sprite(x, y, 'characters-32', heroFrame)
        heroSprite.setScale(playerScale)
        heroSprite.setDepth(DEPTH.PLAYER)
        heroSprite.setFlipX(true)
        sprite = heroSprite
      } else if (!player.isMonster) {
        // Fallback to legacy 16x16 character
        const heroSprite = this.add.sprite(x, y, 'characters-sheet', 0)
        heroSprite.setScale(playerScale * 1.5)
        heroSprite.setDepth(DEPTH.PLAYER)
        heroSprite.setFlipX(true)
        sprite = heroSprite
      } else {
        // Fallback to colored rectangle
        const color = player.isMonster ? COLORS.PRIMARY : COLORS.SECONDARY
        const rectSprite = this.add.rectangle(x, y, 56, 56, color)
        rectSprite.setDepth(DEPTH.PLAYER)
        rectSprite.setStrokeStyle(2, 0xffffff, 0.8)
        sprite = rectSprite
      }

      // Entry slide from right
      sprite.setX(GAME_WIDTH + 100)
      this.tweens.add({
        targets: sprite,
        x,
        duration: 500,
        delay: index * 100,
        ease: 'Power2',
      })

      return sprite
    })
  }

  private calculateSquadPositions(squadCount: number): Array<{ x: number; y: number }> {
    // Layout configuration - positioned lower on screen
    const centerX = 950  // Center point for the squad area (right side)
    const topRowY = GAME_HEIGHT * 0.54  // Top row Y position
    const bottomRowY = GAME_HEIGHT * 0.78  // Bottom row Y position
    const spacing = 180  // Horizontal spacing between characters

    // Determine row sizes based on squad count
    // 1=1+0, 2=2+0, 3=2+1, 4=2+2, 5=3+2, 6=3+3
    let topRowCount: number
    let bottomRowCount: number

    switch (squadCount) {
      case 1:
        topRowCount = 1
        bottomRowCount = 0
        break
      case 2:
        topRowCount = 2
        bottomRowCount = 0
        break
      case 3:
        topRowCount = 2
        bottomRowCount = 1
        break
      case 4:
        topRowCount = 2
        bottomRowCount = 2
        break
      case 5:
        topRowCount = 3
        bottomRowCount = 2
        break
      case 6:
      default:
        topRowCount = 3
        bottomRowCount = squadCount - 3
        break
    }

    const positions: Array<{ x: number; y: number }> = []

    // Calculate top row positions (centered)
    const topRowStartX = centerX - ((topRowCount - 1) * spacing) / 2
    for (let i = 0; i < topRowCount; i++) {
      positions.push({
        x: topRowStartX + i * spacing,
        y: topRowY,
      })
    }

    // Calculate bottom row positions (centered)
    if (bottomRowCount > 0) {
      const bottomRowStartX = centerX - ((bottomRowCount - 1) * spacing) / 2
      for (let i = 0; i < bottomRowCount; i++) {
        positions.push({
          x: bottomRowStartX + i * spacing,
          y: bottomRowY,
        })
      }
    }

    return positions
  }

  private startNextTurn(): void {
    // Recalculate turn order each round
    if (this.currentTurnIndex === 0) {
      this.battle = {
        ...this.battle,
        turnOrder: calculateTurnOrder([...this.battle.playerSquad, ...this.battle.enemySquad]),
      }
    }

    // Check for battle end
    const endState = checkBattleEnd(this.battle)
    if (endState === 'victory') {
      this.handleVictory()
      return
    }
    if (endState === 'defeat') {
      this.handleDefeat()
      return
    }

    // Get current combatant
    const aliveTurnOrder = this.battle.turnOrder.filter((c) => c.stats.currentHp > 0)
    if (aliveTurnOrder.length === 0) return

    const current = aliveTurnOrder[this.currentTurnIndex % aliveTurnOrder.length]
    if (!current) return

    // Process status effects at start of turn
    this.battle = processStatusEffects(this.battle, current.combatantId)
    this.hud.updatePlayerStats(this.battle.playerSquad)
    this.hud.updateEnemyStats(this.battle.enemySquad, this.isBossBattle)

    // Recheck after status effects (poison could KO)
    const postStatusEnd = checkBattleEnd(this.battle)
    if (postStatusEnd === 'victory') {
      this.handleVictory()
      return
    }
    if (postStatusEnd === 'defeat') {
      this.handleDefeat()
      return
    }

    // Check if sleeping
    const updatedCurrent = this.findCurrentCombatant(current.combatantId)
    if (updatedCurrent && isSleeping(updatedCurrent)) {
      this.hud.showMessage(`${updatedCurrent.name} is asleep!`).then(() => {
        this.currentTurnIndex++
        this.startNextTurn()
      })
      return
    }

    // Skip dead combatants
    if (updatedCurrent && updatedCurrent.stats.currentHp <= 0) {
      this.currentTurnIndex++
      this.startNextTurn()
      return
    }

    if (current.isPlayer && !current.isMonster) {
      // Human player's turn
      this.phase = 'player_input'
      this.hud.showCommandMenu()
      this.showActiveTurnIndicatorFor(current)
    } else if (current.isPlayer && current.isMonster) {
      // Squad monster's turn - player controls (no more AI)
      this.phase = 'player_input'
      this.hud.showCommandMenu()
      this.showActiveTurnIndicatorFor(current)
    } else {
      // Enemy's turn
      this.phase = 'enemy_turn'
      this.hud.hideActiveTurnIndicator()
      this.executeEnemyTurn(current)
    }
  }

  private showActiveTurnIndicatorFor(combatant: BattleCombatant): void {
    // Find sprite position for this combatant
    const spriteIndex = this.battle.playerSquad.findIndex(
      (c) => c.combatantId === combatant.combatantId,
    )
    if (spriteIndex >= 0 && this.playerSprites[spriteIndex]) {
      const sprite = this.playerSprites[spriteIndex]
      this.hud.showActiveTurnIndicator(combatant, sprite.x, sprite.y)
    }
  }

  private executeSquadMonsterTurn(monster: BattleCombatant): void {
    this.time.delayedCall(400, () => {
      const action = getSquadMonsterAction(this.battle, monster)
      this.executeActionAndAnimate(action)
    })
  }

  private handlePlayerCommand(choice: CommandChoice, targetId?: string, abilityId?: string): void {
    if (this.phase !== 'player_input' && this.phase !== 'targeting') return

    const aliveTurnOrder = this.battle.turnOrder.filter((c) => c.stats.currentHp > 0)
    const current = aliveTurnOrder[this.currentTurnIndex % aliveTurnOrder.length]
    if (!current) return

    const now = Date.now()

    // Check for re-click during targeting phase (same command clicked again)
    if (this.phase === 'targeting' && this.pendingAction && !targetId) {
      const isSameCommand = choice === this.pendingAction.choice &&
        (choice !== 'ability' || abilityId === this.pendingAction.abilityId)

      if (isSameCommand) {
        // Use default target based on the ability's target type
        let defaultTarget: string | null = null
        if (this.pendingAction.abilityId) {
          const ability = current.abilities.find((a) => a.abilityId === this.pendingAction!.abilityId)
          if (ability?.targetType === 'single_ally') {
            defaultTarget = this.getDefaultAllyTarget(current.combatantId)
          } else {
            defaultTarget = this.getDefaultEnemyTarget()
          }
        } else {
          defaultTarget = this.getDefaultEnemyTarget()
        }

        if (defaultTarget) {
          this.phase = 'executing'
          this.hud.hideTargetSelection()
          this.hud.hideActiveTurnIndicator()

          const action: BattleAction = {
            type: this.pendingAction.choice === 'ability' ? 'ability' : 'attack',
            actorId: current.combatantId,
            targetId: defaultTarget,
            targetIds: [],
            abilityId: this.pendingAction.abilityId,
            itemId: null,
          }

          this.pendingAction = null
          this.lastCommandTime = 0
          this.lastCommandChoice = null
          this.lastCommandAbilityId = null
          this.executeActionAndAnimate(action)
          return
        }
      }
    }

    // If we have a target from targeting phase, execute the pending action
    if (this.phase === 'targeting' && targetId && this.pendingAction) {
      this.phase = 'executing'
      this.hud.hideTargetSelection()
      this.hud.hideActiveTurnIndicator()

      const action: BattleAction = {
        type: this.pendingAction.choice === 'ability' ? 'ability' : 'attack',
        actorId: current.combatantId,
        targetId,
        targetIds: [],
        abilityId: this.pendingAction.abilityId,
        itemId: null,
      }

      this.pendingAction = null
      this.lastCommandTime = 0
      this.lastCommandChoice = null
      this.lastCommandAbilityId = null
      this.executeActionAndAnimate(action)
      return
    }

    // Check for double-click on attack or ability (quick successive clicks)
    const isDoubleClick = (choice === 'attack' || choice === 'ability') &&
      this.lastCommandChoice === choice &&
      (choice !== 'ability' || this.lastCommandAbilityId === abilityId) &&
      (now - this.lastCommandTime) < DOUBLE_CLICK_THRESHOLD

    if (isDoubleClick && !targetId) {
      // Double-click detected - use default target and skip targeting phase
      let defaultTarget: string | null = null
      if (abilityId) {
        const ability = current.abilities.find((a) => a.abilityId === abilityId)
        if (ability?.targetType === 'single_ally') {
          defaultTarget = this.getDefaultAllyTarget(current.combatantId)
        } else if (ability && !requiresTargetSelection(ability.targetType)) {
          // Auto-target abilities (all_enemies, self, etc.) don't need default
          defaultTarget = null
        } else {
          defaultTarget = this.getDefaultEnemyTarget()
        }
      } else {
        defaultTarget = this.getDefaultEnemyTarget()
      }

      if (defaultTarget) {
        this.phase = 'executing'
        this.hud.hideCommandMenu()
        this.hud.hideActiveTurnIndicator()

        const action: BattleAction = {
          type: choice === 'ability' ? 'ability' : 'attack',
          actorId: current.combatantId,
          targetId: defaultTarget,
          targetIds: [],
          abilityId: abilityId ?? null,
          itemId: null,
        }

        this.lastCommandTime = 0
        this.lastCommandChoice = null
        this.lastCommandAbilityId = null
        this.executeActionAndAnimate(action)
        return
      }
    }

    // Track this command for potential double-click detection
    this.lastCommandTime = now
    this.lastCommandChoice = choice
    this.lastCommandAbilityId = abilityId ?? null

    // Handle submenu navigation first (these don't need targeting)
    if (choice === 'ability' && !abilityId) {
      // Show ability submenu
      this.hud.hideCommandMenu()
      this.hud.showAbilityMenu(current.abilities, current.stats.currentMp)
      return
    }

    if (choice === 'item' && !abilityId) {
      // Show item submenu (reuse abilityId param as itemId)
      this.hud.hideCommandMenu()
      try {
        const state = getGameState(this)
        const consumables = getConsumableItems(state.inventory)
        this.hud.showItemMenu(consumables)
      } catch {
        // No game state yet, show nothing
      }
      return
    }

    // Handle capture device selection
    if (choice === 'capture' && !abilityId) {
      this.hud.hideCommandMenu()
      try {
        const state = getGameState(this)
        const devices = getCaptureDevices(state.inventory)
        this.hud.showCaptureDeviceMenu(devices)
      } catch {
        // No game state yet, show nothing
      }
      return
    }

    // Handle capture attempt - needs target selection
    if (choice === 'capture' && abilityId) {
      this.phase = 'executing'
      this.hud.hideCommandMenu()
      this.handleCaptureAttempt(current, abilityId)
      return
    }

    // Handle item usage
    if (choice === 'item' && abilityId) {
      this.phase = 'executing'
      this.hud.hideCommandMenu()
      this.handleItemUse(current, abilityId)
      return
    }

    // Check if attack needs target selection (always for attacks)
    if (choice === 'attack' && !targetId) {
      const aliveEnemies = this.battle.enemySquad.filter((e) => e.stats.currentHp > 0)
      if (aliveEnemies.length > 1) {
        // Keep command menu visible during targeting so user can click Attack again
        this.enterTargetingPhase(choice, null, current)
        return
      }
      // Single enemy, auto-target
      targetId = aliveEnemies[0]?.combatantId
    }

    // Check if ability needs target selection
    if (choice === 'ability' && abilityId && !targetId) {
      const ability = current.abilities.find((a) => a.abilityId === abilityId)
      if (ability && requiresTargetSelection(ability.targetType)) {
        // Keep command menu visible during targeting so user can click Ability again
        this.enterTargetingPhase(choice, abilityId, current)
        return
      }
    }

    // Now we're actually executing - hide menu
    this.phase = 'executing'
    this.hud.hideCommandMenu()

    // Handle defend and flee (no target needed)
    if (choice === 'defend' || choice === 'flee') {
      this.hud.hideActiveTurnIndicator()
      const action: BattleAction = {
        type: choice,
        actorId: current.combatantId,
        targetId: null,
        targetIds: [],
        abilityId: null,
        itemId: null,
      }
      this.executeActionAndAnimate(action)
      return
    }

    // Execute with resolved target
    const aliveEnemies = this.battle.enemySquad.filter((e) => e.stats.currentHp > 0)
    const defaultTarget = targetId ?? aliveEnemies[0]?.combatantId ?? null

    this.hud.hideActiveTurnIndicator()
    const action: BattleAction = {
      type: choice === 'ability' ? 'ability' : 'attack',
      actorId: current.combatantId,
      targetId: defaultTarget,
      targetIds: [],
      abilityId: abilityId ?? null,
      itemId: null,
    }

    this.executeActionAndAnimate(action)
  }

  private enterTargetingPhase(choice: CommandChoice, abilityId: string | null, actor: BattleCombatant): void {
    this.phase = 'targeting'
    this.pendingAction = { choice, abilityId }

    // Determine target type
    let targetType: import('../models/types').TargetType = 'single_enemy'
    if (abilityId) {
      const ability = actor.abilities.find((a) => a.abilityId === abilityId)
      if (ability) {
        targetType = ability.targetType
      }
    }

    // Get valid targets
    const validTargets = getValidTargets(this.battle, actor.combatantId, targetType)

    // Get target positions (enemy sprite positions)
    const targetPositions: TargetPosition[] = this.getEnemyTargetPositions()

    this.hud.showTargetSelection(
      validTargets,
      targetPositions,
      (selectedTargetId) => {
        this.handlePlayerCommand(choice, selectedTargetId, abilityId ?? undefined)
      },
      () => {
        // Cancel - return to command menu
        this.phase = 'player_input'
        this.pendingAction = null
        this.hud.showCommandMenu()
      },
    )
  }

  private getEnemyTargetPositions(): TargetPosition[] {
    const positions: TargetPosition[] = []

    this.battle.enemySquad.forEach((enemy, index) => {
      if (enemy.stats.currentHp <= 0) return
      if (index < this.enemySprites.length) {
        const sprite = this.enemySprites[index]
        positions.push({
          combatantId: enemy.combatantId,
          x: sprite.x,
          y: sprite.y,
        })
      }
    })

    return positions
  }

  private getDefaultEnemyTarget(): string | null {
    const aliveEnemies = this.battle.enemySquad.filter((e) => e.stats.currentHp > 0)
    if (aliveEnemies.length === 0) return null

    // If we have a last targeted enemy and it's still alive, use it
    if (this.lastTargetedEnemyId) {
      const lastTarget = aliveEnemies.find((e) => e.combatantId === this.lastTargetedEnemyId)
      if (lastTarget) {
        return lastTarget.combatantId
      }
    }

    // Otherwise, use the first alive enemy
    return aliveEnemies[0].combatantId
  }

  private getDefaultAllyTarget(actorId: string): string | null {
    const aliveAllies = this.battle.playerSquad.filter((c) => c.stats.currentHp > 0)
    if (aliveAllies.length === 0) return null

    // For heals, default to the lowest HP ally
    const lowestHpAlly = aliveAllies.reduce((lowest, ally) => {
      const lowestRatio = lowest.stats.currentHp / lowest.stats.maxHp
      const allyRatio = ally.stats.currentHp / ally.stats.maxHp
      return allyRatio < lowestRatio ? ally : lowest
    })

    return lowestHpAlly.combatantId
  }

  private handleItemUse(actor: BattleCombatant, itemId: string): void {
    try {
      const state = getGameState(this)
      const itemSlot = state.inventory.items.find((s) => s.item.itemId === itemId)
      if (!itemSlot) {
        this.phase = 'player_input'
        this.hud.showCommandMenu()
        return
      }

      // Apply item effect to player combatant
      const { combatant: updatedActor, result } = useItemOnCombatant(itemSlot.item, actor)

      if (result.success) {
        // Decrement inventory
        const newInventory = useItem(state.inventory, itemId)
        if (newInventory) {
          setGameState(this, updateInventory(state, newInventory))
        }

        // Update battle state with healed combatant
        const updateCombatant = (c: BattleCombatant): BattleCombatant =>
          c.combatantId === updatedActor.combatantId ? updatedActor : c

        this.battle = {
          ...this.battle,
          playerSquad: this.battle.playerSquad.map(updateCombatant),
          enemySquad: this.battle.enemySquad.map(updateCombatant),
          turnOrder: this.battle.turnOrder.map(updateCombatant),
        }
      }

      this.hud.showMessage(result.message).then(() => {
        this.hud.updatePlayerStats(this.battle.playerSquad)
        this.hud.updateEnemyStats(this.battle.enemySquad, this.isBossBattle)

        this.currentTurnIndex++
        const aliveCount = [...this.battle.playerSquad, ...this.battle.enemySquad].filter(
          (c) => c.stats.currentHp > 0,
        ).length
        if (this.currentTurnIndex >= aliveCount) {
          this.currentTurnIndex = 0
        }
        this.startNextTurn()
      })
    } catch {
      this.phase = 'player_input'
      this.hud.showCommandMenu()
    }
  }

  private handleCaptureAttempt(actor: BattleCombatant, deviceItemId: string): void {
    try {
      const state = getGameState(this)
      const deviceSlot = state.inventory.items.find((s) => s.item.itemId === deviceItemId)
      if (!deviceSlot) {
        this.phase = 'player_input'
        this.hud.showCommandMenu()
        return
      }

      // Find the target enemy (first alive, capturable enemy)
      const aliveEnemies = this.battle.enemySquad.filter(
        (e) => e.stats.currentHp > 0 && e.capturable,
      )
      if (aliveEnemies.length === 0) {
        this.hud.showMessage('No capturable targets!').then(() => {
          this.phase = 'player_input'
          this.hud.showCommandMenu()
        })
        return
      }

      const target = aliveEnemies[0]

      // Get species difficulty
      const speciesId = this.sceneData.enemySpeciesIds?.[0] ?? ''
      const species = getSpecies(speciesId)
      const baseDifficulty = species?.captureBaseDifficulty ?? 0.5
      const enemyLevel = this.extractLevelFromName(target.name)

      // Decrement device from inventory
      const newInventory = useItem(state.inventory, deviceItemId)
      if (newInventory) {
        setGameState(this, updateInventory(state, newInventory))
      }

      // Perform capture attempt
      const captureAttempt = attemptCapture(
        target,
        deviceSlot.item,
        actor.stats.luck,
        baseDifficulty,
      )

      const shakeCount = calculateShakeCount(captureAttempt)

      // Emit capture attempt event
      EventBus.emit(GAME_EVENTS.CAPTURE_ATTEMPT, { attempt: captureAttempt, shakeCount })

      // Get sprite positions for animation
      const actorSprite = this.findSprite(actor.combatantId)
      const targetSprite = this.findSprite(target.combatantId)

      if (!actorSprite || !targetSprite) {
        this.finalizeCaptureAttempt(captureAttempt, shakeCount, target, speciesId, enemyLevel)
        return
      }

      // Play capture animation
      playSfx(SFX_KEYS.CAPTURE_THROW)
      this.hud.showMessage(`Throwing ${deviceSlot.item.name}...`).then(() => {
        playCaptureAnimation({
          scene: this,
          deviceX: actorSprite.x,
          deviceY: actorSprite.y,
          targetX: targetSprite.x,
          targetY: targetSprite.y,
          shakeCount,
          succeeded: captureAttempt.succeeded,
          deviceName: deviceSlot.item.name,
        }).then(() => {
          this.finalizeCaptureAttempt(captureAttempt, shakeCount, target, speciesId, enemyLevel)
        })
      })
    } catch {
      this.phase = 'player_input'
      this.hud.showCommandMenu()
    }
  }

  private finalizeCaptureAttempt(
    captureAttempt: ReturnType<typeof attemptCapture>,
    shakeCount: number,
    target: BattleCombatant,
    speciesId: string,
    enemyLevel: number,
  ): void {
    if (captureAttempt.succeeded) {
      // Play capture success SFX
      playSfx(SFX_KEYS.CAPTURE_SUCCESS)

      // Show first capture tutorial
      checkAndShowTutorial(this, 'first_capture')
      // Create captured monster
      const capturedMonster = createCapturedMonster(speciesId, enemyLevel)

      if (capturedMonster) {
        // Add to squad or storage
        const state = getGameState(this)
        const newSquad = addToSquad(state.squad, capturedMonster)

        if (newSquad) {
          setGameState(this, updateSquad(state, newSquad))
          EventBus.emit(GAME_EVENTS.SQUAD_MONSTER_ADDED, { monster: capturedMonster })
        } else {
          // Squad full, add to storage
          const newStorage = [...state.monsterStorage, capturedMonster]
          setGameState(this, updateMonsterStorage(state, newStorage))
        }

        // Discover species
        const updatedState = getGameState(this)
        const newDiscovered = discoverSpecies(updatedState.discoveredSpecies, speciesId)
        setGameState(this, updateDiscoveredSpecies(updatedState, newDiscovered))

        // Emit success events
        EventBus.emit(GAME_EVENTS.CAPTURE_SUCCESS, { monster: capturedMonster, attempt: captureAttempt })
        EventBus.emit(GAME_EVENTS.MONSTER_CAPTURED, { monster: capturedMonster })

        const species = getSpecies(speciesId)
        if (species) {
          EventBus.emit(GAME_EVENTS.SPECIES_DISCOVERED, { speciesId, speciesName: species.name })
        }

        // Remove target from battle
        this.battle = {
          ...this.battle,
          enemySquad: this.battle.enemySquad.filter(
            (e) => e.combatantId !== target.combatantId,
          ),
          turnOrder: this.battle.turnOrder.filter(
            (c) => c.combatantId !== target.combatantId,
          ),
        }

        // Hide the target sprite
        const targetSprite = this.findSprite(target.combatantId)
        if (targetSprite) {
          targetSprite.setVisible(false)
        }

        const locationText = newSquad ? 'squad' : 'storage'
        this.hud.showMessage(`Caught ${target.name}! Added to ${locationText}!`).then(() => {
          this.hud.updatePlayerStats(this.battle.playerSquad)
          this.hud.updateEnemyStats(this.battle.enemySquad, this.isBossBattle)

          // Check if battle should end (no more enemies)
          if (this.battle.enemySquad.every((e) => e.stats.currentHp <= 0)) {
            this.handleVictory()
          } else {
            this.advanceToNextTurn()
          }
        })
      }
    } else {
      // Capture failed
      playSfx(SFX_KEYS.CAPTURE_FAIL)
      EventBus.emit(GAME_EVENTS.CAPTURE_FAIL, { attempt: captureAttempt, shakeCount })

      this.hud.showMessage(`${target.name} broke free!`).then(() => {
        this.advanceToNextTurn()
      })
    }
  }

  private advanceToNextTurn(): void {
    this.currentTurnIndex++

    const aliveCount = [...this.battle.playerSquad, ...this.battle.enemySquad].filter(
      (c) => c.stats.currentHp > 0,
    ).length
    if (this.currentTurnIndex >= aliveCount) {
      this.currentTurnIndex = 0
    }
    this.startNextTurn()
  }

  private extractLevelFromName(name: string): number {
    const match = name.match(/Lv\.(\d+)/)
    return match ? parseInt(match[1], 10) : 1
  }

  private executeEnemyTurn(enemy: BattleCombatant): void {
    this.time.delayedCall(600, () => {
      const action = getEnemyAction(this.battle, enemy)
      this.executeActionAndAnimate(action)
    })
  }

  private executeActionAndAnimate(action: BattleAction): void {
    const result = executeAction(this.battle, action)
    this.battle = result.battle

    // Track last targeted enemy for default target selection
    if (action.targetId && (action.type === 'attack' || action.type === 'ability')) {
      const target = this.battle.enemySquad.find((e) => e.combatantId === action.targetId)
      if (target) {
        this.lastTargetedEnemyId = action.targetId
      }
    }

    // Animate attack
    if (result.damage > 0 && action.targetId) {
      this.animateAttack(action.actorId, action.targetId, result)

      // Check if we should show capture hint (first battle only)
      this.checkAndShowCaptureHint(action.targetId)
    }

    // Show message
    this.hud.showMessage(result.message).then(() => {
      this.hud.updatePlayerStats(this.battle.playerSquad)
      this.hud.updateEnemyStats(this.battle.enemySquad, this.isBossBattle)

      // Check flee
      if (this.battle.state === 'fled') {
        this.handleFlee()
        return
      }

      this.currentTurnIndex++

      // Reset turn index after all combatants have acted
      const aliveCount = [...this.battle.playerSquad, ...this.battle.enemySquad].filter(
        (c) => c.stats.currentHp > 0,
      ).length
      if (this.currentTurnIndex >= aliveCount) {
        this.currentTurnIndex = 0
      }

      this.startNextTurn()
    })
  }

  /**
   * Check if we should show the capture hint tooltip during first battle
   * Shows when an enemy's HP drops below 50% for the first time
   */
  private checkAndShowCaptureHint(targetId: string): void {
    // Only show once per battle
    if (this.captureHintShown) return

    // Only show during first battle (tutorial not complete)
    if (isTutorialComplete('tutorial-first-battle')) return

    // Find the enemy that was just hit
    const enemy = this.battle.enemySquad.find((e) => e.combatantId === targetId)
    if (!enemy) return

    // Check if enemy HP is below 50% and still alive
    const hpRatio = enemy.stats.currentHp / enemy.stats.maxHp
    if (hpRatio >= 0.5 || enemy.stats.currentHp <= 0) return

    // Show the capture hint!
    this.captureHintShown = true

    // Get the Capture button position from the HUD
    const buttonPos = this.hud.getButtonPosition('capture')
    if (!buttonPos) return

    // Delay slightly so it appears after the damage animation
    this.time.delayedCall(800, () => {
      // Clean up any existing tooltip
      if (this.activeTooltip) {
        this.activeTooltip.destroy()
      }

      // Highlight the Capture button
      this.hud.highlightButton('capture')

      this.activeTooltip = new BattleTooltip(this, {
        message: "The monster is getting tired! Try using Capture to make it your friend!",
        targetX: buttonPos.x,
        targetY: buttonPos.y,
        position: 'above',
        autoDismissMs: 8000,
        showArrow: true,
        pulseTarget: false, // HUD provides its own highlight
      })

      this.activeTooltip.setOnDismiss(() => {
        this.activeTooltip = null
        this.hud.clearHighlight()
      })
    })
  }

  private animateAttack(attackerId: string, targetId: string, result: ActionResult): void {
    const targetSprite = this.findSprite(targetId)
    if (!targetSprite) return

    // Play hit SFX
    playSfx(SFX_KEYS.ATTACK_HIT)

    // Flash the target
    this.tweens.add({
      targets: targetSprite,
      alpha: 0.2,
      duration: 100,
      yoyo: true,
      repeat: 2,
    })

    // Shake the target
    const origX = targetSprite.x
    this.tweens.add({
      targets: targetSprite,
      x: origX + 8,
      duration: 50,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        targetSprite.setX(origX)
      },
    })

    // Show damage number
    if (result.damage > 0) {
      this.hud.showDamageNumber(targetSprite.x, targetSprite.y - 40, result.damage, result.isCritical)
    }

    // Check if target KO'd
    const target = this.findCurrentCombatant(targetId)
    if (target && target.stats.currentHp <= 0) {
      this.time.delayedCall(300, () => {
        this.tweens.add({
          targets: targetSprite,
          alpha: 0,
          scaleY: 0,
          duration: 500,
          ease: 'Power2',
        })
      })
    }
  }

  private handleVictory(): void {
    this.phase = 'victory'

    // Play victory music
    playMusic(MUSIC_KEYS.VICTORY_FANFARE, { loop: false })

    // For boss battles, use boss rewards; otherwise calculate normal rewards
    const isBoss = this.isBossBattle && this.bossData
    const bossRewards = isBoss ? this.bossData!.rewards : null
    const normalRewards = calculateBattleRewards(this.battle)

    const rewards = bossRewards
      ? { experience: bossRewards.experience, gold: bossRewards.gold }
      : normalRewards

    // Generate loot (for non-boss battles)
    const speciesIds = this.sceneData.enemySpeciesIds ?? []
    const loot = isBoss ? bossRewards!.guaranteedItems : generateBattleLoot(speciesIds)

    // Apply bond increases to squad
    try {
      const state = getGameState(this)
      if (state.squad.length > 0) {
        const updatedSquad = applyPostBattleBond(state.squad, true)
        setGameState(this, updateSquad(state, updatedSquad))

        // Emit bond events
        for (let i = 0; i < updatedSquad.length; i++) {
          const monster = updatedSquad[i]
          const oldMonster = state.squad[i]
          if (monster.bondLevel !== oldMonster.bondLevel) {
            EventBus.emit(GAME_EVENTS.BOND_INCREASED, {
              monster,
              amount: monster.bondLevel - oldMonster.bondLevel,
              newLevel: monster.bondLevel,
            })
          }
        }
      }

      // Mark boss as defeated
      if (isBoss) {
        const updatedState = getGameState(this)
        setGameState(this, addDefeatedBoss(updatedState, this.bossData!.bossId))

        // Track boss defeat for quests
        const stateAfterBoss = getGameState(this)
        const questsAfterBoss = trackBossDefeat(stateAfterBoss.activeQuests, this.bossData!.bossId)
        if (questsAfterBoss !== stateAfterBoss.activeQuests) {
          setGameState(this, updateActiveQuests(stateAfterBoss, questsAfterBoss))
        }
      }

      // Track monster defeats for quests
      if (speciesIds.length > 0) {
        const stateForQuests = getGameState(this)
        let updatedQuests = stateForQuests.activeQuests
        for (const speciesId of speciesIds) {
          updatedQuests = trackDefeat(updatedQuests, speciesId)
        }
        if (updatedQuests !== stateForQuests.activeQuests) {
          setGameState(this, updateActiveQuests(stateForQuests, updatedQuests))
        }
      }

      // Discover encountered species
      if (speciesIds.length > 0) {
        const updatedState = getGameState(this)
        const newDiscovered = discoverMultipleSpecies(updatedState.discoveredSpecies, speciesIds)
        if (newDiscovered !== updatedState.discoveredSpecies) {
          setGameState(this, updateDiscoveredSpecies(updatedState, newDiscovered))
          EventBus.emit(GAME_EVENTS.BESTIARY_UPDATED, {
            discovered: newDiscovered,
            newCount: newDiscovered.length - updatedState.discoveredSpecies.length,
          })
        }
      }
    } catch {
      // No game state
    }

    // Victory flash
    this.cameras.main.flash(300, 255, 255, 200)

    const lootMsg = loot.length > 0
      ? ` Found: ${loot.map((d) => `${d.itemId} x${d.quantity}`).join(', ')}`
      : ''

    this.hud.hideCommandMenu()

    // For boss battles, show defeat dialog before victory message
    if (isBoss && this.bossData!.defeatDialog.length > 0) {
      this.showBossDefeatDialog()
    } else {
      this.showVictoryMessage(rewards, loot, lootMsg)
    }
  }

  private showBossDefeatDialog(): void {
    if (!this.bossData) return

    const bossRewards = this.bossData.rewards
    const rewards = { experience: bossRewards.experience, gold: bossRewards.gold }
    const loot = bossRewards.guaranteedItems

    // Show defeat dialog via dialog scene
    this.scene.launch(SCENE_KEYS.DIALOG, {
      dialogTreeId: null,
      messages: this.bossData.defeatDialog,
      npcName: this.bossData.name,
      npcType: 'quest',
      parentSceneKey: SCENE_KEYS.BATTLE,
    })

    this.scene.pause()

    this.events.once('resume', () => {
      const lootMsg = loot.length > 0
        ? ` Found: ${loot.map((d) => `${d.itemId} x${d.quantity}`).join(', ')}`
        : ''

      this.showVictoryMessage(rewards, loot, lootMsg)
    })
  }

  private showVictoryMessage(
    rewards: { experience: number; gold: number },
    loot: ReadonlyArray<ItemDrop>,
    lootMsg: string,
  ): void {
    const isBoss = this.isBossBattle && this.bossData
    const victoryMsg = isBoss
      ? `${this.bossData!.name} defeated! Gained ${rewards.experience} XP and ${rewards.gold} gold!${lootMsg}`
      : `Victory! Gained ${rewards.experience} XP and ${rewards.gold} gold!${lootMsg}`

    this.hud.showMessage(victoryMsg).then(() => {
      this.time.delayedCall(1000, () => {
        EventBus.emit(GAME_EVENTS.BATTLE_VICTORY, { rewards })
        EventBus.emit(GAME_EVENTS.BATTLE_END, { result: 'victory' })

        this.cameras.main.fadeOut(500)
        this.cameras.main.once('camerafadeoutcomplete', () => {
          // Store data before cleanUp() clears it
          const returnPosition = this.playerPosition ?? undefined
          const bossInfo = this.bossData
          this.cleanUp()

          // For boss battles, pass boss-specific data
          if (isBoss && bossInfo) {
            this.scene.start(SCENE_KEYS.WORLD, {
              newGame: false,
              battleResult: 'victory',
              rewards,
              loot,
              spawnPosition: returnPosition,
              bossDefeated: bossInfo.bossId,
              bossRewards: {
                experience: bossInfo.rewards.experience,
                gold: bossInfo.rewards.gold,
                items: bossInfo.rewards.guaranteedItems,
                unlocksArea: bossInfo.rewards.unlocksArea,
              },
            })
          } else {
            this.scene.start(SCENE_KEYS.WORLD, {
              newGame: false,
              battleResult: 'victory',
              rewards,
              loot,
              spawnPosition: returnPosition,
            })
          }
        })
      })
    })
  }

  private handleDefeat(): void {
    this.phase = 'defeat'

    this.cameras.main.shake(500, 0.02)

    this.hud.hideCommandMenu()
    this.hud.showMessage('Your party was defeated...').then(() => {
      this.time.delayedCall(1500, () => {
        EventBus.emit(GAME_EVENTS.BATTLE_END, { result: 'defeat' })

        this.cameras.main.fadeOut(800, 0, 0, 0)
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.cleanUp()
          this.scene.start(SCENE_KEYS.TITLE)
        })
      })
    })
  }

  private handleFlee(): void {
    this.phase = 'fled'

    this.hud.hideCommandMenu()
    this.hud.showMessage('Got away safely!').then(() => {
      this.time.delayedCall(500, () => {
        EventBus.emit(GAME_EVENTS.BATTLE_END, { result: 'fled' })

        this.cameras.main.fadeOut(300)
        this.cameras.main.once('camerafadeoutcomplete', () => {
          // Store position before cleanUp() clears it
          const returnPosition = this.playerPosition ?? undefined
          this.cleanUp()
          this.scene.start(SCENE_KEYS.WORLD, {
            newGame: false,
            battleResult: 'fled',
            spawnPosition: returnPosition,
          })
        })
      })
    })
  }

  private findSprite(combatantId: string): BattleSprite | undefined {
    const playerIndex = this.battle.playerSquad.findIndex((c) => c.combatantId === combatantId)
    if (playerIndex >= 0) return this.playerSprites[playerIndex]

    const enemyIndex = this.battle.enemySquad.findIndex((c) => c.combatantId === combatantId)
    if (enemyIndex >= 0) return this.enemySprites[enemyIndex]

    return undefined
  }

  private findCurrentCombatant(combatantId: string): BattleCombatant | undefined {
    return (
      this.battle.playerSquad.find((c) => c.combatantId === combatantId) ??
      this.battle.enemySquad.find((c) => c.combatantId === combatantId)
    )
  }

  private guessEnemyElement(enemy: BattleCombatant): MonsterElement {
    for (const ability of enemy.abilities) {
      if (ability.element !== 'neutral') return ability.element
    }
    return 'neutral'
  }

  private getElementColor(element: MonsterElement): number {
    const colors: Record<MonsterElement, number> = {
      fire: 0xef5350,
      water: 0x42a5f5,
      earth: 0x8d6e63,
      wind: 0x66bb6a,
      light: 0xffd54f,
      dark: 0x7e57c2,
      neutral: 0xbdbdbd,
    }
    return colors[element]
  }

  private cleanUp(): void {
    this.hud.destroy()
    this.playerSprites = []
    this.enemySprites = []
    this.currentTurnIndex = 0
    this.isBossBattle = false
    this.bossData = null
    this.playerPosition = null
    this.pendingAction = null
    this.lastTargetedEnemyId = null
    this.lastCommandTime = 0
    this.lastCommandChoice = null
    this.lastCommandAbilityId = null
  }
}
