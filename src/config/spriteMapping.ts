/**
 * Sprite frame mappings for creature and character sprites
 * Maps game entity IDs to frame indices in sprite sheets
 *
 * 32x32 Monster Icons: Individual files (Icon1.png - Icon50.png)
 * Characters-32 sheet: 12 cols × 21 rows, each character has 12 frames
 */

// Monster species ID to 32x32 icon number (monster-icon-X)
// Maps our monsters to the 50 available 32x32 monster portraits
export const MONSTER_ICON_NUMBERS: Readonly<Record<string, number>> = {
  // Fire element monsters
  flamepup: 1,      // Red/orange puppy creature
  blazefox: 2,      // Fox-like fire creature
  volcanix: 3,      // Dragon/volcanic creature

  // Water element monsters
  bubblefin: 4,     // Blue fish/aquatic
  tidecrab: 5,      // Crab creature
  serpentide: 6,    // Sea serpent
  coralshell: 7,    // Shell creature

  // Earth element monsters
  pebblit: 8,       // Rock creature
  thornback: 9,     // Spiky plant/earth
  crystalgolem: 10, // Crystal rock creature
  mossbun: 11,      // Green bunny
  ironshell: 12,    // Metal shell creature

  // Wind element monsters
  breezling: 13,    // Airy/light creature
  stormowl: 14,     // Bird/owl
  tempestdrake: 15, // Dragon/wind

  // Light element monsters
  glowmoth: 16,     // Moth/butterfly
  sunstag: 17,      // Deer/stag with light
  prismbug: 18,     // Rainbow insect

  // Dark element monsters
  shadowpup: 19,    // Dark puppy
  nightstalker: 20, // Shadowy predator
  duskfox: 21,      // Dark fox

  // Breeding exclusives
  emberbun: 22,     // Fire + Earth bunny
  steampup: 23,     // Fire + Water puppy
  magmawyrm: 24,    // Fire dragon
  magnetite: 25,    // Magnetic creature

  // Boss monsters
  thornwarden: 26,  // Forest miniboss - thorny guardian
  elderwood: 27,    // Forest boss - tree creature
  crystallix: 28,   // Cave boss - crystal creature
}

// Legacy: Monster species ID to creature sheet frame index (16x16)
export const MONSTER_SPRITE_FRAMES: Readonly<Record<string, number>> = {
  // Fire element monsters
  flamepup: 0,
  emberfox: 10,
  cinderbat: 20,

  // Water element monsters
  aquaslime: 1,
  bubblefin: 11,
  waveling: 21,

  // Earth element monsters
  leafling: 2,
  mossbun: 12,
  thornsprout: 22,
  rockshell: 32,

  // Wind element monsters
  zephyrbird: 3,
  gustling: 13,
  breezepuff: 23,

  // Light element monsters
  sparkbug: 4,
  sunmote: 14,

  // Dark element monsters
  shadowmouse: 5,
  nightcrawler: 15,
  gloomcat: 25,

  // Breeding exclusives
  emberbun: 6,
  steampup: 7,
  magmawyrm: 16,
  frostfin: 17,
  crystalshell: 26,
  stormpuff: 27,
  duskling: 36,

  // Boss monsters
  elderwood: 70,
  crystallix: 80,
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
 * Get the 32x32 monster icon key for a species
 * Returns the texture key like 'monster-icon-1'
 */
export function getMonsterIconKey(speciesId: string): string {
  const iconNumber = MONSTER_ICON_NUMBERS[speciesId] ?? 1
  return `monster-icon-${iconNumber}`
}

/**
 * Get the frame index for a monster species (legacy 16x16)
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
