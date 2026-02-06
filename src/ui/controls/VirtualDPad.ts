import Phaser from 'phaser'
import { DEPTH, COLORS } from '../../config'

export interface DPadState {
  readonly up: boolean
  readonly down: boolean
  readonly left: boolean
  readonly right: boolean
}

// Base sizes (will be adjusted for zoom)
const BASE_DPAD_SIZE = 80
const BASE_BUTTON_SIZE = 25
const BASE_DEAD_ZONE = 8

/**
 * Virtual D-Pad for touch controls
 * Positioned in bottom-left corner of the screen
 */
export class VirtualDPad {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private centerX: number
  private centerY: number
  private activePointer: Phaser.Input.Pointer | null = null
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

  constructor(scene: Phaser.Scene, zoom: number = 1) {
    this.scene = scene

    // Adjust sizes for zoom (smaller in world coords = normal size on screen)
    this.dpadSize = BASE_DPAD_SIZE / zoom
    this.buttonSize = BASE_BUTTON_SIZE / zoom
    this.deadZone = BASE_DEAD_ZONE / zoom

    // Get visible area based on zoom
    const visibleWidth = scene.scale.width / zoom
    const visibleHeight = scene.scale.height / zoom

    // Position in bottom-left with padding
    const padding = 15 / zoom
    this.centerX = padding + this.dpadSize / 2
    this.centerY = visibleHeight - padding - this.dpadSize / 2

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
    const btnOffset = this.dpadSize / 2 - this.buttonSize / 2 - 5

    // Up button
    this.upBtn = this.createDirectionButton(
      this.centerX,
      this.centerY - btnOffset,
      '▲',
    )

    // Down button
    this.downBtn = this.createDirectionButton(
      this.centerX,
      this.centerY + btnOffset,
      '▼',
    )

    // Left button
    this.leftBtn = this.createDirectionButton(
      this.centerX - btnOffset,
      this.centerY,
      '◀',
    )

    // Right button
    this.rightBtn = this.createDirectionButton(
      this.centerX + btnOffset,
      this.centerY,
      '▶',
    )
  }

  private createDirectionButton(
    x: number,
    y: number,
    _symbol: string,
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
    const dx = pointerX - this.centerX
    const dy = pointerY - this.centerY

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
    const btnOffset = this.dpadSize / 2 - this.buttonSize / 2 - 5

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
