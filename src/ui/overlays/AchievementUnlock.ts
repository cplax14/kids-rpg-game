import Phaser from 'phaser'
import type { AchievementDefinition, AchievementProgress } from '../../models/types'
import { GAME_WIDTH, COLORS, TEXT_STYLES, DEPTH } from '../../config'
import { playSfx, SFX_KEYS } from '../../systems/AudioSystem'

const CONFETTI_COLORS = [0xffd54f, 0x66bb6a, 0x42a5f5, 0xef5350, 0x7e57c2, 0xffa726]

const RARITY_COLORS: Record<string, number> = {
  bronze: 0xcd7f32,
  silver: 0xc0c0c0,
  gold: 0xffd54f,
  platinum: 0xe5e4e2,
}

const CATEGORY_ICONS: Record<string, string> = {
  combat: '⚔️',
  collection: '📦',
  exploration: '🗺️',
  social: '💬',
  mastery: '⭐',
}

export class AchievementUnlock {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private confettiParticles: Phaser.GameObjects.Rectangle[] = []
  private dismissTimer: Phaser.Time.TimerEvent | null = null
  private onDismiss: () => void

  constructor(
    scene: Phaser.Scene,
    achievement: AchievementDefinition,
    _progress: AchievementProgress,
    onDismiss: () => void,
  ) {
    this.scene = scene
    this.onDismiss = onDismiss

    this.container = scene.add.container(GAME_WIDTH, 20)
    this.container.setDepth(DEPTH.OVERLAY + 200)

    this.createNotification(achievement)

    // Play unlock sound
    playSfx(SFX_KEYS.QUEST_COMPLETE)

    // Confetti for gold/platinum achievements
    if (achievement.rarity === 'gold' || achievement.rarity === 'platinum') {
      this.createConfetti()
    }

    // Slide in from right
    scene.tweens.add({
      targets: this.container,
      x: GAME_WIDTH - 320,
      duration: 400,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.setupAutoDismiss()
        this.setupInput()
      },
    })
  }

  private createNotification(achievement: AchievementDefinition): void {
    const boxWidth = 300
    const boxHeight = 90
    const rarityColor = RARITY_COLORS[achievement.rarity] ?? COLORS.PRIMARY

    // Glow effect
    const glow = this.scene.add.graphics()
    glow.fillStyle(rarityColor, 0.3)
    glow.fillRoundedRect(-5, -5, boxWidth + 10, boxHeight + 10, 14)
    this.container.add(glow)

    // Pulse animation for glow
    this.scene.tweens.add({
      targets: glow,
      alpha: 0.5,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Main background
    const bg = this.scene.add.graphics()
    bg.fillStyle(COLORS.DARK_BG, 0.95)
    bg.fillRoundedRect(0, 0, boxWidth, boxHeight, 12)
    bg.lineStyle(2, rarityColor)
    bg.strokeRoundedRect(0, 0, boxWidth, boxHeight, 12)
    this.container.add(bg)

    // Rarity indicator bar
    const rarityBar = this.scene.add.graphics()
    rarityBar.fillStyle(rarityColor, 0.8)
    rarityBar.fillRoundedRect(0, 0, boxWidth, 6, { tl: 12, tr: 12, bl: 0, br: 0 })
    this.container.add(rarityBar)

    // "Achievement Unlocked!" header
    const header = this.scene.add.text(10, 12, '🏆 Achievement Unlocked!', {
      ...TEXT_STYLES.SMALL,
      fontSize: '11px',
      color: '#ffd54f',
    })
    this.container.add(header)

    // Category icon
    const categoryIcon = CATEGORY_ICONS[achievement.category] ?? '🎯'
    const iconText = this.scene.add.text(10, 35, categoryIcon, {
      fontSize: '28px',
    })
    this.container.add(iconText)

    // Achievement name
    const name = this.scene.add.text(48, 32, achievement.name, {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#ffffff',
    })
    this.container.add(name)

    // Achievement description
    const desc = this.scene.add.text(48, 52, achievement.description, {
      ...TEXT_STYLES.SMALL,
      fontSize: '11px',
      color: '#b0bec5',
      wordWrap: { width: 240 },
    })
    this.container.add(desc)

    // Reward preview (if any)
    if (achievement.rewardGold > 0) {
      const rewardText = this.scene.add.text(boxWidth - 10, boxHeight - 15, `+${achievement.rewardGold}g`, {
        ...TEXT_STYLES.SMALL,
        fontSize: '11px',
        color: '#ffd54f',
      })
      rewardText.setOrigin(1, 0.5)
      this.container.add(rewardText)
    }
  }

  private createConfetti(): void {
    for (let i = 0; i < 20; i++) {
      const x = Phaser.Math.Between(0, 300)
      const startY = Phaser.Math.Between(-50, -10)
      const color = CONFETTI_COLORS[Phaser.Math.Between(0, CONFETTI_COLORS.length - 1)]
      const size = Phaser.Math.Between(4, 8)

      const particle = this.scene.add.rectangle(x, startY, size, size, color)
      particle.setAlpha(0.9)
      this.confettiParticles.push(particle)
      this.container.add(particle)

      const fallDuration = Phaser.Math.Between(1500, 2500)
      const endY = 120
      const sway = Phaser.Math.Between(-30, 30)

      this.scene.tweens.add({
        targets: particle,
        y: endY,
        x: x + sway,
        rotation: Phaser.Math.Between(-2, 2),
        alpha: 0,
        duration: fallDuration,
        delay: Phaser.Math.Between(0, 500),
        ease: 'Sine.easeIn',
      })
    }
  }

  private setupAutoDismiss(): void {
    this.dismissTimer = this.scene.time.delayedCall(4000, () => {
      this.dismiss()
    })
  }

  private setupInput(): void {
    this.scene.input.once('pointerdown', () => {
      if (this.dismissTimer) {
        this.dismissTimer.remove()
      }
      this.dismiss()
    })
  }

  private dismiss(): void {
    this.scene.tweens.add({
      targets: this.container,
      x: GAME_WIDTH + 50,
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        this.destroy()
        this.onDismiss()
      },
    })
  }

  destroy(): void {
    if (this.dismissTimer) {
      this.dismissTimer.remove()
      this.dismissTimer = null
    }
    for (const particle of this.confettiParticles) {
      this.scene.tweens.killTweensOf(particle)
    }
    this.confettiParticles = []
    this.container.destroy()
  }
}
