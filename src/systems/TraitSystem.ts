import type { TraitDefinition, CharacterStats } from '../models/types'

let traitRegistry: ReadonlyArray<TraitDefinition> = []

export function loadTraitData(traits: ReadonlyArray<TraitDefinition>): void {
  traitRegistry = traits
}

export function getTrait(traitId: string): TraitDefinition | undefined {
  return traitRegistry.find((t) => t.traitId === traitId)
}

export function getAllTraits(): ReadonlyArray<TraitDefinition> {
  return traitRegistry
}

export function getTraitsByRarity(
  rarity: 'common' | 'rare' | 'mutation',
): ReadonlyArray<TraitDefinition> {
  return traitRegistry.filter((t) => t.rarity === rarity)
}

export function getMutationTraits(): ReadonlyArray<TraitDefinition> {
  return getTraitsByRarity('mutation')
}

export function getRareTraits(): ReadonlyArray<TraitDefinition> {
  return getTraitsByRarity('rare')
}

export function getCommonTraits(): ReadonlyArray<TraitDefinition> {
  return getTraitsByRarity('common')
}

export function applyTraitBonuses(
  stats: CharacterStats,
  traitIds: ReadonlyArray<string>,
): CharacterStats {
  const traits = traitIds.map((id) => getTrait(id)).filter((t): t is TraitDefinition => t !== undefined)

  if (traits.length === 0) {
    return stats
  }

  let modifiedStats = { ...stats }

  for (const trait of traits) {
    const mods = trait.statModifiers

    if (mods.maxHp !== undefined) {
      modifiedStats = {
        ...modifiedStats,
        maxHp: modifiedStats.maxHp + mods.maxHp,
        currentHp: Math.min(modifiedStats.currentHp + mods.maxHp, modifiedStats.maxHp + mods.maxHp),
      }
    }
    if (mods.maxMp !== undefined) {
      modifiedStats = {
        ...modifiedStats,
        maxMp: modifiedStats.maxMp + mods.maxMp,
        currentMp: Math.min(modifiedStats.currentMp + mods.maxMp, modifiedStats.maxMp + mods.maxMp),
      }
    }
    if (mods.attack !== undefined) {
      modifiedStats = { ...modifiedStats, attack: modifiedStats.attack + mods.attack }
    }
    if (mods.defense !== undefined) {
      modifiedStats = { ...modifiedStats, defense: modifiedStats.defense + mods.defense }
    }
    if (mods.magicAttack !== undefined) {
      modifiedStats = { ...modifiedStats, magicAttack: modifiedStats.magicAttack + mods.magicAttack }
    }
    if (mods.magicDefense !== undefined) {
      modifiedStats = { ...modifiedStats, magicDefense: modifiedStats.magicDefense + mods.magicDefense }
    }
    if (mods.speed !== undefined) {
      modifiedStats = { ...modifiedStats, speed: modifiedStats.speed + mods.speed }
    }
    if (mods.luck !== undefined) {
      modifiedStats = { ...modifiedStats, luck: modifiedStats.luck + mods.luck }
    }
  }

  return modifiedStats
}

export function calculateTraitValue(traitIds: ReadonlyArray<string>): number {
  const traits = traitIds.map((id) => getTrait(id)).filter((t): t is TraitDefinition => t !== undefined)

  let value = 0
  for (const trait of traits) {
    switch (trait.rarity) {
      case 'common':
        value += 1
        break
      case 'rare':
        value += 3
        break
      case 'mutation':
        value += 5
        break
    }
  }
  return value
}

export function getUniqueTraits(
  traits1: ReadonlyArray<string>,
  traits2: ReadonlyArray<string>,
): ReadonlyArray<string> {
  const combined = [...traits1, ...traits2]
  return [...new Set(combined)]
}

export function filterValidTraits(traitIds: ReadonlyArray<string>): ReadonlyArray<string> {
  return traitIds.filter((id) => getTrait(id) !== undefined)
}
