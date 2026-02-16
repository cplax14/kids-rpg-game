/**
 * ObjectiveMarker - Visual arrow/sparkle above objective targets
 *
 * Shows a bouncing arrow pointing down at NPCs, exits, or other targets.
 * Kid-friendly with sparkle effects and smooth animations.
 * Disappears when player gets close to the target.
 */

import Phaser from 'phaser'
import { DEPTH } from '../../config'

const MARKER_BOUNCE_HEIGHT = 12
const MARKER_BOUNCE_DURATION = 600
const MARKER_FADE_DISTANCE = 80
const SPARKLE_INTERVAL = 1500

export class ObjectiveMarker {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private arrow!: Phaser.GameObjects.Text
  private sparkleTimer: Phaser.Time.TimerEvent | null = null

  private targetX: number
  private targetY: number
  private isVisible: boolean = true

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene
    this.targetX = x
    this.targetY = y

    this.container = this.createContainer(x, y)
    this.startAnimations()
  }

  private createContainer(x: number, y: number): Phaser.GameObjects.Container {
    // Position above the target
    const container = this.scene.add.container(x, y - 50)
    container.setDepth(DEPTH.UI - 5) // Below UI but above world objects

    // Downward arrow emoji
    this.arrow = this.scene.add.text(0, 0, '⬇️', {
      fontSize: '28px',
    })
    this.arrow.setOrigin(0.5)
    this.arrow.setResolution(2)
    container.add(this.arrow)

    // Glow effect (optional ring)
    const glow = this.scene.add.graphics()
    glow.fillStyle(0xffd54f, 0.2)
    glow.fillCircle(0, 20, 20)
    container.addAt(glow, 0)

    // Pulse the glow
    this.scene.tweens.add({
      targets: glow,
      alpha: { from: 0.4, to: 0.1 },
      scaleX: { from: 1, to: 1.5 },
      scaleY: { from: 1, to: 1.5 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    return container
  }

  private startAnimations(): void {
    // Bouncing animation
    this.scene.tweens.add({
      targets: this.container,
      y: this.targetY - 50 - MARKER_BOUNCE_HEIGHT,
      duration: MARKER_BOUNCE_DURATION,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Sparkle effect periodically
    this.sparkleTimer = this.scene.time.addEvent({
      delay: SPARKLE_INTERVAL,
      callback: () => this.createSparkle(),
      loop: true,
    })
  }

  private createSparkle(): void {
    if (!this.isVisible) return

    const sparkle = this.scene.add.text(
      this.container.x + Phaser.Math.Between(-20, 20),
      this.container.y + Phaser.Math.Between(-10, 30),
      '✨',
      { fontSize: '16px' },
    )
    sparkle.setOrigin(0.5)
    sparkle.setResolution(2)
    sparkle.setDepth(DEPTH.UI - 4)

    this.scene.tweens.add({
      targets: sparkle,
      y: sparkle.y - 30,
      alpha: 0,
      scaleX: 0.5,
      scaleY: 0.5,
      duration: 800,
      ease: 'Power2',
      onComplete: () => sparkle.destroy(),
    })
  }

  /**
   * Update marker visibility based on player distance.
   * Fades out when player gets close.
   */
  updateDistanceFromPlayer(playerX: number, playerY: number): void {
    const distance = Phaser.Math.Distance.Between(
      playerX,
      playerY,
      this.targetX,
      this.targetY,
    )

    if (distance < MARKER_FADE_DISTANCE) {
      // Fade out when close
      const alpha = Math.max(0, (distance - 30) / (MARKER_FADE_DISTANCE - 30))
      this.container.setAlpha(alpha)
    } else {
      this.container.setAlpha(1)
    }
  }

  /**
   * Move the marker to a new target position.
   */
  setTarget(x: number, y: number): void {
    this.targetX = x
    this.targetY = y

    // Stop existing tweens
    this.scene.tweens.killTweensOf(this.container)

    // Reset position and restart bounce
    this.container.setPosition(x, y - 50)
    this.scene.tweens.add({
      targets: this.container,
      y: y - 50 - MARKER_BOUNCE_HEIGHT,
      duration: MARKER_BOUNCE_DURATION,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  /**
   * Show the marker.
   */
  show(): void {
    if (!this.isVisible) {
      this.isVisible = true
      this.container.setVisible(true)
      this.scene.tweens.add({
        targets: this.container,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 300,
        ease: 'Back.easeOut',
      })
    }
  }

  /**
   * Hide the marker with animation.
   */
  hide(): void {
    if (this.isVisible) {
      this.isVisible = false
      this.scene.tweens.add({
        targets: this.container,
        alpha: 0,
        scaleX: 0.5,
        scaleY: 0.5,
        duration: 200,
        onComplete: () => this.container.setVisible(false),
      })
    }
  }

  /**
   * Check if the marker is currently visible.
   */
  getIsVisible(): boolean {
    return this.isVisible
  }

  /**
   * Get target position.
   */
  getTargetPosition(): { x: number; y: number } {
    return { x: this.targetX, y: this.targetY }
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    if (this.sparkleTimer) {
      this.sparkleTimer.remove()
    }
    this.scene.tweens.killTweensOf(this.container)
    this.container.destroy()
  }
}
