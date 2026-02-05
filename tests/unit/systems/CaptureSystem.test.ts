import { describe, it, expect, beforeEach } from 'vitest'
import {
  gatherCaptureModifiers,
  attemptCaptureWithRoll,
  calculateShakeCount,
  createCapturedMonster,
} from '../../../src/systems/CaptureSystem'
import { loadSpeciesData, loadAbilityData } from '../../../src/systems/MonsterSystem'
import type {
  BattleCombatant,
  Item,
  MonsterSpecies,
  Ability,
  CaptureAttempt,
} from '../../../src/models/types'
import {
  SLEEP_CAPTURE_BONUS,
  LOW_HP_CAPTURE_THRESHOLD,
  CAPTURE_MIN_RATE,
  CAPTURE_MAX_RATE,
} from '../../../src/models/constants'

const mockAbility: Ability = {
  abilityId: 'test-attack',
  name: 'Test Attack',
  description: 'A test attack',
  element: 'fire',
  type: 'physical',
  power: 40,
  accuracy: 95,
  mpCost: 5,
  targetType: 'single_enemy',
  statusEffect: null,
  animation: 'slash',
}

const mockSpecies: MonsterSpecies = {
  speciesId: 'test-mon',
  name: 'Testmon',
  description: 'A test monster',
  element: 'fire',
  rarity: 'common',
  baseStats: {
    maxHp: 100,
    currentHp: 100,
    maxMp: 30,
    currentMp: 30,
    attack: 15,
    defense: 10,
    magicAttack: 12,
    magicDefense: 8,
    speed: 11,
    luck: 5,
  },
  statGrowth: {
    hp: 8,
    mp: 3,
    attack: 2,
    defense: 1.5,
    magicAttack: 2,
    magicDefense: 1,
    speed: 1,
  },
  abilities: [{ abilityId: 'test-attack', learnAtLevel: 1 }],
  captureBaseDifficulty: 0.5,
  spriteKey: 'test-mon-sprite',
  evolutionChain: null,
  breedingGroup: 'beast',
  breedingTraits: ['fire-affinity'],
}

const createMockCombatant = (overrides: Partial<BattleCombatant> = {}): BattleCombatant => ({
  combatantId: 'enemy-1',
  name: 'Wild Testmon',
  isPlayer: false,
  isMonster: true,
  stats: {
    maxHp: 100,
    currentHp: 100,
    maxMp: 30,
    currentMp: 30,
    attack: 15,
    defense: 10,
    magicAttack: 12,
    magicDefense: 8,
    speed: 11,
    luck: 5,
  },
  abilities: [],
  statusEffects: [],
  capturable: true,
  ...overrides,
})

const createMockCaptureDevice = (magnitude: number = 1.0): Item => ({
  itemId: 'capture-capsule',
  name: 'Capture Capsule',
  description: 'A basic capture device',
  category: 'capture_device',
  iconKey: 'capsule',
  stackable: true,
  maxStack: 99,
  useEffect: {
    type: 'capture_boost',
    magnitude,
    targetType: 'single_monster',
  },
  buyPrice: 100,
  sellPrice: 50,
})

beforeEach(() => {
  loadSpeciesData([mockSpecies])
  loadAbilityData([mockAbility])
})

describe('gatherCaptureModifiers', () => {
  it('adds low HP modifier when HP is below threshold', () => {
    const target = createMockCombatant({
      stats: { ...createMockCombatant().stats, currentHp: 20, maxHp: 100 },
    })
    const device = createMockCaptureDevice(1.0)
    const modifiers = gatherCaptureModifiers(target, device, 10)

    const lowHpMod = modifiers.find((m) => m.source === 'low_hp')
    expect(lowHpMod).toBeDefined()
    expect(lowHpMod!.modifier).toBe(1.2)
  })

  it('does not add low HP modifier when HP is above threshold', () => {
    const target = createMockCombatant({
      stats: { ...createMockCombatant().stats, currentHp: 50, maxHp: 100 },
    })
    const device = createMockCaptureDevice(1.0)
    const modifiers = gatherCaptureModifiers(target, device, 10)

    const lowHpMod = modifiers.find((m) => m.source === 'low_hp')
    expect(lowHpMod).toBeUndefined()
  })

  it('adds sleep status modifier when target is asleep', () => {
    const target = createMockCombatant({
      statusEffects: [
        {
          effect: {
            id: 'sleep',
            name: 'Sleep',
            type: 'sleep',
            duration: 3,
            magnitude: 1,
          },
          turnsRemaining: 2,
          appliedBy: 'player',
        },
      ],
    })
    const device = createMockCaptureDevice(1.0)
    const modifiers = gatherCaptureModifiers(target, device, 10)

    const sleepMod = modifiers.find((m) => m.source === 'status_sleep')
    expect(sleepMod).toBeDefined()
    expect(sleepMod!.modifier).toBe(SLEEP_CAPTURE_BONUS)
  })

  it('adds capture device modifier', () => {
    const target = createMockCombatant()
    const device = createMockCaptureDevice(1.5)
    const modifiers = gatherCaptureModifiers(target, device, 10)

    const deviceMod = modifiers.find((m) => m.source === 'capture_device')
    expect(deviceMod).toBeDefined()
    expect(deviceMod!.modifier).toBe(1.5)
  })

  it('adds luck modifier when player has luck', () => {
    const target = createMockCombatant()
    const device = createMockCaptureDevice(1.0)
    const modifiers = gatherCaptureModifiers(target, device, 20)

    const luckMod = modifiers.find((m) => m.source === 'luck')
    expect(luckMod).toBeDefined()
    expect(luckMod!.modifier).toBeCloseTo(1.2)
  })

  it('does not add luck modifier when luck is 0', () => {
    const target = createMockCombatant()
    const device = createMockCaptureDevice(1.0)
    const modifiers = gatherCaptureModifiers(target, device, 0)

    const luckMod = modifiers.find((m) => m.source === 'luck')
    expect(luckMod).toBeUndefined()
  })
})

describe('attemptCaptureWithRoll', () => {
  it('succeeds when roll is below success rate', () => {
    const target = createMockCombatant({
      stats: { ...createMockCombatant().stats, currentHp: 10, maxHp: 100 },
    })
    const device = createMockCaptureDevice(2.0)

    // Low HP + good device = high success rate
    const attempt = attemptCaptureWithRoll(target, device, 10, 0.3, 0.1)

    expect(attempt.succeeded).toBe(true)
    expect(attempt.finalSuccessRate).toBeGreaterThan(0.1)
  })

  it('fails when roll is above success rate', () => {
    const target = createMockCombatant({
      stats: { ...createMockCombatant().stats, currentHp: 90, maxHp: 100 },
    })
    const device = createMockCaptureDevice(1.0)

    // High HP + basic device = low success rate
    const attempt = attemptCaptureWithRoll(target, device, 0, 0.8, 0.99)

    expect(attempt.succeeded).toBe(false)
  })

  it('clamps success rate to minimum', () => {
    const target = createMockCombatant({
      stats: { ...createMockCombatant().stats, currentHp: 100, maxHp: 100 },
    })
    const device = createMockCaptureDevice(0.1)

    const attempt = attemptCaptureWithRoll(target, device, 0, 0.99, 0.5)

    expect(attempt.finalSuccessRate).toBeGreaterThanOrEqual(CAPTURE_MIN_RATE)
  })

  it('clamps success rate to maximum', () => {
    const target = createMockCombatant({
      stats: { ...createMockCombatant().stats, currentHp: 1, maxHp: 100 },
    })
    const device = createMockCaptureDevice(100.0) // Master ball

    const attempt = attemptCaptureWithRoll(target, device, 100, 0.0, 0.0)

    expect(attempt.finalSuccessRate).toBeLessThanOrEqual(CAPTURE_MAX_RATE)
  })

  it('includes all modifiers in the result', () => {
    const target = createMockCombatant({
      stats: { ...createMockCombatant().stats, currentHp: 20, maxHp: 100 },
      statusEffects: [
        {
          effect: { id: 'sleep', name: 'Sleep', type: 'sleep', duration: 3, magnitude: 1 },
          turnsRemaining: 2,
          appliedBy: 'player',
        },
      ],
    })
    const device = createMockCaptureDevice(1.5)

    const attempt = attemptCaptureWithRoll(target, device, 15, 0.5, 0.0)

    expect(attempt.modifiers.length).toBeGreaterThanOrEqual(3)
    expect(attempt.modifiers.some((m) => m.source === 'low_hp')).toBe(true)
    expect(attempt.modifiers.some((m) => m.source === 'status_sleep')).toBe(true)
    expect(attempt.modifiers.some((m) => m.source === 'capture_device')).toBe(true)
  })

  it('stores target monster and device in result', () => {
    const target = createMockCombatant()
    const device = createMockCaptureDevice(1.0)

    const attempt = attemptCaptureWithRoll(target, device, 10, 0.5, 0.5)

    expect(attempt.targetMonster).toBe(target)
    expect(attempt.captureDevice).toBe(device)
  })
})

describe('calculateShakeCount', () => {
  it('returns 3 for successful capture', () => {
    const attempt: CaptureAttempt = {
      targetMonster: createMockCombatant(),
      captureDevice: createMockCaptureDevice(),
      baseSuccessRate: 0.8,
      modifiers: [],
      finalSuccessRate: 0.8,
      succeeded: true,
    }

    expect(calculateShakeCount(attempt)).toBe(3)
  })

  it('returns 2 for failed high-rate capture', () => {
    const attempt: CaptureAttempt = {
      targetMonster: createMockCombatant(),
      captureDevice: createMockCaptureDevice(),
      baseSuccessRate: 0.75,
      modifiers: [],
      finalSuccessRate: 0.75,
      succeeded: false,
    }

    expect(calculateShakeCount(attempt)).toBe(2)
  })

  it('returns 1 for failed medium-rate capture', () => {
    const attempt: CaptureAttempt = {
      targetMonster: createMockCombatant(),
      captureDevice: createMockCaptureDevice(),
      baseSuccessRate: 0.5,
      modifiers: [],
      finalSuccessRate: 0.5,
      succeeded: false,
    }

    expect(calculateShakeCount(attempt)).toBe(1)
  })

  it('returns 0 for failed low-rate capture', () => {
    const attempt: CaptureAttempt = {
      targetMonster: createMockCombatant(),
      captureDevice: createMockCaptureDevice(),
      baseSuccessRate: 0.2,
      modifiers: [],
      finalSuccessRate: 0.2,
      succeeded: false,
    }

    expect(calculateShakeCount(attempt)).toBe(0)
  })
})

describe('createCapturedMonster', () => {
  it('creates a monster instance with correct species and level', () => {
    const monster = createCapturedMonster('test-mon', 5)

    expect(monster).toBeDefined()
    expect(monster!.speciesId).toBe('test-mon')
    expect(monster!.level).toBe(5)
  })

  it('creates a monster with optional nickname', () => {
    const monster = createCapturedMonster('test-mon', 3, 'Sparky')

    expect(monster).toBeDefined()
    expect(monster!.nickname).toBe('Sparky')
  })

  it('returns undefined for unknown species', () => {
    const monster = createCapturedMonster('nonexistent', 5)

    expect(monster).toBeUndefined()
  })

  it('starts with 0 bond level', () => {
    const monster = createCapturedMonster('test-mon', 5)

    expect(monster!.bondLevel).toBe(0)
  })

  it('starts not in squad', () => {
    const monster = createCapturedMonster('test-mon', 5)

    expect(monster!.isInSquad).toBe(false)
  })

  it('generates unique instance IDs', () => {
    const monster1 = createCapturedMonster('test-mon', 5)
    const monster2 = createCapturedMonster('test-mon', 5)

    expect(monster1!.instanceId).not.toBe(monster2!.instanceId)
  })

  it('has capturedAt timestamp', () => {
    const before = new Date().toISOString()
    const monster = createCapturedMonster('test-mon', 5)
    const after = new Date().toISOString()

    expect(monster!.capturedAt).toBeDefined()
    expect(monster!.capturedAt >= before).toBe(true)
    expect(monster!.capturedAt <= after).toBe(true)
  })
})

describe('capture rate formula', () => {
  it('low HP increases capture rate', () => {
    const device = createMockCaptureDevice(1.0)

    const fullHp = createMockCombatant({
      stats: { ...createMockCombatant().stats, currentHp: 100, maxHp: 100 },
    })
    const lowHp = createMockCombatant({
      stats: { ...createMockCombatant().stats, currentHp: 10, maxHp: 100 },
    })

    const fullHpAttempt = attemptCaptureWithRoll(fullHp, device, 10, 0.5, 1.0)
    const lowHpAttempt = attemptCaptureWithRoll(lowHp, device, 10, 0.5, 1.0)

    expect(lowHpAttempt.finalSuccessRate).toBeGreaterThan(fullHpAttempt.finalSuccessRate)
  })

  it('sleep status increases capture rate', () => {
    const device = createMockCaptureDevice(1.0)
    const baseStats = { ...createMockCombatant().stats, currentHp: 50, maxHp: 100 }

    const awake = createMockCombatant({ stats: baseStats })
    const asleep = createMockCombatant({
      stats: baseStats,
      statusEffects: [
        {
          effect: { id: 'sleep', name: 'Sleep', type: 'sleep', duration: 3, magnitude: 1 },
          turnsRemaining: 2,
          appliedBy: 'player',
        },
      ],
    })

    const awakeAttempt = attemptCaptureWithRoll(awake, device, 10, 0.5, 1.0)
    const asleepAttempt = attemptCaptureWithRoll(asleep, device, 10, 0.5, 1.0)

    expect(asleepAttempt.finalSuccessRate).toBeGreaterThan(awakeAttempt.finalSuccessRate)
  })

  it('better capture device increases capture rate', () => {
    const target = createMockCombatant({
      stats: { ...createMockCombatant().stats, currentHp: 50, maxHp: 100 },
    })

    const basicDevice = createMockCaptureDevice(1.0)
    const superDevice = createMockCaptureDevice(1.5)

    const basicAttempt = attemptCaptureWithRoll(target, basicDevice, 10, 0.5, 1.0)
    const superAttempt = attemptCaptureWithRoll(target, superDevice, 10, 0.5, 1.0)

    expect(superAttempt.finalSuccessRate).toBeGreaterThan(basicAttempt.finalSuccessRate)
  })

  it('lower base difficulty increases capture rate', () => {
    const target = createMockCombatant({
      stats: { ...createMockCombatant().stats, currentHp: 50, maxHp: 100 },
    })
    const device = createMockCaptureDevice(1.0)

    const easyAttempt = attemptCaptureWithRoll(target, device, 10, 0.2, 1.0)
    const hardAttempt = attemptCaptureWithRoll(target, device, 10, 0.8, 1.0)

    expect(easyAttempt.finalSuccessRate).toBeGreaterThan(hardAttempt.finalSuccessRate)
  })

  it('higher player luck increases capture rate', () => {
    const target = createMockCombatant({
      stats: { ...createMockCombatant().stats, currentHp: 50, maxHp: 100 },
    })
    const device = createMockCaptureDevice(1.0)

    const lowLuckAttempt = attemptCaptureWithRoll(target, device, 5, 0.5, 1.0)
    const highLuckAttempt = attemptCaptureWithRoll(target, device, 30, 0.5, 1.0)

    expect(highLuckAttempt.finalSuccessRate).toBeGreaterThan(lowLuckAttempt.finalSuccessRate)
  })
})
