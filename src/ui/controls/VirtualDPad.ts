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
const MOBILE_BOTTOM_PADDING = 45  // Extra padding for mobile browser chrome
const DEAD_ZONE = 15

/**
 * Virtual D-Pad for touch controls
 * Positioned in bottom-left corner of the screen
 * Uses DOM-level touch events for accurate mobile touch detection
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

  private activeTouchId: number | null = null
  private enabled: boolean = true

  // Current sizing (scales with screen)
  private dpadRadius: number = BASE_DPAD_RADIUS
  private buttonRadius: number = BASE_BUTTON_RADIUS

  // Screen position of D-pad center (percentage of canvas, for DOM touch handling)
  private dpadScreenXPercent: number = 0
  private dpadScreenYPercent: number = 0
  private hitRadiusPercent: number = 0

  // Bound event handlers (for cleanup)
  private boundTouchStart: (e: TouchEvent) => void
  private boundTouchMove: (e: TouchEvent) => void
  private boundTouchEnd: (e: TouchEvent) => void

  constructor(scene: Phaser.Scene) {
    this.scene = scene

    // Create container (position will be set in updatePosition)
    this.container = scene.add.container(0, 0)
    this.container.setDepth(DEPTH.UI + 100)
    this.container.setScrollFactor(0)

    this.createVisuals()

    // Bind event handlers
    this.boundTouchStart = this.handleTouchStart.bind(this)
    this.boundTouchMove = this.handleTouchMove.bind(this)
    this.boundTouchEnd = this.handleTouchEnd.bind(this)

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

    // Position in bottom-left of the VISIBLE area (canvas coordinates)
    const x = offsetX + sidePadding + this.dpadRadius
    const y = offsetY + visibleHeight - bottomPadding - this.dpadRadius

    this.container.setPosition(x, y)

    // Store position as percentage for DOM touch handling
    // scrollFactor(0) objects are positioned relative to the VISIBLE area (after zoom)
    // So we need to calculate percentage relative to visible dimensions
    this.dpadScreenXPercent = (x - offsetX) / visibleWidth
    this.dpadScreenYPercent = (y - offsetY) / visibleHeight
    this.hitRadiusPercent = (this.dpadRadius + 15) / Math.min(visibleWidth, visibleHeight)

    // Update visuals with new sizes
    this.updateVisuals()
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
    // Use DOM-level touch events for accurate position detection
    // This bypasses Phaser's coordinate transformation issues
    const canvas = this.scene.game.canvas

    canvas.addEventListener('touchstart', this.boundTouchStart, { passive: false })
    canvas.addEventListener('touchmove', this.boundTouchMove, { passive: false })
    canvas.addEventListener('touchend', this.boundTouchEnd, { passive: false })
    canvas.addEventListener('touchcancel', this.boundTouchEnd, { passive: false })
  }

  private handleTouchStart(e: TouchEvent): void {
    if (!this.enabled) return

    // Check each new touch
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]
      const pos = this.getTouchPosition(touch)

      if (this.isWithinDPad(pos.xPercent, pos.yPercent)) {
        // Only capture if we don't already have an active touch
        if (this.activeTouchId === null) {
          this.activeTouchId = touch.identifier
          this.updateDirectionFromPosition(pos.xPercent, pos.yPercent)
          e.preventDefault() // Prevent scrolling when touching D-pad
        }
      }
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    if (!this.enabled || this.activeTouchId === null) return

    // Find our active touch
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]
      if (touch.identifier === this.activeTouchId) {
        const pos = this.getTouchPosition(touch)
        this.updateDirectionFromPosition(pos.xPercent, pos.yPercent)
        e.preventDefault()
        break
      }
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    // Check if our active touch ended
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]
      if (touch.identifier === this.activeTouchId) {
        this.activeTouchId = null
        this.resetState()
        break
      }
    }
  }

  private getTouchPosition(touch: Touch): { xPercent: number; yPercent: number } {
    const canvas = this.scene.game.canvas
    const rect = canvas.getBoundingClientRect()

    // Get touch position as percentage of canvas element
    const xPercent = (touch.clientX - rect.left) / rect.width
    const yPercent = (touch.clientY - rect.top) / rect.height

    return { xPercent, yPercent }
  }

  private isWithinDPad(xPercent: number, yPercent: number): boolean {
    const dx = xPercent - this.dpadScreenXPercent
    const dy = yPercent - this.dpadScreenYPercent

    // Scale dx by aspect ratio to make hit area circular
    const canvas = this.scene.game.canvas
    const aspectRatio = canvas.width / canvas.height
    const adjustedDx = dx * aspectRatio

    const distance = Math.sqrt(adjustedDx * adjustedDx + dy * dy)
    return distance <= this.hitRadiusPercent * aspectRatio
  }

  private updateDirectionFromPosition(xPercent: number, yPercent: number): void {
    // Calculate offset from D-pad center (in percentage units)
    const dx = xPercent - this.dpadScreenXPercent
    const dy = yPercent - this.dpadScreenYPercent

    // Convert percentage offset to approximate pixel offset for dead zone comparison
    const canvas = this.scene.game.canvas
    const pxOffsetX = dx * canvas.width
    const pxOffsetY = dy * canvas.height

    // Determine direction based on position relative to center
    const newState: DPadState = {
      up: pxOffsetY < -DEAD_ZONE,
      down: pxOffsetY > DEAD_ZONE,
      left: pxOffsetX < -DEAD_ZONE,
      right: pxOffsetX > DEAD_ZONE,
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
    this.enabled = visible
    if (!visible) {
      this.activeTouchId = null
      this.resetState()
    }
  }

  setAlpha(alpha: number): void {
    this.container.setAlpha(alpha)
  }

  destroy(): void {
    this.scene.scale.off('resize', this.updatePosition, this)

    // Clean up DOM event listeners
    const canvas = this.scene.game.canvas
    canvas.removeEventListener('touchstart', this.boundTouchStart)
    canvas.removeEventListener('touchmove', this.boundTouchMove)
    canvas.removeEventListener('touchend', this.boundTouchEnd)
    canvas.removeEventListener('touchcancel', this.boundTouchEnd)

    this.container.destroy()
  }
}
