import type { PlayerCharacter, Inventory, MonsterInstance } from '../models/types'
import { createNewPlayer } from './CharacterSystem'
import { MAX_INVENTORY_SLOTS } from '../config'

// ── Game State ──

export interface GameState {
  readonly player: PlayerCharacter
  readonly inventory: Inventory
  readonly squad: ReadonlyArray<MonsterInstance>
  readonly monsterStorage: ReadonlyArray<MonsterInstance>
  readonly discoveredSpecies: ReadonlyArray<string>
}

const REGISTRY_KEY = 'gameState'

// ── Factory ──

export function createInitialGameState(playerName: string): GameState {
  return {
    player: createNewPlayer(playerName),
    inventory: {
      items: [],
      maxSlots: MAX_INVENTORY_SLOTS,
      equipment: [],
    },
    squad: [],
    monsterStorage: [],
    discoveredSpecies: [],
  }
}

// ── Registry Access ──

export function getGameState(scene: { registry: { get(key: string): unknown } }): GameState {
  const state = scene.registry.get(REGISTRY_KEY) as GameState | undefined
  if (!state) {
    throw new Error('GameState not initialized. Call setGameState first.')
  }
  return state
}

export function setGameState(
  scene: { registry: { set(key: string, value: unknown): void } },
  state: GameState,
): void {
  scene.registry.set(REGISTRY_KEY, state)
}

export function hasGameState(scene: { registry: { get(key: string): unknown } }): boolean {
  return scene.registry.get(REGISTRY_KEY) !== undefined && scene.registry.get(REGISTRY_KEY) !== null
}

// ── Immutable Updaters ──

export function updatePlayer(state: GameState, player: PlayerCharacter): GameState {
  return { ...state, player }
}

export function updateInventory(state: GameState, inventory: Inventory): GameState {
  return { ...state, inventory }
}

export function updateSquad(state: GameState, squad: ReadonlyArray<MonsterInstance>): GameState {
  return { ...state, squad }
}

export function updateMonsterStorage(
  state: GameState,
  monsterStorage: ReadonlyArray<MonsterInstance>,
): GameState {
  return { ...state, monsterStorage }
}

export function updateDiscoveredSpecies(
  state: GameState,
  discoveredSpecies: ReadonlyArray<string>,
): GameState {
  return { ...state, discoveredSpecies }
}
