import Phaser from 'phaser'
import { GAME_WIDTH, GAME_HEIGHT, SCENE_KEYS } from './config'
import { BootScene } from './scenes/BootScene'
import { PreloaderScene } from './scenes/PreloaderScene'
import { TitleScene } from './scenes/TitleScene'
import { WorldScene } from './scenes/WorldScene'
import { BattleScene } from './scenes/BattleScene'
import { MenuScene } from './scenes/MenuScene'
import { DialogScene } from './scenes/DialogScene'
import { ShopScene } from './scenes/ShopScene'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    min: {
      width: 640,
      height: 360,
    },
  },
  scene: [BootScene, PreloaderScene, TitleScene, WorldScene, BattleScene, MenuScene, DialogScene, ShopScene],
}

const game = new Phaser.Game(config)

export default game
