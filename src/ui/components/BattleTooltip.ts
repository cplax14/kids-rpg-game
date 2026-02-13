import Phaser from 'phaser'
import { COLORS, TEXT_STYLES, DEPTH } from '../../config'
import { playSfx, SFX_KEYS } from '../../systems/AudioSystem'

export type TooltipPosition = 'above' | 'below' | 'left' | 'right'

export interface BattleTooltipConfig {
  readonly message: string
  readonly targetX: number
  readonly targetY: number
  readonly position?: TooltipPosition
  readonly autoDismissMs?: number
  readonly showArrow?: boolean
  readonly pulseTarget?: boolean
}

/**
 * Non-modal tooltip for contextual battle guidance
 * Shows near UI elements with optional arrow and pulse animation
 * Does NOT pause gameplay
 */
export class BattleTooltip {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private pulseTween: Phaser.Tweens.Tween | null = null
  private autoDismissTimer: Phaser.Time.TimerEvent | null = null
  private onDismiss: (() => void) | null = null
  private targetHighlight: Phaser.GameObjects.Graphics | null = null
  private targetPulseTween: Phaser.Tweens.Tween | null = null

  constructor(scene: Phaser.Scene, config: BattleTooltipConfig) {
    this.scene = scene

    const {
      message,
      targetX,
      targetY,
      position = 'above',
      autoDismissMs,
      showArrow = true,
      pulseTarget = true,
    } = config

    this.container = scene.add.container(0, 0)
    this.container.setDepth(DEPTH.UI + 50)

    // Create target highlight if pulseTarget is enabled
    if (pulseTarget) {
      this.createTargetHighlight(targetX, targetY)
    }

    // Create tooltip box
    this.createTooltipBox(message, targetX, targetY, position, showArrow)

    // Setup input for dismiss
    this.setupInput()

    // Entry animation
    this.playEntryAnimation()

    // Auto-dismiss timer
    if (autoDismissMs && autoDismissMs > 0) {
      this.autoDismissTimer = scene.time.delayedCall(autoDismissMs, () => {
        this.dismiss()
      })
    }
  }

  private createTargetHighlight(targetX: number, targetY: number): void {
    this.targetHighlight = this.scene.add.graphics()
    this.targetHighlight.setDepth(DEPTH.UI + 49)

    // Draw pulsing ring around target
    const drawHighlight = (scale: number): void => {
      if (!this.targetHighlight) return
      this.targetHighlight.clear()
      this.targetHighlight.lineStyle(4, COLORS.GOLD, 0.8)
      this.targetHighlight.strokeCircle(targetX, targetY, 40 * scale)
      this.targetHighlight.lineStyle(2, COLORS.WARNING, 0.6)
      this.targetHighlight.strokeCircle(targetX, targetY, 50 * scale)
    }

    drawHighlight(1)

    // Pulse animation
    const pulseObj = { scale: 1 }
    this.targetPulseTween = this.scene.tweens.add({
      targets: pulseObj,
      scale: 1.15,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      onUpdate: () => drawHighlight(pulseObj.scale),
    })
  }

  private createTooltipBox(
    message: string,
    targetX: number,
    targetY: number,
    position: TooltipPosition,
    showArrow: boolean,
  ): void {
    const padding = 16
    const maxWidth = 280
    const arrowSize = 12

    // Create temporary text to measure
    const tempText = this.scene.add.text(0, 0, message, {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      wordWrap: { width: maxWidth - padding * 2 },
      lineSpacing: 4,
    })
    const textWidth = Math.min(tempText.width, maxWidth - padding * 2)
    const textHeight = tempText.height
    tempText.destroy()

    const boxWidth = textWidth + padding * 2
    const boxHeight = textHeight + padding * 2

    // Calculate position based on target and position preference
    let boxX: number
    let boxY: number
    let arrowX: number
    let arrowY: number
    let arrowRotation: number

    const offset = 20 // Distance from target

    switch (position) {
      case 'above':
        boxX = targetX - boxWidth / 2
        boxY = targetY - boxHeight - offset - arrowSize
        arrowX = targetX
        arrowY = targetY - offset
        arrowRotation = Math.PI // Point down
        break
      case 'below':
        boxX = targetX - boxWidth / 2
        boxY = targetY + offset + arrowSize
        arrowX = targetX
        arrowY = targetY + offset
        arrowRotation = 0 // Point up
        break
      case 'left':
        boxX = targetX - boxWidth - offset - arrowSize
        boxY = targetY - boxHeight / 2
        arrowX = targetX - offset
        arrowY = targetY
        arrowRotation = Math.PI / 2 // Point right
        break
      case 'right':
        boxX = targetX + offset + arrowSize
        boxY = targetY - boxHeight / 2
        arrowX = targetX + offset
        arrowY = targetY
        arrowRotation = -Math.PI / 2 // Point left
        break
    }

    // Background with friendly rounded corners
    const bg = this.scene.add.graphics()
    bg.fillStyle(COLORS.GOLD, 0.95)
    bg.fillRoundedRect(boxX, boxY, boxWidth, boxHeight, 12)
    bg.lineStyle(3, COLORS.WARNING)
    bg.strokeRoundedRect(boxX, boxY, boxWidth, boxHeight, 12)
    this.container.add(bg)

    // Arrow pointing to target
    if (showArrow) {
      const arrow = this.scene.add.graphics()
      arrow.fillStyle(COLORS.GOLD, 0.95)
      arrow.beginPath()
      arrow.moveTo(0, -arrowSize)
      arrow.lineTo(arrowSize, arrowSize)
      arrow.lineTo(-arrowSize, arrowSize)
      arrow.closePath()
      arrow.fillPath()
      arrow.setPosition(arrowX, arrowY)
      arrow.setRotation(arrowRotation)
      this.container.add(arrow)
    }

    // Message text (dark for contrast on gold background)
    const text = this.scene.add.text(boxX + padding, boxY + padding, message, {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      color: '#1a1a2e',
      wordWrap: { width: maxWidth - padding * 2 },
      lineSpacing: 4,
    })
    this.container.add(text)

    // "Tap to continue" hint
    const hint = this.scene.add.text(
      boxX + boxWidth / 2,
      boxY + boxHeight - 6,
      'Tap to continue',
      {
        ...TEXT_STYLES.SMALL,
        fontSize: '11px',
        color: '#5d4037',
      },
    )
    hint.setOrigin(0.5, 1)
    this.container.add(hint)

    // Pulse animation for the whole tooltip
    this.pulseTween = this.scene.tweens.add({
      targets: this.container,
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  private setupInput(): void {
    // Click anywhere to dismiss
    this.scene.input.once('pointerdown', () => {
      this.dismiss()
    })
  }

  private playEntryAnimation(): void {
    this.container.setAlpha(0)
    this.container.setScale(0.8)

    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 300,
      ease: 'Back.easeOut',
    })

    // Play a friendly sound
    playSfx(SFX_KEYS.MENU_CONFIRM)
  }

  private dismiss(): void {
    // Clear auto-dismiss timer if active
    if (this.autoDismissTimer) {
      this.autoDismissTimer.destroy()
      this.autoDismissTimer = null
    }

    // Stop tweens
    if (this.pulseTween) {
      this.pulseTween.stop()
      this.pulseTween = null
    }
    if (this.targetPulseTween) {
      this.targetPulseTween.stop()
      this.targetPulseTween = null
    }

    // Exit animation
    this.scene.tweens.add({
      targets: [this.container, this.targetHighlight].filter(Boolean),
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.destroy()
        this.onDismiss?.()
      },
    })
  }

  setOnDismiss(callback: () => void): void {
    this.onDismiss = callback
  }

  destroy(): void {
    if (this.pulseTween) {
      this.pulseTween.stop()
      this.pulseTween = null
    }
    if (this.targetPulseTween) {
      this.targetPulseTween.stop()
      this.targetPulseTween = null
    }
    if (this.autoDismissTimer) {
      this.autoDismissTimer.destroy()
      this.autoDismissTimer = null
    }
    if (this.targetHighlight) {
      this.targetHighlight.destroy()
      this.targetHighlight = null
    }
    this.container.destroy()
  }
}
