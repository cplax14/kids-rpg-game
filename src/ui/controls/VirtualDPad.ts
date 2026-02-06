import Phaser from 'phaser'
import { DEPTH, COLORS } from '../../config'

export interface DPadState {
  readonly up: boolean
  readonly down: boolean
  readonly left: boolean
  readonly right: boolean
}

// Visual sizes in screen pixels (will be adjusted for zoom)
const SCREEN_DPAD_SIZE = 160
const SCREEN_BUTTON_SIZE = 50
const SCREEN_PADDING = 30
const SCREEN_DEAD_ZONE = 15

/**
 * Virtual D-Pad for touch controls
 * Positioned in bottom-left corner of the screen
 * Handles camera zoom by dividing coordinates appropriately
 */
export class VirtualDPad {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private centerX: number
  private centerY: number
  private activePointer: Phaser.Input.Pointer | null = null

  // Scaled sizes for world coordinates
  private dpadSize: number
  private buttonSize: number
  private deadZone: number

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

  constructor(scene: Phaser.Scene) {
    this.scene = scene

    // Get camera zoom to convert screen pixels to world coordinates
    const zoom = scene.cameras.main.zoom

    // Convert screen sizes to world coordinates (divide by zoom)
    this.dpadSize = SCREEN_DPAD_SIZE / zoom
    this.buttonSize = SCREEN_BUTTON_SIZE / zoom
    this.deadZone = SCREEN_DEAD_ZONE / zoom
    const padding = SCREEN_PADDING / zoom

    // Calculate center position in world coordinates
    // For scrollFactor(0), we need to position relative to camera viewport
    this.centerX = padding + this.dpadSize / 2
    this.centerY = (scene.scale.height / zoom) - padding - this.dpadSize / 2

    console.log('[VirtualDPad] Zoom:', zoom)
    console.log('[VirtualDPad] Center position:', this.centerX, this.centerY)
    console.log('[VirtualDPad] D-pad size:', this.dpadSize)

    this.container = scene.add.container(0, 0)
    this.container.setDepth(DEPTH.UI + 50)
    this.container.setScrollFactor(0)

    this.createVisuals()
    this.setupInput()
  }

  private createVisuals(): void {
    // Semi-transparent background circle
    this.background = this.scene.add.graphics()
    this.background.fillStyle(COLORS.DARK_BG, 0.5)
    this.background.fillCircle(this.centerX, this.centerY, this.dpadSize / 2)
    this.background.lineStyle(2, COLORS.PRIMARY, 0.3)
    this.background.strokeCircle(this.centerX, this.centerY, this.dpadSize / 2)
    this.container.add(this.background)

    // Direction buttons
    const btnOffset = this.dpadSize / 2 - this.buttonSize / 2 - (10 / this.scene.cameras.main.zoom)

    // Up button
    this.upBtn = this.createDirectionButton(
      this.centerX,
      this.centerY - btnOffset,
    )

    // Down button
    this.downBtn = this.createDirectionButton(
      this.centerX,
      this.centerY + btnOffset,
    )

    // Left button
    this.leftBtn = this.createDirectionButton(
      this.centerX - btnOffset,
      this.centerY,
    )

    // Right button
    this.rightBtn = this.createDirectionButton(
      this.centerX + btnOffset,
      this.centerY,
    )
  }

  private createDirectionButton(
    x: number,
    y: number,
  ): Phaser.GameObjects.Graphics {
    const btn = this.scene.add.graphics()
    btn.fillStyle(COLORS.PRIMARY, 0.4)
    btn.fillCircle(x, y, this.buttonSize / 2)
    this.container.add(btn)
    return btn
  }

  private setupInput(): void {
    // Create invisible hit area covering the D-pad
    const hitArea = this.scene.add.circle(
      this.centerX,
      this.centerY,
      this.dpadSize / 2,
    )
    hitArea.setInteractive()
    hitArea.setScrollFactor(0)
    this.container.add(hitArea)

    // Track touch/pointer on the D-pad
    hitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.activePointer = pointer
      this.updateState(pointer.x, pointer.y)
    })

    hitArea.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.activePointer === pointer) {
        this.updateState(pointer.x, pointer.y)
      }
    })

    hitArea.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.activePointer === pointer) {
        this.activePointer = null
        this.resetState()
      }
    })

    hitArea.on('pointerout', (pointer: Phaser.Input.Pointer) => {
      if (this.activePointer === pointer) {
        this.activePointer = null
        this.resetState()
      }
    })

    // Also handle global pointer up in case finger moves off screen
    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.activePointer === pointer) {
        this.activePointer = null
        this.resetState()
      }
    })
  }

  private updateState(pointerX: number, pointerY: number): void {
    // Pointer coordinates need to be converted to world space for comparison
    const zoom = this.scene.cameras.main.zoom
    const worldX = pointerX / zoom
    const worldY = pointerY / zoom

    const dx = worldX - this.centerX
    const dy = worldY - this.centerY

    // Calculate direction based on pointer position relative to center
    const newState: DPadState = {
      up: dy < -this.deadZone,
      down: dy > this.deadZone,
      left: dx < -this.deadZone,
      right: dx > this.deadZone,
    }

    this.state = newState
    this.updateVisuals()
  }

  private resetState(): void {
    this.state = {
      up: false,
      down: false,
      left: false,
      right: false,
    }
    this.updateVisuals()
  }

  private updateVisuals(): void {
    const btnOffset = this.dpadSize / 2 - this.buttonSize / 2 - (10 / this.scene.cameras.main.zoom)

    // Update each button's appearance based on state
    this.drawButton(this.upBtn, this.centerX, this.centerY - btnOffset, this.state.up)
    this.drawButton(this.downBtn, this.centerX, this.centerY + btnOffset, this.state.down)
    this.drawButton(this.leftBtn, this.centerX - btnOffset, this.centerY, this.state.left)
    this.drawButton(this.rightBtn, this.centerX + btnOffset, this.centerY, this.state.right)
  }

  private drawButton(
    btn: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    active: boolean,
  ): void {
    btn.clear()
    btn.fillStyle(COLORS.PRIMARY, active ? 0.8 : 0.4)
    btn.fillCircle(x, y, this.buttonSize / 2)

    if (active) {
      btn.lineStyle(2, COLORS.WHITE, 0.8)
      btn.strokeCircle(x, y, this.buttonSize / 2)
    }
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
