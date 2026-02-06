import Phaser from 'phaser'
import { DEPTH, COLORS, TEXT_STYLES } from '../../config'

// Visual sizes in screen pixels (will be adjusted for zoom)
const SCREEN_BUTTON_SIZE = 70
const SCREEN_PADDING = 40

export interface ActionButtonConfig {
  readonly label?: string
  readonly x?: number  // If provided, in screen pixels (will be converted to world coords)
  readonly y?: number  // If provided, in screen pixels (will be converted to world coords)
}

/**
 * Virtual action button for touch controls
 * By default positioned in bottom-right corner of the screen
 * Handles camera zoom by dividing coordinates appropriately
 */
export class ActionButton {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private background!: Phaser.GameObjects.Graphics
  private isPressed: boolean = false
  private justPressed: boolean = false
  private label: string
  private buttonSize: number

  constructor(scene: Phaser.Scene, config: ActionButtonConfig | string = 'A') {
    this.scene = scene

    // Get camera zoom to convert screen pixels to world coordinates
    const zoom = scene.cameras.main.zoom

    // Handle both old signature (string) and new signature (config)
    if (typeof config === 'string') {
      this.label = config
    } else {
      this.label = config.label ?? 'A'
    }

    // Convert screen sizes to world coordinates (divide by zoom)
    this.buttonSize = SCREEN_BUTTON_SIZE / zoom
    const padding = SCREEN_PADDING / zoom

    // Calculate visible area in world coordinates
    const visibleWidth = scene.scale.width / zoom
    const visibleHeight = scene.scale.height / zoom

    // Get position (convert screen coords to world coords if provided)
    let x: number
    let y: number

    if (typeof config === 'object' && config.x !== undefined) {
      x = config.x / zoom
    } else {
      // Default: bottom-right corner
      x = visibleWidth - padding - this.buttonSize / 2
    }

    if (typeof config === 'object' && config.y !== undefined) {
      y = config.y / zoom
    } else {
      // Default: bottom-right corner
      y = visibleHeight - padding - this.buttonSize / 2
    }

    console.log('[ActionButton] Zoom:', zoom, 'Label:', this.label)
    console.log('[ActionButton] Position:', x, y)
    console.log('[ActionButton] Button size:', this.buttonSize)

    this.container = scene.add.container(x, y)
    this.container.setDepth(DEPTH.UI + 50)
    this.container.setScrollFactor(0)

    this.createVisuals()
    this.setupInput()
  }

  private createVisuals(): void {
    // Button background
    this.background = this.scene.add.graphics()
    this.drawButton(false)
    this.container.add(this.background)

    // Button label - scale font size with button size
    const fontSize = Math.round(this.buttonSize * 0.4)
    const text = this.scene.add.text(0, 0, this.label, {
      ...TEXT_STYLES.BUTTON,
      fontSize: `${fontSize}px`,
      color: '#ffffff',
    })
    text.setOrigin(0.5)
    this.container.add(text)
  }

  private drawButton(pressed: boolean): void {
    const zoom = this.scene.cameras.main.zoom
    const glowExtra = 3 / zoom

    this.background.clear()

    // Outer glow when pressed
    if (pressed) {
      this.background.fillStyle(COLORS.SUCCESS, 0.3)
      this.background.fillCircle(0, 0, this.buttonSize / 2 + glowExtra)
    }

    // Main button
    this.background.fillStyle(pressed ? COLORS.SUCCESS : COLORS.PRIMARY, pressed ? 0.9 : 0.7)
    this.background.fillCircle(0, 0, this.buttonSize / 2)

    // Border
    this.background.lineStyle(2 / zoom, COLORS.WHITE, pressed ? 0.9 : 0.5)
    this.background.strokeCircle(0, 0, this.buttonSize / 2)
  }

  private setupInput(): void {
    const zoom = this.scene.cameras.main.zoom
    // Create hit area (slightly larger for easier touch)
    const hitArea = this.scene.add.circle(0, 0, this.buttonSize / 2 + (5 / zoom))
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
    // Find and update text
    const text = this.container.getAt(1) as Phaser.GameObjects.Text
    if (text) {
      text.setText(label)
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
