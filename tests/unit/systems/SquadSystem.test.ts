import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock EventBus to prevent Phaser dependency
vi.mock('../../../src/events/EventBus', () => ({
  EventBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}))
import {
  isSquadFull,
  getSquadCount,
  findSquadMonster,
  addToSquad,
  removeFromSquad,
  swapSquadPositions,
  moveToStorage,
  moveToSquad,
  applyBondBonus,
  applyPostBattleBond,
  createSquadCombatants,
  setMonsterNickname,
  updateSquadMonster,
  getAliveSquadMonsters,
} from '../../../src/systems/SquadSystem'
import { loadSpeciesData, loadAbilityData } from '../../../src/systems/MonsterSystem'
import type { MonsterInstance, MonsterSpecies, Ability } from '../../../src/models/types'
import { MAX_SQUAD_SIZE } from '../../../src/config'
import { BOND_PER_BATTLE, BOND_PER_WIN, BOND_STAT_BONUS_MAX, BOND_MAX } from '../../../src/models/constants'

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
  cooldownTurns: 0,
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
    attack: 20,
    defense: 10,
    magicAttack: 15,
    magicDefense: 10,
    speed: 12,
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
  obtainableVia: 'wild',
}

const createMockMonster = (overrides: Partial<MonsterInstance> = {}): MonsterInstance => ({
  instanceId: `mon-${Math.random().toString(36).substring(2, 10)}`,
  speciesId: 'test-mon',
  nickname: null,
  level: 5,
  experience: 0,
  stats: {
    maxHp: 100,
    currentHp: 100,
    maxMp: 30,
    currentMp: 30,
    attack: 20,
    defense: 10,
    magicAttack: 15,
    magicDefense: 10,
    speed: 12,
    luck: 5,
  },
  learnedAbilities: [mockAbility],
  inheritedTraits: [],
  parentSpeciesIds: [],
  isInSquad: false,
  capturedAt: new Date().toISOString(),
  bondLevel: 0,
  generation: 0,
  inheritedStatBonus: {},
  legacyAbilities: [],
  isPerfect: false,
  equippedGear: {
    collar: null,
    saddle: null,
    charm: null,
    claws: null,
  },
  ...overrides,
})

beforeEach(() => {
  loadSpeciesData([mockSpecies])
  loadAbilityData([mockAbility])
})

describe('squad queries', () => {
  it('isSquadFull returns false for empty squad', () => {
    expect(isSquadFull([])).toBe(false)
  })

  it('isSquadFull returns false when under limit', () => {
    const squad = [createMockMonster(), createMockMonster()]
    expect(isSquadFull(squad)).toBe(false)
  })

  it('isSquadFull returns true at max size', () => {
    const squad = Array.from({ length: MAX_SQUAD_SIZE }, () => createMockMonster())
    expect(isSquadFull(squad)).toBe(true)
  })

  it('getSquadCount returns correct count', () => {
    const squad = [createMockMonster(), createMockMonster()]
    expect(getSquadCount(squad)).toBe(2)
  })

  it('findSquadMonster finds monster by id', () => {
    const target = createMockMonster({ instanceId: 'target-mon' })
    const squad = [createMockMonster(), target, createMockMonster()]

    expect(findSquadMonster(squad, 'target-mon')).toBe(target)
  })

  it('findSquadMonster returns undefined if not found', () => {
    const squad = [createMockMonster()]
    expect(findSquadMonster(squad, 'nonexistent')).toBeUndefined()
  })
})

describe('addToSquad', () => {
  it('adds monster to squad', () => {
    const squad: ReadonlyArray<MonsterInstance> = []
    const monster = createMockMonster()

    const result = addToSquad(squad, monster)

    expect(result).not.toBeNull()
    expect(result!.length).toBe(1)
    expect(result![0].instanceId).toBe(monster.instanceId)
  })

  it('sets isInSquad to true', () => {
    const monster = createMockMonster({ isInSquad: false })
    const result = addToSquad([], monster)

    expect(result![0].isInSquad).toBe(true)
  })

  it('returns null when squad is full', () => {
    const squad = Array.from({ length: MAX_SQUAD_SIZE }, () => createMockMonster())
    const monster = createMockMonster()

    const result = addToSquad(squad, monster)

    expect(result).toBeNull()
  })

  it('does not mutate original squad', () => {
    const squad: ReadonlyArray<MonsterInstance> = []
    const monster = createMockMonster()

    const result = addToSquad(squad, monster)

    expect(squad.length).toBe(0)
    expect(result).not.toBe(squad)
  })
})

describe('removeFromSquad', () => {
  it('removes monster by id', () => {
    const target = createMockMonster({ instanceId: 'to-remove' })
    const squad = [createMockMonster(), target, createMockMonster()]

    const result = removeFromSquad(squad, 'to-remove')

    expect(result.length).toBe(2)
    expect(result.find((m) => m.instanceId === 'to-remove')).toBeUndefined()
  })

  it('returns unchanged squad if id not found', () => {
    const squad = [createMockMonster()]
    const result = removeFromSquad(squad, 'nonexistent')

    expect(result.length).toBe(squad.length)
  })

  it('does not mutate original squad', () => {
    const target = createMockMonster({ instanceId: 'to-remove' })
    const squad = [target]

    const result = removeFromSquad(squad, 'to-remove')

    expect(squad.length).toBe(1)
    expect(result).not.toBe(squad)
  })
})

describe('swapSquadPositions', () => {
  it('swaps two monsters', () => {
    const a = createMockMonster({ instanceId: 'mon-a' })
    const b = createMockMonster({ instanceId: 'mon-b' })
    const c = createMockMonster({ instanceId: 'mon-c' })
    const squad = [a, b, c]

    const result = swapSquadPositions(squad, 0, 2)

    expect(result[0].instanceId).toBe('mon-c')
    expect(result[2].instanceId).toBe('mon-a')
    expect(result[1].instanceId).toBe('mon-b')
  })

  it('returns unchanged squad for same index', () => {
    const squad = [createMockMonster()]
    const result = swapSquadPositions(squad, 0, 0)

    expect(result).toBe(squad)
  })

  it('returns unchanged squad for out of bounds index', () => {
    const squad = [createMockMonster()]

    expect(swapSquadPositions(squad, -1, 0)).toBe(squad)
    expect(swapSquadPositions(squad, 0, 10)).toBe(squad)
  })
})

describe('storage transfer', () => {
  describe('moveToStorage', () => {
    it('moves monster from squad to storage', () => {
      const monster = createMockMonster({ instanceId: 'moving', isInSquad: true })
      const squad = [monster]
      const storage: ReadonlyArray<MonsterInstance> = []

      const result = moveToStorage(squad, storage, 'moving')

      expect(result).not.toBeNull()
      expect(result!.squad.length).toBe(0)
      expect(result!.storage.length).toBe(1)
      expect(result!.storage[0].isInSquad).toBe(false)
    })

    it('returns null if monster not in squad', () => {
      const result = moveToStorage([], [], 'nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('moveToSquad', () => {
    it('moves monster from storage to squad', () => {
      const monster = createMockMonster({ instanceId: 'moving', isInSquad: false })
      const squad: ReadonlyArray<MonsterInstance> = []
      const storage = [monster]

      const result = moveToSquad(squad, storage, 'moving')

      expect(result).not.toBeNull()
      expect(result!.squad.length).toBe(1)
      expect(result!.storage.length).toBe(0)
      expect(result!.squad[0].isInSquad).toBe(true)
    })

    it('returns null if squad is full', () => {
      const fullSquad = Array.from({ length: MAX_SQUAD_SIZE }, () => createMockMonster())
      const monster = createMockMonster({ instanceId: 'moving' })
      const storage = [monster]

      const result = moveToSquad(fullSquad, storage, 'moving')

      expect(result).toBeNull()
    })

    it('returns null if monster not in storage', () => {
      const result = moveToSquad([], [], 'nonexistent')
      expect(result).toBeNull()
    })
  })
})

describe('bond system', () => {
  describe('applyBondBonus', () => {
    it('applies no bonus at 0 bond', () => {
      const monster = createMockMonster({ bondLevel: 0 })
      const bonded = applyBondBonus(monster)

      expect(bonded.attack).toBe(monster.stats.attack)
      expect(bonded.defense).toBe(monster.stats.defense)
    })

    it('applies max bonus at max bond', () => {
      const monster = createMockMonster({ bondLevel: BOND_MAX })
      const bonded = applyBondBonus(monster)

      const expectedMultiplier = 1 + BOND_STAT_BONUS_MAX
      expect(bonded.attack).toBe(Math.floor(monster.stats.attack * expectedMultiplier))
      expect(bonded.defense).toBe(Math.floor(monster.stats.defense * expectedMultiplier))
    })

    it('applies partial bonus at 50 bond', () => {
      const monster = createMockMonster({ bondLevel: 50 })
      const bonded = applyBondBonus(monster)

      const expectedMultiplier = 1 + 0.5 * BOND_STAT_BONUS_MAX
      expect(bonded.attack).toBe(Math.floor(monster.stats.attack * expectedMultiplier))
    })

    it('does not affect luck', () => {
      const monster = createMockMonster({ bondLevel: BOND_MAX })
      const bonded = applyBondBonus(monster)

      expect(bonded.luck).toBe(monster.stats.luck)
    })
  })

  describe('applyPostBattleBond', () => {
    it('increases bond for all squad members', () => {
      const squad = [createMockMonster(), createMockMonster()]
      const result = applyPostBattleBond(squad, false)

      expect(result[0].bondLevel).toBe(BOND_PER_BATTLE)
      expect(result[1].bondLevel).toBe(BOND_PER_BATTLE)
    })

    it('adds win bonus on victory', () => {
      const squad = [createMockMonster()]
      const result = applyPostBattleBond(squad, true)

      expect(result[0].bondLevel).toBe(BOND_PER_BATTLE + BOND_PER_WIN)
    })

    it('does not mutate original squad', () => {
      const original = createMockMonster()
      const squad = [original]
      applyPostBattleBond(squad, true)

      expect(original.bondLevel).toBe(0)
    })
  })
})

describe('createSquadCombatants', () => {
  it('creates combatants for each squad member', () => {
    const squad = [createMockMonster(), createMockMonster()]
    const combatants = createSquadCombatants(squad)

    expect(combatants.length).toBe(2)
  })

  it('marks combatants as player-owned monsters', () => {
    const squad = [createMockMonster()]
    const combatants = createSquadCombatants(squad)

    expect(combatants[0].isPlayer).toBe(true)
    expect(combatants[0].isMonster).toBe(true)
  })

  it('marks combatants as not capturable', () => {
    const squad = [createMockMonster()]
    const combatants = createSquadCombatants(squad)

    expect(combatants[0].capturable).toBe(false)
  })

  it('uses nickname if present', () => {
    const squad = [createMockMonster({ nickname: 'Sparky' })]
    const combatants = createSquadCombatants(squad)

    expect(combatants[0].name).toBe('Sparky')
  })

  it('uses species name if no nickname', () => {
    const squad = [createMockMonster({ nickname: null })]
    const combatants = createSquadCombatants(squad)

    expect(combatants[0].name).toBe('Testmon')
  })

  it('applies bond bonus to stats', () => {
    const monster = createMockMonster({ bondLevel: BOND_MAX })
    const squad = [monster]
    const combatants = createSquadCombatants(squad)

    const expectedMultiplier = 1 + BOND_STAT_BONUS_MAX
    expect(combatants[0].stats.attack).toBe(Math.floor(monster.stats.attack * expectedMultiplier))
  })

  it('excludes dead monsters', () => {
    const alive = createMockMonster()
    const dead = createMockMonster({
      stats: { ...createMockMonster().stats, currentHp: 0 },
    })
    const squad = [alive, dead]
    const combatants = createSquadCombatants(squad)

    expect(combatants.length).toBe(1)
  })

  it('includes abilities', () => {
    const squad = [createMockMonster()]
    const combatants = createSquadCombatants(squad)

    expect(combatants[0].abilities.length).toBe(1)
    expect(combatants[0].abilities[0].abilityId).toBe('test-attack')
  })

  it('generates squad-prefixed combatant IDs', () => {
    const monster = createMockMonster({ instanceId: 'test-id' })
    const combatants = createSquadCombatants([monster])

    expect(combatants[0].combatantId).toBe('squad-test-id')
  })
})

describe('setMonsterNickname', () => {
  it('sets nickname for matching monster', () => {
    const monster = createMockMonster({ instanceId: 'target' })
    const squad = [monster]

    const result = setMonsterNickname(squad, 'target', 'Fluffy')

    expect(result[0].nickname).toBe('Fluffy')
  })

  it('can clear nickname', () => {
    const monster = createMockMonster({ instanceId: 'target', nickname: 'Fluffy' })
    const squad = [monster]

    const result = setMonsterNickname(squad, 'target', null)

    expect(result[0].nickname).toBeNull()
  })

  it('does not affect other monsters', () => {
    const a = createMockMonster({ instanceId: 'mon-a', nickname: 'Alpha' })
    const b = createMockMonster({ instanceId: 'mon-b', nickname: 'Beta' })
    const squad = [a, b]

    const result = setMonsterNickname(squad, 'mon-a', 'Changed')

    expect(result[0].nickname).toBe('Changed')
    expect(result[1].nickname).toBe('Beta')
  })
})

describe('updateSquadMonster', () => {
  it('updates monster with matching id', () => {
    const original = createMockMonster({ instanceId: 'target' })
    const squad = [original]
    const updated = { ...original, level: 10 }

    const result = updateSquadMonster(squad, updated)

    expect(result[0].level).toBe(10)
  })

  it('does not affect non-matching monsters', () => {
    const a = createMockMonster({ instanceId: 'mon-a', level: 5 })
    const b = createMockMonster({ instanceId: 'mon-b', level: 3 })
    const squad = [a, b]
    const updated = { ...a, level: 10 }

    const result = updateSquadMonster(squad, updated)

    expect(result[0].level).toBe(10)
    expect(result[1].level).toBe(3)
  })
})

describe('getAliveSquadMonsters', () => {
  it('returns only alive monsters', () => {
    const alive1 = createMockMonster({ instanceId: 'alive1' })
    const dead = createMockMonster({
      instanceId: 'dead',
      stats: { ...createMockMonster().stats, currentHp: 0 },
    })
    const alive2 = createMockMonster({ instanceId: 'alive2' })
    const squad = [alive1, dead, alive2]

    const result = getAliveSquadMonsters(squad)

    expect(result.length).toBe(2)
    expect(result.find((m) => m.instanceId === 'dead')).toBeUndefined()
  })

  it('returns empty array if all dead', () => {
    const dead = createMockMonster({
      stats: { ...createMockMonster().stats, currentHp: 0 },
    })
    const squad = [dead]

    expect(getAliveSquadMonsters(squad)).toHaveLength(0)
  })
})
