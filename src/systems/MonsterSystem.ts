import type {
  MonsterSpecies,
  MonsterInstance,
  Ability,
  CharacterStats,
  LearnableAbility,
  MonsterGearSlots,
} from '../models/types'
import { generateMonsterId } from '../utils/id'
import { clamp } from '../utils/math'
import { MAX_LEVEL } from '../models/constants'

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
 * Calculate monster stats based on species and level
 * @param species The monster species data
 * @param level The monster's current level
 */
export function calculateMonsterStats(
  species: MonsterSpecies,
  level: number,
): CharacterStats {
  const levelsGained = level - 1

  const maxHp = species.baseStats.maxHp + Math.floor(species.statGrowth.hp * levelsGained)
  const maxMp = species.baseStats.maxMp + Math.floor(species.statGrowth.mp * levelsGained)
  const attack = species.baseStats.attack + Math.floor(species.statGrowth.attack * levelsGained)
  const defense = species.baseStats.defense + Math.floor(species.statGrowth.defense * levelsGained)
  const magicAttack =
    species.baseStats.magicAttack + Math.floor(species.statGrowth.magicAttack * levelsGained)
  const magicDefense =
    species.baseStats.magicDefense + Math.floor(species.statGrowth.magicDefense * levelsGained)
  const speed = species.baseStats.speed + Math.floor(species.statGrowth.speed * levelsGained)
  const luck = species.baseStats.luck

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
  readonly evolutionStage?: number
  readonly previousForms?: ReadonlyArray<string>
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
    isInSquad: false,
    capturedAt: new Date().toISOString(),
    bondLevel: 0,
    // Evolution fields
    evolutionStage: options?.evolutionStage ?? 1,
    previousForms: options?.previousForms ?? [],
    // Monster Gear (all slots empty by default)
    equippedGear: {
      collar: null,
      saddle: null,
      charm: null,
      claws: null,
    },
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
 * Get all available abilities for a monster
 */
export function getAllAvailableAbilities(monster: MonsterInstance): ReadonlyArray<Ability> {
  return monster.learnedAbilities
}

// ── Monster Evolution Helper ──
// Full evolution logic lives in EvolutionSystem.ts
// This helper transforms a monster instance to a new species

export interface MonsterTransformResult {
  readonly evolved: boolean
  readonly originalSpeciesId: string
  readonly newSpeciesId: string | null
  readonly monster: MonsterInstance
}

/**
 * Transform a monster to a new species (used by EvolutionSystem)
 * Preserves: level, XP, bond, traits, equipped gear
 * Updates: speciesId, stats, learned abilities, evolutionStage, previousForms
 */
export function transformMonster(
  monster: MonsterInstance,
  targetSpeciesId: string,
  newEvolutionStage: number,
): MonsterTransformResult {
  const originalSpeciesId = monster.speciesId

  const targetSpecies = getSpecies(targetSpeciesId)
  if (!targetSpecies) {
    return { evolved: false, originalSpeciesId, newSpeciesId: null, monster }
  }

  // Recalculate stats with new species at current level
  const newStats = calculateMonsterStats(targetSpecies, monster.level)

  // Preserve HP/MP ratios
  const hpRatio = monster.stats.maxHp > 0 ? monster.stats.currentHp / monster.stats.maxHp : 1
  const mpRatio = monster.stats.maxMp > 0 ? monster.stats.currentMp / monster.stats.maxMp : 1

  // Get abilities for new species at current level
  const newAbilities = getLearnedAbilitiesAtLevel(targetSpecies, monster.level)

  const evolvedMonster: MonsterInstance = {
    ...monster,
    speciesId: targetSpeciesId,
    stats: {
      ...newStats,
      currentHp: Math.max(1, Math.ceil(newStats.maxHp * hpRatio)),
      currentMp: Math.ceil(newStats.maxMp * mpRatio),
    },
    learnedAbilities: newAbilities,
    evolutionStage: newEvolutionStage,
    previousForms: [...monster.previousForms, originalSpeciesId],
  }

  return { evolved: true, originalSpeciesId, newSpeciesId: targetSpeciesId, monster: evolvedMonster }
}
