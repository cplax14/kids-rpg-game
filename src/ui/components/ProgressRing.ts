import Phaser from 'phaser'
import { COLORS, TEXT_STYLES } from '../../config'

export interface ProgressRingOptions {
  readonly radius: number
  readonly thickness: number
  readonly bgColor: number
  readonly fillColor: number
  readonly showPercent: boolean
  readonly animate: boolean
}

const DEFAULT_OPTIONS: ProgressRingOptions = {
  radius: 20,
  thickness: 4,
  bgColor: 0x333333,
  fillColor: COLORS.PRIMARY,
  showPercent: true,
  animate: true,
}

export class ProgressRing {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private bgGraphics: Phaser.GameObjects.Graphics
  private fillGraphics: Phaser.GameObjects.Graphics
  private percentText: Phaser.GameObjects.Text | null = null
  private options: ProgressRingOptions
  private currentProgress: number = 0
  private targetProgress: number = 0
  private animationTween: Phaser.Tweens.Tween | null = null

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    progress: number,
    options: Partial<ProgressRingOptions> = {},
  ) {
    this.scene = scene
    this.options = { ...DEFAULT_OPTIONS, ...options }

    this.container = scene.add.container(x, y)

    // Background ring
    this.bgGraphics = scene.add.graphics()
    this.container.add(this.bgGraphics)

    // Fill ring
    this.fillGraphics = scene.add.graphics()
    this.container.add(this.fillGraphics)

    // Percent text
    if (this.options.showPercent) {
      this.percentText = scene.add.text(0, 0, '0%', {
        ...TEXT_STYLES.SMALL,
        fontSize: this.options.radius < 20 ? '9px' : '11px',
        color: '#ffffff',
      })
      this.percentText.setResolution(2) // Crisp text at zoom levels
      this.percentText.setOrigin(0.5)
      this.container.add(this.percentText)
    }

    this.drawBackground()
    this.setProgress(progress, false)
  }

  private drawBackground(): void {
    const { radius, thickness, bgColor } = this.options

    this.bgGraphics.clear()
    this.bgGraphics.lineStyle(thickness, bgColor, 1)
    this.bgGraphics.beginPath()
    this.bgGraphics.arc(0, 0, radius, 0, Math.PI * 2)
    this.bgGraphics.strokePath()
  }

  private drawProgress(progress: number): void {
    const { radius, thickness, fillColor } = this.options

    this.fillGraphics.clear()

    if (progress <= 0) return

    const clampedProgress = Math.min(progress, 100)
    const startAngle = -Math.PI / 2 // Start from top
    const endAngle = startAngle + (Math.PI * 2 * clampedProgress) / 100

    this.fillGraphics.lineStyle(thickness, fillColor, 1)
    this.fillGraphics.beginPath()
    this.fillGraphics.arc(0, 0, radius, startAngle, endAngle)
    this.fillGraphics.strokePath()

    // Update percent text
    if (this.percentText) {
      this.percentText.setText(`${Math.round(clampedProgress)}%`)
    }
  }

  setProgress(progress: number, animate: boolean = true): void {
    this.targetProgress = Math.min(Math.max(progress, 0), 100)

    if (animate && this.options.animate && this.currentProgress !== this.targetProgress) {
      // Stop existing animation
      if (this.animationTween) {
        this.animationTween.stop()
      }

      // Animate to new progress
      const startProgress = this.currentProgress
      this.animationTween = this.scene.tweens.addCounter({
        from: startProgress,
        to: this.targetProgress,
        duration: 400,
        ease: 'Power2',
        onUpdate: (tween) => {
          this.currentProgress = tween.getValue() ?? 0
          this.drawProgress(this.currentProgress)
        },
        onComplete: () => {
          this.animationTween = null
        },
      })
    } else {
      this.currentProgress = this.targetProgress
      this.drawProgress(this.currentProgress)
    }
  }

  setColor(color: number): void {
    this.options = { ...this.options, fillColor: color }
    this.drawProgress(this.currentProgress)
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y)
  }

  setDepth(depth: number): void {
    this.container.setDepth(depth)
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible)
  }

  destroy(): void {
    if (this.animationTween) {
      this.animationTween.stop()
    }
    this.container.destroy()
  }
}
