import { describe, it, expect, beforeEach, vi } from 'vitest'
import type {
  ChestObject,
  SignObject,
  FountainObject,
  TransitionZone,
  Item,
  Inventory,
  PlayerCharacter,
  MonsterInstance,
  ItemDrop,
} from '../../../src/models/types'

// Define GameState interface locally to avoid imports
interface GameState {
  readonly player: PlayerCharacter
  readonly inventory: Inventory
  readonly squad: ReadonlyArray<MonsterInstance>
  readonly monsterStorage: ReadonlyArray<MonsterInstance>
  readonly discoveredSpecies: ReadonlyArray<string>
  readonly currentAreaId: string
  readonly defeatedBosses: ReadonlyArray<string>
  readonly openedChests: ReadonlyArray<string>
}

// Mock WorldSystem to avoid Phaser dependency chain
vi.mock('../../../src/systems/WorldSystem', () => ({
  getBoss: vi.fn((bossId: string) => {
    if (bossId === 'test-boss') {
      return {
        bossId: 'test-boss',
        name: 'Test Boss',
        title: 'The Test',
        level: 10,
      }
    }
    return undefined
  }),
  getArea: vi.fn(() => undefined),
  loadBossData: vi.fn(),
}))

// Mock InventorySystem
vi.mock('../../../src/systems/InventorySystem', () => ({
  addItem: vi.fn((inventory: Inventory, itemId: string, quantity: number) => ({
    ...inventory,
    items: [...inventory.items, { item: { itemId }, quantity }],
  })),
  loadItemData: vi.fn(),
}))

// Mock GameStateManager
vi.mock('../../../src/systems/GameStateManager', () => ({
  updatePlayer: vi.fn((state: GameState, player: PlayerCharacter) => ({ ...state, player })),
  updateInventory: vi.fn((state: GameState, inventory: Inventory) => ({ ...state, inventory })),
  addOpenedChest: vi.fn((state: GameState, chestId: string) => ({
    ...state,
    openedChests: [...state.openedChests, chestId],
  })),
}))

import {
  openChest,
  readSign,
  useFountain,
  checkTransition,
  isChestObject,
  isSignObject,
  isFountainObject,
  getInteractableDescription,
} from '../../../src/systems/InteractableSystem'



const mockChest: ChestObject = {
  objectId: 'chest-1',
  type: 'chest',
  position: { x: 100, y: 100 },
  isOneTime: true,
  contents: {
    items: [{ itemId: 'potion-small', quantity: 3 }],
    gold: 100,
  },
}

const mockSign: SignObject = {
  objectId: 'sign-1',
  type: 'sign',
  position: { x: 200, y: 200 },
  isOneTime: false,
  message: ['Line 1', 'Line 2', 'Line 3'],
}

const mockFountain: FountainObject = {
  objectId: 'fountain-1',
  type: 'fountain',
  position: { x: 300, y: 300 },
  isOneTime: false,
  healPercent: 1.0,
  healsSquad: true,
}

const mockTransition: TransitionZone = {
  zoneId: 'trans-1',
  targetAreaId: 'next-area',
  targetPosition: { x: 50, y: 50 },
  triggerBounds: { x: 0, y: 0, width: 32, height: 32 },
  requiredLevel: 5,
  requiredBossDefeated: 'test-boss',
}

const createMockGameState = (overrides: Partial<GameState> = {}): GameState => ({
  player: {
    id: 'player-1',
    name: 'Test Player',
    level: 5,
    experience: 0,
    experienceToNextLevel: 100,
    stats: {
      maxHp: 100,
      currentHp: 50,
      maxMp: 50,
      currentMp: 50,
      attack: 15,
      defense: 12,
      magicAttack: 10,
      magicDefense: 10,
      speed: 14,
      luck: 10,
    },
    equipment: {
      weapon: null,
      armor: null,
      helmet: null,
      accessory: null,
    },
    position: { x: 0, y: 0 },
    currentAreaId: 'test-area',
    gold: 100,
  },
  inventory: {
    items: [],
    maxSlots: 30,
    equipment: [],
  },
  squad: [
    {
      instanceId: 'squad-1',
      speciesId: 'test-monster',
      nickname: null,
      level: 5,
      experience: 0,
      stats: {
        maxHp: 80,
        currentHp: 40,
        maxMp: 30,
        currentMp: 30,
        attack: 15,
        defense: 12,
        magicAttack: 10,
        magicDefense: 10,
        speed: 14,
        luck: 10,
      },
      learnedAbilities: [],
      inheritedTraits: [],
      parentSpeciesIds: [],
      isInSquad: true,
      capturedAt: new Date().toISOString(),
      bondLevel: 0,
    },
  ],
  monsterStorage: [],
  discoveredSpecies: [],
  currentAreaId: 'test-area',
  defeatedBosses: [],
  openedChests: [],
  ...overrides,
})

describe('InteractableSystem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('openChest', () => {
    it('should open a chest and add items and gold', () => {
      const state = createMockGameState()
      const result = openChest(mockChest, state)

      expect(result.alreadyOpened).toBe(false)
      expect(result.goldGained).toBe(100)
      expect(result.itemsGained.length).toBe(1)
      expect(result.newState.player.gold).toBe(200) // 100 + 100
      expect(result.newState.openedChests).toContain('chest-1')
    })

    it('should not open an already opened chest', () => {
      const state = createMockGameState({ openedChests: ['chest-1'] })
      const result = openChest(mockChest, state)

      expect(result.alreadyOpened).toBe(true)
      expect(result.goldGained).toBe(0)
      expect(result.itemsGained.length).toBe(0)
      expect(result.newState.player.gold).toBe(100) // unchanged
    })
  })

  describe('readSign', () => {
    it('should return sign messages', () => {
      const messages = readSign(mockSign)
      expect(messages.length).toBe(3)
      expect(messages[0]).toBe('Line 1')
    })
  })

  describe('useFountain', () => {
    it('should heal player when damaged', () => {
      const state = createMockGameState()
      const result = useFountain(mockFountain, state)

      expect(result.healed).toBe(true)
      expect(result.healAmount).toBe(50) // 100% of 100 maxHp, but only 50 missing
      expect(result.newState.player.stats.currentHp).toBe(100)
    })

    it('should heal squad when healsSquad is true', () => {
      const state = createMockGameState()
      const result = useFountain(mockFountain, state)

      expect(result.newState.squad[0].stats.currentHp).toBe(80) // fully healed
    })

    it('should not heal when at full health', () => {
      const state = createMockGameState({
        player: {
          ...createMockGameState().player,
          stats: {
            ...createMockGameState().player.stats,
            currentHp: 100, // full health
          },
        },
      })
      const result = useFountain(mockFountain, state)

      expect(result.healed).toBe(false)
      expect(result.healAmount).toBe(0)
    })
  })

  describe('checkTransition', () => {
    it('should allow transition when requirements met', () => {
      const state = createMockGameState({ defeatedBosses: ['test-boss'] })
      const result = checkTransition(mockTransition, state)

      expect(result.allowed).toBe(true)
    })

    it('should deny transition for insufficient level', () => {
      const state = createMockGameState({
        player: { ...createMockGameState().player, level: 3 },
        defeatedBosses: ['test-boss'],
      })
      const result = checkTransition(mockTransition, state)

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('level 5')
    })

    it('should deny transition when boss not defeated', () => {
      const state = createMockGameState()
      const result = checkTransition(mockTransition, state)

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Test Boss')
    })
  })

  describe('Type Guards', () => {
    it('should identify chest objects', () => {
      expect(isChestObject(mockChest)).toBe(true)
      expect(isChestObject(mockSign)).toBe(false)
    })

    it('should identify sign objects', () => {
      expect(isSignObject(mockSign)).toBe(true)
      expect(isSignObject(mockChest)).toBe(false)
    })

    it('should identify fountain objects', () => {
      expect(isFountainObject(mockFountain)).toBe(true)
      expect(isFountainObject(mockChest)).toBe(false)
    })
  })

  describe('getInteractableDescription', () => {
    it('should return descriptions for each type', () => {
      expect(getInteractableDescription(mockChest)).toContain('chest')
      expect(getInteractableDescription(mockSign)).toContain('sign')
      expect(getInteractableDescription(mockFountain)).toContain('fountain')
    })
  })
})
