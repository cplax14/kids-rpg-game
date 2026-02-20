import type {
  EvolutionChain,
  EvolutionStageDefinition,
  EvolutionResult,
  MonsterInstance,
  MonsterSpecies,
  CharacterStats,
} from '../models/types'
import {
  EVOLUTION_TRAIT_CHANCE,
  EVOLUTION_STAT_BOOST_MIN,
  EVOLUTION_STAT_BOOST_MAX,
  EVOLUTION_BONUS_TRAITS,
} from '../models/constants'
import { getSpecies } from './MonsterSystem'

// ── Registry ──

let chainRegistry: ReadonlyArray<EvolutionChain> = []

export function loadEvolutionChains(chains: ReadonlyArray<EvolutionChain>): void {
  chainRegistry = chains
}

export function getEvolutionChains(): ReadonlyArray<EvolutionChain> {
  return chainRegistry
}

export function getChainForSpecies(speciesId: string): EvolutionChain | null {
  return chainRegistry.find((chain) =>
    chain.stages.some((stage) => stage.speciesId === speciesId),
  ) ?? null
}

export function getStageForSpecies(speciesId: string): EvolutionStageDefinition | null {
  for (const chain of chainRegistry) {
    const stage = chain.stages.find((s) => s.speciesId === speciesId)
    if (stage) return stage
  }
  return null
}

// ── Evolution Check ──

export interface CanEvolveResult {
  readonly canEvolve: boolean
  readonly reason: 'not_enough_stardust' | 'level_too_low' | 'no_evolution' | 'already_max' | null
  readonly nextStage: EvolutionStageDefinition | null
  readonly stardustCost: number
  readonly requiredLevel: number
}

export function canEvolve(
  monster: MonsterInstance,
  playerStardust: number,
): CanEvolveResult {
  const species = getSpecies(monster.speciesId)
  if (!species) {
    return { canEvolve: false, reason: 'no_evolution', nextStage: null, stardustCost: 0, requiredLevel: 0 }
  }

  const currentStage = getStageForSpecies(monster.speciesId)
  if (!currentStage || !currentStage.evolvesTo) {
    return { canEvolve: false, reason: 'already_max', nextStage: null, stardustCost: 0, requiredLevel: 0 }
  }

  const chain = getChainForSpecies(monster.speciesId)
  if (!chain) {
    return { canEvolve: false, reason: 'no_evolution', nextStage: null, stardustCost: 0, requiredLevel: 0 }
  }

  const nextStage = chain.stages.find((s) => s.speciesId === currentStage.evolvesTo)
  if (!nextStage) {
    return { canEvolve: false, reason: 'no_evolution', nextStage: null, stardustCost: 0, requiredLevel: 0 }
  }

  if (monster.level < nextStage.requiredLevel) {
    return {
      canEvolve: false,
      reason: 'level_too_low',
      nextStage,
      stardustCost: nextStage.stardustCost,
      requiredLevel: nextStage.requiredLevel,
    }
  }

  if (playerStardust < nextStage.stardustCost) {
    return {
      canEvolve: false,
      reason: 'not_enough_stardust',
      nextStage,
      stardustCost: nextStage.stardustCost,
      requiredLevel: nextStage.requiredLevel,
    }
  }

  return {
    canEvolve: true,
    reason: null,
    nextStage,
    stardustCost: nextStage.stardustCost,
    requiredLevel: nextStage.requiredLevel,
  }
}

// ── Evolution Execution ──

export function executeEvolution(
  monster: MonsterInstance,
  nextStage: EvolutionStageDefinition,
  nextSpecies: MonsterSpecies,
): EvolutionResult {
  // Roll for bonus trait
  const traitRoll = Math.random()
  const bonusTrait = traitRoll < EVOLUTION_TRAIT_CHANCE
    ? EVOLUTION_BONUS_TRAITS[Math.floor(Math.random() * EVOLUTION_BONUS_TRAITS.length)]
    : null

  // Roll for stat boost (random 5-15% on 2-3 random stats)
  const boostPercent = EVOLUTION_STAT_BOOST_MIN +
    Math.random() * (EVOLUTION_STAT_BOOST_MAX - EVOLUTION_STAT_BOOST_MIN)
  const statKeys: (keyof CharacterStats)[] = [
    'maxHp', 'maxMp', 'attack', 'defense',
    'magicAttack', 'magicDefense', 'speed',
  ]
  // Pick 2-3 random stats to boost
  const numBoosts = 2 + (Math.random() < 0.5 ? 1 : 0)
  const shuffled = [...statKeys].sort(() => Math.random() - 0.5)
  const boostedStats = shuffled.slice(0, numBoosts)

  const statBoost: Partial<CharacterStats> = {}
  for (const key of boostedStats) {
    const baseValue = nextSpecies.baseStats[key]
    const boostAmount = Math.max(1, Math.floor(baseValue * boostPercent))
    ;(statBoost as Record<string, number>)[key] = boostAmount
  }

  return {
    previousSpeciesId: monster.speciesId,
    newSpeciesId: nextStage.speciesId,
    stardustSpent: nextStage.stardustCost,
    bonusTrait,
    statBoost: Object.keys(statBoost).length > 0 ? statBoost : null,
  }
}

// ── Evolution Preview ──

export interface EvolutionPreview {
  readonly currentStats: CharacterStats
  readonly projectedStats: CharacterStats
  readonly newAbilities: ReadonlyArray<string>
  readonly possibleTraits: ReadonlyArray<string>
}

export function getEvolutionPreview(
  monster: MonsterInstance,
  nextSpecies: MonsterSpecies,
): EvolutionPreview {
  // Calculate what stats would be at current level with new species
  const levelsGained = monster.level - 1
  const projectedStats: CharacterStats = {
    maxHp: nextSpecies.baseStats.maxHp + Math.floor(nextSpecies.statGrowth.hp * levelsGained),
    currentHp: nextSpecies.baseStats.maxHp + Math.floor(nextSpecies.statGrowth.hp * levelsGained),
    maxMp: nextSpecies.baseStats.maxMp + Math.floor(nextSpecies.statGrowth.mp * levelsGained),
    currentMp: nextSpecies.baseStats.maxMp + Math.floor(nextSpecies.statGrowth.mp * levelsGained),
    attack: nextSpecies.baseStats.attack + Math.floor(nextSpecies.statGrowth.attack * levelsGained),
    defense: nextSpecies.baseStats.defense + Math.floor(nextSpecies.statGrowth.defense * levelsGained),
    magicAttack: nextSpecies.baseStats.magicAttack + Math.floor(nextSpecies.statGrowth.magicAttack * levelsGained),
    magicDefense: nextSpecies.baseStats.magicDefense + Math.floor(nextSpecies.statGrowth.magicDefense * levelsGained),
    speed: nextSpecies.baseStats.speed + Math.floor(nextSpecies.statGrowth.speed * levelsGained),
    luck: nextSpecies.baseStats.luck,
  }

  // Find new abilities the monster would learn
  const newAbilities = nextSpecies.abilities
    .filter((a) => a.learnAtLevel <= monster.level)
    .map((a) => a.abilityId)

  return {
    currentStats: monster.stats,
    projectedStats,
    newAbilities,
    possibleTraits: [...EVOLUTION_BONUS_TRAITS],
  }
}
