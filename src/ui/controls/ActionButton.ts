import Phaser from 'phaser'
import { DEPTH, COLORS, TEXT_STYLES } from '../../config'

// Base sizes (will be scaled based on screen size)
const BASE_BUTTON_RADIUS = 30
const BASE_PADDING = 20
const BASE_SPACING = 70

export type ButtonPosition = 'primary' | 'secondary' | 'tertiary'

export interface ActionButtonConfig {
  readonly label?: string
  readonly position?: ButtonPosition  // primary=bottom-right, secondary=above primary, tertiary=left of primary
}

/**
 * Virtual action button for touch controls
 * Dynamically positions based on actual viewport size
 */
export class ActionButton {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private background!: Phaser.GameObjects.Graphics
  private textObj!: Phaser.GameObjects.Text
  private hitArea!: Phaser.GameObjects.Arc
  private isPressed: boolean = false
  private justPressed: boolean = false
  private label: string
  private position: ButtonPosition

  // Current sizing (scales with screen)
  private buttonRadius: number = BASE_BUTTON_RADIUS
  private padding: number = BASE_PADDING
  private spacing: number = BASE_SPACING

  constructor(scene: Phaser.Scene, config: ActionButtonConfig | string = 'A') {
    this.scene = scene

    // Handle both old signature (string) and new signature (config)
    if (typeof config === 'string') {
      this.label = config
      this.position = 'primary'
    } else {
      this.label = config.label ?? 'A'
      this.position = config.position ?? 'primary'
    }

    // Create container (position will be set in updatePosition)
    this.container = scene.add.container(0, 0)
    this.container.setDepth(DEPTH.UI + 100)
    this.container.setScrollFactor(0)

    this.createVisuals()
    this.setupInput()

    // Initial position
    this.updatePosition()

    // Listen for resize events
    scene.scale.on('resize', this.updatePosition, this)
  }

  private updatePosition(): void {
    // Get the camera viewport
    const camera = this.scene.cameras.main
    const viewWidth = camera.width
    const viewHeight = camera.height

    // Calculate scale factor
    const scaleFactor = Math.min(viewWidth / 640, viewHeight / 360)

    // Scale button size (with min/max bounds)
    this.buttonRadius = Math.max(25, Math.min(35, BASE_BUTTON_RADIUS * scaleFactor))
    this.padding = Math.max(15, Math.min(25, BASE_PADDING * scaleFactor))
    this.spacing = Math.max(55, Math.min(80, BASE_SPACING * scaleFactor))

    // Calculate base position (bottom-right)
    const baseX = viewWidth - this.padding - this.buttonRadius
    const baseY = viewHeight - this.padding - this.buttonRadius

    // Position based on button role
    let x: number
    let y: number

    switch (this.position) {
      case 'primary':
        // Bottom-right corner (A button)
        x = baseX
        y = baseY
        break
      case 'secondary':
        // Above primary (Menu button)
        x = baseX
        y = baseY - this.spacing
        break
      case 'tertiary':
        // Left of primary (X/Cancel button)
        x = baseX - this.spacing
        y = baseY
        break
      default:
        x = baseX
        y = baseY
    }

    this.container.setPosition(x, y)

    // Update visuals with new size
    this.drawButton(false)
    this.updateTextSize()
    this.updateHitArea()
  }

  private createVisuals(): void {
    // Button background
    this.background = this.scene.add.graphics()
    this.background.setScrollFactor(0)
    this.container.add(this.background)

    // Button label
    this.textObj = this.scene.add.text(0, 0, this.label, {
      ...TEXT_STYLES.BUTTON,
      fontSize: '20px',
      color: '#ffffff',
    })
    this.textObj.setOrigin(0.5)
    this.textObj.setScrollFactor(0)
    this.container.add(this.textObj)
  }

  private updateTextSize(): void {
    // Scale font size with button
    const fontSize = Math.max(16, Math.min(24, Math.floor(this.buttonRadius * 0.7)))
    this.textObj.setFontSize(fontSize)
  }

  private drawButton(pressed: boolean): void {
    this.background.clear()

    // Outer glow when pressed
    if (pressed) {
      this.background.fillStyle(COLORS.SUCCESS, 0.3)
      this.background.fillCircle(0, 0, this.buttonRadius + 5)
    }

    // Main button
    this.background.fillStyle(pressed ? COLORS.SUCCESS : COLORS.PRIMARY, pressed ? 0.9 : 0.7)
    this.background.fillCircle(0, 0, this.buttonRadius)

    // Border
    this.background.lineStyle(3, COLORS.WHITE, pressed ? 0.9 : 0.5)
    this.background.strokeCircle(0, 0, this.buttonRadius)
  }

  private setupInput(): void {
    // Create hit area
    this.hitArea = this.scene.add.circle(0, 0, this.buttonRadius + 10, 0x000000, 0)
    this.hitArea.setScrollFactor(0)
    this.hitArea.setInteractive()
    this.container.add(this.hitArea)

    this.hitArea.on('pointerdown', () => {
      this.isPressed = true
      this.justPressed = true
      this.drawButton(true)
    })

    this.hitArea.on('pointerup', () => {
      this.isPressed = false
      this.drawButton(false)
    })

    this.hitArea.on('pointerout', () => {
      this.isPressed = false
      this.drawButton(false)
    })
  }

  private updateHitArea(): void {
    const hitRadius = this.buttonRadius + 8
    this.hitArea.setRadius(hitRadius)
    this.hitArea.setInteractive(new Phaser.Geom.Circle(0, 0, hitRadius), Phaser.Geom.Circle.Contains)
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
    this.scene.scale.off('resize', this.updatePosition, this)
    this.container.destroy()
  }
}
