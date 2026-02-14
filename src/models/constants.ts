import type { MonsterElement } from './types'

// ── Experience Table ──
// XP required to reach each level (index = level)

export const XP_TABLE: ReadonlyArray<number> = [
  0, // Level 0 (unused)
  0, // Level 1 (starting level)
  100, // Level 2
  250, // Level 3
  450, // Level 4
  700, // Level 5
  1000, // Level 6
  1400, // Level 7
  1900, // Level 8
  2500, // Level 9
  3200, // Level 10
  4000, // Level 11
  5000, // Level 12
  6200, // Level 13
  7600, // Level 14
  9200, // Level 15
  11000, // Level 16
  13000, // Level 17
  15500, // Level 18
  18500, // Level 19
  22000, // Level 20
  26000, // Level 21
  30500, // Level 22
  35500, // Level 23
  41000, // Level 24
  47000, // Level 25
]

export const MAX_LEVEL = 25

// ── Element Effectiveness ──
// Multiplier for attacker element vs defender element
// > 1.0 = super effective, < 1.0 = not very effective, 1.0 = neutral

type ElementTable = Record<MonsterElement, Record<MonsterElement, number>>

export const ELEMENT_EFFECTIVENESS: ElementTable = {
  fire: {
    fire: 0.5,
    water: 0.5,
    earth: 2.0,
    wind: 1.0,
    light: 1.0,
    dark: 1.0,
    neutral: 1.0,
  },
  water: {
    fire: 2.0,
    water: 0.5,
    earth: 1.0,
    wind: 0.5,
    light: 1.0,
    dark: 1.0,
    neutral: 1.0,
  },
  earth: {
    fire: 0.5,
    water: 1.0,
    earth: 0.5,
    wind: 2.0,
    light: 1.0,
    dark: 1.0,
    neutral: 1.0,
  },
  wind: {
    fire: 1.0,
    water: 2.0,
    earth: 0.5,
    wind: 0.5,
    light: 1.0,
    dark: 1.0,
    neutral: 1.0,
  },
  light: {
    fire: 1.0,
    water: 1.0,
    earth: 1.0,
    wind: 1.0,
    light: 0.5,
    dark: 2.0,
    neutral: 1.0,
  },
  dark: {
    fire: 1.0,
    water: 1.0,
    earth: 1.0,
    wind: 1.0,
    light: 2.0,
    dark: 0.5,
    neutral: 1.0,
  },
  neutral: {
    fire: 1.0,
    water: 1.0,
    earth: 1.0,
    wind: 1.0,
    light: 1.0,
    dark: 1.0,
    neutral: 1.0,
  },
}

// ── Combat Constants ──

export const DAMAGE_VARIANCE_MIN = 0.85
export const DAMAGE_VARIANCE_MAX = 1.15
export const CRITICAL_HIT_MULTIPLIER = 2.0
export const BASE_CRITICAL_RATE = 0.05
export const LUCK_CRITICAL_BONUS = 0.003

export const FLEE_BASE_CHANCE = 0.5
export const FLEE_SPEED_FACTOR = 0.01

// ── Capture Constants ──

export const CAPTURE_MIN_RATE = 0.05
export const CAPTURE_MAX_RATE = 0.95
export const SLEEP_CAPTURE_BONUS = 1.5
export const LOW_HP_CAPTURE_THRESHOLD = 0.25

// ── Breeding Constants ──

export const TRAIT_INHERITANCE_CHANCE = 0.5
export const MUTATION_CHANCE = 0.05
export const STAT_INHERITANCE_VARIANCE = 0.1

// ── Bond Constants ──

export const BOND_PER_BATTLE = 2
export const BOND_PER_HEAL = 1
export const BOND_PER_WIN = 1
export const BOND_MAX = 100
export const BOND_STAT_BONUS_MAX = 0.1

// ── Monster XP Distribution Constants ──

export const XP_BENCH_PERCENTAGE = 0.1 // 10% XP to bench monsters

// ── Breeding Progression Constants ──

export const INHERITED_STAT_PERCENTAGE = 0.2 // 20% of parents' trained stats
export const LEGACY_ABILITY_CHANCE = 0.25 // 25% per parent ability
export const PERFECT_BASE_CHANCE = 0.02 // 2% base chance for perfect offspring
export const PERFECT_HARMONY_BONUS = 0.03 // +3% with harmony-bell
export const PERFECT_BOND_BONUS = 0.02 // +2% if both parents have >80 bond
export const PERFECT_STAT_MULTIPLIER = 1.15 // +15% to inherited stat bonuses

// Generation trait slots: how many traits each generation can have
export const GENERATION_TRAIT_SLOTS: Record<number, number> = {
  0: 1, // Wild-caught
  1: 2, // G1 bred
  2: 3, // G2+ bred
}

// Generation stat ceiling multipliers
export const GENERATION_STAT_CEILING: Record<number, number> = {
  0: 1.0, // Wild: 100% max
  1: 1.1, // G1: 110% max
  2: 1.2, // G2+: 120% max
}

// ── Battle Spirit Constants ──

/** Maximum battle spirit level (escalation die) */
export const BATTLE_SPIRIT_MAX = 5
/** Damage bonus per spirit level (+8% per level) */
export const BATTLE_SPIRIT_DAMAGE_BONUS = 0.08
/** Accuracy bonus per spirit level (+3% per level) */
export const BATTLE_SPIRIT_ACCURACY_BONUS = 3

// ── Status Effect Constants ──

export const POISON_DAMAGE_PERCENT = 0.1
export const REGEN_HEAL_PERCENT = 0.08
export const SLOW_SPEED_MULTIPLIER = 0.5
export const HASTE_SPEED_MULTIPLIER = 1.5
export const SHIELD_DEFENSE_MULTIPLIER = 1.5
export const ATTACK_UP_MULTIPLIER = 1.3
export const DEFENSE_UP_MULTIPLIER = 1.3
