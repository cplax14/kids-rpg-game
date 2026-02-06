import Phaser from 'phaser'
import { DEPTH, COLORS } from '../../config'

export interface DPadState {
  readonly up: boolean
  readonly down: boolean
  readonly left: boolean
  readonly right: boolean
}

// D-pad sizing (will be scaled based on screen size)
const BASE_DPAD_RADIUS = 60
const BASE_BUTTON_RADIUS = 20
const BASE_PADDING = 15  // Base padding from edge
const MOBILE_BOTTOM_PADDING = 25  // Extra padding for mobile browser chrome
const DEAD_ZONE = 15

/**
 * Virtual D-Pad for touch controls
 * Positioned in bottom-left corner of the screen
 * Uses single hit area with direction calculation for reliable touch detection
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

  // Single hit area for the entire D-pad
  private hitArea!: Phaser.GameObjects.Arc
  private activePointer: Phaser.Input.Pointer | null = null

  // Current sizing (scales with screen)
  private dpadRadius: number = BASE_DPAD_RADIUS
  private buttonRadius: number = BASE_BUTTON_RADIUS

  constructor(scene: Phaser.Scene) {
    this.scene = scene

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
    // Get the camera (for zoom level and viewport calculation)
    const camera = this.scene.cameras.main
    const zoom = camera.zoom

    // With scrollFactor(0), elements are positioned in canvas coordinates
    // But with zoom > 1, only the CENTER of the canvas is visible
    const canvasWidth = this.scene.scale.width   // 1280
    const canvasHeight = this.scene.scale.height // 720
    const visibleWidth = canvasWidth / zoom      // 640 with zoom 2
    const visibleHeight = canvasHeight / zoom    // 360 with zoom 2
    const offsetX = (canvasWidth - visibleWidth) / 2   // 320 with zoom 2
    const offsetY = (canvasHeight - visibleHeight) / 2 // 180 with zoom 2

    // Calculate scale factor based on visible size
    const scaleFactor = Math.min(visibleWidth / 640, visibleHeight / 360)

    // Scale the D-pad size (with min/max bounds)
    this.dpadRadius = Math.max(45, Math.min(70, BASE_DPAD_RADIUS * scaleFactor))
    this.buttonRadius = Math.max(15, Math.min(25, BASE_BUTTON_RADIUS * scaleFactor))

    // Calculate padding (extra at bottom for mobile browser chrome)
    const sidePadding = Math.max(10, BASE_PADDING * scaleFactor)
    const bottomPadding = sidePadding + MOBILE_BOTTOM_PADDING

    // Position in bottom-left of the VISIBLE area
    const x = offsetX + sidePadding + this.dpadRadius
    const y = offsetY + visibleHeight - bottomPadding - this.dpadRadius

    this.container.setPosition(x, y)

    // Update visuals and hit area with new sizes
    this.updateVisuals()
    this.updateHitArea()
  }

  private createVisuals(): void {
    // Semi-transparent background circle
    this.background = this.scene.add.graphics()
    this.container.add(this.background)

    // Direction buttons
    this.upBtn = this.scene.add.graphics()
    this.container.add(this.upBtn)

    this.downBtn = this.scene.add.graphics()
    this.container.add(this.downBtn)

    this.leftBtn = this.scene.add.graphics()
    this.container.add(this.leftBtn)

    this.rightBtn = this.scene.add.graphics()
    this.container.add(this.rightBtn)
  }

  private setupInput(): void {
    // Create a single hit area covering the entire D-pad
    // Don't add to container - position it independently for reliable hit detection
    this.hitArea = this.scene.add.circle(0, 0, this.dpadRadius + 15, 0x000000, 0)
    this.hitArea.setDepth(DEPTH.UI + 101)
    this.hitArea.setScrollFactor(0)
    this.hitArea.setInteractive({ useHandCursor: false })
    // Note: hitArea position will be synced with container in updatePosition

    this.hitArea.on('pointerdown', (pointer: Phaser.Input.Pointer, localX: number, localY: number) => {
      console.log('[VirtualDPad] pointerdown at local:', localX, localY)
      this.activePointer = pointer
      this.updateDirectionFromLocal(localX, localY)
    })

    this.hitArea.on('pointermove', (pointer: Phaser.Input.Pointer, localX: number, localY: number) => {
      if (this.activePointer === pointer && pointer.isDown) {
        this.updateDirectionFromLocal(localX, localY)
      }
    })

    this.hitArea.on('pointerup', () => {
      console.log('[VirtualDPad] pointerup')
      this.activePointer = null
      this.resetState()
    })

    this.hitArea.on('pointerout', () => {
      this.activePointer = null
      this.resetState()
    })

    // Global pointer up handler
    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.activePointer === pointer) {
        this.activePointer = null
        this.resetState()
      }
    })
  }

  private updateHitArea(): void {
    const hitRadius = this.dpadRadius + 15
    this.hitArea.setRadius(hitRadius)

    // Position hit area at the same location as container
    this.hitArea.setPosition(this.container.x, this.container.y)

    // Update the interactive hit area geometry
    if (this.hitArea.input) {
      this.hitArea.input.hitArea.setTo(0, 0, hitRadius)
    }
  }

  private updateDirectionFromLocal(localX: number, localY: number): void {
    // localX/localY are coordinates relative to the hit area center (0,0)
    // The hit area is centered on the D-pad, so these give us the offset from center
    const hitRadius = this.dpadRadius + 15

    // Convert from hit area local coords (where 0,0 is top-left) to center-relative
    const dx = localX - hitRadius
    const dy = localY - hitRadius

    // Determine direction based on position relative to center
    const newState: DPadState = {
      up: dy < -DEAD_ZONE,
      down: dy > DEAD_ZONE,
      left: dx < -DEAD_ZONE,
      right: dx > DEAD_ZONE,
    }

    // Only update if state changed
    if (newState.up !== this.state.up || newState.down !== this.state.down ||
        newState.left !== this.state.left || newState.right !== this.state.right) {
      this.state = newState
      this.updateVisuals()
    }
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
    // Draw background
    this.background.clear()
    this.background.fillStyle(COLORS.DARK_BG, 0.7)
    this.background.fillCircle(0, 0, this.dpadRadius)
    this.background.lineStyle(2, COLORS.PRIMARY, 0.6)
    this.background.strokeCircle(0, 0, this.dpadRadius)

    const btnOffset = this.dpadRadius - this.buttonRadius - 5

    // Draw all direction buttons
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
    btn.fillStyle(COLORS.PRIMARY, active ? 0.95 : 0.6)
    btn.fillCircle(x, y, this.buttonRadius)
    btn.lineStyle(2, COLORS.WHITE, active ? 0.9 : 0.4)
    btn.strokeCircle(x, y, this.buttonRadius)
  }

  getState(): DPadState {
    return this.state
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible)
    this.hitArea.setVisible(visible)
    // Also enable/disable input
    if (visible) {
      this.hitArea.setInteractive()
    } else {
      this.hitArea.disableInteractive()
    }
  }

  setAlpha(alpha: number): void {
    this.container.setAlpha(alpha)
  }

  destroy(): void {
    this.scene.scale.off('resize', this.updatePosition, this)
    this.scene.input.off('pointerup')
    this.hitArea.destroy()
    this.container.destroy()
  }
}
