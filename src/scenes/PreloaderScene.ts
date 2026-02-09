import Phaser from 'phaser'
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, COLORS, TEXT_STYLES } from '../config'

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
    this.createNPCAnimations()
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

    // Load achievement data
    this.load.json('achievements-data', 'assets/data/achievements.json')

    // ===========================================
    // NEW 32x32 ASSETS
    // ===========================================

    // Load 32x32 character sprite sheet (transparent background)
    // Layout: 12 columns × 21 rows, each character has 12 frames
    // Cols 0-2: Down, Cols 3-5: Left, Cols 6-8: Right, Cols 9-11: Up
    this.load.spritesheet('characters-32', 'assets/sprites/characters/rpg-characters-32x32-transparent.png', {
      frameWidth: 32,
      frameHeight: 32,
    })

    // Load monster portrait icons (32x32, transparent)
    for (let i = 1; i <= 50; i++) {
      this.load.image(`monster-icon-${i}`, `assets/sprites/monsters/Icon${i}.png`)
    }

    // Load Mixel 32x32 tilesets as spritesheets for decoration sprites
    this.load.spritesheet('tileset-ground', 'assets/tilesets/mixel-32x32/Topdown RPG 32x32 - Ground Tileset.png', {
      frameWidth: 32,
      frameHeight: 32,
    })
    // Load trees at 32x32 for small elements (shadows, leaves)
    this.load.spritesheet('tileset-trees', 'assets/tilesets/mixel-32x32/Topdown RPG 32x32 - Trees.PNG', {
      frameWidth: 32,
      frameHeight: 32,
    })
    // Load trees at 64x96 for full tree sprites (2 tiles wide, 3 tiles tall)
    // The tileset is 384x320, so 64x96 gives us 6 columns x 3 rows of full trees
    this.load.spritesheet('tileset-trees-large', 'assets/tilesets/mixel-32x32/Topdown RPG 32x32 - Trees.PNG', {
      frameWidth: 64,
      frameHeight: 96,
    })
    this.load.spritesheet('tileset-bushes', 'assets/tilesets/mixel-32x32/Topdown RPG 32x32 - Bushes.PNG', {
      frameWidth: 32,
      frameHeight: 32,
    })
    this.load.spritesheet('tileset-rocks', 'assets/tilesets/mixel-32x32/Topdown RPG 32x32 - Rocks.PNG', {
      frameWidth: 32,
      frameHeight: 32,
    })
    this.load.spritesheet('tileset-mushrooms', 'assets/tilesets/mixel-32x32/Topdown RPG 32x32 - Mushrooms.png', {
      frameWidth: 32,
      frameHeight: 32,
    })
    this.load.spritesheet('tileset-stumps', 'assets/tilesets/mixel-32x32/Topdown RPG 32x32 - Tree Stumps and Logs.png', {
      frameWidth: 32,
      frameHeight: 32,
    })
    this.load.spritesheet('tileset-nature', 'assets/tilesets/mixel-32x32/Topdown RPG 32x32 - Nature Details.png', {
      frameWidth: 32,
      frameHeight: 32,
    })
    this.load.spritesheet('tileset-ruins', 'assets/tilesets/mixel-32x32/Topdown RPG 32x32 - Ruins.PNG', {
      frameWidth: 32,
      frameHeight: 32,
    })

    // ===========================================
    // LEGACY 16x16 ASSETS (kept for backwards compatibility)
    // ===========================================

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

    // Legacy tilesets
    this.load.image('basictiles', 'assets/tilesets/basictiles.png')
    this.load.image('rpg-overworld', 'assets/tilesets/rpg-overworld.png')
    this.load.image('rpg-dungeon', 'assets/tilesets/rpg-dungeon.png')

    // ===========================================
    // NINJA ADVENTURE UI/ITEMS (16x16)
    // ===========================================

    // HUD elements
    this.load.image('ui-heart', 'assets/ninja-adventure/hud/heart.png')
    this.load.image('ui-dialog', 'assets/ninja-adventure/hud/dialogue-bubble.png')

    // Item icons
    this.load.image('item-coin', 'assets/ninja-adventure/items/gold-coin.png')
    this.load.image('item-heart', 'assets/ninja-adventure/items/heart.png')
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
    // Try to use 32x32 characters first, fall back to 16x16
    const has32Characters = this.textures.exists('characters-32')
    const has16Characters = this.textures.exists('characters-sheet')

    if (has32Characters) {
      this.create32PlayerAnimations()
    } else if (has16Characters) {
      this.create16PlayerAnimations()
    } else {
      this.createFallbackPlayerAnimations()
    }
  }

  private create32PlayerAnimations(): void {
    // 32x32 character sheet layout (rpg-characters-32x32-transparent.png):
    // - 12 columns × 21 rows of 32x32 sprites
    // - Each row is one character with 12 frames total:
    //   - Columns 0-2: Down-facing (3 frames)
    //   - Columns 3-5: Left-facing (3 frames)
    //   - Columns 6-8: Right-facing (3 frames)
    //   - Columns 9-11: Up-facing (3 frames)
    //
    // Walk cycle pattern: Frame 1 is standing, frames 0 and 2 are walk poses
    // Proper walk sequence: 1 -> 0 -> 1 -> 2 (stand, step, stand, step)
    //
    // Player character uses row 2 (light skin, blonde hair)

    const COLS_PER_ROW = 12
    const PLAYER_ROW = 2 // Light skin, blonde hair

    const rowStart = PLAYER_ROW * COLS_PER_ROW

    // Sprite sheet layout analysis:
    // - Cols 0-2: Down/Front-facing
    // - Cols 3-5: Up/Back-facing
    // - Cols 6-8: Up/Back-facing (duplicate)
    // - Cols 9-11: Left side profile (only one side view exists)
    //
    // For right-facing, we use left sprites and flip horizontally in the game
    const directionOffsets = {
      down: 0,   // Cols 0-2: Front-facing
      up: 3,     // Cols 3-5: Back-facing
      left: 9,   // Cols 9-11: Left side profile
      right: 9,  // Same as left (flip sprite horizontally in player code)
    } as const

    const directions = ['down', 'left', 'right', 'up'] as const

    directions.forEach((dir) => {
      const offset = directionOffsets[dir]
      const base = rowStart + offset

      // Different frame patterns for different directions:
      // - Down/Up: frames 1 and 2 work (frame 0 has issues)
      // - Left/Right: frames 0 and 1 work (frame 2 is empty/weapons)
      const isHorizontal = dir === 'left' || dir === 'right'

      const walkFrames = isHorizontal
        ? [
            { key: 'characters-32', frame: base + 0 }, // Walk pose 1
            { key: 'characters-32', frame: base + 1 }, // Walk pose 2
          ]
        : [
            { key: 'characters-32', frame: base + 1 }, // Neutral
            { key: 'characters-32', frame: base + 2 }, // Walk pose
          ]

      const idleFrame = isHorizontal ? base + 1 : base + 1

      this.anims.create({
        key: `player-walk-${dir}`,
        frames: walkFrames,
        frameRate: 6,
        repeat: -1,
      })

      // Idle animation
      this.anims.create({
        key: `player-idle-${dir}`,
        frames: [{ key: 'characters-32', frame: idleFrame }],
        frameRate: 1,
        repeat: 0,
      })
    })
  }

  private createNPCAnimations(): void {
    // Create animations for NPCs using the 32x32 character sheet
    const has32Characters = this.textures.exists('characters-32')
    if (!has32Characters) return

    const COLS_PER_ROW = 12

    // NPC row mappings from CHARACTER-MAP.md
    const npcRows: Record<string, number> = {
      'village-guide': 10,    // Brown clothed
      'shopkeeper': 14,       // Tan/merchant
      'healer': 8,            // White robed
      'breeder': 16,          // Orange clothed
      'guard': 6,             // Gray armored knight
      'skeleton': 0,          // White skeleton (enemy)
    }

    // Direction offsets within each row (same as player)
    const directionOffsets = {
      down: 0,   // Cols 0-2: Front-facing
      up: 3,     // Cols 3-5: Back-facing
      left: 9,   // Cols 9-11: Left side profile
      right: 9,  // Same as left (flip sprite horizontally)
    } as const

    const directions = ['down', 'left', 'right', 'up'] as const

    Object.entries(npcRows).forEach(([npcId, row]) => {
      const rowStart = row * COLS_PER_ROW

      directions.forEach((dir) => {
        const offset = directionOffsets[dir]
        const base = rowStart + offset

        // Different frame patterns for different directions
        const isHorizontal = dir === 'left' || dir === 'right'

        const walkFrames = isHorizontal
          ? [
              { key: 'characters-32', frame: base + 0 },
              { key: 'characters-32', frame: base + 1 },
            ]
          : [
              { key: 'characters-32', frame: base + 1 },
              { key: 'characters-32', frame: base + 2 },
            ]

        const idleFrame = base + 1

        this.anims.create({
          key: `${npcId}-walk-${dir}`,
          frames: walkFrames,
          frameRate: 5,
          repeat: -1,
        })

        this.anims.create({
          key: `${npcId}-idle-${dir}`,
          frames: [{ key: 'characters-32', frame: idleFrame }],
          frameRate: 1,
          repeat: 0,
        })
      })
    })
  }

  private create16PlayerAnimations(): void {
    // Legacy 16x16 character sheet animations
    // Characters sheet is 192x128 (12x8 grid of 16x16 sprites)
    const COLS_PER_ROW = 12

    const frameMap = {
      down: [0, 1, 2],
      left: [COLS_PER_ROW + 0, COLS_PER_ROW + 1, COLS_PER_ROW + 2],
      right: [COLS_PER_ROW + 0, COLS_PER_ROW + 1, COLS_PER_ROW + 2],
      up: [COLS_PER_ROW * 3 + 0, COLS_PER_ROW * 3 + 1, COLS_PER_ROW * 3 + 2],
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
