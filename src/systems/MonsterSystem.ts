import type {
  MonsterSpecies,
  MonsterInstance,
  Ability,
  CharacterStats,
  LearnableAbility,
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

export function calculateMonsterStats(species: MonsterSpecies, level: number): CharacterStats {
  const levelsGained = level - 1
  const maxHp = species.baseStats.maxHp + Math.floor(species.statGrowth.hp * levelsGained)
  const maxMp = species.baseStats.maxMp + Math.floor(species.statGrowth.mp * levelsGained)

  return {
    maxHp,
    currentHp: maxHp,
    maxMp,
    currentMp: maxMp,
    attack: species.baseStats.attack + Math.floor(species.statGrowth.attack * levelsGained),
    defense: species.baseStats.defense + Math.floor(species.statGrowth.defense * levelsGained),
    magicAttack:
      species.baseStats.magicAttack + Math.floor(species.statGrowth.magicAttack * levelsGained),
    magicDefense:
      species.baseStats.magicDefense + Math.floor(species.statGrowth.magicDefense * levelsGained),
    speed: species.baseStats.speed + Math.floor(species.statGrowth.speed * levelsGained),
    luck: species.baseStats.luck,
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

export function createMonsterInstance(
  speciesId: string,
  level: number,
  options?: {
    readonly nickname?: string
    readonly inheritedTraits?: ReadonlyArray<string>
    readonly parentSpeciesIds?: ReadonlyArray<string>
  },
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
  }
}

export function addExperienceToMonster(
  monster: MonsterInstance,
  xpGained: number,
): MonsterInstance {
  const species = getSpecies(monster.speciesId)
  if (!species || monster.level >= MAX_LEVEL) return monster

  const newXp = monster.experience + xpGained
  // Simple level-up: every 100 * currentLevel XP
  const xpNeeded = monster.level * 100
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

    return {
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
  }

  return {
    ...monster,
    experience: newXp,
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
