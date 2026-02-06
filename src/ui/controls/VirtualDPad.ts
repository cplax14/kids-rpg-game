import Phaser from 'phaser'
import { DEPTH, COLORS } from '../../config'

export interface DPadState {
  readonly up: boolean
  readonly down: boolean
  readonly left: boolean
  readonly right: boolean
}

// Screen pixel sizes (not affected by zoom)
const DPAD_RADIUS = 80
const BUTTON_RADIUS = 30
const PADDING = 30

// With camera zoom 2, only the center 640x360 of the 1280x720 canvas is visible
// scrollFactor(0) positions are in canvas coordinates, so we need to offset
const GAME_WIDTH = 1280
const GAME_HEIGHT = 720
const ZOOM = 2
const VISIBLE_WIDTH = GAME_WIDTH / ZOOM   // 640
const VISIBLE_HEIGHT = GAME_HEIGHT / ZOOM // 360
const OFFSET_X = (GAME_WIDTH - VISIBLE_WIDTH) / 2   // 320
const OFFSET_Y = (GAME_HEIGHT - VISIBLE_HEIGHT) / 2 // 180

/**
 * Virtual D-Pad for touch controls
 * Positioned in bottom-left corner of the screen
 * Uses 4 separate hit zones for reliable direction detection
 */
export class VirtualDPad {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container

  private state: DPadState = {
    up: false,
    down: false,
    left: false,
    right: false,
  }

  // Visual elements
  private background!: Phaser.GameObjects.Graphics
  private upBtn!: Phaser.GameObjects.Graphics
  private downBtn!: Phaser.GameObjects.Graphics
  private leftBtn!: Phaser.GameObjects.Graphics
  private rightBtn!: Phaser.GameObjects.Graphics

  // Hit zones for each direction
  private upZone!: Phaser.GameObjects.Arc
  private downZone!: Phaser.GameObjects.Arc
  private leftZone!: Phaser.GameObjects.Arc
  private rightZone!: Phaser.GameObjects.Arc

  constructor(scene: Phaser.Scene) {
    this.scene = scene

    // Canvas position for rendering (with zoom offset)
    // D-pad center in bottom-left of visible area
    const centerX = OFFSET_X + PADDING + DPAD_RADIUS
    const centerY = OFFSET_Y + VISIBLE_HEIGHT - PADDING - DPAD_RADIUS

    // Create container at the center position
    this.container = scene.add.container(centerX, centerY)
    this.container.setDepth(DEPTH.UI + 100)
    this.container.setScrollFactor(0)

    this.createVisuals()
    this.setupDirectionZones()
  }

  private createVisuals(): void {
    // Semi-transparent background circle - draw at (0, 0) relative to container
    this.background = this.scene.add.graphics()
    this.background.setScrollFactor(0)
    this.background.fillStyle(COLORS.DARK_BG, 0.6)
    this.background.fillCircle(0, 0, DPAD_RADIUS)
    this.background.lineStyle(3, COLORS.PRIMARY, 0.5)
    this.background.strokeCircle(0, 0, DPAD_RADIUS)
    this.container.add(this.background)

    // Direction buttons offset from center
    const btnOffset = DPAD_RADIUS - BUTTON_RADIUS - 5

    // Up button
    this.upBtn = this.createDirectionButton(0, -btnOffset)

    // Down button
    this.downBtn = this.createDirectionButton(0, btnOffset)

    // Left button
    this.leftBtn = this.createDirectionButton(-btnOffset, 0)

    // Right button
    this.rightBtn = this.createDirectionButton(btnOffset, 0)
  }

  private createDirectionButton(x: number, y: number): Phaser.GameObjects.Graphics {
    const btn = this.scene.add.graphics()
    btn.setScrollFactor(0)
    btn.fillStyle(COLORS.PRIMARY, 0.5)
    btn.fillCircle(x, y, BUTTON_RADIUS)
    btn.lineStyle(2, COLORS.WHITE, 0.3)
    btn.strokeCircle(x, y, BUTTON_RADIUS)
    this.container.add(btn)
    return btn
  }

  private setupDirectionZones(): void {
    // Create 4 separate interactive hit zones for each direction
    // Position them at the same offsets as the visual buttons
    const btnOffset = DPAD_RADIUS - BUTTON_RADIUS - 5
    const hitRadius = BUTTON_RADIUS + 10 // Slightly larger for easier touch

    // Up zone
    this.upZone = this.scene.add.circle(0, -btnOffset, hitRadius, 0x000000, 0)
    this.upZone.setScrollFactor(0)
    this.upZone.setInteractive()
    this.container.add(this.upZone)
    this.setupZoneEvents(this.upZone, 'up')

    // Down zone
    this.downZone = this.scene.add.circle(0, btnOffset, hitRadius, 0x000000, 0)
    this.downZone.setScrollFactor(0)
    this.downZone.setInteractive()
    this.container.add(this.downZone)
    this.setupZoneEvents(this.downZone, 'down')

    // Left zone
    this.leftZone = this.scene.add.circle(-btnOffset, 0, hitRadius, 0x000000, 0)
    this.leftZone.setScrollFactor(0)
    this.leftZone.setInteractive()
    this.container.add(this.leftZone)
    this.setupZoneEvents(this.leftZone, 'left')

    // Right zone
    this.rightZone = this.scene.add.circle(btnOffset, 0, hitRadius, 0x000000, 0)
    this.rightZone.setScrollFactor(0)
    this.rightZone.setInteractive()
    this.container.add(this.rightZone)
    this.setupZoneEvents(this.rightZone, 'right')
  }

  private setupZoneEvents(zone: Phaser.GameObjects.Arc, direction: 'up' | 'down' | 'left' | 'right'): void {
    zone.on('pointerdown', () => {
      this.setDirection(direction, true)
    })

    zone.on('pointerup', () => {
      this.setDirection(direction, false)
    })

    zone.on('pointerout', () => {
      this.setDirection(direction, false)
    })

    // Handle entering from another zone while pointer is down
    zone.on('pointerover', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        this.setDirection(direction, true)
      }
    })
  }

  private setDirection(direction: 'up' | 'down' | 'left' | 'right', active: boolean): void {
    this.state = {
      ...this.state,
      [direction]: active,
    }
    this.updateVisuals()
  }

  private updateVisuals(): void {
    const btnOffset = DPAD_RADIUS - BUTTON_RADIUS - 5

    // Update each button's appearance based on state
    this.drawButton(this.upBtn, 0, -btnOffset, this.state.up)
    this.drawButton(this.downBtn, 0, btnOffset, this.state.down)
    this.drawButton(this.leftBtn, -btnOffset, 0, this.state.left)
    this.drawButton(this.rightBtn, btnOffset, 0, this.state.right)
  }

  private drawButton(
    btn: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    active: boolean,
  ): void {
    btn.clear()
    btn.fillStyle(COLORS.PRIMARY, active ? 0.9 : 0.5)
    btn.fillCircle(x, y, BUTTON_RADIUS)
    btn.lineStyle(2, COLORS.WHITE, active ? 0.9 : 0.3)
    btn.strokeCircle(x, y, BUTTON_RADIUS)
  }

  getState(): DPadState {
    return this.state
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible)
  }

  setAlpha(alpha: number): void {
    this.container.setAlpha(alpha)
  }

  destroy(): void {
    this.container.destroy()
  }
}
