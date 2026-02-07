import type {
  PlayerCharacter,
  Inventory,
  MonsterInstance,
  QuestProgress,
  AchievementProgress,
  AchievementStats,
} from '../models/types'
import { createNewPlayer } from './CharacterSystem'
import { MAX_INVENTORY_SLOTS } from '../config'

// ── Game State ──

export interface GameState {
  readonly player: PlayerCharacter
  readonly inventory: Inventory
  readonly squad: ReadonlyArray<MonsterInstance>
  readonly monsterStorage: ReadonlyArray<MonsterInstance>
  readonly discoveredSpecies: ReadonlyArray<string>
  readonly currentAreaId: string
  readonly defeatedBosses: ReadonlyArray<string>
  readonly openedChests: ReadonlyArray<string>
  readonly activeQuests: ReadonlyArray<QuestProgress>
  readonly completedQuestIds: ReadonlyArray<string>
  readonly achievements: ReadonlyArray<AchievementProgress>
  readonly achievementStats: AchievementStats
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
    currentAreaId: 'sunlit-village',
    defeatedBosses: [],
    openedChests: [],
    activeQuests: [],
    completedQuestIds: [],
    achievements: [],
    achievementStats: {
      battlesWon: 0,
      monstersDefeated: 0,
      monstersCaptured: 0,
      goldEarned: 0,
      questsCompleted: 0,
      bossesDefeated: 0,
      areasVisited: 0,
      speciesDiscovered: 0,
      monstersBreed: 0,
      highestPlayerLevel: 1,
    },
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

export function updateCurrentArea(state: GameState, areaId: string): GameState {
  return { ...state, currentAreaId: areaId }
}

export function addDefeatedBoss(state: GameState, bossId: string): GameState {
  if (state.defeatedBosses.includes(bossId)) {
    return state
  }
  return { ...state, defeatedBosses: [...state.defeatedBosses, bossId] }
}

export function addOpenedChest(state: GameState, chestId: string): GameState {
  if (state.openedChests.includes(chestId)) {
    return state
  }
  return { ...state, openedChests: [...state.openedChests, chestId] }
}

export function updateActiveQuests(
  state: GameState,
  activeQuests: ReadonlyArray<QuestProgress>,
): GameState {
  return { ...state, activeQuests }
}

export function updateCompletedQuests(
  state: GameState,
  completedQuestIds: ReadonlyArray<string>,
): GameState {
  return { ...state, completedQuestIds }
}

export function updateAchievements(
  state: GameState,
  achievements: ReadonlyArray<AchievementProgress>,
): GameState {
  return { ...state, achievements }
}

export function updateAchievementStats(
  state: GameState,
  achievementStats: AchievementStats,
): GameState {
  return { ...state, achievementStats }
}
