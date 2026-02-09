import { test, expect } from '@playwright/test'
import { waitForGameLoad } from './game-helpers'

/**
 * E2E Tests for Monster Progression Systems
 * These tests verify the game systems are properly loaded and functional
 * by accessing the exposed test exports in development mode
 */

test.describe('Monster System Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForGameLoad(page)

    // Wait for test exports to be available
    await page.waitForFunction(
      () => (window as unknown as { __TEST_EXPORTS__?: unknown }).__TEST_EXPORTS__ !== undefined,
      { timeout: 10000 },
    )
  })

  test('MonsterSystem exports are available', async ({ page }) => {
    const result = await page.evaluate(() => {
      const exports = (window as unknown as { __TEST_EXPORTS__?: { MonsterSystem?: object } }).__TEST_EXPORTS__
      return {
        hasMonsterSystem: !!exports?.MonsterSystem,
        hasCreateMonster: typeof exports?.MonsterSystem === 'object' && 'createMonsterInstance' in exports.MonsterSystem,
        hasEvolution: typeof exports?.MonsterSystem === 'object' && 'checkEvolution' in exports.MonsterSystem,
        hasLegacyAbilities: typeof exports?.MonsterSystem === 'object' && 'getAllAvailableAbilities' in exports.MonsterSystem,
      }
    })

    expect(result.hasMonsterSystem).toBe(true)
    expect(result.hasCreateMonster).toBe(true)
    expect(result.hasEvolution).toBe(true)
    expect(result.hasLegacyAbilities).toBe(true)
  })

  test('can create a monster instance', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { MonsterSystem } = (window as unknown as {
        __TEST_EXPORTS__: {
          MonsterSystem: {
            loadSpeciesData: (data: unknown[]) => void
            loadAbilityData: (data: unknown[]) => void
            createMonsterInstance: (speciesId: string, level: number) => unknown
          }
        }
      }).__TEST_EXPORTS__

      // Load mock species data for testing
      const mockSpecies = {
        speciesId: 'test-monster-e2e',
        name: 'E2E Test Monster',
        description: 'A monster for E2E testing',
        element: 'fire',
        rarity: 'common',
        baseStats: {
          maxHp: 100,
          currentHp: 100,
          maxMp: 30,
          currentMp: 30,
          attack: 15,
          defense: 10,
          magicAttack: 12,
          magicDefense: 8,
          speed: 11,
          luck: 5,
        },
        statGrowth: { hp: 8, mp: 3, attack: 2, defense: 1, magicAttack: 2, magicDefense: 1, speed: 1 },
        abilities: [],
        captureBaseDifficulty: 0.3,
        spriteKey: 'test-mon',
        evolutionChain: null,
        breedingGroup: 'beast',
        breedingTraits: [],
        obtainableVia: 'both',
      }

      MonsterSystem.loadSpeciesData([mockSpecies])
      MonsterSystem.loadAbilityData([])

      const monster = MonsterSystem.createMonsterInstance('test-monster-e2e', 5)
      return {
        created: !!monster,
        level: (monster as { level?: number })?.level,
        speciesId: (monster as { speciesId?: string })?.speciesId,
      }
    })

    expect(result.created).toBe(true)
    expect(result.level).toBe(5)
    expect(result.speciesId).toBe('test-monster-e2e')
  })
})

test.describe('Breeding System Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForGameLoad(page)

    await page.waitForFunction(
      () => (window as unknown as { __TEST_EXPORTS__?: unknown }).__TEST_EXPORTS__ !== undefined,
      { timeout: 10000 },
    )
  })

  test('BreedingSystem exports are available', async ({ page }) => {
    const result = await page.evaluate(() => {
      const exports = (window as unknown as { __TEST_EXPORTS__?: { BreedingSystem?: object } }).__TEST_EXPORTS__
      return {
        hasBreedingSystem: !!exports?.BreedingSystem,
        hasCompatibility: typeof exports?.BreedingSystem === 'object' && 'getBreedingCompatibility' in exports.BreedingSystem,
        hasGeneration: typeof exports?.BreedingSystem === 'object' && 'calculateOffspringGeneration' in exports.BreedingSystem,
        hasTraitSlots: typeof exports?.BreedingSystem === 'object' && 'getMaxTraitSlotsForGeneration' in exports.BreedingSystem,
        hasLegacyAbilities: typeof exports?.BreedingSystem === 'object' && 'rollForLegacyAbilities' in exports.BreedingSystem,
      }
    })

    expect(result.hasBreedingSystem).toBe(true)
    expect(result.hasCompatibility).toBe(true)
    expect(result.hasGeneration).toBe(true)
    expect(result.hasTraitSlots).toBe(true)
    expect(result.hasLegacyAbilities).toBe(true)
  })

  test('generation trait slots work correctly', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { BreedingSystem } = (window as unknown as {
        __TEST_EXPORTS__: {
          BreedingSystem: {
            getMaxTraitSlotsForGeneration: (gen: number) => number
          }
        }
      }).__TEST_EXPORTS__

      return {
        gen0: BreedingSystem.getMaxTraitSlotsForGeneration(0),
        gen1: BreedingSystem.getMaxTraitSlotsForGeneration(1),
        gen2: BreedingSystem.getMaxTraitSlotsForGeneration(2),
        gen5: BreedingSystem.getMaxTraitSlotsForGeneration(5),
      }
    })

    expect(result.gen0).toBe(1) // Wild: 1 trait
    expect(result.gen1).toBe(2) // G1: 2 traits
    expect(result.gen2).toBe(3) // G2+: 3 traits
    expect(result.gen5).toBe(3) // G5 still 3 traits (capped)
  })

  test('offspring generation calculation works', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { BreedingSystem } = (window as unknown as {
        __TEST_EXPORTS__: {
          BreedingSystem: {
            calculateOffspringGeneration: (p1: { generation: number }, p2: { generation: number }) => number
          }
        }
      }).__TEST_EXPORTS__

      const mockParent = (gen: number) => ({
        generation: gen,
        instanceId: 'test',
        speciesId: 'test',
        nickname: null,
        level: 10,
        experience: 0,
        stats: { maxHp: 100, currentHp: 100, maxMp: 30, currentMp: 30, attack: 15, defense: 10, magicAttack: 12, magicDefense: 8, speed: 11, luck: 5 },
        learnedAbilities: [],
        inheritedTraits: [],
        parentSpeciesIds: [],
        isInSquad: false,
        capturedAt: new Date().toISOString(),
        bondLevel: 50,
        inheritedStatBonus: {},
        legacyAbilities: [],
        isPerfect: false,
      })

      return {
        wildParents: BreedingSystem.calculateOffspringGeneration(mockParent(0), mockParent(0)),
        g1Parent: BreedingSystem.calculateOffspringGeneration(mockParent(1), mockParent(0)),
        mixedParents: BreedingSystem.calculateOffspringGeneration(mockParent(2), mockParent(3)),
      }
    })

    expect(result.wildParents).toBe(1) // Wild + Wild = G1
    expect(result.g1Parent).toBe(2) // G1 + Wild = G2
    expect(result.mixedParents).toBe(4) // G2 + G3 = G4
  })
})

test.describe('Evolution System Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForGameLoad(page)

    await page.waitForFunction(
      () => (window as unknown as { __TEST_EXPORTS__?: unknown }).__TEST_EXPORTS__ !== undefined,
      { timeout: 10000 },
    )
  })

  test('evolution check functions are available', async ({ page }) => {
    const result = await page.evaluate(() => {
      const exports = (window as unknown as { __TEST_EXPORTS__?: { MonsterSystem?: object } }).__TEST_EXPORTS__
      return {
        hasCheckEvolution: typeof exports?.MonsterSystem === 'object' && 'checkEvolution' in exports.MonsterSystem,
        hasEvolveMonster: typeof exports?.MonsterSystem === 'object' && 'evolveMonster' in exports.MonsterSystem,
        hasCheckAndEvolve: typeof exports?.MonsterSystem === 'object' && 'checkAndEvolve' in exports.MonsterSystem,
      }
    })

    expect(result.hasCheckEvolution).toBe(true)
    expect(result.hasEvolveMonster).toBe(true)
    expect(result.hasCheckAndEvolve).toBe(true)
  })

  test('evolution check returns correct result for non-evolvable species', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { MonsterSystem } = (window as unknown as {
        __TEST_EXPORTS__: {
          MonsterSystem: {
            loadSpeciesData: (data: unknown[]) => void
            loadAbilityData: (data: unknown[]) => void
            createMonsterInstance: (speciesId: string, level: number) => unknown
            checkEvolution: (monster: unknown) => { canEvolve: boolean; evolvesToSpeciesId: string | null }
          }
        }
      }).__TEST_EXPORTS__

      // Non-evolvable species
      const mockSpecies = {
        speciesId: 'no-evolve-test',
        name: 'No Evolve Monster',
        description: 'Cannot evolve',
        element: 'neutral',
        rarity: 'common',
        baseStats: {
          maxHp: 100, currentHp: 100, maxMp: 30, currentMp: 30,
          attack: 15, defense: 10, magicAttack: 12, magicDefense: 8, speed: 11, luck: 5,
        },
        statGrowth: { hp: 8, mp: 3, attack: 2, defense: 1, magicAttack: 2, magicDefense: 1, speed: 1 },
        abilities: [],
        captureBaseDifficulty: 0.3,
        spriteKey: 'test',
        evolutionChain: null, // No evolution
        breedingGroup: 'beast',
        breedingTraits: [],
        obtainableVia: 'both',
      }

      MonsterSystem.loadSpeciesData([mockSpecies])
      MonsterSystem.loadAbilityData([])

      const monster = MonsterSystem.createMonsterInstance('no-evolve-test', 25)
      const evolutionCheck = MonsterSystem.checkEvolution(monster)

      return {
        canEvolve: evolutionCheck.canEvolve,
        evolvesTo: evolutionCheck.evolvesToSpeciesId,
      }
    })

    expect(result.canEvolve).toBe(false)
    expect(result.evolvesTo).toBe(null)
  })

  test('evolution check returns correct result for evolvable species at level', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { MonsterSystem } = (window as unknown as {
        __TEST_EXPORTS__: {
          MonsterSystem: {
            loadSpeciesData: (data: unknown[]) => void
            loadAbilityData: (data: unknown[]) => void
            createMonsterInstance: (speciesId: string, level: number) => unknown
            checkEvolution: (monster: unknown) => { canEvolve: boolean; evolvesToSpeciesId: string | null; requiresItem: boolean }
          }
        }
      }).__TEST_EXPORTS__

      const baseSpecies = {
        speciesId: 'evolve-base',
        name: 'Base Form',
        description: 'Can evolve at level 10',
        element: 'fire',
        rarity: 'common',
        baseStats: {
          maxHp: 100, currentHp: 100, maxMp: 30, currentMp: 30,
          attack: 15, defense: 10, magicAttack: 12, magicDefense: 8, speed: 11, luck: 5,
        },
        statGrowth: { hp: 8, mp: 3, attack: 2, defense: 1, magicAttack: 2, magicDefense: 1, speed: 1 },
        abilities: [],
        captureBaseDifficulty: 0.3,
        spriteKey: 'test',
        evolutionChain: {
          evolvesTo: 'evolve-target',
          levelRequired: 10,
          itemRequired: null,
        },
        breedingGroup: 'beast',
        breedingTraits: [],
        obtainableVia: 'both',
      }

      const evolvedSpecies = {
        ...baseSpecies,
        speciesId: 'evolve-target',
        name: 'Evolved Form',
        evolutionChain: null,
      }

      MonsterSystem.loadSpeciesData([baseSpecies, evolvedSpecies])
      MonsterSystem.loadAbilityData([])

      // Test at level 5 (too low)
      const monsterLow = MonsterSystem.createMonsterInstance('evolve-base', 5)
      const checkLow = MonsterSystem.checkEvolution(monsterLow)

      // Test at level 10 (can evolve)
      const monsterHigh = MonsterSystem.createMonsterInstance('evolve-base', 10)
      const checkHigh = MonsterSystem.checkEvolution(monsterHigh)

      return {
        lowLevel: {
          canEvolve: checkLow.canEvolve,
          evolvesTo: checkLow.evolvesToSpeciesId,
        },
        highLevel: {
          canEvolve: checkHigh.canEvolve,
          evolvesTo: checkHigh.evolvesToSpeciesId,
          requiresItem: checkHigh.requiresItem,
        },
      }
    })

    expect(result.lowLevel.canEvolve).toBe(false)
    expect(result.lowLevel.evolvesTo).toBe('evolve-target')
    expect(result.highLevel.canEvolve).toBe(true)
    expect(result.highLevel.evolvesTo).toBe('evolve-target')
    expect(result.highLevel.requiresItem).toBe(false)
  })
})

test.describe('Constants Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForGameLoad(page)

    await page.waitForFunction(
      () => (window as unknown as { __TEST_EXPORTS__?: unknown }).__TEST_EXPORTS__ !== undefined,
      { timeout: 10000 },
    )
  })

  test('breeding progression constants are correct', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { Constants } = (window as unknown as {
        __TEST_EXPORTS__: {
          Constants: {
            XP_BENCH_PERCENTAGE: number
            INHERITED_STAT_PERCENTAGE: number
            LEGACY_ABILITY_CHANCE: number
            PERFECT_BASE_CHANCE: number
            PERFECT_HARMONY_BONUS: number
            PERFECT_BOND_BONUS: number
            PERFECT_STAT_MULTIPLIER: number
            GENERATION_TRAIT_SLOTS: Record<number, number>
            GENERATION_STAT_CEILING: Record<number, number>
          }
        }
      }).__TEST_EXPORTS__

      return {
        xpBench: Constants.XP_BENCH_PERCENTAGE,
        inheritedStat: Constants.INHERITED_STAT_PERCENTAGE,
        legacyChance: Constants.LEGACY_ABILITY_CHANCE,
        perfectBase: Constants.PERFECT_BASE_CHANCE,
        perfectHarmony: Constants.PERFECT_HARMONY_BONUS,
        perfectBond: Constants.PERFECT_BOND_BONUS,
        perfectMultiplier: Constants.PERFECT_STAT_MULTIPLIER,
        traitSlots: Constants.GENERATION_TRAIT_SLOTS,
        statCeiling: Constants.GENERATION_STAT_CEILING,
      }
    })

    // Verify XP distribution
    expect(result.xpBench).toBe(0.1) // 10% to bench

    // Verify breeding constants
    expect(result.inheritedStat).toBe(0.2) // 20% stat inheritance
    expect(result.legacyChance).toBe(0.25) // 25% legacy ability chance

    // Verify perfect offspring constants
    expect(result.perfectBase).toBe(0.02) // 2% base
    expect(result.perfectHarmony).toBe(0.03) // +3% harmony bell
    expect(result.perfectBond).toBe(0.02) // +2% high bond
    expect(result.perfectMultiplier).toBe(1.15) // +15% stat bonus

    // Verify generation trait slots
    expect(result.traitSlots[0]).toBe(1) // Wild
    expect(result.traitSlots[1]).toBe(2) // G1
    expect(result.traitSlots[2]).toBe(3) // G2+

    // Verify stat ceiling multipliers
    expect(result.statCeiling[0]).toBe(1.0) // Wild: 100%
    expect(result.statCeiling[1]).toBe(1.1) // G1: 110%
    expect(result.statCeiling[2]).toBe(1.2) // G2+: 120%
  })
})

test.describe('World System - Breeding Exclusive Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForGameLoad(page)

    await page.waitForFunction(
      () => (window as unknown as { __TEST_EXPORTS__?: unknown }).__TEST_EXPORTS__ !== undefined,
      { timeout: 10000 },
    )
  })

  test('WorldSystem encounter generation filters breeding-only species', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { WorldSystem, MonsterSystem } = (window as unknown as {
        __TEST_EXPORTS__: {
          WorldSystem: {
            loadAreaData: (data: unknown[]) => void
            generateAreaEncounter: (areaId: string) => { speciesIds: string[] } | null
          }
          MonsterSystem: {
            loadSpeciesData: (data: unknown[]) => void
            loadAbilityData: (data: unknown[]) => void
          }
        }
      }).__TEST_EXPORTS__

      // Create mock species: one wild, one breeding-only
      const wildSpecies = {
        speciesId: 'wild-encounter-test',
        name: 'Wild Monster',
        description: 'Can be found in wild',
        element: 'neutral',
        rarity: 'common',
        baseStats: {
          maxHp: 100, currentHp: 100, maxMp: 30, currentMp: 30,
          attack: 15, defense: 10, magicAttack: 12, magicDefense: 8, speed: 11, luck: 5,
        },
        statGrowth: { hp: 8, mp: 3, attack: 2, defense: 1, magicAttack: 2, magicDefense: 1, speed: 1 },
        abilities: [],
        captureBaseDifficulty: 0.3,
        spriteKey: 'test',
        evolutionChain: null,
        breedingGroup: 'beast',
        breedingTraits: [],
        obtainableVia: 'both',
      }

      const breedingOnlySpecies = {
        ...wildSpecies,
        speciesId: 'breeding-only-test',
        name: 'Breeding Only Monster',
        obtainableVia: 'breeding',
      }

      MonsterSystem.loadSpeciesData([wildSpecies, breedingOnlySpecies])
      MonsterSystem.loadAbilityData([])

      // Create area with both species
      const testArea = {
        areaId: 'filter-test-area',
        name: 'Filter Test Area',
        description: 'Test area',
        recommendedLevel: 1,
        isSafeZone: false,
        mapWidth: 30,
        mapHeight: 30,
        terrainType: 'forest',
        encounters: [
          { speciesId: 'wild-encounter-test', weight: 50, minLevel: 1, maxLevel: 5 },
          { speciesId: 'breeding-only-test', weight: 50, minLevel: 1, maxLevel: 5 },
        ],
        transitions: [],
        interactables: [],
        bossIds: [],
      }

      WorldSystem.loadAreaData([testArea])

      // Generate encounters multiple times and check results
      const encounteredSpecies = new Set<string>()
      for (let i = 0; i < 50; i++) {
        const encounter = WorldSystem.generateAreaEncounter('filter-test-area')
        if (encounter) {
          encounter.speciesIds.forEach((id: string) => encounteredSpecies.add(id))
        }
      }

      return {
        hasWild: encounteredSpecies.has('wild-encounter-test'),
        hasBreedingOnly: encounteredSpecies.has('breeding-only-test'),
        species: Array.from(encounteredSpecies),
      }
    })

    expect(result.hasWild).toBe(true) // Should find wild species
    expect(result.hasBreedingOnly).toBe(false) // Should NOT find breeding-only species
    expect(result.species).not.toContain('breeding-only-test')
  })
})
