import Phaser from 'phaser'
import type { NpcDefinition, NpcType } from '../models/types'
import { DEPTH, TILE_SIZE, TEXT_STYLES } from '../config'

// Fallback colors for procedural NPCs
const NPC_COLORS: Readonly<Record<NpcType, number>> = {
  shop: 0xffd54f,
  healer: 0xef5350,
  info: 0x66bb6a,
  breeder: 0x7e57c2,
  quest: 0x42a5f5,
}

// Frame indices for 32x32 character sheet (characters-32)
// Each row has 12 frames: cols 0-2 down, 3-5 up, 6-8 left, 9-11 right
// Down-facing idle is at row * 12 + 1
const NPC_FRAMES_32: Readonly<Record<NpcType, number>> = {
  shop: 14 * 12 + 1,     // Row 14 (tan merchant) = 169
  healer: 8 * 12 + 1,    // Row 8 (white robed) = 97
  info: 10 * 12 + 1,     // Row 10 (brown clothed guide) = 121
  breeder: 16 * 12 + 1,  // Row 16 (orange clothed) = 193
  quest: 4 * 12 + 1,     // Row 4 (red mage) = 49
}

// Legacy frame indices for 16x16 character sheet (characters-sheet)
const NPC_FRAMES_16: Readonly<Record<NpcType, number>> = {
  shop: 13,
  healer: 25,
  info: 37,
  breeder: 49,
  quest: 61,
}

// Animation keys for NPCs (created in PreloaderScene)
const NPC_ANIM_KEYS: Readonly<Record<NpcType, string>> = {
  shop: 'shopkeeper',
  healer: 'healer',
  info: 'village-guide',
  breeder: 'breeder',
  quest: 'village-guide', // Use guide animations for quest NPCs
}

const NPC_SCALE_32 = 1.5
const NPC_SCALE_16 = 3
const INTERACTION_RADIUS = 2 * TILE_SIZE

export type QuestIndicatorType = 'available' | 'ready' | 'in_progress' | 'none'

export class NPC {
  private readonly scene: Phaser.Scene
  private readonly sprite: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite
  private readonly nameLabel: Phaser.GameObjects.Text
  private readonly promptText: Phaser.GameObjects.Text
  private readonly interactionZone: Phaser.GameObjects.Zone
  private readonly definition: NpcDefinition
  private readonly questIndicatorOffsetY: number
  private questIndicator: Phaser.GameObjects.Text | null = null
  private questIndicatorTween: Phaser.Tweens.Tween | null = null
  private currentIndicatorType: QuestIndicatorType = 'none'

  constructor(scene: Phaser.Scene, x: number, y: number, definition: NpcDefinition) {
    this.scene = scene
    this.definition = definition

    // Prefer 32x32 sprites, fall back to 16x16, then colored rectangle
    const has32Sheet = scene.textures.exists('characters-32')
    const has16Sheet = scene.textures.exists('characters-sheet')

    let labelOffsetY: number
    let promptOffsetY: number

    if (has32Sheet) {
      // Use new 32x32 character sprites
      const frameIndex = NPC_FRAMES_32[definition.type]
      this.sprite = scene.add.sprite(x, y, 'characters-32', frameIndex)
      this.sprite.setScale(NPC_SCALE_32)
      labelOffsetY = -32
      promptOffsetY = -46
      this.questIndicatorOffsetY = -48
    } else if (has16Sheet) {
      // Fall back to 16x16 sprites
      const frameIndex = NPC_FRAMES_16[definition.type]
      this.sprite = scene.add.sprite(x, y, 'characters-sheet', frameIndex)
      this.sprite.setScale(NPC_SCALE_16)
      labelOffsetY = -24
      promptOffsetY = -38
      this.questIndicatorOffsetY = -40
    } else {
      // Fallback to colored rectangle
      const color = NPC_COLORS[definition.type]
      this.sprite = scene.add.rectangle(x, y, 28, 28, color)
      ;(this.sprite as Phaser.GameObjects.Rectangle).setStrokeStyle(2, 0xffffff, 0.8)
      labelOffsetY = -24
      promptOffsetY = -38
      this.questIndicatorOffsetY = -40
    }
    this.sprite.setDepth(DEPTH.PLAYER)

    // Name label above
    this.nameLabel = scene.add.text(x, y + labelOffsetY, definition.name, {
      ...TEXT_STYLES.SMALL,
      fontSize: '14px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    })
    this.nameLabel.setOrigin(0.5)
    this.nameLabel.setDepth(DEPTH.ABOVE_PLAYER)

    // "Press E" prompt (hidden by default)
    this.promptText = scene.add.text(x, y + promptOffsetY, 'Press E', {
      ...TEXT_STYLES.SMALL,
      fontSize: '10px',
      color: '#ffd54f',
      stroke: '#000000',
      strokeThickness: 2,
    })
    this.promptText.setOrigin(0.5)
    this.promptText.setDepth(DEPTH.ABOVE_PLAYER)
    this.promptText.setVisible(false)

    // Interaction zone
    this.interactionZone = scene.add.zone(x, y, INTERACTION_RADIUS * 2, INTERACTION_RADIUS * 2)
    scene.physics.add.existing(this.interactionZone, true)
    this.interactionZone.setDepth(DEPTH.GROUND)
  }

  showPrompt(): void {
    this.promptText.setVisible(true)
  }

  hidePrompt(): void {
    this.promptText.setVisible(false)
  }

  getInteractionZone(): Phaser.GameObjects.Zone {
    return this.interactionZone
  }

  getDialogTreeId(): string {
    return this.definition.dialogTreeId
  }

  getNpcName(): string {
    return this.definition.name
  }

  getNpcType(): NpcType {
    return this.definition.type
  }

  getNpcId(): string {
    return this.definition.npcId
  }

  getPosition(): { readonly x: number; readonly y: number } {
    return { x: this.sprite.x, y: this.sprite.y }
  }

  setQuestIndicator(type: QuestIndicatorType): void {
    // No change needed
    if (type === this.currentIndicatorType) return

    // Clean up existing indicator
    if (this.questIndicatorTween) {
      this.questIndicatorTween.stop()
      this.questIndicatorTween = null
    }
    if (this.questIndicator) {
      this.questIndicator.destroy()
      this.questIndicator = null
    }

    this.currentIndicatorType = type

    if (type === 'none') return

    const x = this.sprite.x
    const y = this.sprite.y + this.questIndicatorOffsetY

    // Create indicator text
    const symbol = type === 'available' ? '!' : '?'
    const color = type === 'in_progress' ? '#888888' : '#ffd54f'

    this.questIndicator = this.scene.add.text(x, y, symbol, {
      ...TEXT_STYLES.HEADING,
      fontSize: '20px',
      color,
      stroke: '#000000',
      strokeThickness: 3,
    })
    this.questIndicator.setOrigin(0.5)
    this.questIndicator.setDepth(DEPTH.ABOVE_PLAYER + 1)

    // Create animation based on type
    if (type === 'available') {
      // Bouncing animation for available quests
      this.questIndicatorTween = this.scene.tweens.add({
        targets: this.questIndicator,
        y: y - 6,
        duration: 400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    } else if (type === 'ready') {
      // Pulsing animation for ready to turn in
      this.questIndicatorTween = this.scene.tweens.add({
        targets: this.questIndicator,
        scale: 1.3,
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }
    // in_progress has no animation (static gray ?)
  }

  getQuestIndicatorType(): QuestIndicatorType {
    return this.currentIndicatorType
  }

  destroy(): void {
    if (this.questIndicatorTween) {
      this.questIndicatorTween.stop()
      this.questIndicatorTween = null
    }
    if (this.questIndicator) {
      this.questIndicator.destroy()
      this.questIndicator = null
    }
    this.sprite.destroy()
    this.nameLabel.destroy()
    this.promptText.destroy()
    this.interactionZone.destroy()
  }
}
