import {
  DAMAGE_VARIANCE_MIN,
  DAMAGE_VARIANCE_MAX,
  CRITICAL_HIT_MULTIPLIER,
  BASE_CRITICAL_RATE,
  LUCK_CRITICAL_BONUS,
  ELEMENT_EFFECTIVENESS,
  FLEE_BASE_CHANCE,
  FLEE_SPEED_FACTOR,
  CAPTURE_MIN_RATE,
  CAPTURE_MAX_RATE,
} from '../models/constants'
import type { MonsterElement } from '../models/types'

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

export function randomChance(probability: number): boolean {
  return Math.random() < probability
}

export function weightedRandom<T>(items: ReadonlyArray<T>, weights: ReadonlyArray<number>): T {
  if (items.length === 0) {
    throw new Error('weightedRandom: items array is empty')
  }
  if (items.length !== weights.length) {
    throw new Error('weightedRandom: items and weights must have same length')
  }

  const totalWeight = weights.reduce((sum, w) => sum + w, 0)
  if (totalWeight <= 0) {
    throw new Error('weightedRandom: total weight must be positive')
  }

  let roll = Math.random() * totalWeight

  for (let i = 0; i < items.length; i++) {
    roll -= weights[i]
    if (roll <= 0) {
      return items[i]
    }
  }

  return items[items.length - 1]
}

export function getElementMultiplier(
  attackerElement: MonsterElement,
  defenderElement: MonsterElement,
): number {
  return ELEMENT_EFFECTIVENESS[attackerElement][defenderElement]
}

export function calculateDamage(
  attackerAttack: number,
  abilityPower: number,
  defenderDefense: number,
  attackerElement: MonsterElement,
  defenderElement: MonsterElement,
  attackerLuck: number,
): { readonly damage: number; readonly isCritical: boolean } {
  const baseDamage = (attackerAttack * abilityPower) / Math.max(defenderDefense * 0.5, 1)
  const elementMultiplier = getElementMultiplier(attackerElement, defenderElement)
  const variance = randomFloat(DAMAGE_VARIANCE_MIN, DAMAGE_VARIANCE_MAX)

  const critRate = BASE_CRITICAL_RATE + attackerLuck * LUCK_CRITICAL_BONUS
  const isCritical = randomChance(critRate)
  const critMultiplier = isCritical ? CRITICAL_HIT_MULTIPLIER : 1.0

  const finalDamage = Math.max(1, Math.round(baseDamage * elementMultiplier * variance * critMultiplier))

  return { damage: finalDamage, isCritical }
}

export function calculateFleeChance(playerSpeed: number, enemySpeed: number): number {
  const speedDiff = playerSpeed - enemySpeed
  const chance = FLEE_BASE_CHANCE + speedDiff * FLEE_SPEED_FACTOR
  return clamp(chance, 0.1, 0.95)
}

export function calculateCaptureRate(
  currentHpPercent: number,
  baseDifficulty: number,
  deviceMultiplier: number,
  statusBonus: number,
  playerLuck: number,
): number {
  const hpFactor = 1 - currentHpPercent
  const rate = hpFactor * (1 - baseDifficulty) * deviceMultiplier * statusBonus * (1 + playerLuck * 0.01)
  return clamp(rate, CAPTURE_MIN_RATE, CAPTURE_MAX_RATE)
}

export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * clamp(t, 0, 1)
}

export function percentOf(value: number, total: number): number {
  if (total === 0) return 0
  return (value / total) * 100
}
