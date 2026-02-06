import Phaser from 'phaser'
import { DEPTH, COLORS } from '../../config'

export interface DPadState {
  readonly up: boolean
  readonly down: boolean
  readonly left: boolean
  readonly right: boolean
}

// D-pad sizing (will be scaled based on screen size)
const BASE_DPAD_RADIUS = 70
const BASE_BUTTON_RADIUS = 25
const BASE_PADDING = 20

/**
 * Virtual D-Pad for touch controls
 * Positioned in bottom-left corner of the screen
 * Dynamically repositions based on actual viewport size
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

  // Current sizing (scales with screen)
  private dpadRadius: number = BASE_DPAD_RADIUS
  private buttonRadius: number = BASE_BUTTON_RADIUS
  private padding: number = BASE_PADDING

  constructor(scene: Phaser.Scene) {
    this.scene = scene

    // Create container (position will be set in updatePosition)
    this.container = scene.add.container(0, 0)
    this.container.setDepth(DEPTH.UI + 100)
    this.container.setScrollFactor(0)

    this.createVisuals()
    this.setupDirectionZones()

    // Initial position
    this.updatePosition()

    // Listen for resize events
    scene.scale.on('resize', this.updatePosition, this)
  }

  private updatePosition(): void {
    // Get the camera viewport (this is what's actually visible)
    const camera = this.scene.cameras.main

    // Calculate scale factor based on smaller dimension for consistent sizing
    const viewWidth = camera.width
    const viewHeight = camera.height
    const scaleFactor = Math.min(viewWidth / 640, viewHeight / 360)

    // Scale the D-pad size (with min/max bounds)
    this.dpadRadius = Math.max(50, Math.min(80, BASE_DPAD_RADIUS * scaleFactor))
    this.buttonRadius = Math.max(18, Math.min(30, BASE_BUTTON_RADIUS * scaleFactor))
    this.padding = Math.max(15, Math.min(30, BASE_PADDING * scaleFactor))

    // Position in bottom-left of the camera view
    // Use camera scroll position for scrollFactor(0) elements
    const x = this.padding + this.dpadRadius
    const y = viewHeight - this.padding - this.dpadRadius

    this.container.setPosition(x, y)

    // Update visuals with new sizes
    this.updateVisuals()
    this.updateHitZones()
  }

  private createVisuals(): void {
    // Semi-transparent background circle
    this.background = this.scene.add.graphics()
    this.background.setScrollFactor(0)
    this.container.add(this.background)

    // Direction buttons (will be drawn in updateVisuals)
    this.upBtn = this.scene.add.graphics()
    this.upBtn.setScrollFactor(0)
    this.container.add(this.upBtn)

    this.downBtn = this.scene.add.graphics()
    this.downBtn.setScrollFactor(0)
    this.container.add(this.downBtn)

    this.leftBtn = this.scene.add.graphics()
    this.leftBtn.setScrollFactor(0)
    this.container.add(this.leftBtn)

    this.rightBtn = this.scene.add.graphics()
    this.rightBtn.setScrollFactor(0)
    this.container.add(this.rightBtn)
  }

  private setupDirectionZones(): void {
    // Create hit zones (will be positioned in updateHitZones)
    this.upZone = this.scene.add.circle(0, 0, 1, 0x000000, 0)
    this.upZone.setScrollFactor(0)
    this.upZone.setInteractive()
    this.container.add(this.upZone)
    this.setupZoneEvents(this.upZone, 'up')

    this.downZone = this.scene.add.circle(0, 0, 1, 0x000000, 0)
    this.downZone.setScrollFactor(0)
    this.downZone.setInteractive()
    this.container.add(this.downZone)
    this.setupZoneEvents(this.downZone, 'down')

    this.leftZone = this.scene.add.circle(0, 0, 1, 0x000000, 0)
    this.leftZone.setScrollFactor(0)
    this.leftZone.setInteractive()
    this.container.add(this.leftZone)
    this.setupZoneEvents(this.leftZone, 'left')

    this.rightZone = this.scene.add.circle(0, 0, 1, 0x000000, 0)
    this.rightZone.setScrollFactor(0)
    this.rightZone.setInteractive()
    this.container.add(this.rightZone)
    this.setupZoneEvents(this.rightZone, 'right')
  }

  private updateHitZones(): void {
    const btnOffset = this.dpadRadius - this.buttonRadius - 5
    const hitRadius = this.buttonRadius + 8

    // Update positions and sizes
    this.upZone.setPosition(0, -btnOffset)
    this.upZone.setRadius(hitRadius)

    this.downZone.setPosition(0, btnOffset)
    this.downZone.setRadius(hitRadius)

    this.leftZone.setPosition(-btnOffset, 0)
    this.leftZone.setRadius(hitRadius)

    this.rightZone.setPosition(btnOffset, 0)
    this.rightZone.setRadius(hitRadius)

    // Re-set interactive areas with new sizes
    this.upZone.setInteractive(new Phaser.Geom.Circle(0, 0, hitRadius), Phaser.Geom.Circle.Contains)
    this.downZone.setInteractive(new Phaser.Geom.Circle(0, 0, hitRadius), Phaser.Geom.Circle.Contains)
    this.leftZone.setInteractive(new Phaser.Geom.Circle(0, 0, hitRadius), Phaser.Geom.Circle.Contains)
    this.rightZone.setInteractive(new Phaser.Geom.Circle(0, 0, hitRadius), Phaser.Geom.Circle.Contains)
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
    this.updateButtonVisual(direction)
  }

  private updateVisuals(): void {
    // Draw background
    this.background.clear()
    this.background.fillStyle(COLORS.DARK_BG, 0.6)
    this.background.fillCircle(0, 0, this.dpadRadius)
    this.background.lineStyle(3, COLORS.PRIMARY, 0.5)
    this.background.strokeCircle(0, 0, this.dpadRadius)

    const btnOffset = this.dpadRadius - this.buttonRadius - 5

    // Draw all direction buttons
    this.drawButton(this.upBtn, 0, -btnOffset, this.state.up)
    this.drawButton(this.downBtn, 0, btnOffset, this.state.down)
    this.drawButton(this.leftBtn, -btnOffset, 0, this.state.left)
    this.drawButton(this.rightBtn, btnOffset, 0, this.state.right)
  }

  private updateButtonVisual(direction: 'up' | 'down' | 'left' | 'right'): void {
    const btnOffset = this.dpadRadius - this.buttonRadius - 5

    switch (direction) {
      case 'up':
        this.drawButton(this.upBtn, 0, -btnOffset, this.state.up)
        break
      case 'down':
        this.drawButton(this.downBtn, 0, btnOffset, this.state.down)
        break
      case 'left':
        this.drawButton(this.leftBtn, -btnOffset, 0, this.state.left)
        break
      case 'right':
        this.drawButton(this.rightBtn, btnOffset, 0, this.state.right)
        break
    }
  }

  private drawButton(
    btn: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    active: boolean,
  ): void {
    btn.clear()
    btn.fillStyle(COLORS.PRIMARY, active ? 0.9 : 0.5)
    btn.fillCircle(x, y, this.buttonRadius)
    btn.lineStyle(2, COLORS.WHITE, active ? 0.9 : 0.3)
    btn.strokeCircle(x, y, this.buttonRadius)
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
    this.scene.scale.off('resize', this.updatePosition, this)
    this.container.destroy()
  }
}
