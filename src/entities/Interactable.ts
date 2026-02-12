import Phaser from 'phaser'
import type { InteractableObject, InteractableType } from '../models/types'
import { DEPTH, TILE_SIZE, TEXT_STYLES } from '../config'

const INTERACTABLE_COLORS: Readonly<Record<InteractableType, number>> = {
  chest: 0xffd54f,
  sign: 0x8d6e63,
  fountain: 0x4fc3f7,
  waypoint: 0x9c27b0,
}

const INTERACTABLE_SIZE: Readonly<Record<InteractableType, { width: number; height: number }>> = {
  chest: { width: 24, height: 20 },
  sign: { width: 20, height: 28 },
  fountain: { width: 32, height: 32 },
  waypoint: { width: 40, height: 40 },
}

const INTERACTION_RADIUS = 1.5 * TILE_SIZE

export class Interactable {
  private readonly sprite: Phaser.GameObjects.Graphics
  private readonly promptText: Phaser.GameObjects.Text
  private readonly interactionZone: Phaser.GameObjects.Zone
  private readonly definition: InteractableObject
  private isOpen: boolean = false

  constructor(scene: Phaser.Scene, definition: InteractableObject, isAlreadyUsed: boolean = false) {
    this.definition = definition
    this.isOpen = isAlreadyUsed && definition.isOneTime

    const { x, y } = definition.position
    const color = INTERACTABLE_COLORS[definition.type]
    const size = INTERACTABLE_SIZE[definition.type]

    // Create sprite graphics
    this.sprite = scene.add.graphics()
    this.drawSprite(color, size, x, y)
    this.sprite.setDepth(DEPTH.BELOW_PLAYER)

    // "Press E" prompt (hidden by default)
    this.promptText = scene.add.text(x, y - size.height - 10, 'Press E', {
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

  private drawSprite(color: number, size: { width: number; height: number }, x: number, y: number): void {
    this.sprite.clear()

    const halfW = size.width / 2
    const halfH = size.height / 2

    switch (this.definition.type) {
      case 'chest':
        this.drawChest(color, x, y, halfW, halfH)
        break
      case 'sign':
        this.drawSign(color, x, y, halfW, halfH)
        break
      case 'fountain':
        this.drawFountain(color, x, y, halfW, halfH)
        break
      case 'waypoint':
        this.drawWaypoint(color, x, y, halfW, halfH)
        break
    }
  }

  private drawChest(color: number, x: number, y: number, halfW: number, halfH: number): void {
    if (this.isOpen) {
      // Open chest - darker color, lid open
      this.sprite.fillStyle(0x8b7355, 1)
      this.sprite.fillRect(x - halfW, y - halfH + 4, halfW * 2, halfH * 2 - 4)

      // Lid (tilted back)
      this.sprite.fillStyle(0xa08060, 1)
      this.sprite.fillRect(x - halfW - 2, y - halfH - 6, halfW * 2 + 4, 8)
    } else {
      // Closed chest
      this.sprite.fillStyle(color, 1)
      this.sprite.fillRect(x - halfW, y - halfH, halfW * 2, halfH * 2)

      // Lid
      this.sprite.fillStyle(0xdaa520, 1)
      this.sprite.fillRect(x - halfW - 2, y - halfH - 2, halfW * 2 + 4, 6)

      // Lock
      this.sprite.fillStyle(0x333333, 1)
      this.sprite.fillRect(x - 3, y - 2, 6, 8)
    }

    // Border
    this.sprite.lineStyle(2, 0x333333, 0.8)
    this.sprite.strokeRect(x - halfW, y - halfH, halfW * 2, halfH * 2)
  }

  private drawSign(color: number, x: number, y: number, halfW: number, halfH: number): void {
    // Post
    this.sprite.fillStyle(0x5d4037, 1)
    this.sprite.fillRect(x - 3, y, 6, halfH)

    // Sign board
    this.sprite.fillStyle(color, 1)
    this.sprite.fillRect(x - halfW, y - halfH, halfW * 2, halfH + 4)

    // Text lines (decorative)
    this.sprite.fillStyle(0x333333, 0.6)
    this.sprite.fillRect(x - halfW + 3, y - halfH + 4, halfW * 2 - 6, 2)
    this.sprite.fillRect(x - halfW + 3, y - halfH + 10, halfW * 2 - 8, 2)

    // Border
    this.sprite.lineStyle(1, 0x4a3728, 0.8)
    this.sprite.strokeRect(x - halfW, y - halfH, halfW * 2, halfH + 4)
  }

  private drawFountain(color: number, x: number, y: number, halfW: number, halfH: number): void {
    // Base
    this.sprite.fillStyle(0x9e9e9e, 1)
    this.sprite.fillEllipse(x, y + halfH - 4, halfW * 2, halfH * 0.8)

    // Water basin
    this.sprite.fillStyle(color, 0.8)
    this.sprite.fillEllipse(x, y + halfH - 6, halfW * 1.6, halfH * 0.5)

    // Central pillar
    this.sprite.fillStyle(0xbdbdbd, 1)
    this.sprite.fillRect(x - 4, y - halfH + 4, 8, halfH)

    // Water spout (top)
    this.sprite.fillStyle(0x81d4fa, 0.9)
    this.sprite.fillCircle(x, y - halfH + 2, 6)

    // Decorative water drops
    this.sprite.fillStyle(0x4fc3f7, 0.6)
    this.sprite.fillCircle(x - 6, y - 4, 2)
    this.sprite.fillCircle(x + 6, y - 2, 2)
    this.sprite.fillCircle(x, y, 3)
  }

  private drawWaypoint(color: number, x: number, y: number, halfW: number, halfH: number): void {
    // Stone platform base
    this.sprite.fillStyle(0x5d4e37, 1)
    this.sprite.fillEllipse(x, y + halfH - 4, halfW * 1.8, halfH * 0.5)

    // Stone platform top
    this.sprite.fillStyle(0x7a6a5a, 1)
    this.sprite.fillEllipse(x, y + halfH - 8, halfW * 1.6, halfH * 0.4)

    // Outer glow ring
    this.sprite.fillStyle(color, 0.3)
    this.sprite.fillCircle(x, y - 4, halfW * 0.9)

    // Portal circle (main glow)
    this.sprite.fillStyle(color, 0.6)
    this.sprite.fillCircle(x, y - 4, halfW * 0.7)

    // Inner light core
    this.sprite.fillStyle(0xe1bee7, 0.8)
    this.sprite.fillCircle(x, y - 4, halfW * 0.4)

    // Bright center
    this.sprite.fillStyle(0xffffff, 0.9)
    this.sprite.fillCircle(x, y - 4, halfW * 0.2)

    // Sparkle particles
    this.sprite.fillStyle(0xce93d8, 0.7)
    this.sprite.fillCircle(x - 8, y - 12, 2)
    this.sprite.fillCircle(x + 10, y - 8, 2)
    this.sprite.fillCircle(x - 6, y + 4, 1.5)
    this.sprite.fillCircle(x + 8, y, 1.5)

    // Portal ring outline
    this.sprite.lineStyle(2, 0xba68c8, 0.8)
    this.sprite.strokeCircle(x, y - 4, halfW * 0.7)
  }

  showPrompt(): void {
    // Don't show prompt for already opened one-time interactables
    if (this.isOpen && this.definition.isOneTime) return
    this.promptText.setVisible(true)
  }

  hidePrompt(): void {
    this.promptText.setVisible(false)
  }

  getInteractionZone(): Phaser.GameObjects.Zone {
    return this.interactionZone
  }

  getDefinition(): InteractableObject {
    return this.definition
  }

  getObjectId(): string {
    return this.definition.objectId
  }

  getType(): InteractableType {
    return this.definition.type
  }

  getPosition(): { readonly x: number; readonly y: number } {
    return this.definition.position
  }

  isOneTime(): boolean {
    return this.definition.isOneTime
  }

  isUsed(): boolean {
    return this.isOpen
  }

  markAsUsed(): void {
    if (this.definition.type === 'chest' && !this.isOpen) {
      this.isOpen = true
      const color = INTERACTABLE_COLORS[this.definition.type]
      const size = INTERACTABLE_SIZE[this.definition.type]
      this.drawSprite(color, size, this.definition.position.x, this.definition.position.y)
    }
  }

  destroy(): void {
    this.sprite.destroy()
    this.promptText.destroy()
    this.interactionZone.destroy()
  }
}
