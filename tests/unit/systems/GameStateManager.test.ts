import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock EventBus to avoid Phaser dependency
vi.mock('../../../src/events/EventBus', () => ({
  EventBus: { emit: vi.fn(), on: vi.fn(), once: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() },
}))

import {
  createInitialGameState,
  getGameState,
  setGameState,
  hasGameState,
  updatePlayer,
  updateInventory,
  updateSquad,
  type GameState,
} from '../../../src/systems/GameStateManager'
import type { PlayerCharacter, Inventory, MonsterInstance } from '../../../src/models/types'

// ── Mock Scene Registry ──

function createMockScene() {
  const store: Record<string, unknown> = {}
  return {
    registry: {
      get: (key: string) => store[key],
      set: (key: string, value: unknown) => {
        store[key] = value
      },
    },
  }
}

// ── createInitialGameState ──

describe('createInitialGameState', () => {
  it('should create a game state with the given player name', () => {
    const state = createInitialGameState('Hero')

    expect(state.player.name).toBe('Hero')
    expect(state.player.level).toBe(1)
  })

  it('should create an empty inventory', () => {
    const state = createInitialGameState('Hero')

    expect(state.inventory.items).toHaveLength(0)
    expect(state.inventory.maxSlots).toBeGreaterThan(0)
    expect(state.inventory.equipment).toHaveLength(0)
  })

  it('should create an empty squad', () => {
    const state = createInitialGameState('Hero')

    expect(state.squad).toHaveLength(0)
  })
})

// ── setGameState / getGameState ──

describe('setGameState and getGameState', () => {
  it('should store and retrieve game state', () => {
    const scene = createMockScene()
    const state = createInitialGameState('Hero')

    setGameState(scene, state)
    const retrieved = getGameState(scene)

    expect(retrieved).toBe(state)
    expect(retrieved.player.name).toBe('Hero')
  })

  it('should throw when game state has not been initialized', () => {
    const scene = createMockScene()

    expect(() => getGameState(scene)).toThrow('GameState not initialized')
  })
})

// ── hasGameState ──

describe('hasGameState', () => {
  it('should return false when no state is set', () => {
    const scene = createMockScene()

    expect(hasGameState(scene)).toBe(false)
  })

  it('should return true after state is set', () => {
    const scene = createMockScene()
    setGameState(scene, createInitialGameState('Hero'))

    expect(hasGameState(scene)).toBe(true)
  })
})

// ── Immutable Updaters ──

describe('updatePlayer', () => {
  it('should return a new state with the updated player', () => {
    const state = createInitialGameState('Hero')
    const updatedPlayer: PlayerCharacter = { ...state.player, level: 5 }

    const newState = updatePlayer(state, updatedPlayer)

    expect(newState.player.level).toBe(5)
    expect(newState.inventory).toBe(state.inventory)
    expect(newState.squad).toBe(state.squad)
  })

  it('should not mutate the original state', () => {
    const state = createInitialGameState('Hero')
    const updatedPlayer: PlayerCharacter = { ...state.player, level: 5 }

    updatePlayer(state, updatedPlayer)

    expect(state.player.level).toBe(1)
  })
})

describe('updateInventory', () => {
  it('should return a new state with the updated inventory', () => {
    const state = createInitialGameState('Hero')
    const updatedInventory: Inventory = { ...state.inventory, maxSlots: 50 }

    const newState = updateInventory(state, updatedInventory)

    expect(newState.inventory.maxSlots).toBe(50)
    expect(newState.player).toBe(state.player)
    expect(newState.squad).toBe(state.squad)
  })

  it('should not mutate the original state', () => {
    const state = createInitialGameState('Hero')
    const updatedInventory: Inventory = { ...state.inventory, maxSlots: 50 }

    updateInventory(state, updatedInventory)

    expect(state.inventory.maxSlots).not.toBe(50)
  })
})

describe('updateSquad', () => {
  it('should return a new state with the updated squad', () => {
    const state = createInitialGameState('Hero')
    const newSquad: MonsterInstance[] = [
      {
        instanceId: 'mon-1',
        speciesId: 'flamepup',
        nickname: 'Sparky',
        level: 3,
        experience: 50,
        experienceToNextLevel: 100,
        stats: state.player.stats,
        abilities: [],
        statusEffects: [],
      },
    ]

    const newState = updateSquad(state, newSquad)

    expect(newState.squad).toHaveLength(1)
    expect(newState.squad[0].nickname).toBe('Sparky')
    expect(newState.player).toBe(state.player)
    expect(newState.inventory).toBe(state.inventory)
  })

  it('should not mutate the original state', () => {
    const state = createInitialGameState('Hero')

    updateSquad(state, [])

    expect(state.squad).toHaveLength(0)
  })
})
