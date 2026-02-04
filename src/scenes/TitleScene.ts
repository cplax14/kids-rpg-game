import Phaser from 'phaser'
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, COLORS, TEXT_STYLES } from '../config'
import { hasSaveData } from '../utils/storage'

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.TITLE })
  }

  create(): void {
    this.createBackground()
    this.createTitle()
    this.createMenuButtons()
    this.createFooter()
  }

  private createBackground(): void {
    const graphics = this.add.graphics()

    // Gradient background
    graphics.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e)
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    // Decorative stars
    for (let i = 0; i < 60; i++) {
      const x = Phaser.Math.Between(0, GAME_WIDTH)
      const y = Phaser.Math.Between(0, GAME_HEIGHT * 0.6)
      const size = Phaser.Math.FloatBetween(1, 3)
      const alpha = Phaser.Math.FloatBetween(0.3, 1.0)

      graphics.fillStyle(0xffffff, alpha)
      graphics.fillCircle(x, y, size)
    }

    // Ground area
    graphics.fillStyle(0x2e7d32, 1)
    graphics.fillRect(0, GAME_HEIGHT * 0.75, GAME_WIDTH, GAME_HEIGHT * 0.25)

    graphics.fillStyle(0x4caf50, 1)
    graphics.fillRect(0, GAME_HEIGHT * 0.75, GAME_WIDTH, 8)
  }

  private createTitle(): void {
    const centerX = GAME_WIDTH / 2

    // Main title with shadow
    const shadow = this.add.text(centerX + 3, 103, 'Monster Quest', {
      ...TEXT_STYLES.HEADING,
      fontSize: '64px',
      color: '#000000',
    })
    shadow.setOrigin(0.5)
    shadow.setAlpha(0.4)

    const title = this.add.text(centerX, 100, 'Monster Quest', {
      ...TEXT_STYLES.HEADING,
      fontSize: '64px',
      color: '#ffd54f',
    })
    title.setOrigin(0.5)

    // Subtitle
    const subtitle = this.add.text(centerX, 170, 'Capture  \u2022  Breed  \u2022  Battle', {
      ...TEXT_STYLES.BODY,
      fontSize: '22px',
      color: '#b0bec5',
    })
    subtitle.setOrigin(0.5)

    // Animate title
    this.tweens.add({
      targets: [title, shadow],
      y: '+=8',
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  private createMenuButtons(): void {
    const centerX = GAME_WIDTH / 2
    const startY = 300

    this.createButton(centerX, startY, 'New Game', () => {
      this.startNewGame()
    })

    const hasSave = hasSaveData(0) || hasSaveData(1) || hasSaveData(2)
    const continueButton = this.createButton(centerX, startY + 80, 'Continue', () => {
      this.continueGame()
    })

    if (!hasSave) {
      continueButton.forEach((obj) => {
        if ('setAlpha' in obj) {
          ;(obj as Phaser.GameObjects.Image | Phaser.GameObjects.Text).setAlpha(0.4)
        }
      })
    }
  }

  private createButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
  ): Phaser.GameObjects.GameObject[] {
    const bg = this.add.image(x, y, 'button')
    bg.setOrigin(0.5)
    bg.setInteractive({ useHandCursor: true })

    const text = this.add.text(x, y, label, TEXT_STYLES.BUTTON)
    text.setOrigin(0.5)

    bg.on('pointerover', () => {
      bg.setTexture('button-hover')
      this.tweens.add({
        targets: [bg, text],
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100,
        ease: 'Power1',
      })
    })

    bg.on('pointerout', () => {
      bg.setTexture('button')
      this.tweens.add({
        targets: [bg, text],
        scaleX: 1.0,
        scaleY: 1.0,
        duration: 100,
        ease: 'Power1',
      })
    })

    bg.on('pointerdown', () => {
      this.tweens.add({
        targets: [bg, text],
        scaleX: 0.95,
        scaleY: 0.95,
        duration: 50,
        ease: 'Power1',
        yoyo: true,
        onComplete: onClick,
      })
    })

    return [bg, text]
  }

  private createFooter(): void {
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, 'v0.1.0 - Phase 1', {
      ...TEXT_STYLES.SMALL,
      color: '#546e7a',
    })
    text.setOrigin(0.5)
  }

  private startNewGame(): void {
    this.cameras.main.fadeOut(500, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENE_KEYS.WORLD, { newGame: true })
    })
  }

  private continueGame(): void {
    const hasSave = hasSaveData(0) || hasSaveData(1) || hasSaveData(2)
    if (!hasSave) return

    this.cameras.main.fadeOut(500, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENE_KEYS.WORLD, { newGame: false, saveSlot: 0 })
    })
  }
}
