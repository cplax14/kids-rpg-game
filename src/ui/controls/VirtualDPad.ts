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
const BUTTON_RADIUS = 25
const PADDING = 100
const DEAD_ZONE = 20

/**
 * Virtual D-Pad for touch controls
 * Positioned in bottom-left corner of the screen
 * Uses scrollFactor(0) with direct screen coordinates
 */
export class VirtualDPad {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private centerX: number
  private centerY: number
  private activePointer: Phaser.Input.Pointer | null = null

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

    // Position in bottom-left with padding (screen coordinates)
    // Use game dimensions directly - scrollFactor(0) will keep it fixed
    this.centerX = PADDING
    this.centerY = scene.scale.height - PADDING

    console.log('[VirtualDPad] Screen dimensions:', scene.scale.width, 'x', scene.scale.height)
    console.log('[VirtualDPad] Center position (screen coords):', this.centerX, this.centerY)

    // Create container at the center position
    this.container = scene.add.container(this.centerX, this.centerY)
    this.container.setDepth(DEPTH.UI + 100)
    this.container.setScrollFactor(0)

    this.createVisuals()
    this.setupInput()
  }

  private createVisuals(): void {
    // Semi-transparent background circle - draw at (0, 0) relative to container
    this.background = this.scene.add.graphics()
    this.background.fillStyle(COLORS.DARK_BG, 0.6)
    this.background.fillCircle(0, 0, DPAD_RADIUS)
    this.background.lineStyle(3, COLORS.PRIMARY, 0.5)
    this.background.strokeCircle(0, 0, DPAD_RADIUS)
    this.container.add(this.background)

    // Direction buttons offset from center
    const btnOffset = DPAD_RADIUS - BUTTON_RADIUS - 10

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
    btn.fillStyle(COLORS.PRIMARY, 0.5)
    btn.fillCircle(x, y, BUTTON_RADIUS)
    btn.lineStyle(2, COLORS.WHITE, 0.3)
    btn.strokeCircle(x, y, BUTTON_RADIUS)
    this.container.add(btn)
    return btn
  }

  private setupInput(): void {
    // Create invisible hit area covering the D-pad - position at (0, 0) relative to container
    const hitArea = this.scene.add.circle(0, 0, DPAD_RADIUS + 10)
    hitArea.setInteractive()
    this.container.add(hitArea)

    // Track touch/pointer on the D-pad
    hitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.activePointer = pointer
      this.updateState(pointer)
    })

    hitArea.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.activePointer === pointer) {
        this.updateState(pointer)
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

  private updateState(pointer: Phaser.Input.Pointer): void {
    // Get pointer position relative to the D-pad center
    // pointer.x/y are in screen coordinates, so we compare directly with centerX/centerY
    const dx = pointer.x - this.centerX
    const dy = pointer.y - this.centerY

    // Calculate direction based on pointer position relative to center
    const newState: DPadState = {
      up: dy < -DEAD_ZONE,
      down: dy > DEAD_ZONE,
      left: dx < -DEAD_ZONE,
      right: dx > DEAD_ZONE,
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
    const btnOffset = DPAD_RADIUS - BUTTON_RADIUS - 10

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
