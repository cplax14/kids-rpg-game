import Phaser from 'phaser'
import type { NpcDefinition, NpcType } from '../models/types'
import { DEPTH, TILE_SIZE, TEXT_STYLES } from '../config'

const NPC_COLORS: Readonly<Record<NpcType, number>> = {
  shop: 0xffd54f,
  healer: 0xef5350,
  info: 0x66bb6a,
  breeder: 0x7e57c2,
  quest: 0x42a5f5,
}

const INTERACTION_RADIUS = 2 * TILE_SIZE

export class NPC {
  private readonly sprite: Phaser.GameObjects.Rectangle
  private readonly nameLabel: Phaser.GameObjects.Text
  private readonly promptText: Phaser.GameObjects.Text
  private readonly interactionZone: Phaser.GameObjects.Zone
  private readonly definition: NpcDefinition

  constructor(scene: Phaser.Scene, x: number, y: number, definition: NpcDefinition) {
    this.definition = definition

    const color = NPC_COLORS[definition.type]

    // Create colored rectangle sprite
    this.sprite = scene.add.rectangle(x, y, 28, 28, color)
    this.sprite.setDepth(DEPTH.PLAYER)
    this.sprite.setStrokeStyle(2, 0xffffff, 0.8)

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

  destroy(): void {
    this.sprite.destroy()
    this.nameLabel.destroy()
    this.promptText.destroy()
    this.interactionZone.destroy()
  }
}
