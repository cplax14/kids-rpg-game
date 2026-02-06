import Phaser from 'phaser'
import { DEPTH, COLORS, TEXT_STYLES } from '../../config'

// Base button size (will be adjusted for zoom)
const BASE_BUTTON_SIZE = 35

export interface ActionButtonConfig {
  readonly label?: string
  readonly x?: number
  readonly y?: number
  readonly zoom?: number
}

/**
 * Virtual action button for touch controls
 * By default positioned in bottom-right corner of the screen
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

    // Handle both old signature (string) and new signature (config)
    if (typeof config === 'string') {
      this.label = config
      this.buttonSize = BASE_BUTTON_SIZE
      // Default position in bottom-right with padding
      const padding = 20
      const x = scene.scale.width - padding - this.buttonSize / 2
      const y = scene.scale.height - padding - this.buttonSize / 2
      this.container = scene.add.container(x, y)
    } else {
      const zoom = config.zoom ?? 1
      this.label = config.label ?? 'A'
      this.buttonSize = BASE_BUTTON_SIZE / zoom

      const visibleWidth = scene.scale.width / zoom
      const visibleHeight = scene.scale.height / zoom
      const padding = 20 / zoom

      const x = config.x ?? visibleWidth - padding - this.buttonSize / 2
      const y = config.y ?? visibleHeight - padding - this.buttonSize / 2
      this.container = scene.add.container(x, y)
    }

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
    const fontSize = Math.round(this.buttonSize * 0.5)
    const text = this.scene.add.text(0, 0, this.label, {
      ...TEXT_STYLES.BUTTON,
      fontSize: `${fontSize}px`,
      color: '#ffffff',
    })
    text.setOrigin(0.5)
    this.container.add(text)
  }

  private drawButton(pressed: boolean): void {
    this.background.clear()

    // Outer glow when pressed
    if (pressed) {
      this.background.fillStyle(COLORS.SUCCESS, 0.3)
      this.background.fillCircle(0, 0, this.buttonSize / 2 + 3)
    }

    // Main button
    this.background.fillStyle(pressed ? COLORS.SUCCESS : COLORS.PRIMARY, pressed ? 0.9 : 0.7)
    this.background.fillCircle(0, 0, this.buttonSize / 2)

    // Border
    this.background.lineStyle(2, COLORS.WHITE, pressed ? 0.9 : 0.5)
    this.background.strokeCircle(0, 0, this.buttonSize / 2)
  }

  private setupInput(): void {
    // Create hit area
    const hitArea = this.scene.add.circle(0, 0, this.buttonSize / 2 + 5)
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
