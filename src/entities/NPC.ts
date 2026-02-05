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

// Frame indices from characters-sheet for each NPC type (12 cols per row)
// Using idle frame (index 1) from different character rows
const NPC_FRAMES: Readonly<Record<NpcType, number>> = {
  shop: 13,     // Row 1, idle frame
  healer: 25,   // Row 2, idle frame
  info: 37,     // Row 3, idle frame
  breeder: 49,  // Row 4, idle frame
  quest: 61,    // Row 5, idle frame
}

const NPC_SCALE = 3
const INTERACTION_RADIUS = 2 * TILE_SIZE

export type QuestIndicatorType = 'available' | 'ready' | 'in_progress' | 'none'

export class NPC {
  private readonly scene: Phaser.Scene
  private readonly sprite: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite
  private readonly nameLabel: Phaser.GameObjects.Text
  private readonly promptText: Phaser.GameObjects.Text
  private readonly interactionZone: Phaser.GameObjects.Zone
  private readonly definition: NpcDefinition
  private questIndicator: Phaser.GameObjects.Text | null = null
  private questIndicatorTween: Phaser.Tweens.Tween | null = null
  private currentIndicatorType: QuestIndicatorType = 'none'

  constructor(scene: Phaser.Scene, x: number, y: number, definition: NpcDefinition) {
    this.scene = scene
    this.definition = definition

    const hasCharacterSheet = scene.textures.exists('characters-sheet')

    if (hasCharacterSheet) {
      // Use real sprite from character sheet
      const frameIndex = NPC_FRAMES[definition.type]
      this.sprite = scene.add.sprite(x, y, 'characters-sheet', frameIndex)
      this.sprite.setScale(NPC_SCALE)
    } else {
      // Fallback to colored rectangle
      const color = NPC_COLORS[definition.type]
      this.sprite = scene.add.rectangle(x, y, 28, 28, color)
      ;(this.sprite as Phaser.GameObjects.Rectangle).setStrokeStyle(2, 0xffffff, 0.8)
    }
    this.sprite.setDepth(DEPTH.PLAYER)

    // Name label above
    this.nameLabel = scene.add.text(x, y - 24, definition.name, {
      ...TEXT_STYLES.SMALL,
      fontSize: '11px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    })
    this.nameLabel.setOrigin(0.5)
    this.nameLabel.setDepth(DEPTH.ABOVE_PLAYER)

    // "Press E" prompt (hidden by default)
    this.promptText = scene.add.text(x, y - 38, 'Press E', {
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
    const y = this.sprite.y - 40

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
