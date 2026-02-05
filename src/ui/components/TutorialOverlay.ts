import Phaser from 'phaser'
import type { TutorialStep } from '../../models/types'
import { GAME_WIDTH, GAME_HEIGHT, COLORS, TEXT_STYLES, DEPTH } from '../../config'
import { playSfx, SFX_KEYS } from '../../systems/AudioSystem'

export class TutorialOverlay {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private onDismiss: () => void

  constructor(scene: Phaser.Scene, step: TutorialStep, onDismiss: () => void) {
    this.scene = scene
    this.onDismiss = onDismiss

    this.container = scene.add.container(0, 0)
    this.container.setDepth(DEPTH.OVERLAY + 50)

    this.createOverlay(step)
    this.createTutorialBox(step)
    this.setupInput()
  }

  private createOverlay(step: TutorialStep): void {
    // Semi-transparent background
    const overlay = this.scene.add.graphics()
    overlay.fillStyle(0x000000, 0.6)
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    this.container.add(overlay)
  }

  private createTutorialBox(step: TutorialStep): void {
    const boxWidth = 500
    const boxHeight = 180

    // Calculate position based on step.position
    let boxX = GAME_WIDTH / 2 - boxWidth / 2
    let boxY: number

    switch (step.position) {
      case 'top':
        boxY = 60
        break
      case 'bottom':
        boxY = GAME_HEIGHT - boxHeight - 60
        break
      case 'center':
      default:
        boxY = GAME_HEIGHT / 2 - boxHeight / 2
        break
    }

    // Box background
    const bg = this.scene.add.graphics()
    bg.fillStyle(COLORS.DARK_BG, 0.98)
    bg.fillRoundedRect(boxX, boxY, boxWidth, boxHeight, 16)
    bg.lineStyle(3, COLORS.PRIMARY)
    bg.strokeRoundedRect(boxX, boxY, boxWidth, boxHeight, 16)
    this.container.add(bg)

    // Tutorial icon
    const iconBg = this.scene.add.graphics()
    iconBg.fillStyle(COLORS.PRIMARY, 1)
    iconBg.fillCircle(boxX + 40, boxY + 45, 20)
    this.container.add(iconBg)

    const icon = this.scene.add.text(boxX + 40, boxY + 45, '?', {
      fontFamily: 'Arial Black',
      fontSize: '24px',
      color: '#ffffff',
    })
    icon.setOrigin(0.5)
    this.container.add(icon)

    // Title
    const title = this.scene.add.text(boxX + 75, boxY + 25, step.title, {
      ...TEXT_STYLES.HEADING,
      fontSize: '22px',
      color: '#ffd54f',
    })
    this.container.add(title)

    // Message
    const message = this.scene.add.text(boxX + 25, boxY + 70, step.message, {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      wordWrap: { width: boxWidth - 50 },
      lineSpacing: 6,
    })
    this.container.add(message)

    // Continue prompt
    const continueText = this.scene.add.text(
      boxX + boxWidth / 2,
      boxY + boxHeight - 25,
      'Click or press any key to continue',
      {
        ...TEXT_STYLES.SMALL,
        fontSize: '13px',
        color: '#888888',
      },
    )
    continueText.setOrigin(0.5)
    this.container.add(continueText)

    // Blink animation for continue text
    this.scene.tweens.add({
      targets: continueText,
      alpha: 0.4,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Entry animation
    this.container.setAlpha(0)
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 300,
      ease: 'Power2',
    })
  }

  private setupInput(): void {
    // Click to dismiss
    this.scene.input.once('pointerdown', () => {
      this.dismiss()
    })

    // Keyboard to dismiss
    this.scene.input.keyboard?.once('keydown', () => {
      this.dismiss()
    })
  }

  private dismiss(): void {
    playSfx(SFX_KEYS.MENU_CONFIRM)

    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.onDismiss()
      },
    })
  }

  destroy(): void {
    this.container.destroy()
  }
}
