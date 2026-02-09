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
  INHERITED_STAT_PERCENTAGE,
  LEGACY_ABILITY_CHANCE,
  PERFECT_BASE_CHANCE,
  PERFECT_HARMONY_BONUS,
  PERFECT_BOND_BONUS,
  PERFECT_STAT_MULTIPLIER,
  GENERATION_TRAIT_SLOTS,
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
  const usedItems = items ?? []
  const boosts = applyBreedingItemBoosts(usedItems)

  // Select offspring species
  const selectedOutcome = selectOffspringSpecies(pair.possibleOffspring)
  if (!selectedOutcome) return null

  const offspringSpecies = getSpecies(selectedOutcome.resultSpeciesId)
  if (!offspringSpecies) return null

  // Calculate breeding progression values
  const offspringGeneration = calculateOffspringGeneration(pair.parent1, pair.parent2)
  const isPerfect = rollForPerfectOffspring(pair.parent1, pair.parent2, usedItems)
  const inheritedStatBonus = calculateInheritedStatBonus(pair.parent1, pair.parent2, isPerfect)

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

  let allInheritedTraits = getUniqueTraits(
    getUniqueTraits(inheritedFromParent1, inheritedFromParent2),
    bonusTraits,
  )

  // Roll for mutation
  const mutationTrait = rollForMutation(allInheritedTraits, boosts.mutationBoost)
  if (mutationTrait) {
    allInheritedTraits = [...allInheritedTraits, mutationTrait]
  }

  // Limit traits based on generation
  const maxTraits = isPerfect
    ? Math.max(2, getMaxTraitSlotsForGeneration(offspringGeneration))
    : getMaxTraitSlotsForGeneration(offspringGeneration)
  const finalTraits = filterValidTraits(allInheritedTraits).slice(0, maxTraits)

  // Roll for legacy ability inheritance
  const legacyAbilities = rollForLegacyAbilities(pair.parent1, pair.parent2, offspringSpecies.speciesId)

  // Create offspring with breeding progression fields
  const offspring = createMonsterInstance(offspringSpecies.speciesId, 1, {
    inheritedTraits: finalTraits,
    parentSpeciesIds: [pair.parent1.speciesId, pair.parent2.speciesId],
    generation: offspringGeneration,
    inheritedStatBonus,
    legacyAbilities,
    isPerfect,
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

// ── Breeding Progression Helpers ──

/**
 * Calculate the "trained stats" for a monster (current stats minus base stats at level 1)
 * These represent the growth from leveling up
 */
export function getTrainedStats(monster: MonsterInstance): Partial<CharacterStats> {
  const species = getSpecies(monster.speciesId)
  if (!species) return {}

  const baseStats = calculateMonsterStats(species, 1)

  return {
    maxHp: Math.max(0, monster.stats.maxHp - baseStats.maxHp),
    maxMp: Math.max(0, monster.stats.maxMp - baseStats.maxMp),
    attack: Math.max(0, monster.stats.attack - baseStats.attack),
    defense: Math.max(0, monster.stats.defense - baseStats.defense),
    magicAttack: Math.max(0, monster.stats.magicAttack - baseStats.magicAttack),
    magicDefense: Math.max(0, monster.stats.magicDefense - baseStats.magicDefense),
    speed: Math.max(0, monster.stats.speed - baseStats.speed),
  }
}

/**
 * Calculate the inherited stat bonus from two parents
 * Offspring inherits a percentage of the average trained stats
 */
export function calculateInheritedStatBonus(
  parent1: MonsterInstance,
  parent2: MonsterInstance,
  isPerfect: boolean = false,
): Partial<CharacterStats> {
  const p1Trained = getTrainedStats(parent1)
  const p2Trained = getTrainedStats(parent2)

  // Average the trained stats
  const avgTrained: Partial<CharacterStats> = {
    maxHp: Math.floor(((p1Trained.maxHp ?? 0) + (p2Trained.maxHp ?? 0)) / 2),
    maxMp: Math.floor(((p1Trained.maxMp ?? 0) + (p2Trained.maxMp ?? 0)) / 2),
    attack: Math.floor(((p1Trained.attack ?? 0) + (p2Trained.attack ?? 0)) / 2),
    defense: Math.floor(((p1Trained.defense ?? 0) + (p2Trained.defense ?? 0)) / 2),
    magicAttack: Math.floor(((p1Trained.magicAttack ?? 0) + (p2Trained.magicAttack ?? 0)) / 2),
    magicDefense: Math.floor(((p1Trained.magicDefense ?? 0) + (p2Trained.magicDefense ?? 0)) / 2),
    speed: Math.floor(((p1Trained.speed ?? 0) + (p2Trained.speed ?? 0)) / 2),
  }

  // Apply inheritance percentage
  const percentage = isPerfect
    ? INHERITED_STAT_PERCENTAGE * PERFECT_STAT_MULTIPLIER
    : INHERITED_STAT_PERCENTAGE

  return {
    maxHp: Math.floor((avgTrained.maxHp ?? 0) * percentage),
    maxMp: Math.floor((avgTrained.maxMp ?? 0) * percentage),
    attack: Math.floor((avgTrained.attack ?? 0) * percentage),
    defense: Math.floor((avgTrained.defense ?? 0) * percentage),
    magicAttack: Math.floor((avgTrained.magicAttack ?? 0) * percentage),
    magicDefense: Math.floor((avgTrained.magicDefense ?? 0) * percentage),
    speed: Math.floor((avgTrained.speed ?? 0) * percentage),
  }
}

/**
 * Calculate the generation for offspring based on parents
 */
export function calculateOffspringGeneration(
  parent1: MonsterInstance,
  parent2: MonsterInstance,
): number {
  const p1Gen = parent1.generation ?? 0
  const p2Gen = parent2.generation ?? 0
  return Math.max(p1Gen, p2Gen) + 1
}

/**
 * Get the max trait slots allowed for a generation
 */
export function getMaxTraitSlotsForGeneration(generation: number): number {
  if (generation >= 2) return GENERATION_TRAIT_SLOTS[2]
  return GENERATION_TRAIT_SLOTS[generation] ?? 1
}

/**
 * Roll for perfect offspring
 */
export function rollForPerfectOffspring(
  parent1: MonsterInstance,
  parent2: MonsterInstance,
  items: ReadonlyArray<Item>,
): boolean {
  let chance = PERFECT_BASE_CHANCE

  // Harmony bell bonus
  if (items.some((item) => item.itemId === 'harmony-bell')) {
    chance += PERFECT_HARMONY_BONUS
  }

  // High bond bonus
  if ((parent1.bondLevel ?? 0) > 80 && (parent2.bondLevel ?? 0) > 80) {
    chance += PERFECT_BOND_BONUS
  }

  return Math.random() < chance
}

/**
 * Roll for legacy ability inheritance from parents
 * Each parent ability has a chance to be inherited even if the offspring species can't normally learn it
 */
export function rollForLegacyAbilities(
  parent1: MonsterInstance,
  parent2: MonsterInstance,
  offspringSpeciesId: string,
): ReadonlyArray<string> {
  const offspringSpecies = getSpecies(offspringSpeciesId)
  if (!offspringSpecies) return []

  // Get ability IDs the offspring species can naturally learn
  const naturalAbilityIds = new Set(offspringSpecies.abilities.map((la) => la.abilityId))

  // Collect all unique ability IDs from both parents
  const parentAbilityIds = new Set<string>()
  for (const ability of parent1.learnedAbilities) {
    parentAbilityIds.add(ability.abilityId)
  }
  for (const ability of parent2.learnedAbilities) {
    parentAbilityIds.add(ability.abilityId)
  }

  // Also include any legacy abilities from parents (inheritance chains)
  for (const abilityId of parent1.legacyAbilities ?? []) {
    parentAbilityIds.add(abilityId)
  }
  for (const abilityId of parent2.legacyAbilities ?? []) {
    parentAbilityIds.add(abilityId)
  }

  // Roll for each parent ability to be inherited as a legacy ability
  // Only inherit abilities the offspring can't naturally learn
  const legacyAbilities: string[] = []
  for (const abilityId of parentAbilityIds) {
    // Skip abilities the species can naturally learn
    if (naturalAbilityIds.has(abilityId)) continue

    // Roll for inheritance
    if (Math.random() < LEGACY_ABILITY_CHANCE) {
      legacyAbilities.push(abilityId)
    }
  }

  return legacyAbilities
}

export function getCompatibleMonstersForBreeding(
  monster: MonsterInstance,
  candidates: ReadonlyArray<MonsterInstance>,
): ReadonlyArray<MonsterInstance> {
  return candidates.filter(
    (c) => c.instanceId !== monster.instanceId && canBreed(monster, c),
  )
}
