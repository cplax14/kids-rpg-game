/**
 * Sprite frame mappings for creature and character sprites
 * Maps game entity IDs to frame indices in sprite sheets
 *
 * Creatures sheet: 160x288 (10x18 grid = 180 sprites, 16x16 each)
 * Characters sheet: 192x128 (12x8 grid = 96 sprites, 16x16 each)
 */

// Monster species ID to creature sheet frame index
// The Tiny Creatures pack has various fantasy creatures - we map our monsters to similar sprites
export const MONSTER_SPRITE_FRAMES: Readonly<Record<string, number>> = {
  // Fire element monsters
  flamepup: 0, // Row 0, col 0 - use a dog-like creature
  emberfox: 10, // Row 1, col 0 - fox-like
  cinderbat: 20, // Row 2, col 0 - bat

  // Water element monsters
  aquaslime: 1, // Row 0, col 1 - slime
  bubblefin: 11, // Row 1, col 1 - fish
  waveling: 21, // Row 2, col 1

  // Earth element monsters
  leafling: 2, // Row 0, col 2 - plant creature
  mossbun: 12, // Row 1, col 2 - bunny
  thornsprout: 22, // Row 2, col 2 - spiky plant
  rockshell: 32, // Row 3, col 2 - turtle/shell

  // Wind element monsters
  zephyrbird: 3, // Row 0, col 3 - bird
  gustling: 13, // Row 1, col 3 - cloud creature
  breezepuff: 23, // Row 2, col 3 - dandelion puff

  // Light element monsters
  sparkbug: 4, // Row 0, col 4 - beetle
  sunmote: 14, // Row 1, col 4 - sun spirit

  // Dark element monsters
  shadowmouse: 5, // Row 0, col 5 - mouse
  nightcrawler: 15, // Row 1, col 5 - worm
  gloomcat: 25, // Row 2, col 5 - cat

  // Breeding exclusives
  emberbun: 6, // Fire + Earth hybrid
  steampup: 7, // Fire + Water hybrid
  magmawyrm: 16, // Fire + Dragon
  frostfin: 17, // Water + Ice
  crystalshell: 26, // Earth + Crystal
  stormpuff: 27, // Wind + Electric
  duskling: 36, // Dark + Normal

  // Boss monsters - use larger/more impressive sprites
  elderwood: 70, // Forest boss - tree creature
  crystallix: 80, // Cave boss - crystal creature
}

// NPC type to 16x16 character sheet frame index (legacy)
export const NPC_SPRITE_FRAMES: Readonly<Record<string, number>> = {
  shopkeeper: 0,
  healer: 12, // Row 1
  breeder: 24, // Row 2
  quest: 36, // Row 3
  guide: 48, // Row 4
  guard: 60, // Row 5
  villager: 72, // Row 6
}

// NPC type to 32x32 character sheet frame index (new)
// Characters-32 sheet: 12 cols × 21 rows, each row is one character
// Down-facing idle is at row * 12 + 1 (col 1 of down direction)
export const NPC_SPRITE_FRAMES_32: Readonly<Record<string, number>> = {
  shopkeeper: 14 * 12 + 1,   // Row 14: tan merchant = 169
  healer: 8 * 12 + 1,        // Row 8: white robed = 97
  breeder: 16 * 12 + 1,      // Row 16: orange clothed = 193
  quest: 4 * 12 + 1,         // Row 4: red mage = 49
  guide: 10 * 12 + 1,        // Row 10: brown clothed = 121
  guard: 6 * 12 + 1,         // Row 6: gray armored = 73
  villager: 12 * 12 + 1,     // Row 12: blue clothed = 145
  skeleton: 0 * 12 + 1,      // Row 0: skeleton = 1
}

// Player character frames in the character sheet
export const PLAYER_SPRITE_FRAMES = {
  idle: {
    down: 0,
    left: 1,
    right: 2,
    up: 3,
  },
  walk: {
    down: [0, 4, 0, 8],
    left: [1, 5, 1, 9],
    right: [2, 6, 2, 10],
    up: [3, 7, 3, 11],
  },
} as const

// Item category to items sheet frame index range
export const ITEM_SPRITE_FRAMES: Readonly<Record<string, number>> = {
  potion: 0,
  'super-potion': 1,
  'mega-potion': 2,
  ether: 3,
  'super-ether': 4,
  antidote: 5,
  'wake-up-bell': 6,
  'revive-feather': 7,
  'capture-capsule': 16,
  'super-capsule': 17,
  'ultra-capsule': 18,
  'master-capsule': 19,
  'breeding-charm': 24,
  'trait-crystal': 25,
  'mutation-catalyst': 26,
  'harmony-bell': 27,
}

// Element to color mapping for visual effects
export const ELEMENT_COLORS: Readonly<Record<string, number>> = {
  fire: 0xff7043,
  water: 0x42a5f5,
  earth: 0x8d6e63,
  wind: 0x81d4fa,
  light: 0xffd54f,
  dark: 0x7e57c2,
  neutral: 0x9e9e9e,
}

/**
 * Get the frame index for a monster species
 */
export function getMonsterFrame(speciesId: string): number {
  return MONSTER_SPRITE_FRAMES[speciesId] ?? 0
}

/**
 * Get the frame index for an NPC type (16x16 legacy)
 */
export function getNpcFrame(npcType: string): number {
  return NPC_SPRITE_FRAMES[npcType] ?? 72 // Default to villager
}

/**
 * Get the frame index for an NPC type (32x32 new)
 */
export function getNpcFrame32(npcType: string): number {
  return NPC_SPRITE_FRAMES_32[npcType] ?? NPC_SPRITE_FRAMES_32.villager
}

/**
 * Get the frame index for an item
 */
export function getItemFrame(itemId: string): number {
  return ITEM_SPRITE_FRAMES[itemId] ?? 0
}
