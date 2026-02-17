/**
 * AutoSaveIndicator - Visual feedback when the game auto-saves
 *
 * Shows a brief "Saved!" message with a floppy disk icon in the corner.
 * Appears briefly (2 seconds) then fades out.
 * Child-friendly design with clear, simple text.
 */

import Phaser from 'phaser'
import { COLORS, DEPTH, GAME_WIDTH, TEXT_STYLES } from '../../config'

const INDICATOR_PADDING = 20
const DISPLAY_DURATION_MS = 2000
const FADE_DURATION_MS = 500

export class AutoSaveIndicator {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private isVisible: boolean = false
  private hideTimer: Phaser.Time.TimerEvent | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.container = this.createContainer()
    this.container.setVisible(false)
  }

  private createContainer(): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, 0)
    container.setScrollFactor(0)
    container.setDepth(DEPTH.UI + 10)

    // Calculate position (top-right corner of visible area)
    this.updatePosition(container)

    // Background panel
    const bg = this.scene.add.graphics()
    bg.fillStyle(COLORS.DARK_BG, 0.9)
    bg.fillRoundedRect(0, 0, 120, 40, 8)
    bg.lineStyle(2, COLORS.SUCCESS, 0.8)
    bg.strokeRoundedRect(0, 0, 120, 40, 8)
    container.add(bg)

    // Floppy disk emoji (save icon)
    const icon = this.scene.add.text(12, 8, '💾', {
      fontSize: '20px',
    })
    icon.setResolution(2)
    container.add(icon)

    // "Saved!" text
    const text = this.scene.add.text(42, 10, 'Saved!', {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      color: '#66bb6a',
      fontStyle: 'bold',
    })
    text.setResolution(2)
    container.add(text)

    // Listen for resize events
    this.scene.scale.on('resize', () => this.updatePosition(container), this)

    return container
  }

  /**
   * Update container position based on camera zoom.
   */
  private updatePosition(container: Phaser.GameObjects.Container): void {
    const camera = this.scene.cameras.main
    const zoom = camera.zoom

    // Calculate visible area within canvas coordinates
    const canvasWidth = this.scene.scale.width
    const visibleWidth = canvasWidth / zoom
    const offsetX = (canvasWidth - visibleWidth) / 2

    // Position in top-right of the VISIBLE area
    const x = offsetX + visibleWidth - 120 - INDICATOR_PADDING
    const y = INDICATOR_PADDING

    container.setPosition(x, y)
  }

  /**
   * Show the save indicator with animation
   */
  show(): void {
    // Cancel any pending hide
    if (this.hideTimer) {
      this.hideTimer.remove()
      this.hideTimer = null
    }

    // Reset state
    this.container.setAlpha(0)
    this.container.setScale(0.8)
    this.container.setVisible(true)
    this.isVisible = true

    // Animate in with a pop effect
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 200,
      ease: 'Back.easeOut',
    })

    // Add a subtle checkmark pulse animation
    const checkPulse = this.scene.add.text(100, 8, '✓', {
      fontSize: '18px',
      color: '#66bb6a',
    })
    checkPulse.setResolution(2)
    this.container.add(checkPulse)

    this.scene.tweens.add({
      targets: checkPulse,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 500,
      ease: 'Power2',
      onComplete: () => {
        checkPulse.destroy()
      },
    })

    // Schedule hide after display duration
    this.hideTimer = this.scene.time.delayedCall(DISPLAY_DURATION_MS, () => {
      this.hide()
    })
  }

  /**
   * Hide the save indicator with fade animation
   */
  private hide(): void {
    if (!this.isVisible) return

    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: FADE_DURATION_MS,
      ease: 'Power2',
      onComplete: () => {
        this.container.setVisible(false)
        this.isVisible = false
      },
    })
  }

  /**
   * Immediately hide without animation (for scene cleanup)
   */
  hideImmediate(): void {
    if (this.hideTimer) {
      this.hideTimer.remove()
      this.hideTimer = null
    }
    this.container.setVisible(false)
    this.isVisible = false
  }

  /**
   * Check if the indicator is currently visible
   */
  getIsVisible(): boolean {
    return this.isVisible
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.scene.scale.off('resize', () => this.updatePosition(this.container), this)
    if (this.hideTimer) {
      this.hideTimer.remove()
    }
    this.container.destroy()
  }
}
