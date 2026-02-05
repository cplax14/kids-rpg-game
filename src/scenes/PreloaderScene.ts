import Phaser from 'phaser'
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, COLORS, TEXT_STYLES, TILE_SIZE } from '../config'

export class PreloaderScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.PRELOADER })
  }

  preload(): void {
    this.createLoadingBar()
    this.loadAssets()
  }

  create(): void {
    this.createPlayerAnimations()
    this.scene.start(SCENE_KEYS.TITLE)
  }

  private createLoadingBar(): void {
    const centerX = GAME_WIDTH / 2
    const centerY = GAME_HEIGHT / 2

    const title = this.add.text(centerX, centerY - 80, 'Monster Quest', {
      ...TEXT_STYLES.HEADING,
      fontSize: '48px',
    })
    title.setOrigin(0.5)

    const subtitle = this.add.text(centerX, centerY - 30, 'Loading...', TEXT_STYLES.BODY)
    subtitle.setOrigin(0.5)

    const barWidth = 400
    const barHeight = 30

    const barBg = this.add.graphics()
    barBg.fillStyle(0x333333, 1)
    barBg.fillRoundedRect(centerX - barWidth / 2, centerY + 20, barWidth, barHeight, 8)

    const barFill = this.add.graphics()

    this.load.on('progress', (value: number) => {
      barFill.clear()
      barFill.fillStyle(COLORS.PRIMARY, 1)
      barFill.fillRoundedRect(
        centerX - barWidth / 2 + 4,
        centerY + 24,
        (barWidth - 8) * value,
        barHeight - 8,
        6,
      )
    })
  }

  private loadAssets(): void {
    // Load the village tilemap JSON
    this.load.tilemapTiledJSON('village-map', 'assets/tilemaps/village.json')

    // Load game data
    this.load.json('monsters-data', 'assets/data/monsters.json')
    this.load.json('items-data', 'assets/data/items.json')
    this.load.json('abilities-data', 'assets/data/abilities.json')
    this.load.json('equipment-data', 'assets/data/equipment.json')
    this.load.json('dialogs-data', 'assets/data/dialogs.json')
    this.load.json('traits-data', 'assets/data/traits.json')
    this.load.json('breeding-recipes-data', 'assets/data/breeding-recipes.json')
  }

  private createPlayerAnimations(): void {
    const frameWidth = 32
    const frameHeight = 48

    // Add sprite sheet frames from the canvas texture
    this.textures.get('player').add(
      'player-sheet',
      0,
      0,
      0,
      frameWidth * 3,
      frameHeight * 4,
    )

    // Create animation frames manually from the canvas texture
    const directions = ['down', 'left', 'right', 'up'] as const
    const playerTexture = this.textures.get('player')

    // Generate frames for each direction
    directions.forEach((dir, dirIndex) => {
      const frames = Array.from({ length: 3 }, (_, i) => {
        const frameName = `${dir}-${i}`
        playerTexture.add(
          frameName,
          0,
          i * frameWidth,
          dirIndex * frameHeight,
          frameWidth,
          frameHeight,
        )
        return { key: 'player', frame: frameName }
      })

      this.anims.create({
        key: `player-walk-${dir}`,
        frames,
        frameRate: 8,
        repeat: -1,
      })

      // Idle animation (just the middle frame)
      this.anims.create({
        key: `player-idle-${dir}`,
        frames: [{ key: 'player', frame: `${dir}-1` }],
        frameRate: 1,
        repeat: 0,
      })
    })
  }
}
