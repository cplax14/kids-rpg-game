import type {
  GameAreaDefinition,
  BossDefinition,
  BattleCombatant,
  AreaEncounterEntry,
} from '../models/types'
import type { GameState } from './GameStateManager'
import { weightedRandom, randomInt } from '../utils/math'
import { getSpecies, calculateMonsterStats, getLearnedAbilitiesAtLevel } from './MonsterSystem'
import { createCombatantFromEnemy } from './CombatSystem'

// ── Registry ──

const areaRegistry: Map<string, GameAreaDefinition> = new Map()
const bossRegistry: Map<string, BossDefinition> = new Map()

export function loadAreaData(areas: ReadonlyArray<GameAreaDefinition>): void {
  areaRegistry.clear()
  for (const area of areas) {
    areaRegistry.set(area.areaId, area)
  }
}

export function loadBossData(bosses: ReadonlyArray<BossDefinition>): void {
  bossRegistry.clear()
  for (const boss of bosses) {
    bossRegistry.set(boss.bossId, boss)
  }
}

export function getArea(areaId: string): GameAreaDefinition | undefined {
  return areaRegistry.get(areaId)
}

export function getBoss(bossId: string): BossDefinition | undefined {
  return bossRegistry.get(bossId)
}

export function getAllAreas(): ReadonlyArray<GameAreaDefinition> {
  return Array.from(areaRegistry.values())
}

export function getAllBosses(): ReadonlyArray<BossDefinition> {
  return Array.from(bossRegistry.values())
}

// ── Encounter Generation ──

export interface AreaEncounterResult {
  readonly combatants: ReadonlyArray<BattleCombatant>
  readonly speciesIds: ReadonlyArray<string>
}

export function generateAreaEncounter(areaId: string): AreaEncounterResult | null {
  const area = getArea(areaId)
  if (!area || area.encounters.length === 0) {
    return null
  }

  // Pick 1-2 enemies
  const enemyCount = Math.random() < 0.3 ? 2 : 1
  const enemies: BattleCombatant[] = []
  const speciesIds: string[] = []

  const items = area.encounters.map((e) => e)
  const weights = area.encounters.map((e) => e.weight)

  for (let i = 0; i < enemyCount; i++) {
    const picked = weightedRandom(items, weights) as AreaEncounterEntry

    const species = getSpecies(picked.speciesId)
    if (!species) continue

    const level = randomInt(picked.minLevel, picked.maxLevel)
    const stats = calculateMonsterStats(species, level)
    const abilities = getLearnedAbilitiesAtLevel(species, level)

    enemies.push(
      createCombatantFromEnemy(
        `${species.name} Lv.${level}`,
        stats,
        species.element,
        abilities,
      ),
    )
    speciesIds.push(picked.speciesId)
  }

  return enemies.length > 0 ? { combatants: enemies, speciesIds } : null
}

// ── Boss Encounter ──

export interface BossEncounterResult {
  readonly combatant: BattleCombatant
  readonly boss: BossDefinition
  readonly speciesId: string
}

export function createBossEncounter(bossId: string): BossEncounterResult | null {
  const boss = getBoss(bossId)
  if (!boss) return null

  const species = getSpecies(boss.speciesId)
  if (!species) return null

  const stats = calculateMonsterStats(species, boss.level)
  const abilities = getLearnedAbilitiesAtLevel(species, boss.level)

  const combatant = createCombatantFromEnemy(
    `${boss.name} Lv.${boss.level}`,
    stats,
    species.element,
    abilities,
    false, // not capturable
  )

  return {
    combatant,
    boss,
    speciesId: boss.speciesId,
  }
}

// ── Access Validation ──

export interface AccessResult {
  readonly allowed: boolean
  readonly reason?: string
}

export function canAccessArea(areaId: string, gameState: GameState): AccessResult {
  const area = getArea(areaId)
  if (!area) {
    return { allowed: false, reason: 'Area does not exist.' }
  }

  // Check player level
  if (gameState.player.level < area.recommendedLevel) {
    return {
      allowed: false,
      reason: `Recommended level ${area.recommendedLevel}. You are level ${gameState.player.level}.`,
    }
  }

  // Find the transition zone that leads to this area
  const currentArea = getArea(gameState.currentAreaId)
  if (currentArea) {
    const transition = currentArea.transitions.find((t) => t.targetAreaId === areaId)
    if (transition) {
      // Check level requirement
      if (transition.requiredLevel && gameState.player.level < transition.requiredLevel) {
        return {
          allowed: false,
          reason: `You must be level ${transition.requiredLevel} to enter this area.`,
        }
      }

      // Check boss requirement
      if (transition.requiredBossDefeated) {
        if (!gameState.defeatedBosses.includes(transition.requiredBossDefeated)) {
          const boss = getBoss(transition.requiredBossDefeated)
          const bossName = boss?.name ?? 'the guardian'
          return {
            allowed: false,
            reason: `You must defeat ${bossName} to access this area.`,
          }
        }
      }
    }
  }

  return { allowed: true }
}

export function isBossDefeated(bossId: string, gameState: GameState): boolean {
  return gameState.defeatedBosses.includes(bossId)
}

export function isChestOpened(chestId: string, gameState: GameState): boolean {
  return gameState.openedChests.includes(chestId)
}

// ── Area Bosses ──

export function getAreaBosses(areaId: string): ReadonlyArray<BossDefinition> {
  const area = getArea(areaId)
  if (!area) return []

  return area.bossIds
    .map((id) => getBoss(id))
    .filter((boss): boss is BossDefinition => boss !== undefined)
}

export function getUndefeatedBosses(
  areaId: string,
  gameState: GameState,
): ReadonlyArray<BossDefinition> {
  const bosses = getAreaBosses(areaId)
  return bosses.filter((boss) => !isBossDefeated(boss.bossId, gameState))
}
