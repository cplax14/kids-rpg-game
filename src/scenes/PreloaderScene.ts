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
  }

  private loadAudioAssets(): void {
    // Load music tracks (placeholder paths - real files would be added later)
    this.load.audio(MUSIC_KEYS.TITLE_THEME, 'assets/audio/music/title.ogg')
    this.load.audio(MUSIC_KEYS.VILLAGE_PEACEFUL, 'assets/audio/music/village.ogg')
    this.load.audio(MUSIC_KEYS.FOREST_MYSTICAL, 'assets/audio/music/forest.ogg')
    this.load.audio(MUSIC_KEYS.CAVE_AMBIENT, 'assets/audio/music/cave.ogg')
    this.load.audio(MUSIC_KEYS.BATTLE_NORMAL, 'assets/audio/music/battle.ogg')
    this.load.audio(MUSIC_KEYS.BATTLE_BOSS, 'assets/audio/music/boss.ogg')
    this.load.audio(MUSIC_KEYS.VICTORY_FANFARE, 'assets/audio/music/victory.ogg')

    // Load SFX
    this.load.audio(SFX_KEYS.MENU_SELECT, 'assets/audio/sfx/menu-select.ogg')
    this.load.audio(SFX_KEYS.MENU_CONFIRM, 'assets/audio/sfx/menu-confirm.ogg')
    this.load.audio(SFX_KEYS.ATTACK_HIT, 'assets/audio/sfx/attack-hit.ogg')
    this.load.audio(SFX_KEYS.CAPTURE_THROW, 'assets/audio/sfx/capture-throw.ogg')
    this.load.audio(SFX_KEYS.CAPTURE_SHAKE, 'assets/audio/sfx/capture-shake.ogg')
    this.load.audio(SFX_KEYS.CAPTURE_SUCCESS, 'assets/audio/sfx/capture-success.ogg')
    this.load.audio(SFX_KEYS.CAPTURE_FAIL, 'assets/audio/sfx/capture-fail.ogg')
    this.load.audio(SFX_KEYS.LEVEL_UP, 'assets/audio/sfx/level-up.ogg')
    this.load.audio(SFX_KEYS.HEAL, 'assets/audio/sfx/heal.ogg')
    this.load.audio(SFX_KEYS.CHEST_OPEN, 'assets/audio/sfx/chest-open.ogg')
    this.load.audio(SFX_KEYS.QUEST_ACCEPT, 'assets/audio/sfx/quest-accept.ogg')
    this.load.audio(SFX_KEYS.QUEST_PROGRESS, 'assets/audio/sfx/quest-progress.ogg')
    this.load.audio(SFX_KEYS.QUEST_COMPLETE, 'assets/audio/sfx/quest-complete.ogg')

    // Handle audio loading errors gracefully (audio files may not exist yet)
    this.load.on('loaderror', (fileObj: Phaser.Loader.File) => {
      if (fileObj.type === 'audio') {
        // Silently ignore missing audio files during development
        console.warn(`Audio file not found: ${fileObj.key}`)
      }
    })
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
