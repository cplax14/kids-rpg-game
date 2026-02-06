import Phaser from 'phaser'
import { DEPTH, COLORS, TEXT_STYLES } from '../../config'

// Screen pixel sizes
const BUTTON_RADIUS = 35
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

export interface ActionButtonConfig {
  readonly label?: string
  readonly x?: number  // Screen X coordinate
  readonly y?: number  // Screen Y coordinate
}

/**
 * Virtual action button for touch controls
 * By default positioned in bottom-right corner of the screen
 * Uses scrollFactor(0) with direct screen coordinates
 */
export class ActionButton {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private background!: Phaser.GameObjects.Graphics
  private textObj!: Phaser.GameObjects.Text
  private isPressed: boolean = false
  private justPressed: boolean = false
  private label: string

  constructor(scene: Phaser.Scene, config: ActionButtonConfig | string = 'A') {
    this.scene = scene

    // Handle both old signature (string) and new signature (config)
    if (typeof config === 'string') {
      this.label = config
    } else {
      this.label = config.label ?? 'A'
    }

    // Calculate position in CANVAS coordinates (accounting for zoom)
    // With zoom 2, visible area is center 640x360 of 1280x720 canvas
    let x: number
    let y: number

    if (typeof config === 'object' && config.x !== undefined) {
      // Custom position - assume caller is providing visible-area relative coords
      // Convert from visible area coords to canvas coords
      x = OFFSET_X + config.x
    } else {
      // Default: bottom-right corner of visible area
      x = OFFSET_X + VISIBLE_WIDTH - PADDING - BUTTON_RADIUS
    }

    if (typeof config === 'object' && config.y !== undefined) {
      // Custom position - assume caller is providing visible-area relative coords
      y = OFFSET_Y + config.y
    } else {
      // Default: bottom-right corner of visible area
      y = OFFSET_Y + VISIBLE_HEIGHT - PADDING - BUTTON_RADIUS
    }

    console.log('[ActionButton] Label:', this.label, 'Position (canvas):', x, y)

    // Create container at the screen position
    this.container = scene.add.container(x, y)
    this.container.setDepth(DEPTH.UI + 100)
    this.container.setScrollFactor(0)

    this.createVisuals()
    this.setupInput()
  }

  private createVisuals(): void {
    // Button background - draw at (0, 0) relative to container
    this.background = this.scene.add.graphics()
    this.background.setScrollFactor(0)
    this.drawButton(false)
    this.container.add(this.background)

    // Button label
    this.textObj = this.scene.add.text(0, 0, this.label, {
      ...TEXT_STYLES.BUTTON,
      fontSize: '24px',
      color: '#ffffff',
    })
    this.textObj.setOrigin(0.5)
    this.textObj.setScrollFactor(0)
    this.container.add(this.textObj)
  }

  private drawButton(pressed: boolean): void {
    this.background.clear()

    // Outer glow when pressed
    if (pressed) {
      this.background.fillStyle(COLORS.SUCCESS, 0.3)
      this.background.fillCircle(0, 0, BUTTON_RADIUS + 5)
    }

    // Main button
    this.background.fillStyle(pressed ? COLORS.SUCCESS : COLORS.PRIMARY, pressed ? 0.9 : 0.7)
    this.background.fillCircle(0, 0, BUTTON_RADIUS)

    // Border
    this.background.lineStyle(3, COLORS.WHITE, pressed ? 0.9 : 0.5)
    this.background.strokeCircle(0, 0, BUTTON_RADIUS)
  }

  private setupInput(): void {
    // Create hit area at (0, 0) relative to container
    const hitArea = this.scene.add.circle(0, 0, BUTTON_RADIUS + 10)
    hitArea.setScrollFactor(0)
    hitArea.setInteractive()
    this.container.add(hitArea)

    hitArea.on('pointerdown', () => {
      this.isPressed = true
      this.justPressed = true
      this.drawButton(true)
    })

    hitArea.on('pointerup', () => {
      this.isPressed = false
      this.drawButton(false)
    })

    hitArea.on('pointerout', () => {
      this.isPressed = false
      this.drawButton(false)
    })
  }

  /**
   * Returns true only once per press (like keyboard justPressed)
   */
  consumePress(): boolean {
    if (this.justPressed) {
      this.justPressed = false
      return true
    }
    return false
  }

  /**
   * Returns true while button is held down
   */
  isDown(): boolean {
    return this.isPressed
  }

  setLabel(label: string): void {
    this.label = label
    if (this.textObj) {
      this.textObj.setText(label)
    }
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
