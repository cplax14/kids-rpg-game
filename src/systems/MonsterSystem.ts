import type {
  MonsterSpecies,
  MonsterInstance,
  Ability,
  CharacterStats,
  LearnableAbility,
} from '../models/types'
import { generateMonsterId } from '../utils/id'
import { clamp } from '../utils/math'
import { MAX_LEVEL, GENERATION_STAT_CEILING } from '../models/constants'

let speciesRegistry: ReadonlyArray<MonsterSpecies> = []
let abilityRegistry: ReadonlyArray<Ability> = []

export function loadSpeciesData(species: ReadonlyArray<MonsterSpecies>): void {
  speciesRegistry = species
}

export function loadAbilityData(abilities: ReadonlyArray<Ability>): void {
  abilityRegistry = abilities
}

export function getSpecies(speciesId: string): MonsterSpecies | undefined {
  return speciesRegistry.find((s) => s.speciesId === speciesId)
}

export function getAllSpecies(): ReadonlyArray<MonsterSpecies> {
  return speciesRegistry
}

export function getAbility(abilityId: string): Ability | undefined {
  return abilityRegistry.find((a) => a.abilityId === abilityId)
}

export function getAllAbilities(): ReadonlyArray<Ability> {
  return abilityRegistry
}

/**
 * Get the stat ceiling multiplier for a given generation
 */
export function getStatCeilingMultiplier(generation: number): number {
  if (generation >= 2) return GENERATION_STAT_CEILING[2]
  return GENERATION_STAT_CEILING[generation] ?? 1.0
}

/**
 * Calculate the maximum stat ceiling for a species based on generation
 * Bred monsters can exceed normal max stats
 */
export function calculateStatCeiling(
  species: MonsterSpecies,
  generation: number,
): CharacterStats {
  // Get base max stats at MAX_LEVEL
  const baseMaxStats = calculateMonsterStats(species, MAX_LEVEL)
  const multiplier = getStatCeilingMultiplier(generation)

  return {
    maxHp: Math.floor(baseMaxStats.maxHp * multiplier),
    currentHp: Math.floor(baseMaxStats.maxHp * multiplier),
    maxMp: Math.floor(baseMaxStats.maxMp * multiplier),
    currentMp: Math.floor(baseMaxStats.maxMp * multiplier),
    attack: Math.floor(baseMaxStats.attack * multiplier),
    defense: Math.floor(baseMaxStats.defense * multiplier),
    magicAttack: Math.floor(baseMaxStats.magicAttack * multiplier),
    magicDefense: Math.floor(baseMaxStats.magicDefense * multiplier),
    speed: Math.floor(baseMaxStats.speed * multiplier),
    luck: baseMaxStats.luck, // Luck doesn't scale with ceiling
  }
}

/**
 * Calculate monster stats based on species, level, and optional inherited bonuses
 * @param species The monster species data
 * @param level The monster's current level
 * @param inheritedBonus Optional stat bonus from breeding (from parent stats)
 * @param generation Optional generation for applying stat ceiling (0 = wild)
 */
export function calculateMonsterStats(
  species: MonsterSpecies,
  level: number,
  inheritedBonus?: Partial<CharacterStats>,
  generation?: number,
): CharacterStats {
  const levelsGained = level - 1

  // Base stats + growth
  let maxHp = species.baseStats.maxHp + Math.floor(species.statGrowth.hp * levelsGained)
  let maxMp = species.baseStats.maxMp + Math.floor(species.statGrowth.mp * levelsGained)
  let attack = species.baseStats.attack + Math.floor(species.statGrowth.attack * levelsGained)
  let defense = species.baseStats.defense + Math.floor(species.statGrowth.defense * levelsGained)
  let magicAttack =
    species.baseStats.magicAttack + Math.floor(species.statGrowth.magicAttack * levelsGained)
  let magicDefense =
    species.baseStats.magicDefense + Math.floor(species.statGrowth.magicDefense * levelsGained)
  let speed = species.baseStats.speed + Math.floor(species.statGrowth.speed * levelsGained)
  let luck = species.baseStats.luck

  // Apply inherited stat bonus from breeding
  if (inheritedBonus) {
    maxHp += Math.floor(inheritedBonus.maxHp ?? 0)
    maxMp += Math.floor(inheritedBonus.maxMp ?? 0)
    attack += Math.floor(inheritedBonus.attack ?? 0)
    defense += Math.floor(inheritedBonus.defense ?? 0)
    magicAttack += Math.floor(inheritedBonus.magicAttack ?? 0)
    magicDefense += Math.floor(inheritedBonus.magicDefense ?? 0)
    speed += Math.floor(inheritedBonus.speed ?? 0)
    luck += Math.floor(inheritedBonus.luck ?? 0)
  }

  // Apply stat ceiling based on generation
  if (generation !== undefined) {
    const ceiling = calculateStatCeiling(species, generation)
    maxHp = Math.min(maxHp, ceiling.maxHp)
    maxMp = Math.min(maxMp, ceiling.maxMp)
    attack = Math.min(attack, ceiling.attack)
    defense = Math.min(defense, ceiling.defense)
    magicAttack = Math.min(magicAttack, ceiling.magicAttack)
    magicDefense = Math.min(magicDefense, ceiling.magicDefense)
    speed = Math.min(speed, ceiling.speed)
  }

  return {
    maxHp,
    currentHp: maxHp,
    maxMp,
    currentMp: maxMp,
    attack,
    defense,
    magicAttack,
    magicDefense,
    speed,
    luck,
  }
}

export function getLearnedAbilitiesAtLevel(
  species: MonsterSpecies,
  level: number,
): ReadonlyArray<Ability> {
  return species.abilities
    .filter((la: LearnableAbility) => la.learnAtLevel <= level)
    .map((la: LearnableAbility) => getAbility(la.abilityId))
    .filter((a): a is Ability => a !== undefined)
}

export interface CreateMonsterOptions {
  readonly nickname?: string
  readonly inheritedTraits?: ReadonlyArray<string>
  readonly parentSpeciesIds?: ReadonlyArray<string>
  readonly generation?: number
  readonly inheritedStatBonus?: Partial<CharacterStats>
  readonly legacyAbilities?: ReadonlyArray<string>
  readonly isPerfect?: boolean
}

export function createMonsterInstance(
  speciesId: string,
  level: number,
  options?: CreateMonsterOptions,
): MonsterInstance | undefined {
  const species = getSpecies(speciesId)
  if (!species) return undefined

  const clampedLevel = clamp(level, 1, MAX_LEVEL)
  const stats = calculateMonsterStats(species, clampedLevel)
  const abilities = getLearnedAbilitiesAtLevel(species, clampedLevel)

  return {
    instanceId: generateMonsterId(),
    speciesId,
    nickname: options?.nickname ?? null,
    level: clampedLevel,
    experience: 0,
    stats,
    learnedAbilities: abilities,
    inheritedTraits: options?.inheritedTraits ?? [],
    parentSpeciesIds: options?.parentSpeciesIds ?? [],
    isInSquad: false,
    capturedAt: new Date().toISOString(),
    bondLevel: 0,
    // Breeding progression fields
    generation: options?.generation ?? 0,
    inheritedStatBonus: options?.inheritedStatBonus ?? {},
    legacyAbilities: options?.legacyAbilities ?? [],
    isPerfect: options?.isPerfect ?? false,
  }
}

export interface MonsterLevelUpResult {
  readonly monster: MonsterInstance
  readonly didLevelUp: boolean
  readonly previousLevel: number
  readonly newLevel: number
  readonly xpGained: number
}

export function addExperienceToMonster(
  monster: MonsterInstance,
  xpGained: number,
): MonsterInstance {
  return addExperienceToMonsterWithInfo(monster, xpGained).monster
}

/**
 * Add experience to a monster and return level-up information
 * Used for displaying level-up notifications
 */
export function addExperienceToMonsterWithInfo(
  monster: MonsterInstance,
  xpGained: number,
): MonsterLevelUpResult {
  const species = getSpecies(monster.speciesId)
  const previousLevel = monster.level

  if (!species || monster.level >= MAX_LEVEL) {
    return {
      monster,
      didLevelUp: false,
      previousLevel,
      newLevel: previousLevel,
      xpGained,
    }
  }

  const newXp = monster.experience + xpGained
  // Simple level-up: every 100 * currentLevel XP
  let currentLevel = monster.level
  let remainingXp = newXp

  while (currentLevel < MAX_LEVEL && remainingXp >= currentLevel * 100) {
    remainingXp -= currentLevel * 100
    currentLevel++
  }

  if (currentLevel > monster.level) {
    const newStats = calculateMonsterStats(species, currentLevel)
    const hpRatio = monster.stats.currentHp / monster.stats.maxHp
    const mpRatio = monster.stats.maxMp > 0 ? monster.stats.currentMp / monster.stats.maxMp : 1
    const newAbilities = getLearnedAbilitiesAtLevel(species, currentLevel)

    const updatedMonster: MonsterInstance = {
      ...monster,
      level: currentLevel,
      experience: remainingXp,
      stats: {
        ...newStats,
        currentHp: Math.max(1, Math.ceil(newStats.maxHp * hpRatio)),
        currentMp: Math.ceil(newStats.maxMp * mpRatio),
      },
      learnedAbilities: newAbilities,
    }

    return {
      monster: updatedMonster,
      didLevelUp: true,
      previousLevel,
      newLevel: currentLevel,
      xpGained,
    }
  }

  return {
    monster: {
      ...monster,
      experience: newXp,
    },
    didLevelUp: false,
    previousLevel,
    newLevel: previousLevel,
    xpGained,
  }
}

export function healMonster(
  monster: MonsterInstance,
  hpAmount: number,
  mpAmount: number,
): MonsterInstance {
  return {
    ...monster,
    stats: {
      ...monster.stats,
      currentHp: Math.min(monster.stats.currentHp + hpAmount, monster.stats.maxHp),
      currentMp: Math.min(monster.stats.currentMp + mpAmount, monster.stats.maxMp),
    },
  }
}

export function damageMonster(monster: MonsterInstance, amount: number): MonsterInstance {
  return {
    ...monster,
    stats: {
      ...monster.stats,
      currentHp: Math.max(0, monster.stats.currentHp - amount),
    },
  }
}

export function isMonsterAlive(monster: MonsterInstance): boolean {
  return monster.stats.currentHp > 0
}

export function setMonsterInSquad(monster: MonsterInstance, inSquad: boolean): MonsterInstance {
  return {
    ...monster,
    isInSquad: inSquad,
  }
}

export function increaseBondLevel(monster: MonsterInstance, amount: number): MonsterInstance {
  return {
    ...monster,
    bondLevel: clamp(monster.bondLevel + amount, 0, 100),
  }
}

/**
 * Get all available abilities for a monster, including legacy abilities
 * Legacy abilities are inherited from parents and available regardless of species
 */
export function getAllAvailableAbilities(monster: MonsterInstance): ReadonlyArray<Ability> {
  const learnedAbilities = [...monster.learnedAbilities]

  // Add legacy abilities if any
  if (monster.legacyAbilities && monster.legacyAbilities.length > 0) {
    for (const abilityId of monster.legacyAbilities) {
      // Skip if already in learned abilities
      if (learnedAbilities.some((a) => a.abilityId === abilityId)) continue

      const ability = getAbility(abilityId)
      if (ability) {
        learnedAbilities.push(ability)
      }
    }
  }

  return learnedAbilities
}

// ── Evolution System ──

export interface EvolutionCheckResult {
  readonly canEvolve: boolean
  readonly evolvesToSpeciesId: string | null
  readonly requiresItem: boolean
  readonly requiredItemId: string | null
}

/**
 * Check if a monster can evolve based on its current level
 * Returns evolution info if eligible, or null if not
 */
export function checkEvolution(monster: MonsterInstance): EvolutionCheckResult {
  const species = getSpecies(monster.speciesId)
  if (!species || !species.evolutionChain) {
    return { canEvolve: false, evolvesToSpeciesId: null, requiresItem: false, requiredItemId: null }
  }

  const { evolvesTo, levelRequired, itemRequired } = species.evolutionChain

  // Check level requirement
  if (monster.level < levelRequired) {
    return { canEvolve: false, evolvesToSpeciesId: evolvesTo, requiresItem: !!itemRequired, requiredItemId: itemRequired }
  }

  // Check if evolution target species exists
  const targetSpecies = getSpecies(evolvesTo)
  if (!targetSpecies) {
    return { canEvolve: false, evolvesToSpeciesId: null, requiresItem: false, requiredItemId: null }
  }

  // If item required, can't auto-evolve (needs item use)
  if (itemRequired) {
    return { canEvolve: false, evolvesToSpeciesId: evolvesTo, requiresItem: true, requiredItemId: itemRequired }
  }

  return { canEvolve: true, evolvesToSpeciesId: evolvesTo, requiresItem: false, requiredItemId: null }
}

export interface EvolutionResult {
  readonly evolved: boolean
  readonly originalSpeciesId: string
  readonly newSpeciesId: string | null
  readonly monster: MonsterInstance
}

/**
 * Evolve a monster to its next form
 * Preserves: level, XP, bond, traits, generation, legacy abilities, isPerfect
 * Updates: speciesId, stats, learned abilities
 */
export function evolveMonster(monster: MonsterInstance, targetSpeciesId?: string): EvolutionResult {
  const species = getSpecies(monster.speciesId)
  const originalSpeciesId = monster.speciesId

  // Determine target species
  let newSpeciesId = targetSpeciesId
  if (!newSpeciesId) {
    const evolutionCheck = checkEvolution(monster)
    if (!evolutionCheck.canEvolve || !evolutionCheck.evolvesToSpeciesId) {
      return { evolved: false, originalSpeciesId, newSpeciesId: null, monster }
    }
    newSpeciesId = evolutionCheck.evolvesToSpeciesId
  }

  const targetSpecies = getSpecies(newSpeciesId)
  if (!targetSpecies) {
    return { evolved: false, originalSpeciesId, newSpeciesId: null, monster }
  }

  // Recalculate stats with new species at current level
  // Preserve inherited stat bonus and generation for stat ceiling
  const newStats = calculateMonsterStats(
    targetSpecies,
    monster.level,
    monster.inheritedStatBonus,
    monster.generation,
  )

  // Preserve HP/MP ratios
  const hpRatio = monster.stats.maxHp > 0 ? monster.stats.currentHp / monster.stats.maxHp : 1
  const mpRatio = monster.stats.maxMp > 0 ? monster.stats.currentMp / monster.stats.maxMp : 1

  // Get abilities for new species at current level
  const newAbilities = getLearnedAbilitiesAtLevel(targetSpecies, monster.level)

  // Evolved monster preserves all breeding/progression data
  const evolvedMonster: MonsterInstance = {
    ...monster,
    speciesId: newSpeciesId,
    stats: {
      ...newStats,
      currentHp: Math.max(1, Math.ceil(newStats.maxHp * hpRatio)),
      currentMp: Math.ceil(newStats.maxMp * mpRatio),
    },
    learnedAbilities: newAbilities,
    // These are preserved:
    // - level, experience
    // - nickname
    // - bondLevel
    // - inheritedTraits, parentSpeciesIds
    // - generation, inheritedStatBonus, legacyAbilities, isPerfect
    // - isInSquad, capturedAt
  }

  return { evolved: true, originalSpeciesId, newSpeciesId, monster: evolvedMonster }
}

/**
 * Check and evolve monster if eligible (for use after level-up)
 * Returns the evolved monster or the original if not eligible
 */
export function checkAndEvolve(monster: MonsterInstance): EvolutionResult {
  const check = checkEvolution(monster)
  if (!check.canEvolve) {
    return { evolved: false, originalSpeciesId: monster.speciesId, newSpeciesId: null, monster }
  }

  return evolveMonster(monster)
}
