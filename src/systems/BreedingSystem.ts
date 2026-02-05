import type {
  MonsterInstance,
  MonsterSpecies,
  BreedingPair,
  BreedingResult,
  BreedingOutcome,
  BreedingRecipe,
  BreedingOffspringOption,
  Item,
  CharacterStats,
} from '../models/types'
import {
  TRAIT_INHERITANCE_CHANCE,
  MUTATION_CHANCE,
  STAT_INHERITANCE_VARIANCE,
} from '../models/constants'
import { getSpecies, createMonsterInstance, calculateMonsterStats } from './MonsterSystem'
import { getMutationTraits, getUniqueTraits, filterValidTraits } from './TraitSystem'

let recipeRegistry: ReadonlyArray<BreedingRecipe> = []

// ── Breeding Group Compatibility Matrix ──
const GROUP_COMPATIBILITY: Record<string, Record<string, number>> = {
  beast: { beast: 1.0, dragon: 0.75, elemental: 0.6, aquatic: 0.3, avian: 0.4 },
  dragon: { dragon: 1.0, beast: 0.75, aquatic: 0.5, elemental: 0.5, avian: 0.5 },
  aquatic: { aquatic: 1.0, dragon: 0.5, elemental: 0.4, beast: 0.3, avian: 0.3 },
  elemental: { elemental: 1.0, beast: 0.6, aquatic: 0.4, dragon: 0.5, avian: 0.6 },
  avian: { avian: 1.0, elemental: 0.6, dragon: 0.5, beast: 0.4, aquatic: 0.3 },
}

export function loadBreedingRecipes(recipes: ReadonlyArray<BreedingRecipe>): void {
  recipeRegistry = recipes
}

export function getBreedingRecipes(): ReadonlyArray<BreedingRecipe> {
  return recipeRegistry
}

export function getBreedingRecipe(
  speciesId1: string,
  speciesId2: string,
): BreedingRecipe | undefined {
  return recipeRegistry.find(
    (r) =>
      (r.parents[0] === speciesId1 && r.parents[1] === speciesId2) ||
      (r.parents[0] === speciesId2 && r.parents[1] === speciesId1),
  )
}

export function areCompatibleGroups(group1: string, group2: string): boolean {
  const compat = GROUP_COMPATIBILITY[group1]?.[group2] ?? 0
  return compat > 0
}

export function getGroupCompatibility(group1: string, group2: string): number {
  return GROUP_COMPATIBILITY[group1]?.[group2] ?? 0
}

export function getBreedingCompatibility(
  parent1: MonsterInstance,
  parent2: MonsterInstance,
): number {
  const species1 = getSpecies(parent1.speciesId)
  const species2 = getSpecies(parent2.speciesId)

  if (!species1 || !species2) return 0

  const groupCompat = getGroupCompatibility(species1.breedingGroup, species2.breedingGroup)
  if (groupCompat === 0) return 0

  // Same species bonus
  const sameSpeciesBonus = parent1.speciesId === parent2.speciesId ? 0.2 : 0

  // Bond level bonus (average of both parents' bond levels)
  const avgBond = (parent1.bondLevel + parent2.bondLevel) / 2
  const bondBonus = (avgBond / 100) * 0.15

  // Level similarity bonus (closer levels = better)
  const levelDiff = Math.abs(parent1.level - parent2.level)
  const levelBonus = Math.max(0, 0.1 - levelDiff * 0.01)

  const baseCompatibility = groupCompat + sameSpeciesBonus + bondBonus + levelBonus

  return Math.min(1, Math.max(0, baseCompatibility))
}

export function getPossibleOffspring(
  parent1: MonsterInstance,
  parent2: MonsterInstance,
): ReadonlyArray<BreedingOutcome> {
  const recipe = getBreedingRecipe(parent1.speciesId, parent2.speciesId)

  if (recipe) {
    return recipe.offspring.map((opt) => ({
      resultSpeciesId: opt.speciesId,
      probability: opt.probability,
      inheritableTraits: getUniqueTraits(
        getParentTraits(parent1),
        getParentTraits(parent2),
      ),
      bonusStats: null,
    }))
  }

  // Default fallback: can breed same species or related species
  const species1 = getSpecies(parent1.speciesId)
  const species2 = getSpecies(parent2.speciesId)

  if (!species1 || !species2) return []

  const compatibility = getBreedingCompatibility(parent1, parent2)
  if (compatibility < 0.3) return []

  // Same species: always possible
  if (parent1.speciesId === parent2.speciesId) {
    return [
      {
        resultSpeciesId: parent1.speciesId,
        probability: 1.0,
        inheritableTraits: getUniqueTraits(
          getParentTraits(parent1),
          getParentTraits(parent2),
        ),
        bonusStats: null,
      },
    ]
  }

  // Different species: 50/50 for either parent's species
  return [
    {
      resultSpeciesId: parent1.speciesId,
      probability: 0.5,
      inheritableTraits: getParentTraits(parent1),
      bonusStats: null,
    },
    {
      resultSpeciesId: parent2.speciesId,
      probability: 0.5,
      inheritableTraits: getParentTraits(parent2),
      bonusStats: null,
    },
  ]
}

function getParentTraits(monster: MonsterInstance): ReadonlyArray<string> {
  const species = getSpecies(monster.speciesId)
  if (!species) return monster.inheritedTraits

  return getUniqueTraits(species.breedingTraits, monster.inheritedTraits)
}

export function selectOffspringSpecies(
  possibleOffspring: ReadonlyArray<BreedingOutcome>,
  roll?: number,
): BreedingOutcome | undefined {
  if (possibleOffspring.length === 0) return undefined

  const actualRoll = roll ?? Math.random()
  let cumulative = 0

  for (const outcome of possibleOffspring) {
    cumulative += outcome.probability
    if (actualRoll <= cumulative) {
      return outcome
    }
  }

  return possibleOffspring[possibleOffspring.length - 1]
}

export function calculateInheritedStats(
  parent1: MonsterInstance,
  parent2: MonsterInstance,
  offspringSpecies: MonsterSpecies,
  variance?: number,
): CharacterStats {
  const actualVariance = variance ?? STAT_INHERITANCE_VARIANCE
  const baseStats = calculateMonsterStats(offspringSpecies, 1)

  // Calculate average bonus from parents' levels
  const avgParentLevel = (parent1.level + parent2.level) / 2
  const levelBonus = Math.floor(avgParentLevel * 0.1)

  // Apply slight variation based on parents' stats
  const applyVariance = (base: number): number => {
    const varianceFactor = 1 + (Math.random() * 2 - 1) * actualVariance
    return Math.max(1, Math.floor(base * varianceFactor) + levelBonus)
  }

  return {
    maxHp: applyVariance(baseStats.maxHp),
    currentHp: applyVariance(baseStats.maxHp),
    maxMp: applyVariance(baseStats.maxMp),
    currentMp: applyVariance(baseStats.maxMp),
    attack: applyVariance(baseStats.attack),
    defense: applyVariance(baseStats.defense),
    magicAttack: applyVariance(baseStats.magicAttack),
    magicDefense: applyVariance(baseStats.magicDefense),
    speed: applyVariance(baseStats.speed),
    luck: baseStats.luck,
  }
}

export function inheritTraits(
  parent1Traits: ReadonlyArray<string>,
  parent2Traits: ReadonlyArray<string>,
  inheritanceBoost?: number,
): ReadonlyArray<string> {
  const boost = inheritanceBoost ?? 0
  const inheritanceChance = Math.min(1, TRAIT_INHERITANCE_CHANCE + boost)
  const inherited: string[] = []

  const allTraits = getUniqueTraits(parent1Traits, parent2Traits)

  for (const trait of allTraits) {
    if (Math.random() < inheritanceChance) {
      inherited.push(trait)
    }
  }

  return filterValidTraits(inherited)
}

export function rollForMutation(
  existingTraits: ReadonlyArray<string>,
  mutationBoost?: number,
): string | null {
  const boost = mutationBoost ?? 0
  const mutationChance = Math.min(1, MUTATION_CHANCE + boost)

  if (Math.random() >= mutationChance) {
    return null
  }

  const mutationTraits = getMutationTraits()
  if (mutationTraits.length === 0) return null

  // Don't give a mutation trait the monster already has
  const available = mutationTraits.filter((t) => !existingTraits.includes(t.traitId))
  if (available.length === 0) return null

  const selected = available[Math.floor(Math.random() * available.length)]
  return selected.traitId
}

export function applyBreedingItemBoosts(
  items: ReadonlyArray<Item>,
): {
  compatibilityBoost: number
  traitBoost: number
  mutationBoost: number
} {
  let compatibilityBoost = 0
  let traitBoost = 0
  let mutationBoost = 0

  for (const item of items) {
    if (item.category !== 'breeding_item' || !item.useEffect) continue

    switch (item.itemId) {
      case 'breeding-charm':
        compatibilityBoost += item.useEffect.magnitude
        break
      case 'trait-crystal':
        traitBoost += item.useEffect.magnitude
        break
      case 'mutation-catalyst':
        mutationBoost += item.useEffect.magnitude
        break
      case 'harmony-bell':
        compatibilityBoost += item.useEffect.magnitude
        break
      default:
        // Generic breeding boost
        traitBoost += item.useEffect.magnitude * 0.5
        compatibilityBoost += item.useEffect.magnitude * 0.5
    }
  }

  return { compatibilityBoost, traitBoost, mutationBoost }
}

export function createBreedingPair(
  parent1: MonsterInstance,
  parent2: MonsterInstance,
  items?: ReadonlyArray<Item>,
): BreedingPair | null {
  const species1 = getSpecies(parent1.speciesId)
  const species2 = getSpecies(parent2.speciesId)

  if (!species1 || !species2) return null

  const boosts = applyBreedingItemBoosts(items ?? [])
  let compatibility = getBreedingCompatibility(parent1, parent2)
  compatibility = Math.min(1, compatibility + boosts.compatibilityBoost)

  if (compatibility <= 0) return null

  const possibleOffspring = getPossibleOffspring(parent1, parent2)
  if (possibleOffspring.length === 0) return null

  return {
    parent1,
    parent2,
    compatibility,
    possibleOffspring,
  }
}

export function executeBreeding(
  pair: BreedingPair,
  items?: ReadonlyArray<Item>,
): BreedingResult | null {
  const boosts = applyBreedingItemBoosts(items ?? [])

  // Select offspring species
  const selectedOutcome = selectOffspringSpecies(pair.possibleOffspring)
  if (!selectedOutcome) return null

  const offspringSpecies = getSpecies(selectedOutcome.resultSpeciesId)
  if (!offspringSpecies) return null

  // Get recipe bonus traits
  const recipe = getBreedingRecipe(pair.parent1.speciesId, pair.parent2.speciesId)
  const bonusTraits: string[] = []
  if (recipe) {
    const recipeOffspring = recipe.offspring.find(
      (o) => o.speciesId === selectedOutcome.resultSpeciesId,
    )
    if (recipeOffspring) {
      bonusTraits.push(...recipeOffspring.bonusTraits)
    }
  }

  // Inherit traits from parents
  const parent1Traits = getParentTraits(pair.parent1)
  const parent2Traits = getParentTraits(pair.parent2)

  const inheritedFromParent1 = inheritTraits(parent1Traits, [], boosts.traitBoost)
  const inheritedFromParent2 = inheritTraits([], parent2Traits, boosts.traitBoost)

  const allInheritedTraits = getUniqueTraits(
    getUniqueTraits(inheritedFromParent1, inheritedFromParent2),
    bonusTraits,
  )

  // Roll for mutation
  const mutationTrait = rollForMutation(allInheritedTraits, boosts.mutationBoost)
  const finalTraits = mutationTrait
    ? [...allInheritedTraits, mutationTrait]
    : [...allInheritedTraits]

  // Create offspring
  const offspring = createMonsterInstance(offspringSpecies.speciesId, 1, {
    inheritedTraits: filterValidTraits(finalTraits),
    parentSpeciesIds: [pair.parent1.speciesId, pair.parent2.speciesId],
  })

  if (!offspring) return null

  return {
    offspring,
    inheritedTraitsFromParent1: inheritedFromParent1,
    inheritedTraitsFromParent2: inheritedFromParent2,
    mutationOccurred: mutationTrait !== null,
    mutationTrait,
  }
}

export function canBreed(parent1: MonsterInstance, parent2: MonsterInstance): boolean {
  if (parent1.instanceId === parent2.instanceId) return false

  const species1 = getSpecies(parent1.speciesId)
  const species2 = getSpecies(parent2.speciesId)

  if (!species1 || !species2) return false

  return areCompatibleGroups(species1.breedingGroup, species2.breedingGroup)
}

export function getCompatibleMonstersForBreeding(
  monster: MonsterInstance,
  candidates: ReadonlyArray<MonsterInstance>,
): ReadonlyArray<MonsterInstance> {
  return candidates.filter(
    (c) => c.instanceId !== monster.instanceId && canBreed(monster, c),
  )
}
