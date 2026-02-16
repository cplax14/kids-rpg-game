/**
 * DefeatRecoveryScene - Shown when the player's squad is defeated
 *
 * Instead of going to the title screen and losing progress, players
 * respawn at Sunlit Village with recovery options:
 * - Paid: Pay 25% gold → full restoration
 * - Free: Keep gold, lose random half of items AND monsters (starter protected)
 *
 * Child-friendly design:
 * - "Your team needs to rest" not "Game Over"
 * - Sleeping/resting imagery, not death
 * - Clear preview of what will be lost
 * - Paid option prominently recommended
 */

import Phaser from 'phaser'
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, COLORS, DEPTH, TEXT_STYLES } from '../config'
import { getMonsterIconKey } from '../config/spriteMapping'
import type { GameState } from '../systems/GameStateManager'
import { getGameState, setGameState } from '../systems/GameStateManager'
import {
  generateRecoveryPreview,
  applyRecovery,
  RECOVERY_CONSTANTS,
  type RecoveryPreview,
  type RecoveryOptionType,
} from '../systems/RecoverySystem'
import { getItem } from '../systems/InventorySystem'
import { getSpecies } from '../systems/MonsterSystem'
import { initAudioSystem, playMusic, playSfx, MUSIC_KEYS, SFX_KEYS } from '../systems/AudioSystem'
import { EventBus } from '../events/EventBus'
import { GAME_EVENTS } from '../events/GameEvents'

interface DefeatRecoverySceneData {
  readonly gameState: GameState
  readonly defeatAreaId: string
  readonly defeatTimestamp: number
}

export class DefeatRecoveryScene extends Phaser.Scene {
  private sceneData!: DefeatRecoverySceneData
  private preview!: RecoveryPreview
  private paidButton!: Phaser.GameObjects.Container
  private freeButton!: Phaser.GameObjects.Container

  constructor() {
    super({ key: SCENE_KEYS.DEFEAT_RECOVERY })
  }

  create(data: DefeatRecoverySceneData): void {
    this.sceneData = data
    this.preview = generateRecoveryPreview(data.gameState, data.defeatTimestamp)

    // Initialize audio
    initAudioSystem(this)

    // Play gentle/sad music (reuse existing if available, or silence)
    try {
      playMusic(MUSIC_KEYS.TITLE_THEME, { fadeIn: 1000 })
    } catch {
      // Music might not be available
    }

    // Create dark overlay background
    this.createBackground()

    // Create the main UI
    this.createHeader()
    this.createRecoveryOptions()
    this.createFooterMessage()

    // Fade in
    this.cameras.main.fadeIn(500)
  }

  private createBackground(): void {
    // Dark gradient background with slight purple tint (restful, not scary)
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x2d2d44, 0x2d2d44)
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    bg.setDepth(DEPTH.GROUND)

    // Add some floating stars/sparkles (peaceful atmosphere)
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * GAME_WIDTH
      const y = Math.random() * GAME_HEIGHT * 0.5
      const alpha = 0.3 + Math.random() * 0.4
      const size = 1 + Math.random() * 2

      const star = this.add.circle(x, y, size, 0xffffff, alpha)
      star.setDepth(DEPTH.GROUND + 1)

      // Gentle twinkle animation
      this.tweens.add({
        targets: star,
        alpha: alpha * 0.3,
        duration: 1500 + Math.random() * 1000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }
  }

  private createHeader(): void {
    // Main title - child-friendly language
    const title = this.add.text(GAME_WIDTH / 2, 60, 'Oh no! Your team needs to rest...', {
      ...TEXT_STYLES.HEADING,
      fontSize: '36px',
      color: '#ffffff',
    })
    title.setOrigin(0.5)
    title.setDepth(DEPTH.UI)

    // Subtitle with reassurance
    const subtitle = this.add.text(
      GAME_WIDTH / 2,
      110,
      'A kind villager found you and brought you back to Sunlit Village!',
      {
        ...TEXT_STYLES.BODY,
        fontSize: '18px',
        color: '#aaaadd',
      },
    )
    subtitle.setOrigin(0.5)
    subtitle.setDepth(DEPTH.UI)

    // Show sleeping monster sprites
    this.createSleepingMonsters()
  }

  private createSleepingMonsters(): void {
    const squad = this.sceneData.gameState.squad
    const centerX = GAME_WIDTH / 2
    const y = 180
    const spacing = 100

    const startX = centerX - ((squad.length - 1) * spacing) / 2

    squad.forEach((monster, index) => {
      const x = startX + index * spacing
      const iconKey = getMonsterIconKey(monster.speciesId)

      if (this.textures.exists(iconKey)) {
        const sprite = this.add.sprite(x, y, iconKey)
        sprite.setScale(2.5)
        sprite.setDepth(DEPTH.UI)
        sprite.setAlpha(0.7) // Sleepy/tired look

        // Gentle sleeping bob animation
        this.tweens.add({
          targets: sprite,
          y: y + 5,
          duration: 1500 + index * 200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })

        // Add "Zzz" text
        const zzz = this.add.text(x + 25, y - 35, 'z z z', {
          fontSize: '14px',
          color: '#aaaadd',
        })
        zzz.setOrigin(0.5)
        zzz.setDepth(DEPTH.UI + 1)
        zzz.setAlpha(0.7)

        this.tweens.add({
          targets: zzz,
          y: y - 45,
          alpha: 0.3,
          duration: 2000,
          yoyo: true,
          repeat: -1,
        })
      }
    })
  }

  private createRecoveryOptions(): void {
    const optionY = 380
    const leftX = GAME_WIDTH * 0.28
    const rightX = GAME_WIDTH * 0.72

    // Create both option panels
    this.paidButton = this.createPaidOption(leftX, optionY)
    this.freeButton = this.createFreeOption(rightX, optionY)
  }

  private createPaidOption(x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y)
    container.setDepth(DEPTH.UI)

    const width = 340
    const height = 280

    // Panel background (gold border to indicate recommended)
    const bg = this.add.graphics()
    bg.fillStyle(0x2d4a2d, 1) // Green-ish background (positive)
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 16)
    bg.lineStyle(4, COLORS.GOLD)
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 16)
    container.add(bg)

    // "Recommended!" badge
    const badge = this.add.text(0, -height / 2 - 15, '⭐ Recommended!', {
      fontSize: '16px',
      fontFamily: 'Arial Black',
      color: '#ffd54f',
      stroke: '#000000',
      strokeThickness: 3,
    })
    badge.setOrigin(0.5)
    container.add(badge)

    // Title
    const title = this.add.text(0, -height / 2 + 35, 'Pay to Restore', {
      ...TEXT_STYLES.HEADING,
      fontSize: '24px',
      color: '#ffffff',
    })
    title.setOrigin(0.5)
    container.add(title)

    // Cost
    const goldCost = this.preview.paid.goldCost
    const costText = this.add.text(0, -height / 2 + 75, `Cost: ${goldCost} gold`, {
      fontSize: '20px',
      color: '#ffd54f',
    })
    costText.setOrigin(0.5)
    container.add(costText)

    // Benefits list
    const benefits = [
      '✓ Full HP & MP restored',
      '✓ Keep all your items',
      '✓ Keep all your monsters',
    ]

    benefits.forEach((benefit, i) => {
      const text = this.add.text(0, -height / 2 + 115 + i * 30, benefit, {
        fontSize: '16px',
        color: '#88ff88',
      })
      text.setOrigin(0.5)
      container.add(text)
    })

    // Action button
    const canAfford = this.preview.canAffordPaid
    const buttonColor = canAfford ? COLORS.GOLD : 0x666666
    const buttonText = canAfford ? 'PAY & WAKE UP' : 'Not Enough Gold'

    const button = this.createActionButton(0, height / 2 - 50, 200, 50, buttonText, buttonColor)
    container.add(button)

    if (canAfford) {
      button.setInteractive(
        new Phaser.Geom.Rectangle(-100, -25, 200, 50),
        Phaser.Geom.Rectangle.Contains,
      )
      button.on('pointerover', () => this.onButtonHover(button, true))
      button.on('pointerout', () => this.onButtonHover(button, false))
      button.on('pointerdown', () => this.onRecoveryChosen('paid'))
    }

    return container
  }

  private createFreeOption(x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y)
    container.setDepth(DEPTH.UI)

    const width = 340
    const height = 280

    // Panel background (darker/gray - less appealing)
    const bg = this.add.graphics()
    bg.fillStyle(0x3d2d2d, 1) // Red-ish background (warning)
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 16)
    bg.lineStyle(2, 0x888888)
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 16)
    container.add(bg)

    // Title
    const title = this.add.text(0, -height / 2 + 35, 'Free Recovery', {
      ...TEXT_STYLES.HEADING,
      fontSize: '24px',
      color: '#cccccc',
    })
    title.setOrigin(0.5)
    container.add(title)

    // Keep gold notice
    const keepGold = this.add.text(0, -height / 2 + 75, 'Keep your gold', {
      fontSize: '20px',
      color: '#aaaaaa',
    })
    keepGold.setOrigin(0.5)
    container.add(keepGold)

    // Penalties list
    const penalties: string[] = ['✗ Wake at low HP']

    // Add items to lose
    if (this.preview.free.itemsToLose.length > 0) {
      penalties.push('✗ Lose these items:')
      this.preview.free.itemsToLose.slice(0, 2).forEach((item) => {
        const itemDef = getItem(item.itemId)
        const name = itemDef?.name ?? item.itemId
        penalties.push(`   - ${name} x${item.quantity}`)
      })
      if (this.preview.free.itemsToLose.length > 2) {
        penalties.push(`   + ${this.preview.free.itemsToLose.length - 2} more...`)
      }
    }

    // Add monsters to lose
    if (this.preview.free.monstersToLose.length > 0) {
      penalties.push('✗ Lose these monsters:')
      const squad = this.sceneData.gameState.squad
      this.preview.free.monstersToLose.slice(0, 2).forEach((instanceId) => {
        const monster = squad.find((m) => m.instanceId === instanceId)
        if (monster) {
          const species = getSpecies(monster.speciesId)
          const name = monster.nickname ?? species?.name ?? monster.speciesId
          penalties.push(`   - ${name} Lv.${monster.level}`)
        }
      })
      if (this.preview.free.monstersToLose.length > 2) {
        penalties.push(`   + ${this.preview.free.monstersToLose.length - 2} more...`)
      }
    }

    // Render penalties (scrollable if needed)
    const startY = -height / 2 + 105
    const lineHeight = 22
    penalties.forEach((penalty, i) => {
      if (startY + i * lineHeight > height / 2 - 70) return // Don't overflow

      const isLoss = penalty.startsWith('✗') || penalty.startsWith('   -')
      const text = this.add.text(0, startY + i * lineHeight, penalty, {
        fontSize: '14px',
        color: isLoss ? '#ff8888' : '#aaaaaa',
      })
      text.setOrigin(0.5)
      container.add(text)
    })

    // Action button (smaller, less prominent)
    const button = this.createActionButton(0, height / 2 - 50, 160, 40, 'WAKE UP', 0x666666)
    container.add(button)

    button.setInteractive(
      new Phaser.Geom.Rectangle(-80, -20, 160, 40),
      Phaser.Geom.Rectangle.Contains,
    )
    button.on('pointerover', () => this.onButtonHover(button, true))
    button.on('pointerout', () => this.onButtonHover(button, false))
    button.on('pointerdown', () => this.onRecoveryChosen('free'))

    return container
  }

  private createActionButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    color: number,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y)

    const bg = this.add.graphics()
    bg.fillStyle(color, 1)
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 8)
    container.add(bg)

    const text = this.add.text(0, 0, label, {
      fontSize: '18px',
      fontFamily: 'Arial Black',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    })
    text.setOrigin(0.5)
    container.add(text)

    return container
  }

  private createFooterMessage(): void {
    // Reassurance about starter monster
    const footer = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT - 50,
      '💝 Your starter monster will always stay with you!',
      {
        fontSize: '18px',
        color: '#88ddff',
        stroke: '#000000',
        strokeThickness: 2,
      },
    )
    footer.setOrigin(0.5)
    footer.setDepth(DEPTH.UI)

    // Gentle pulse animation
    this.tweens.add({
      targets: footer,
      alpha: 0.7,
      duration: 1500,
      yoyo: true,
      repeat: -1,
    })
  }

  private onButtonHover(button: Phaser.GameObjects.Container, isHover: boolean): void {
    this.tweens.add({
      targets: button,
      scaleX: isHover ? 1.05 : 1,
      scaleY: isHover ? 1.05 : 1,
      duration: 100,
    })

    if (isHover) {
      playSfx(SFX_KEYS.MENU_SELECT)
    }
  }

  private onRecoveryChosen(option: RecoveryOptionType): void {
    // Prevent double-clicks
    this.paidButton.disableInteractive()
    this.freeButton.disableInteractive()

    playSfx(SFX_KEYS.MENU_CONFIRM)

    // Apply recovery to game state
    const newState = applyRecovery(
      this.sceneData.gameState,
      option,
      this.sceneData.defeatTimestamp,
    )

    // Update the game state registry
    setGameState(this, newState)

    // Emit recovery event
    EventBus.emit(GAME_EVENTS.BATTLE_END, {
      result: 'defeat',
      recoveryOption: option,
    })

    // Show brief message then transition
    const message =
      option === 'paid'
        ? 'Your team feels refreshed and ready!'
        : 'Your team wakes up tired but safe...'

    const msgText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, message, {
      fontSize: '28px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    })
    msgText.setOrigin(0.5)
    msgText.setDepth(DEPTH.OVERLAY)
    msgText.setAlpha(0)

    this.tweens.add({
      targets: msgText,
      alpha: 1,
      duration: 500,
      onComplete: () => {
        this.time.delayedCall(1500, () => {
          this.transitionToWorld()
        })
      },
    })
  }

  private transitionToWorld(): void {
    this.cameras.main.fadeOut(500)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENE_KEYS.WORLD, {
        newGame: false,
        battleResult: 'recovery',
        spawnPosition: RECOVERY_CONSTANTS.SPAWN_POSITION,
      })
    })
  }
}
