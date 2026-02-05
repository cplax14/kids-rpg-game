import type { MonsterSpecies } from '../models/types'
import { getSpecies, getAllSpecies } from './MonsterSystem'

// ── Discovery ──

export function discoverSpecies(
  discovered: ReadonlyArray<string>,
  speciesId: string,
): ReadonlyArray<string> {
  if (discovered.includes(speciesId)) {
    return discovered // Idempotent - already discovered
  }
  return [...discovered, speciesId]
}

export function discoverMultipleSpecies(
  discovered: ReadonlyArray<string>,
  speciesIds: ReadonlyArray<string>,
): ReadonlyArray<string> {
  const newDiscoveries = speciesIds.filter((id) => !discovered.includes(id))
  if (newDiscoveries.length === 0) {
    return discovered
  }
  return [...discovered, ...newDiscoveries]
}

// ── Queries ──

export function isSpeciesDiscovered(
  discovered: ReadonlyArray<string>,
  speciesId: string,
): boolean {
  return discovered.includes(speciesId)
}

export function getDiscoveryCount(discovered: ReadonlyArray<string>): number {
  return discovered.length
}

export function getTotalSpeciesCount(): number {
  return getAllSpecies().length
}

export function getDiscoveryProgress(discovered: ReadonlyArray<string>): {
  readonly discovered: number
  readonly total: number
  readonly percentage: number
} {
  const total = getTotalSpeciesCount()
  const discoveredCount = discovered.length
  const percentage = total > 0 ? Math.round((discoveredCount / total) * 100) : 0

  return {
    discovered: discoveredCount,
    total,
    percentage,
  }
}

// ── Data Retrieval ──

export function getDiscoveredSpeciesData(
  discovered: ReadonlyArray<string>,
): ReadonlyArray<MonsterSpecies> {
  return discovered
    .map((speciesId) => getSpecies(speciesId))
    .filter((species): species is MonsterSpecies => species !== undefined)
}

export function getUndiscoveredSpeciesIds(
  discovered: ReadonlyArray<string>,
): ReadonlyArray<string> {
  const allSpecies = getAllSpecies()
  return allSpecies
    .filter((species) => !discovered.includes(species.speciesId))
    .map((species) => species.speciesId)
}

// ── Sorting & Filtering ──

export function sortDiscoveredByName(
  discovered: ReadonlyArray<string>,
): ReadonlyArray<MonsterSpecies> {
  return [...getDiscoveredSpeciesData(discovered)].sort(
    (a: MonsterSpecies, b: MonsterSpecies) => a.name.localeCompare(b.name)
  )
}

export function sortDiscoveredByElement(
  discovered: ReadonlyArray<string>,
): ReadonlyArray<MonsterSpecies> {
  const elementOrder: Record<string, number> = {
    fire: 0,
    water: 1,
    earth: 2,
    wind: 3,
    light: 4,
    dark: 5,
    neutral: 6,
  }

  return [...getDiscoveredSpeciesData(discovered)].sort(
    (a: MonsterSpecies, b: MonsterSpecies) => {
      const orderA = elementOrder[a.element] ?? 99
      const orderB = elementOrder[b.element] ?? 99
      if (orderA !== orderB) return orderA - orderB
      return a.name.localeCompare(b.name)
    }
  )
}

export function filterDiscoveredByElement(
  discovered: ReadonlyArray<string>,
  element: string,
): ReadonlyArray<MonsterSpecies> {
  return getDiscoveredSpeciesData(discovered).filter(
    (species) => species.element === element
  )
}

export function filterDiscoveredByRarity(
  discovered: ReadonlyArray<string>,
  rarity: string,
): ReadonlyArray<MonsterSpecies> {
  return getDiscoveredSpeciesData(discovered).filter(
    (species) => species.rarity === rarity
  )
}
