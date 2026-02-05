import type {
  ChestObject,
  SignObject,
  FountainObject,
  TransitionZone,
  ItemDrop,
  InteractableObject,
} from '../models/types'
import type { GameState } from './GameStateManager'
import { addItem } from './InventorySystem'
import { updatePlayer, updateInventory, addOpenedChest } from './GameStateManager'
import { getBoss, getArea } from './WorldSystem'

// ── Chest Interaction ──

export interface ChestResult {
  readonly newState: GameState
  readonly itemsGained: ReadonlyArray<ItemDrop>
  readonly goldGained: number
  readonly alreadyOpened: boolean
}

export function openChest(chest: ChestObject, gameState: GameState): ChestResult {
  // Check if already opened
  if (gameState.openedChests.includes(chest.objectId)) {
    return {
      newState: gameState,
      itemsGained: [],
      goldGained: 0,
      alreadyOpened: true,
    }
  }

  let newState = gameState

  // Add gold
  if (chest.contents.gold > 0) {
    const updatedPlayer = {
      ...newState.player,
      gold: newState.player.gold + chest.contents.gold,
    }
    newState = updatePlayer(newState, updatedPlayer)
  }

  // Add items
  let inventory = newState.inventory
  for (const drop of chest.contents.items) {
    const result = addItem(inventory, drop.itemId, drop.quantity)
    if (result) {
      inventory = result
    }
  }
  newState = updateInventory(newState, inventory)

  // Mark chest as opened
  newState = addOpenedChest(newState, chest.objectId)

  return {
    newState,
    itemsGained: chest.contents.items,
    goldGained: chest.contents.gold,
    alreadyOpened: false,
  }
}

// ── Sign Interaction ──

export function readSign(sign: SignObject): ReadonlyArray<string> {
  return sign.message
}

// ── Fountain Interaction ──

export interface FountainResult {
  readonly newState: GameState
  readonly healed: boolean
  readonly healAmount: number
}

export function useFountain(fountain: FountainObject, gameState: GameState): FountainResult {
  const player = gameState.player
  const maxHp = player.stats.maxHp
  const currentHp = player.stats.currentHp

  // Calculate heal amount
  const healAmount = Math.floor(maxHp * fountain.healPercent)
  const newHp = Math.min(maxHp, currentHp + healAmount)
  const actualHeal = newHp - currentHp

  if (actualHeal <= 0) {
    return {
      newState: gameState,
      healed: false,
      healAmount: 0,
    }
  }

  // Update player HP
  const updatedPlayer = {
    ...player,
    stats: {
      ...player.stats,
      currentHp: newHp,
    },
  }

  let newState = updatePlayer(gameState, updatedPlayer)

  // Heal squad if applicable
  if (fountain.healsSquad && gameState.squad.length > 0) {
    const healedSquad = gameState.squad.map((monster) => {
      const monsterMaxHp = monster.stats.maxHp
      const monsterHealAmount = Math.floor(monsterMaxHp * fountain.healPercent)
      const newMonsterHp = Math.min(monsterMaxHp, monster.stats.currentHp + monsterHealAmount)

      return {
        ...monster,
        stats: {
          ...monster.stats,
          currentHp: newMonsterHp,
        },
      }
    })

    newState = { ...newState, squad: healedSquad }
  }

  return {
    newState,
    healed: true,
    healAmount: actualHeal,
  }
}

// ── Transition Zone Validation ──

export interface TransitionResult {
  readonly allowed: boolean
  readonly reason?: string
}

export function checkTransition(zone: TransitionZone, gameState: GameState): TransitionResult {
  // Check level requirement
  if (zone.requiredLevel !== undefined && gameState.player.level < zone.requiredLevel) {
    return {
      allowed: false,
      reason: `You must be level ${zone.requiredLevel} to enter this area. You are level ${gameState.player.level}.`,
    }
  }

  // Check boss requirement
  if (zone.requiredBossDefeated) {
    if (!gameState.defeatedBosses.includes(zone.requiredBossDefeated)) {
      const boss = getBoss(zone.requiredBossDefeated)
      const bossName = boss?.name ?? 'the guardian'
      return {
        allowed: false,
        reason: `You must defeat ${bossName} to access this area.`,
      }
    }
  }

  return { allowed: true }
}

// ── Utility Functions ──

export function isChestObject(obj: InteractableObject): obj is ChestObject {
  return obj.type === 'chest'
}

export function isSignObject(obj: InteractableObject): obj is SignObject {
  return obj.type === 'sign'
}

export function isFountainObject(obj: InteractableObject): obj is FountainObject {
  return obj.type === 'fountain'
}

export function getInteractableDescription(obj: InteractableObject): string {
  switch (obj.type) {
    case 'chest':
      return 'A treasure chest'
    case 'sign':
      return 'A wooden sign'
    case 'fountain':
      return 'A healing fountain'
    default:
      return 'Something interesting'
  }
}
