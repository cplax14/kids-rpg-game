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
  EVOLUTION: 'EvolutionScene',
  DIALOG: 'DialogScene',
  TRANSITION: 'TransitionScene',
  GAME_OVER: 'GameOverScene',
  DEFEAT_RECOVERY: 'DefeatRecoveryScene',
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
  STARDUST: 0xce93d8,
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

// ── Roaming Monster Constants ──

export const ROAMING_MONSTER_SPEED = 50
export const ROAMING_ENCOUNTER_RADIUS = 1.5 * TILE_SIZE
export const ROAMING_NOTICE_RADIUS = 4 * TILE_SIZE
export const MAX_ROAMING_MONSTERS = 10
export const ROAMING_DIRECTION_CHANGE_MIN_MS = 2000
export const ROAMING_DIRECTION_CHANGE_MAX_MS = 4000
export const ROAMING_MONSTER_SCALE = 1.0
export const ROAMING_MULTI_ENEMY_CHANCE = 0.3

export const TEXT_SPEED_MS = {
  slow: 80,
  normal: 40,
  fast: 15,
} as const

// ── Cloud Save Configuration ──

export const CLOUD_SAVE_ENABLED =
  typeof import.meta !== 'undefined' &&
  Boolean(import.meta.env?.VITE_SUPABASE_URL) &&
  Boolean(import.meta.env?.VITE_SUPABASE_ANON_KEY)

export const SUPABASE_CONFIG = {
  url: (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SUPABASE_URL : '') ?? '',
  anonKey:
    (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SUPABASE_ANON_KEY : '') ?? '',
} as const

export const SYNC_CONFIG = {
  conflictThresholdMs: 5 * 60 * 1000, // 5 minutes - prompt user if difference exceeds this
  autoSyncOnAreaChange: true,
  retryAttempts: 3,
  retryDelayMs: 1000,
} as const
