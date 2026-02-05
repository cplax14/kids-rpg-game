import Phaser from 'phaser'
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, COLORS, TEXT_STYLES, TILE_SIZE } from '../config'
import { MUSIC_KEYS, SFX_KEYS } from '../systems/AudioSystem'

export class PreloaderScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.PRELOADER })
  }

  preload(): void {
    this.createLoadingBar()
    this.loadAssets()
    this.loadAudioAssets()
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
    this.load.json('areas-data', 'assets/data/areas.json')
    this.load.json('bosses-data', 'assets/data/bosses.json')

    // Load audio config and tutorial data
    this.load.json('audio-config', 'assets/data/audio-config.json')
    this.load.json('tutorials-data', 'assets/data/tutorials.json')

    // Load quest data
    this.load.json('quests-data', 'assets/data/quests.json')

    // Load real sprite sheets (16x16 pixel art)
    this.load.spritesheet('characters-sheet', 'assets/sprites/characters/characters.png', {
      frameWidth: 16,
      frameHeight: 16,
    })

    this.load.spritesheet('creatures-sheet', 'assets/sprites/monsters/creatures-sheet.png', {
      frameWidth: 16,
      frameHeight: 16,
    })

    this.load.spritesheet('items-sheet', 'assets/sprites/effects/things.png', {
      frameWidth: 16,
      frameHeight: 16,
    })

    // Load tilesets
    this.load.image('basictiles', 'assets/tilesets/basictiles.png')
    this.load.image('rpg-overworld', 'assets/tilesets/rpg-overworld.png')
    this.load.image('rpg-dungeon', 'assets/tilesets/rpg-dungeon.png')
  }

  private loadAudioAssets(): void {
    // Audio loading disabled until real audio files are added
    // The audio system will handle missing audio gracefully
    // TODO: Enable audio loading when assets/audio/ files are added
    //
    // Music tracks to add:
    // - assets/audio/music/title.ogg
    // - assets/audio/music/village.ogg
    // - assets/audio/music/forest.ogg
    // - assets/audio/music/cave.ogg
    // - assets/audio/music/battle.ogg
    // - assets/audio/music/boss.ogg
    // - assets/audio/music/victory.ogg
    //
    // SFX to add:
    // - assets/audio/sfx/menu-select.ogg
    // - assets/audio/sfx/menu-confirm.ogg
    // - assets/audio/sfx/attack-hit.ogg
    // - assets/audio/sfx/capture-throw.ogg
    // - assets/audio/sfx/capture-shake.ogg
    // - assets/audio/sfx/capture-success.ogg
    // - assets/audio/sfx/capture-fail.ogg
    // - assets/audio/sfx/level-up.ogg
    // - assets/audio/sfx/heal.ogg
    // - assets/audio/sfx/chest-open.ogg
    // - assets/audio/sfx/quest-accept.ogg
    // - assets/audio/sfx/quest-progress.ogg
    // - assets/audio/sfx/quest-complete.ogg
  }

  private createPlayerAnimations(): void {
    // Check if we have the real character sheet loaded
    const hasCharacterSheet = this.textures.exists('characters-sheet')

    if (hasCharacterSheet) {
      this.createRealPlayerAnimations()
    } else {
      this.createFallbackPlayerAnimations()
    }
  }

  private createRealPlayerAnimations(): void {
    // Characters sheet is 192x128 (12x8 grid of 16x16 sprites)
    // Tiny 16 Basic layout: Each row has different character types
    // We'll use the first character (knight/hero) - frames in row 0-1
    // Frame layout for hero character:
    // Row 0: Down facing (frames 0-2), Right facing (frames 3-5)
    // Row 1: Up facing (frames 6-8), Left facing (frames 9-11) - adjusted for sheet

    // For Tiny 16 Basic, characters are arranged:
    // Columns 0-2: Down walk cycle
    // Columns 3-5: Side walk cycle (can flip for left/right)
    // Columns 6-8: Up walk cycle

    const frameMap = {
      down: [0, 1, 2],      // First 3 frames - down facing
      right: [3, 4, 5],     // Next 3 frames - side facing
      left: [3, 4, 5],      // Same as right, we'll flip the sprite
      up: [6, 7, 8],        // Up facing frames
    } as const

    const directions = ['down', 'left', 'right', 'up'] as const

    directions.forEach((dir) => {
      const frameIndices = frameMap[dir]
      const frames = frameIndices.map((index) => ({
        key: 'characters-sheet',
        frame: index,
      }))

      this.anims.create({
        key: `player-walk-${dir}`,
        frames,
        frameRate: 8,
        repeat: -1,
      })

      // Idle animation (middle frame)
      this.anims.create({
        key: `player-idle-${dir}`,
        frames: [{ key: 'characters-sheet', frame: frameIndices[1] }],
        frameRate: 1,
        repeat: 0,
      })
    })
  }

  private createFallbackPlayerAnimations(): void {
    // Fallback to procedural player texture
    const frameWidth = 32
    const frameHeight = 48

    this.textures.get('player').add(
      'player-sheet',
      0,
      0,
      0,
      frameWidth * 3,
      frameHeight * 4,
    )

    const directions = ['down', 'left', 'right', 'up'] as const
    const playerTexture = this.textures.get('player')

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

      this.anims.create({
        key: `player-idle-${dir}`,
        frames: [{ key: 'player', frame: `${dir}-1` }],
        frameRate: 1,
        repeat: 0,
      })
    })
  }
}
