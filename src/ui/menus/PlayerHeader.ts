import Phaser from 'phaser'
import { COLORS, TEXT_STYLES, DEPTH, GAME_WIDTH } from '../../config'
import { getGameState } from '../../systems/GameStateManager'
import { getArea } from '../../systems/WorldSystem'
import { formatPlayTime } from '../../systems/SaveSystem'

const HEADER_HEIGHT = 85

export class PlayerHeader {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private playTime: number
  private xpBarFill!: Phaser.GameObjects.Graphics
  private hpBarFill!: Phaser.GameObjects.Graphics
  private mpBarFill!: Phaser.GameObjects.Graphics
  private xpText!: Phaser.GameObjects.Text
  private hpText!: Phaser.GameObjects.Text
  private mpText!: Phaser.GameObjects.Text
  private goldText!: Phaser.GameObjects.Text
  private levelText!: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene, x: number, y: number, playTime: number = 0) {
    this.scene = scene
    this.playTime = playTime
    this.container = scene.add.container(x, y)
    this.container.setDepth(DEPTH.OVERLAY + 1)

    this.createBackground()
    this.createPlayerInfo()
    this.createProgressBars()
    this.createResourceDisplay()
  }

  private createBackground(): void {
    const bg = this.scene.add.graphics()
    bg.fillStyle(COLORS.PANEL_BG, 0.8)
    bg.fillRoundedRect(0, 0, GAME_WIDTH - 80, HEADER_HEIGHT, 10)
    bg.lineStyle(1, COLORS.PRIMARY, 0.3)
    bg.strokeRoundedRect(0, 0, GAME_WIDTH - 80, HEADER_HEIGHT, 10)
    this.container.add(bg)
  }

  private createPlayerInfo(): void {
    const state = getGameState(this.scene)

    // Player name with badge styling
    const nameBg = this.scene.add.graphics()
    nameBg.fillStyle(COLORS.PRIMARY, 0.3)
    nameBg.fillRoundedRect(10, 8, 140, 28, 6)
    this.container.add(nameBg)

    const nameText = this.scene.add.text(20, 12, state.player.name, {
      ...TEXT_STYLES.BODY,
      fontSize: '18px',
      fontStyle: 'bold',
    })
    this.container.add(nameText)

    // Level display
    this.levelText = this.scene.add.text(165, 12, `Level ${state.player.level}`, {
      ...TEXT_STYLES.BODY,
      fontSize: '18px',
      color: '#ffd54f',
    })
    this.container.add(this.levelText)

    // Current area
    const area = getArea(state.currentAreaId)
    const areaName = area?.name ?? 'Unknown'
    const areaText = this.scene.add.text(300, 12, areaName, {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      color: '#b0bec5',
    })
    this.container.add(areaText)

    // Play time (if provided)
    if (this.playTime > 0) {
      const timeText = this.scene.add.text(500, 12, formatPlayTime(this.playTime), {
        ...TEXT_STYLES.SMALL,
        fontSize: '14px',
        color: '#888888',
      })
      this.container.add(timeText)
    }
  }

  private createProgressBars(): void {
    const state = getGameState(this.scene)
    const barWidth = 200
    const barHeight = 14
    const smallBarWidth = 140
    const smallBarHeight = 10

    // XP Progress Bar
    const xpY = 42
    const xpLabel = this.scene.add.text(10, xpY, 'XP', {
      ...TEXT_STYLES.SMALL,
      fontSize: '11px',
      color: '#b0bec5',
    })
    this.container.add(xpLabel)

    // XP bar background
    const xpBarBg = this.scene.add.graphics()
    xpBarBg.fillStyle(COLORS.BAR_BG, 1)
    xpBarBg.fillRoundedRect(35, xpY, barWidth, barHeight, 4)
    this.container.add(xpBarBg)

    // XP bar fill
    this.xpBarFill = this.scene.add.graphics()
    this.container.add(this.xpBarFill)
    this.drawXpBar(state.player.experience, state.player.experienceToNextLevel, barWidth, barHeight, 35, xpY)

    // XP text
    const xpPercent = Math.floor((state.player.experience / state.player.experienceToNextLevel) * 100)
    this.xpText = this.scene.add.text(240, xpY, `${state.player.experience}/${state.player.experienceToNextLevel} (${xpPercent}%)`, {
      ...TEXT_STYLES.SMALL,
      fontSize: '11px',
      color: '#cccccc',
    })
    this.container.add(this.xpText)

    // HP Bar
    const hpY = 62
    const hpLabel = this.scene.add.text(10, hpY, 'HP', {
      ...TEXT_STYLES.SMALL,
      fontSize: '11px',
      color: '#66bb6a',
    })
    this.container.add(hpLabel)

    const hpBarBg = this.scene.add.graphics()
    hpBarBg.fillStyle(COLORS.BAR_BG, 1)
    hpBarBg.fillRoundedRect(35, hpY, smallBarWidth, smallBarHeight, 3)
    this.container.add(hpBarBg)

    this.hpBarFill = this.scene.add.graphics()
    this.container.add(this.hpBarFill)
    this.drawHpBar(state.player.stats.currentHp, state.player.stats.maxHp, smallBarWidth, smallBarHeight, 35, hpY)

    this.hpText = this.scene.add.text(180, hpY, `${state.player.stats.currentHp}/${state.player.stats.maxHp}`, {
      ...TEXT_STYLES.SMALL,
      fontSize: '11px',
      color: '#66bb6a',
    })
    this.container.add(this.hpText)

    // MP Bar
    const mpY = 62
    const mpLabel = this.scene.add.text(260, mpY, 'MP', {
      ...TEXT_STYLES.SMALL,
      fontSize: '11px',
      color: '#42a5f5',
    })
    this.container.add(mpLabel)

    const mpBarBg = this.scene.add.graphics()
    mpBarBg.fillStyle(COLORS.BAR_BG, 1)
    mpBarBg.fillRoundedRect(285, mpY, smallBarWidth, smallBarHeight, 3)
    this.container.add(mpBarBg)

    this.mpBarFill = this.scene.add.graphics()
    this.container.add(this.mpBarFill)
    this.drawMpBar(state.player.stats.currentMp, state.player.stats.maxMp, smallBarWidth, smallBarHeight, 285, mpY)

    this.mpText = this.scene.add.text(430, mpY, `${state.player.stats.currentMp}/${state.player.stats.maxMp}`, {
      ...TEXT_STYLES.SMALL,
      fontSize: '11px',
      color: '#42a5f5',
    })
    this.container.add(this.mpText)
  }

  private createResourceDisplay(): void {
    const state = getGameState(this.scene)

    // Gold display with styled background
    const goldBg = this.scene.add.graphics()
    goldBg.fillStyle(COLORS.GOLD, 0.15)
    goldBg.fillRoundedRect(480, 55, 100, 22, 6)
    this.container.add(goldBg)

    this.goldText = this.scene.add.text(490, 58, `Gold: ${state.player.gold}`, {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
      color: '#ffd54f',
    })
    this.container.add(this.goldText)
  }

  private drawXpBar(current: number, max: number, width: number, height: number, x: number, y: number): void {
    this.xpBarFill.clear()
    const progress = Math.min(current / max, 1)
    const fillWidth = width * progress
    if (fillWidth > 0) {
      this.xpBarFill.fillStyle(COLORS.XP_PURPLE, 1)
      this.xpBarFill.fillRoundedRect(x, y, fillWidth, height, 4)
    }
  }

  private drawHpBar(current: number, max: number, width: number, height: number, x: number, y: number): void {
    this.hpBarFill.clear()
    const progress = Math.min(current / max, 1)
    const fillWidth = width * progress
    if (fillWidth > 0) {
      // Color based on HP percentage
      let color: number = COLORS.HP_GREEN
      if (progress < 0.3) color = COLORS.HP_RED
      else if (progress < 0.6) color = COLORS.HP_YELLOW
      this.hpBarFill.fillStyle(color, 1)
      this.hpBarFill.fillRoundedRect(x, y, fillWidth, height, 3)
    }
  }

  private drawMpBar(current: number, max: number, width: number, height: number, x: number, y: number): void {
    this.mpBarFill.clear()
    const progress = Math.min(current / max, 1)
    const fillWidth = width * progress
    if (fillWidth > 0) {
      this.mpBarFill.fillStyle(COLORS.MP_BLUE, 1)
      this.mpBarFill.fillRoundedRect(x, y, fillWidth, height, 3)
    }
  }

  refresh(): void {
    const state = getGameState(this.scene)

    // Update level
    this.levelText.setText(`Level ${state.player.level}`)

    // Update XP bar
    const barWidth = 200
    const barHeight = 14
    this.drawXpBar(state.player.experience, state.player.experienceToNextLevel, barWidth, barHeight, 35, 42)
    const xpPercent = Math.floor((state.player.experience / state.player.experienceToNextLevel) * 100)
    this.xpText.setText(`${state.player.experience}/${state.player.experienceToNextLevel} (${xpPercent}%)`)

    // Update HP bar
    const smallBarWidth = 140
    const smallBarHeight = 10
    this.drawHpBar(state.player.stats.currentHp, state.player.stats.maxHp, smallBarWidth, smallBarHeight, 35, 62)
    this.hpText.setText(`${state.player.stats.currentHp}/${state.player.stats.maxHp}`)

    // Update MP bar
    this.drawMpBar(state.player.stats.currentMp, state.player.stats.maxMp, smallBarWidth, smallBarHeight, 285, 62)
    this.mpText.setText(`${state.player.stats.currentMp}/${state.player.stats.maxMp}`)

    // Update gold
    this.goldText.setText(`Gold: ${state.player.gold}`)
  }

  destroy(): void {
    this.container.destroy()
  }
}
