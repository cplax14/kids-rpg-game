export const GAME_WIDTH = 1280
export const GAME_HEIGHT = 720
export const TILE_SIZE = 32

export const PLAYER_SPEED = 160

export const MAX_SQUAD_SIZE = 4
export const MAX_INVENTORY_SLOTS = 30
export const MAX_STORAGE_MONSTERS = 50
export const SAVE_SLOTS = 3

export const SCENE_KEYS = {
  BOOT: 'BootScene',
  PRELOADER: 'PreloaderScene',
  TITLE: 'TitleScene',
  WORLD: 'WorldScene',
  BATTLE: 'BattleScene',
  MENU: 'MenuScene',
  SHOP: 'ShopScene',
  BREEDING: 'BreedingScene',
  DIALOG: 'DialogScene',
  TRANSITION: 'TransitionScene',
  GAME_OVER: 'GameOverScene',
} as const

export const DEPTH = {
  GROUND: 0,
  BELOW_PLAYER: 5,
  PLAYER: 10,
  ABOVE_PLAYER: 15,
  UI: 100,
  OVERLAY: 200,
} as const

export const COLORS = {
  PRIMARY: 0x4fc3f7,
  SECONDARY: 0x7e57c2,
  SUCCESS: 0x66bb6a,
  DANGER: 0xef5350,
  WARNING: 0xffa726,
  GOLD: 0xffd54f,
  WHITE: 0xffffff,
  BLACK: 0x000000,
  DARK_BG: 0x1a1a2e,
  PANEL_BG: 0x16213e,
  TEXT_LIGHT: 0xf0f0f0,
  TEXT_DARK: 0x333333,
  HP_GREEN: 0x66bb6a,
  HP_YELLOW: 0xffa726,
  HP_RED: 0xef5350,
  MP_BLUE: 0x42a5f5,
  XP_PURPLE: 0x7c4dff,
  BAR_BG: 0x333333,
} as const

export const FONTS = {
  BODY: 'Arial, sans-serif',
  HEADING: 'Arial Black, Arial, sans-serif',
} as const

export const TEXT_STYLES = {
  HEADING: {
    fontFamily: FONTS.HEADING,
    fontSize: '32px',
    color: '#ffffff',
  },
  BODY: {
    fontFamily: FONTS.BODY,
    fontSize: '18px',
    color: '#f0f0f0',
  },
  BUTTON: {
    fontFamily: FONTS.HEADING,
    fontSize: '24px',
    color: '#ffffff',
  },
  SMALL: {
    fontFamily: FONTS.BODY,
    fontSize: '14px',
    color: '#cccccc',
  },
} as const

export const TEXT_SPEED_MS = {
  slow: 80,
  normal: 40,
  fast: 15,
} as const
