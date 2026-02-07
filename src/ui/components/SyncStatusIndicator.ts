import Phaser from 'phaser'
import { COLORS, TEXT_STYLES } from '../../config'
import type { SyncStatus } from '../../models/auth-types'

interface SyncStatusIndicatorOptions {
  readonly showLabel?: boolean
  readonly size?: 'small' | 'medium'
}

const STATUS_CONFIG: Record<SyncStatus, { icon: string; color: number; label: string }> = {
  idle: { icon: '☁️', color: COLORS.TEXT_LIGHT, label: 'Cloud' },
  syncing: { icon: '🔄', color: COLORS.PRIMARY, label: 'Syncing...' },
  synced: { icon: '✓', color: COLORS.SUCCESS, label: 'Synced' },
  error: { icon: '⚠', color: COLORS.DANGER, label: 'Sync Error' },
  offline: { icon: '📴', color: COLORS.WARNING, label: 'Offline' },
}

export class SyncStatusIndicator {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private statusIcon: Phaser.GameObjects.Text
  private statusLabel: Phaser.GameObjects.Text | null = null
  private spinTween: Phaser.Tweens.Tween | null = null
  private currentStatus: SyncStatus = 'idle'
  private showLabel: boolean
  private size: 'small' | 'medium'

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    options: SyncStatusIndicatorOptions = {},
  ) {
    this.scene = scene
    this.showLabel = options.showLabel ?? false
    this.size = options.size ?? 'medium'

    this.container = scene.add.container(x, y)

    const fontSize = this.size === 'small' ? '14px' : '18px'

    this.statusIcon = scene.add.text(0, 0, STATUS_CONFIG.idle.icon, {
      fontSize,
    })
    this.statusIcon.setOrigin(0.5)
    this.container.add(this.statusIcon)

    if (this.showLabel) {
      const labelFontSize = this.size === 'small' ? '11px' : '13px'
      this.statusLabel = scene.add.text(
        this.size === 'small' ? 16 : 20,
        0,
        STATUS_CONFIG.idle.label,
        {
          ...TEXT_STYLES.SMALL,
          fontSize: labelFontSize,
          color: `#${STATUS_CONFIG.idle.color.toString(16).padStart(6, '0')}`,
        },
      )
      this.statusLabel.setOrigin(0, 0.5)
      this.container.add(this.statusLabel)
    }
  }

  setStatus(status: SyncStatus): void {
    if (this.currentStatus === status) {
      return
    }

    this.currentStatus = status
    const config = STATUS_CONFIG[status]

    this.statusIcon.setText(config.icon)

    if (this.statusLabel) {
      this.statusLabel.setText(config.label)
      this.statusLabel.setColor(`#${config.color.toString(16).padStart(6, '0')}`)
    }

    // Handle spin animation for syncing
    if (status === 'syncing') {
      this.startSpinAnimation()
    } else {
      this.stopSpinAnimation()
    }

    // Flash animation on status change
    this.scene.tweens.add({
      targets: this.statusIcon,
      scale: 1.2,
      duration: 100,
      yoyo: true,
      ease: 'Power1',
    })
  }

  private startSpinAnimation(): void {
    if (this.spinTween) {
      return
    }

    this.spinTween = this.scene.tweens.add({
      targets: this.statusIcon,
      angle: 360,
      duration: 1000,
      repeat: -1,
      ease: 'Linear',
    })
  }

  private stopSpinAnimation(): void {
    if (this.spinTween) {
      this.spinTween.stop()
      this.spinTween = null
      this.statusIcon.setAngle(0)
    }
  }

  getStatus(): SyncStatus {
    return this.currentStatus
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y)
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible)
  }

  setDepth(depth: number): void {
    this.container.setDepth(depth)
  }

  destroy(): void {
    this.stopSpinAnimation()
    this.container.destroy()
  }
}
