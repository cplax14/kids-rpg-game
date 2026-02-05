import Phaser from 'phaser'
import type { QuestDefinition, QuestRewards } from '../../models/types'
import { GAME_WIDTH, GAME_HEIGHT, COLORS, TEXT_STYLES, DEPTH } from '../../config'
import { playSfx, SFX_KEYS } from '../../systems/AudioSystem'
import { getItem } from '../../systems/InventorySystem'
import { getEquipment } from '../../systems/EquipmentSystem'

const CONFETTI_COLORS = [
  0xffd54f, // gold
  0x66bb6a, // green
  0x42a5f5, // blue
  0xef5350, // red
  0x7e57c2, // purple
  0xffa726, // orange
]

export class QuestCelebration {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private confettiParticles: Phaser.GameObjects.Rectangle[] = []
  private onDismiss: () => void

  constructor(
    scene: Phaser.Scene,
    quest: QuestDefinition,
    rewards: QuestRewards,
    onDismiss: () => void,
  ) {
    this.scene = scene
    this.onDismiss = onDismiss

    this.container = scene.add.container(0, 0)
    this.container.setDepth(DEPTH.OVERLAY + 100)

    this.createOverlay()
    this.createConfetti()
    this.createCelebrationBox(quest, rewards)

    // Entry animation
    this.container.setAlpha(0)
    scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 300,
      ease: 'Power2',
    })
  }

  private createOverlay(): void {
    const overlay = this.scene.add.graphics()
    overlay.fillStyle(0x000000, 0.7)
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    this.container.add(overlay)
  }

  private createConfetti(): void {
    // Create falling confetti particles
    for (let i = 0; i < 50; i++) {
      const x = Phaser.Math.Between(0, GAME_WIDTH)
      const startY = Phaser.Math.Between(-100, -20)
      const color = CONFETTI_COLORS[Phaser.Math.Between(0, CONFETTI_COLORS.length - 1)]
      const width = Phaser.Math.Between(6, 12)
      const height = Phaser.Math.Between(4, 8)

      const particle = this.scene.add.rectangle(x, startY, width, height, color)
      particle.setAlpha(0.9)
      this.confettiParticles.push(particle)
      this.container.add(particle)

      // Animate falling
      const fallDuration = Phaser.Math.Between(2000, 4000)
      const endY = GAME_HEIGHT + 50
      const sway = Phaser.Math.Between(-100, 100)

      this.scene.tweens.add({
        targets: particle,
        y: endY,
        x: x + sway,
        rotation: Phaser.Math.Between(-3, 3),
        duration: fallDuration,
        delay: Phaser.Math.Between(0, 1000),
        ease: 'Sine.easeIn',
        repeat: -1,
        onRepeat: () => {
          particle.setY(Phaser.Math.Between(-100, -20))
          particle.setX(Phaser.Math.Between(0, GAME_WIDTH))
        },
      })
    }
  }

  private createCelebrationBox(quest: QuestDefinition, rewards: QuestRewards): void {
    const boxWidth = 480
    const boxHeight = 350
    const boxX = GAME_WIDTH / 2 - boxWidth / 2
    const boxY = GAME_HEIGHT / 2 - boxHeight / 2

    // Box background with glow effect
    const glow = this.scene.add.graphics()
    glow.fillStyle(COLORS.GOLD, 0.2)
    glow.fillRoundedRect(boxX - 10, boxY - 10, boxWidth + 20, boxHeight + 20, 20)
    this.container.add(glow)

    // Pulsing glow animation
    this.scene.tweens.add({
      targets: glow,
      alpha: 0.4,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    const bg = this.scene.add.graphics()
    bg.fillStyle(COLORS.DARK_BG, 0.98)
    bg.fillRoundedRect(boxX, boxY, boxWidth, boxHeight, 16)
    bg.lineStyle(3, COLORS.GOLD)
    bg.strokeRoundedRect(boxX, boxY, boxWidth, boxHeight, 16)
    this.container.add(bg)

    let yOffset = boxY + 20

    // "Quest Complete!" banner
    const bannerBg = this.scene.add.graphics()
    bannerBg.fillStyle(COLORS.GOLD, 0.3)
    bannerBg.fillRoundedRect(boxX + 40, yOffset, boxWidth - 80, 50, 12)
    this.container.add(bannerBg)

    const bannerText = this.scene.add.text(boxX + boxWidth / 2, yOffset + 25, 'QUEST COMPLETE!', {
      ...TEXT_STYLES.HEADING,
      fontSize: '28px',
      color: '#ffd54f',
    })
    bannerText.setOrigin(0.5)
    this.container.add(bannerText)

    // Banner scale animation
    this.scene.tweens.add({
      targets: bannerText,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 300,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
    })

    yOffset += 70

    // Quest name
    const questName = this.scene.add.text(boxX + boxWidth / 2, yOffset, quest.name, {
      ...TEXT_STYLES.BODY,
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
    })
    questName.setOrigin(0.5)
    this.container.add(questName)

    yOffset += 35

    // Rewards header
    const rewardsHeader = this.scene.add.text(boxX + boxWidth / 2, yOffset, 'Rewards', {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      color: '#42a5f5',
      fontStyle: 'bold',
    })
    rewardsHeader.setOrigin(0.5)
    this.container.add(rewardsHeader)

    yOffset += 25

    // Rewards with reveal animation
    const rewardItems: { text: string; color: string; delay: number }[] = []

    rewardItems.push({ text: `+${rewards.experience} Experience`, color: '#66bb6a', delay: 300 })
    rewardItems.push({ text: `+${rewards.gold} Gold`, color: '#ffd54f', delay: 600 })

    for (const itemReward of rewards.items) {
      const item = getItem(itemReward.itemId)
      const name = item?.name ?? itemReward.itemId
      rewardItems.push({
        text: `${name} x${itemReward.quantity}`,
        color: '#ffffff',
        delay: 900 + rewardItems.length * 200,
      })
    }

    if (rewards.equipmentId) {
      const equipment = getEquipment(rewards.equipmentId)
      const name = equipment?.name ?? rewards.equipmentId
      rewardItems.push({
        text: `${name} (Equipment)`,
        color: '#7e57c2',
        delay: 900 + rewardItems.length * 200,
      })
    }

    // Create reward texts with delayed reveal
    for (const reward of rewardItems) {
      const rewardText = this.scene.add.text(boxX + boxWidth / 2, yOffset, reward.text, {
        ...TEXT_STYLES.BODY,
        fontSize: '15px',
        color: reward.color,
      })
      rewardText.setOrigin(0.5)
      rewardText.setAlpha(0)
      rewardText.setScale(0.5)
      this.container.add(rewardText)

      this.scene.tweens.add({
        targets: rewardText,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 300,
        delay: reward.delay,
        ease: 'Back.easeOut',
        onStart: () => {
          playSfx(SFX_KEYS.MENU_CONFIRM)
        },
      })

      yOffset += 24
    }

    yOffset += 15

    // Celebration message from NPC
    if (quest.celebrationMessage) {
      const messageText = this.scene.add.text(
        boxX + boxWidth / 2,
        yOffset,
        `"${quest.celebrationMessage}"`,
        {
          ...TEXT_STYLES.BODY,
          fontSize: '13px',
          color: '#b0bec5',
          fontStyle: 'italic',
          wordWrap: { width: boxWidth - 60 },
          align: 'center',
        },
      )
      messageText.setOrigin(0.5, 0)
      messageText.setAlpha(0)
      this.container.add(messageText)

      this.scene.tweens.add({
        targets: messageText,
        alpha: 1,
        duration: 500,
        delay: 1200 + rewardItems.length * 200,
        ease: 'Power2',
      })
    }

    // Continue prompt
    const continueText = this.scene.add.text(
      boxX + boxWidth / 2,
      boxY + boxHeight - 25,
      'Click or press any key to continue',
      {
        ...TEXT_STYLES.SMALL,
        fontSize: '12px',
        color: '#888888',
      },
    )
    continueText.setOrigin(0.5)
    continueText.setAlpha(0)
    this.container.add(continueText)

    // Show continue prompt after rewards
    this.scene.time.delayedCall(1500 + rewardItems.length * 200, () => {
      continueText.setAlpha(1)

      this.scene.tweens.add({
        targets: continueText,
        alpha: 0.4,
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })

      this.setupInput()
    })
  }

  private setupInput(): void {
    this.scene.input.once('pointerdown', () => {
      this.dismiss()
    })

    this.scene.input.keyboard?.once('keydown', () => {
      this.dismiss()
    })
  }

  private dismiss(): void {
    playSfx(SFX_KEYS.MENU_CONFIRM)

    this.scene.tweens.add({
      targets: this.container,
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
    // Stop all confetti tweens
    for (const particle of this.confettiParticles) {
      this.scene.tweens.killTweensOf(particle)
    }
    this.confettiParticles = []
    this.container.destroy()
  }
}
