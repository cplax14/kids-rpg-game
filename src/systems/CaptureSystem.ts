import type {
  BattleCombatant,
  CaptureAttempt,
  CaptureModifier,
  Item,
  MonsterInstance,
} from '../models/types'
import {
  CAPTURE_MIN_RATE,
  CAPTURE_MAX_RATE,
  SLEEP_CAPTURE_BONUS,
  LOW_HP_CAPTURE_THRESHOLD,
} from '../models/constants'
import { calculateCaptureRate, randomChance } from '../utils/math'
import { createMonsterInstance, getSpecies } from './MonsterSystem'

// ── Modifiers ──

function hasStatusEffect(combatant: BattleCombatant, effectType: string): boolean {
  return combatant.statusEffects.some((se) => se.effect.type === effectType)
}

export function gatherCaptureModifiers(
  target: BattleCombatant,
  captureDevice: Item,
  playerLuck: number,
): ReadonlyArray<CaptureModifier> {
  const modifiers: CaptureModifier[] = []

  // HP modifier (lower HP = easier capture)
  const hpPercent = target.stats.currentHp / target.stats.maxHp
  if (hpPercent <= LOW_HP_CAPTURE_THRESHOLD) {
    modifiers.push({
      source: 'low_hp',
      modifier: 1.2,
      reason: `Low HP bonus (HP at ${Math.round(hpPercent * 100)}%)`,
    })
  }

  // Status effect bonus (sleep)
  if (hasStatusEffect(target, 'sleep')) {
    modifiers.push({
      source: 'status_sleep',
      modifier: SLEEP_CAPTURE_BONUS,
      reason: 'Target is asleep',
    })
  }

  // Capture device multiplier
  const deviceMultiplier = captureDevice.useEffect?.magnitude ?? 1.0
  modifiers.push({
    source: 'capture_device',
    modifier: deviceMultiplier,
    reason: `${captureDevice.name} (${deviceMultiplier}x)`,
  })

  // Player luck bonus
  if (playerLuck > 0) {
    const luckBonus = 1 + playerLuck * 0.01
    modifiers.push({
      source: 'luck',
      modifier: luckBonus,
      reason: `Player luck bonus (${Math.round((luckBonus - 1) * 100)}%)`,
    })
  }

  return modifiers
}

// ── Capture Attempt ──

export interface CaptureOptions {
  /** If true, capture always succeeds (for first battle tutorial) */
  readonly guaranteeSuccess?: boolean
}

export function attemptCapture(
  target: BattleCombatant,
  captureDevice: Item,
  playerLuck: number,
  speciesDifficulty: number,
  options?: CaptureOptions,
): CaptureAttempt {
  const hpPercent = target.stats.currentHp / target.stats.maxHp
  const statusBonus = hasStatusEffect(target, 'sleep') ? SLEEP_CAPTURE_BONUS : 1.0
  const deviceMultiplier = captureDevice.useEffect?.magnitude ?? 1.0

  const baseSuccessRate = calculateCaptureRate(
    hpPercent,
    speciesDifficulty,
    deviceMultiplier,
    statusBonus,
    playerLuck,
  )

  const modifiers = gatherCaptureModifiers(target, captureDevice, playerLuck)
  const finalSuccessRate = Math.min(CAPTURE_MAX_RATE, Math.max(CAPTURE_MIN_RATE, baseSuccessRate))

  // Guarantee success for first battle tutorial
  const succeeded = options?.guaranteeSuccess ? true : randomChance(finalSuccessRate)

  return {
    targetMonster: target,
    captureDevice,
    baseSuccessRate,
    modifiers,
    finalSuccessRate,
    succeeded,
  }
}

// ── Shake Animation Helper ──

export function calculateShakeCount(captureAttempt: CaptureAttempt): number {
  if (captureAttempt.succeeded) {
    return 3 // Full 3 shakes = success
  }

  // Failed captures: more shakes if closer to success
  const rate = captureAttempt.finalSuccessRate
  if (rate >= 0.7) {
    return 2 // Very close, 2 shakes before escape
  } else if (rate >= 0.4) {
    return 1 // Moderate chance, 1 shake
  }
  return 0 // Low chance, immediate escape
}

// ── Create Captured Monster ──

export function createCapturedMonster(
  speciesId: string,
  enemyLevel: number,
  nickname?: string,
): MonsterInstance | undefined {
  return createMonsterInstance(speciesId, enemyLevel, {
    nickname,
  })
}

// ── Deterministic Capture (for testing) ──

export function attemptCaptureWithRoll(
  target: BattleCombatant,
  captureDevice: Item,
  playerLuck: number,
  speciesDifficulty: number,
  roll: number,
): CaptureAttempt {
  const hpPercent = target.stats.currentHp / target.stats.maxHp
  const statusBonus = hasStatusEffect(target, 'sleep') ? SLEEP_CAPTURE_BONUS : 1.0
  const deviceMultiplier = captureDevice.useEffect?.magnitude ?? 1.0

  const baseSuccessRate = calculateCaptureRate(
    hpPercent,
    speciesDifficulty,
    deviceMultiplier,
    statusBonus,
    playerLuck,
  )

  const modifiers = gatherCaptureModifiers(target, captureDevice, playerLuck)
  const finalSuccessRate = Math.min(CAPTURE_MAX_RATE, Math.max(CAPTURE_MIN_RATE, baseSuccessRate))
  const succeeded = roll < finalSuccessRate

  return {
    targetMonster: target,
    captureDevice,
    baseSuccessRate,
    modifiers,
    finalSuccessRate,
    succeeded,
  }
}
