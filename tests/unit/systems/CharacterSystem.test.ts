import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createNewPlayer,
  getXpForLevel,
  getXpToNextLevel,
  calculateStatsForLevel,
  addExperience,
  healPlayer,
  fullHeal,
  damagePlayer,
  updatePlayerPosition,
  updatePlayerGold,
  isPlayerAlive,
} from '../../../src/systems/CharacterSystem'
import { MAX_LEVEL, XP_TABLE } from '../../../src/models/constants'

// Mock EventBus to prevent Phaser dependency
vi.mock('../../../src/events/EventBus', () => ({
  EventBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}))

describe('createNewPlayer', () => {
  it('creates a player with the given name', () => {
    const player = createNewPlayer('TestHero')
    expect(player.name).toBe('TestHero')
  })

  it('starts at level 1 with 0 experience', () => {
    const player = createNewPlayer('Hero')
    expect(player.level).toBe(1)
    expect(player.experience).toBe(0)
  })

  it('has base stats matching specification', () => {
    const player = createNewPlayer('Hero')
    expect(player.stats.maxHp).toBe(120)
    expect(player.stats.currentHp).toBe(120)
    expect(player.stats.maxMp).toBe(40)
    expect(player.stats.currentMp).toBe(40)
    expect(player.stats.attack).toBe(18)
    expect(player.stats.defense).toBe(14)
    expect(player.stats.speed).toBe(14)
  })

  it('starts with 100 gold', () => {
    const player = createNewPlayer('Hero')
    expect(player.gold).toBe(100)
  })

  it('starts in sunlit-village', () => {
    const player = createNewPlayer('Hero')
    expect(player.currentAreaId).toBe('sunlit-village')
  })

  it('has no equipment', () => {
    const player = createNewPlayer('Hero')
    expect(player.equipment.weapon).toBeNull()
    expect(player.equipment.armor).toBeNull()
    expect(player.equipment.helmet).toBeNull()
    expect(player.equipment.accessory).toBeNull()
  })

  it('returns a new object each call (no shared state)', () => {
    const p1 = createNewPlayer('A')
    const p2 = createNewPlayer('B')
    expect(p1).not.toBe(p2)
    expect(p1.id).not.toBe(p2.id)
  })
})

describe('getXpForLevel', () => {
  it('returns 0 for level 1', () => {
    expect(getXpForLevel(1)).toBe(0)
  })

  it('returns correct XP for level 2', () => {
    expect(getXpForLevel(2)).toBe(XP_TABLE[2])
  })

  it('returns 0 for level below 1', () => {
    expect(getXpForLevel(0)).toBe(0)
    expect(getXpForLevel(-1)).toBe(0)
  })

  it('returns last table entry for levels beyond table', () => {
    expect(getXpForLevel(100)).toBe(XP_TABLE[XP_TABLE.length - 1])
  })
})

describe('getXpToNextLevel', () => {
  it('returns XP needed for level 2 when at level 1', () => {
    expect(getXpToNextLevel(1)).toBe(getXpForLevel(2))
  })

  it('returns 0 at max level', () => {
    expect(getXpToNextLevel(MAX_LEVEL)).toBe(0)
  })
})

describe('calculateStatsForLevel', () => {
  it('returns base stats at level 1', () => {
    const stats = calculateStatsForLevel(1)
    expect(stats.maxHp).toBe(120)
    expect(stats.attack).toBe(18)
    expect(stats.defense).toBe(14)
  })

  it('increases stats at level 2 by growth amounts', () => {
    const stats = calculateStatsForLevel(2)
    expect(stats.maxHp).toBe(120 + 12) // base + hp growth
    expect(stats.attack).toBe(18 + 3) // base + attack growth
    expect(stats.defense).toBe(14 + 2) // base + defense growth
  })

  it('scales linearly with level', () => {
    const level5 = calculateStatsForLevel(5)
    const level10 = calculateStatsForLevel(10)
    // HP at level 5: 120 + 12*4 = 168
    // HP at level 10: 120 + 12*9 = 228
    expect(level5.maxHp).toBe(168)
    expect(level10.maxHp).toBe(228)
  })

  it('sets currentHp and currentMp to max', () => {
    const stats = calculateStatsForLevel(5)
    expect(stats.currentHp).toBe(stats.maxHp)
    expect(stats.currentMp).toBe(stats.maxMp)
  })
})

describe('addExperience', () => {
  it('adds XP without leveling up', () => {
    const player = createNewPlayer('Hero')
    const updated = addExperience(player, 50)
    expect(updated.experience).toBe(50)
    expect(updated.level).toBe(1)
  })

  it('does not mutate the original player', () => {
    const player = createNewPlayer('Hero')
    const updated = addExperience(player, 50)
    expect(player.experience).toBe(0)
    expect(updated).not.toBe(player)
  })

  it('returns same player at max level', () => {
    const player = { ...createNewPlayer('Hero'), level: MAX_LEVEL }
    const result = addExperience(player, 1000)
    expect(result).toBe(player)
  })

  it('levels up when enough XP is gained', () => {
    const player = createNewPlayer('Hero')
    const xpNeeded = getXpToNextLevel(1)
    const updated = addExperience(player, xpNeeded)
    expect(updated.level).toBeGreaterThanOrEqual(2)
  })

  it('updates stats on level up', () => {
    const player = createNewPlayer('Hero')
    const xpNeeded = getXpToNextLevel(1)
    const updated = addExperience(player, xpNeeded)
    expect(updated.stats.maxHp).toBeGreaterThan(player.stats.maxHp)
  })

  it('preserves HP ratio on level up', () => {
    const player = {
      ...createNewPlayer('Hero'),
      stats: {
        ...createNewPlayer('Hero').stats,
        currentHp: 60, // 50% of 120 maxHp
      },
    }
    const xpNeeded = getXpToNextLevel(1)
    const updated = addExperience(player, xpNeeded)
    const expectedRatio = 60 / 120
    const actualRatio = updated.stats.currentHp / updated.stats.maxHp
    expect(actualRatio).toBeCloseTo(expectedRatio, 1)
  })

  it('emits PLAYER_LEVEL_UP event on level up', async () => {
    const { EventBus } = await import('../../../src/events/EventBus')
    const player = createNewPlayer('Hero')
    const xpNeeded = getXpToNextLevel(1)
    addExperience(player, xpNeeded)
    expect(EventBus.emit).toHaveBeenCalled()
  })
})

describe('healPlayer', () => {
  it('heals HP and MP', () => {
    const player = {
      ...createNewPlayer('Hero'),
      stats: { ...createNewPlayer('Hero').stats, currentHp: 50, currentMp: 10 },
    }
    const healed = healPlayer(player, 30, 15)
    expect(healed.stats.currentHp).toBe(80)
    expect(healed.stats.currentMp).toBe(25)
  })

  it('does not exceed max HP', () => {
    const player = createNewPlayer('Hero')
    const healed = healPlayer(player, 100, 0)
    expect(healed.stats.currentHp).toBe(player.stats.maxHp)
  })

  it('does not exceed max MP', () => {
    const player = createNewPlayer('Hero')
    const healed = healPlayer(player, 0, 200)
    expect(healed.stats.currentMp).toBe(player.stats.maxMp)
  })

  it('does not mutate original', () => {
    const player = {
      ...createNewPlayer('Hero'),
      stats: { ...createNewPlayer('Hero').stats, currentHp: 50 },
    }
    healPlayer(player, 30, 0)
    expect(player.stats.currentHp).toBe(50)
  })
})

describe('fullHeal', () => {
  it('restores HP and MP to max', () => {
    const player = {
      ...createNewPlayer('Hero'),
      stats: { ...createNewPlayer('Hero').stats, currentHp: 1, currentMp: 1 },
    }
    const healed = fullHeal(player)
    expect(healed.stats.currentHp).toBe(healed.stats.maxHp)
    expect(healed.stats.currentMp).toBe(healed.stats.maxMp)
  })
})

describe('damagePlayer', () => {
  it('reduces HP by given amount', () => {
    const player = createNewPlayer('Hero')
    const damaged = damagePlayer(player, 30)
    expect(damaged.stats.currentHp).toBe(90)
  })

  it('does not go below 0', () => {
    const player = createNewPlayer('Hero')
    const damaged = damagePlayer(player, 999)
    expect(damaged.stats.currentHp).toBe(0)
  })

  it('does not mutate original', () => {
    const player = createNewPlayer('Hero')
    damagePlayer(player, 30)
    expect(player.stats.currentHp).toBe(120)
  })
})

describe('updatePlayerPosition', () => {
  it('updates position immutably', () => {
    const player = createNewPlayer('Hero')
    const moved = updatePlayerPosition(player, { x: 100, y: 200 })
    expect(moved.position).toEqual({ x: 100, y: 200 })
    expect(player.position).toEqual({ x: 0, y: 0 })
  })
})

describe('updatePlayerGold', () => {
  it('adds gold', () => {
    const player = createNewPlayer('Hero')
    const updated = updatePlayerGold(player, 50)
    expect(updated.gold).toBe(150)
  })

  it('subtracts gold', () => {
    const player = createNewPlayer('Hero')
    const updated = updatePlayerGold(player, -30)
    expect(updated.gold).toBe(70)
  })

  it('does not go below 0', () => {
    const player = createNewPlayer('Hero')
    const updated = updatePlayerGold(player, -200)
    expect(updated.gold).toBe(0)
  })

  it('does not mutate original', () => {
    const player = createNewPlayer('Hero')
    updatePlayerGold(player, 50)
    expect(player.gold).toBe(100)
  })
})

describe('isPlayerAlive', () => {
  it('returns true when HP is above 0', () => {
    const player = createNewPlayer('Hero')
    expect(isPlayerAlive(player)).toBe(true)
  })

  it('returns false when HP is 0', () => {
    const player = damagePlayer(createNewPlayer('Hero'), 999)
    expect(isPlayerAlive(player)).toBe(false)
  })
})
