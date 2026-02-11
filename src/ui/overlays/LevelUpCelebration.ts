import Phaser from 'phaser'
import type { Ability } from '../../models/types'
import type { StatChange } from '../../systems/CharacterSystem'
import { GAME_WIDTH, GAME_HEIGHT, COLORS, TEXT_STYLES, DEPTH } from '../../config'
import { playSfx, SFX_KEYS } from '../../systems/AudioSystem'

const CONFETTI_COLORS = [
  0xffd54f, // gold
  0x66bb6a, // green
  0x42a5f5, // blue
  0xef5350, // red
  0x7e57c2, // purple
  0xffa726, // orange
]

export interface LevelUpDisplayData {
  readonly playerName: string
  readonly previousLevel: number
  readonly newLevel: number
  readonly statChanges: ReadonlyArray<StatChange>
  readonly newAbilities: ReadonlyArray<string>
  readonly abilitiesData: ReadonlyArray<Ability> | undefined
}

export class LevelUpCelebration {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private confettiParticles: Phaser.GameObjects.Rectangle[] = []
  private onDismiss: () => void

  constructor(scene: Phaser.Scene, data: LevelUpDisplayData, onDismiss: () => void) {
    this.scene = scene
    this.onDismiss = onDismiss

    this.container = scene.add.container(0, 0)
    this.container.setDepth(DEPTH.OVERLAY + 100)
    this.container.setScrollFactor(0)

    this.createOverlay()
    this.createConfetti()
    this.createCelebrationBox(data)

    // Play level up sound
    playSfx(SFX_KEYS.LEVEL_UP)

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
    for (let i = 0; i < 60; i++) {
      const x = Phaser.Math.Between(0, GAME_WIDTH)
      const startY = Phaser.Math.Between(-100, -20)
      const color = CONFETTI_COLORS[Phaser.Math.Between(0, CONFETTI_COLORS.length - 1)]
      const width = Phaser.Math.Between(6, 12)
      const height = Phaser.Math.Between(4, 8)

      const particle = this.scene.add.rectangle(x, startY, width, height, color)
      particle.setAlpha(0.9)
      particle.setScrollFactor(0)
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

  private createCelebrationBox(data: LevelUpDisplayData): void {
    const { playerName, previousLevel, newLevel, statChanges, newAbilities, abilitiesData } = data

    // Calculate box height based on content
    const hasAbilities = newAbilities.length > 0
    const boxWidth = 520
    const baseHeight = 280
    const statsHeight = Math.ceil(statChanges.length / 2) * 28
    const abilitiesHeight = hasAbilities ? 40 + newAbilities.length * 50 : 0
    const boxHeight = Math.min(baseHeight + statsHeight + abilitiesHeight, GAME_HEIGHT - 80)

    const boxX = GAME_WIDTH / 2 - boxWidth / 2
    const boxY = GAME_HEIGHT / 2 - boxHeight / 2

    // Box background with golden glow effect
    const glow = this.scene.add.graphics()
    glow.fillStyle(COLORS.GOLD, 0.25)
    glow.fillRoundedRect(boxX - 12, boxY - 12, boxWidth + 24, boxHeight + 24, 22)
    this.container.add(glow)

    // Pulsing glow animation
    this.scene.tweens.add({
      targets: glow,
      alpha: 0.5,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    const bg = this.scene.add.graphics()
    bg.fillStyle(COLORS.DARK_BG, 0.98)
    bg.fillRoundedRect(boxX, boxY, boxWidth, boxHeight, 16)
    bg.lineStyle(4, COLORS.GOLD)
    bg.strokeRoundedRect(boxX, boxY, boxWidth, boxHeight, 16)
    this.container.add(bg)

    let yOffset = boxY + 25

    // "LEVEL UP!" banner with golden background
    const bannerBg = this.scene.add.graphics()
    bannerBg.fillStyle(COLORS.GOLD, 0.3)
    bannerBg.fillRoundedRect(boxX + 60, yOffset, boxWidth - 120, 55, 12)
    this.container.add(bannerBg)

    const bannerText = this.scene.add.text(boxX + boxWidth / 2, yOffset + 28, 'LEVEL UP!', {
      ...TEXT_STYLES.HEADING,
      fontSize: '32px',
      color: '#ffd700',
      stroke: '#8b4513',
      strokeThickness: 4,
    })
    bannerText.setOrigin(0.5)
    this.container.add(bannerText)

    // Banner scale animation
    this.scene.tweens.add({
      targets: bannerText,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 400,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
    })

    yOffset += 75

    // Player name and level change
    const levelText = this.scene.add.text(
      boxX + boxWidth / 2,
      yOffset,
      `${playerName}: Level ${previousLevel} → Level ${newLevel}`,
      {
        ...TEXT_STYLES.BODY,
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      },
    )
    levelText.setOrigin(0.5)
    levelText.setAlpha(0)
    this.container.add(levelText)

    // Reveal animation for level text
    this.scene.tweens.add({
      targets: levelText,
      alpha: 1,
      scaleX: { from: 0.8, to: 1 },
      scaleY: { from: 0.8, to: 1 },
      duration: 300,
      delay: 200,
      ease: 'Back.easeOut',
    })

    yOffset += 40

    // Stats section header
    const statsHeader = this.scene.add.text(boxX + boxWidth / 2, yOffset, '— Stat Increases —', {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      color: '#42a5f5',
      fontStyle: 'bold',
    })
    statsHeader.setOrigin(0.5)
    statsHeader.setAlpha(0)
    this.container.add(statsHeader)

    this.scene.tweens.add({
      targets: statsHeader,
      alpha: 1,
      duration: 300,
      delay: 400,
      ease: 'Power2',
    })

    yOffset += 28

    // Display stat changes in two columns with reveal animations
    const leftColumnX = boxX + boxWidth / 2 - 110
    const rightColumnX = boxX + boxWidth / 2 + 110
    const lineHeight = 28

    statChanges.forEach((stat, index) => {
      const columnX = index % 2 === 0 ? leftColumnX : rightColumnX
      const rowIndex = Math.floor(index / 2)
      const y = yOffset + rowIndex * lineHeight
      const delay = 500 + index * 100

      // Stat label and values
      const statText = this.scene.add.text(
        columnX,
        y,
        `${stat.label}: ${stat.previousValue} → ${stat.newValue}`,
        {
          ...TEXT_STYLES.BODY,
          fontSize: '14px',
          color: '#ffffff',
        },
      )
      statText.setOrigin(0.5)
      statText.setAlpha(0)
      statText.setScale(0.5)
      this.container.add(statText)

      // Change value in green
      const changeText = this.scene.add.text(columnX + 95, y, `+${stat.change}`, {
        ...TEXT_STYLES.BODY,
        fontSize: '14px',
        color: '#4caf50',
        fontStyle: 'bold',
      })
      changeText.setOrigin(0.5)
      changeText.setAlpha(0)
      changeText.setScale(0.5)
      this.container.add(changeText)

      // Reveal animation
      this.scene.tweens.add({
        targets: [statText, changeText],
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 250,
        delay,
        ease: 'Back.easeOut',
        onStart: () => {
          if (index === 0) {
            playSfx(SFX_KEYS.MENU_CONFIRM)
          }
        },
      })
    })

    yOffset += Math.ceil(statChanges.length / 2) * lineHeight + 15

    // New abilities section
    const totalRevealDelay = 500 + statChanges.length * 100

    if (hasAbilities) {
      const abilitiesHeader = this.scene.add.text(
        boxX + boxWidth / 2,
        yOffset,
        '✨ New Ability Learned! ✨',
        {
          ...TEXT_STYLES.BODY,
          fontSize: '16px',
          color: '#ffcc00',
          fontStyle: 'bold',
        },
      )
      abilitiesHeader.setOrigin(0.5)
      abilitiesHeader.setAlpha(0)
      this.container.add(abilitiesHeader)

      this.scene.tweens.add({
        targets: abilitiesHeader,
        alpha: 1,
        duration: 300,
        delay: totalRevealDelay,
        ease: 'Power2',
        onStart: () => {
          playSfx(SFX_KEYS.MENU_CONFIRM)
        },
      })

      yOffset += 30

      newAbilities.forEach((abilityId, index) => {
        const ability = abilitiesData?.find((a) => a.abilityId === abilityId)
        if (ability) {
          const abilityDelay = totalRevealDelay + 200 + index * 300

          const abilityText = this.scene.add.text(boxX + boxWidth / 2, yOffset, ability.name, {
            ...TEXT_STYLES.BODY,
            fontSize: '18px',
            color: '#ffeb3b',
            fontStyle: 'bold',
          })
          abilityText.setOrigin(0.5)
          abilityText.setAlpha(0)
          abilityText.setScale(0.5)
          this.container.add(abilityText)

          const descText = this.scene.add.text(boxX + boxWidth / 2, yOffset + 22, ability.description, {
            ...TEXT_STYLES.BODY,
            fontSize: '12px',
            color: '#b0bec5',
            fontStyle: 'italic',
            wordWrap: { width: boxWidth - 80 },
            align: 'center',
          })
          descText.setOrigin(0.5, 0)
          descText.setAlpha(0)
          this.container.add(descText)

          this.scene.tweens.add({
            targets: abilityText,
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
            duration: 300,
            delay: abilityDelay,
            ease: 'Back.easeOut',
          })

          this.scene.tweens.add({
            targets: descText,
            alpha: 1,
            duration: 300,
            delay: abilityDelay + 150,
            ease: 'Power2',
          })

          yOffset += 50
        }
      })
    }

    // Continue prompt
    const continueText = this.scene.add.text(
      boxX + boxWidth / 2,
      boxY + boxHeight - 28,
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

    // Show continue prompt after all animations
    const promptDelay = hasAbilities
      ? totalRevealDelay + 400 + newAbilities.length * 300
      : totalRevealDelay + 300

    this.scene.time.delayedCall(promptDelay, () => {
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
