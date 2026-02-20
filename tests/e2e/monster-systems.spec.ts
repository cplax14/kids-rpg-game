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
        hasTransformMonster: typeof exports?.MonsterSystem === 'object' && 'transformMonster' in exports.MonsterSystem,
        hasGetAllAbilities: typeof exports?.MonsterSystem === 'object' && 'getAllAvailableAbilities' in exports.MonsterSystem,
      }
    })

    expect(result.hasMonsterSystem).toBe(true)
    expect(result.hasCreateMonster).toBe(true)
    expect(result.hasTransformMonster).toBe(true)
    expect(result.hasGetAllAbilities).toBe(true)
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
        evolutionChainId: null,
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

test.describe('Evolution System Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForGameLoad(page)

    await page.waitForFunction(
      () => (window as unknown as { __TEST_EXPORTS__?: unknown }).__TEST_EXPORTS__ !== undefined,
      { timeout: 10000 },
    )
  })

  test('EvolutionSystem exports are available', async ({ page }) => {
    const result = await page.evaluate(() => {
      const exports = (window as unknown as { __TEST_EXPORTS__?: { EvolutionSystem?: object } }).__TEST_EXPORTS__
      return {
        hasEvolutionSystem: !!exports?.EvolutionSystem,
        hasCanEvolve: typeof exports?.EvolutionSystem === 'object' && 'canEvolve' in exports.EvolutionSystem,
        hasExecuteEvolution: typeof exports?.EvolutionSystem === 'object' && 'executeEvolution' in exports.EvolutionSystem,
        hasGetEvolutionPreview: typeof exports?.EvolutionSystem === 'object' && 'getEvolutionPreview' in exports.EvolutionSystem,
        hasLoadChains: typeof exports?.EvolutionSystem === 'object' && 'loadEvolutionChains' in exports.EvolutionSystem,
        hasGetChainForSpecies: typeof exports?.EvolutionSystem === 'object' && 'getChainForSpecies' in exports.EvolutionSystem,
      }
    })

    expect(result.hasEvolutionSystem).toBe(true)
    expect(result.hasCanEvolve).toBe(true)
    expect(result.hasExecuteEvolution).toBe(true)
    expect(result.hasGetEvolutionPreview).toBe(true)
    expect(result.hasLoadChains).toBe(true)
    expect(result.hasGetChainForSpecies).toBe(true)
  })

  test('canEvolve correctly checks level and stardust requirements', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { MonsterSystem, EvolutionSystem } = (window as unknown as {
        __TEST_EXPORTS__: {
          MonsterSystem: {
            loadSpeciesData: (data: unknown[]) => void
            loadAbilityData: (data: unknown[]) => void
            createMonsterInstance: (speciesId: string, level: number) => unknown
          }
          EvolutionSystem: {
            loadEvolutionChains: (chains: unknown[]) => void
            canEvolve: (monster: unknown, stardust: number) => {
              canEvolve: boolean
              reason: string | null
              nextStage: { speciesId: string } | null
              stardustCost: number | null
              requiredLevel: number | null
            }
          }
        }
      }).__TEST_EXPORTS__

      const baseSpecies = {
        speciesId: 'e2e-base',
        name: 'Base Form',
        description: 'Can evolve',
        element: 'fire',
        rarity: 'common',
        baseStats: {
          maxHp: 50, currentHp: 50, maxMp: 20, currentMp: 20,
          attack: 12, defense: 8, magicAttack: 10, magicDefense: 8, speed: 10, luck: 5,
        },
        statGrowth: { hp: 5, mp: 3, attack: 2, defense: 1, magicAttack: 2, magicDefense: 1, speed: 1 },
        abilities: [],
        captureBaseDifficulty: 0.3,
        spriteKey: 'test',
        evolutionChainId: 'e2e-chain',
        obtainableVia: 'wild',
      }

      const evolvedSpecies = {
        ...baseSpecies,
        speciesId: 'e2e-evolved',
        name: 'Evolved Form',
        rarity: 'uncommon',
        baseStats: {
          maxHp: 80, currentHp: 80, maxMp: 35, currentMp: 35,
          attack: 20, defense: 14, magicAttack: 18, magicDefense: 14, speed: 16, luck: 5,
        },
        statGrowth: { hp: 7, mp: 4, attack: 3, defense: 2, magicAttack: 3, magicDefense: 2, speed: 2 },
      }

      MonsterSystem.loadSpeciesData([baseSpecies, evolvedSpecies])
      MonsterSystem.loadAbilityData([])

      EvolutionSystem.loadEvolutionChains([{
        chainId: 'e2e-chain',
        name: 'E2E Evolution Chain',
        stages: [
          { speciesId: 'e2e-base', order: 1, evolvesTo: 'e2e-evolved', evolvesFrom: null, requiredLevel: 10, stardustCost: 0 },
          { speciesId: 'e2e-evolved', order: 2, evolvesTo: null, evolvesFrom: 'e2e-base', requiredLevel: 10, stardustCost: 100 },
        ],
      }])

      // Create monsters at different levels
      const monsterLowLevel = MonsterSystem.createMonsterInstance('e2e-base', 5)
      const monsterHighLevel = MonsterSystem.createMonsterInstance('e2e-base', 12)
      const monsterMaxForm = MonsterSystem.createMonsterInstance('e2e-evolved', 15)

      return {
        lowLevel: EvolutionSystem.canEvolve(monsterLowLevel, 500),
        highLevelRichStardust: EvolutionSystem.canEvolve(monsterHighLevel, 500),
        highLevelPoorStardust: EvolutionSystem.canEvolve(monsterHighLevel, 10),
        alreadyMax: EvolutionSystem.canEvolve(monsterMaxForm, 999),
      }
    })

    // Low level: cannot evolve
    expect(result.lowLevel.canEvolve).toBe(false)
    expect(result.lowLevel.reason).toBe('level_too_low')

    // High level + enough stardust: can evolve
    expect(result.highLevelRichStardust.canEvolve).toBe(true)
    expect(result.highLevelRichStardust.nextStage?.speciesId).toBe('e2e-evolved')
    expect(result.highLevelRichStardust.stardustCost).toBe(100)

    // High level + not enough stardust: cannot evolve
    expect(result.highLevelPoorStardust.canEvolve).toBe(false)
    expect(result.highLevelPoorStardust.reason).toBe('not_enough_stardust')

    // Already at max form: cannot evolve
    expect(result.alreadyMax.canEvolve).toBe(false)
    expect(result.alreadyMax.reason).toBe('already_max')
  })

  test('executeEvolution produces valid result with stardust cost', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { MonsterSystem, EvolutionSystem } = (window as unknown as {
        __TEST_EXPORTS__: {
          MonsterSystem: {
            loadSpeciesData: (data: unknown[]) => void
            loadAbilityData: (data: unknown[]) => void
            createMonsterInstance: (speciesId: string, level: number) => unknown
          }
          EvolutionSystem: {
            loadEvolutionChains: (chains: unknown[]) => void
            canEvolve: (monster: unknown, stardust: number) => {
              canEvolve: boolean
              nextStage: { speciesId: string; stardustCost: number } | null
            }
            executeEvolution: (
              monster: unknown,
              nextStage: unknown,
              nextSpecies: unknown,
            ) => {
              previousSpeciesId: string
              newSpeciesId: string
              stardustSpent: number
              bonusTrait: string | null
              statBoost: Record<string, number> | null
            }
          }
        }
      }).__TEST_EXPORTS__

      const baseSpecies = {
        speciesId: 'exec-base',
        name: 'Base',
        description: 'Test',
        element: 'fire',
        rarity: 'common',
        baseStats: {
          maxHp: 50, currentHp: 50, maxMp: 20, currentMp: 20,
          attack: 12, defense: 8, magicAttack: 10, magicDefense: 8, speed: 10, luck: 5,
        },
        statGrowth: { hp: 5, mp: 3, attack: 2, defense: 1, magicAttack: 2, magicDefense: 1, speed: 1 },
        abilities: [],
        captureBaseDifficulty: 0.3,
        spriteKey: 'test',
        evolutionChainId: 'exec-chain',
        obtainableVia: 'wild',
      }

      const evolvedSpecies = {
        ...baseSpecies,
        speciesId: 'exec-evolved',
        name: 'Evolved',
        evolutionChainId: 'exec-chain',
      }

      MonsterSystem.loadSpeciesData([baseSpecies, evolvedSpecies])
      MonsterSystem.loadAbilityData([])

      const chain = {
        chainId: 'exec-chain',
        name: 'Exec Chain',
        stages: [
          { speciesId: 'exec-base', order: 1, evolvesTo: 'exec-evolved', evolvesFrom: null, requiredLevel: 10, stardustCost: 0 },
          { speciesId: 'exec-evolved', order: 2, evolvesTo: null, evolvesFrom: 'exec-base', requiredLevel: 10, stardustCost: 150 },
        ],
      }

      EvolutionSystem.loadEvolutionChains([chain])

      const monster = MonsterSystem.createMonsterInstance('exec-base', 12)
      const check = EvolutionSystem.canEvolve(monster, 500)

      if (!check.canEvolve || !check.nextStage) {
        return { success: false, previousSpeciesId: '', newSpeciesId: '', stardustSpent: 0 }
      }

      const evoResult = EvolutionSystem.executeEvolution(monster, check.nextStage, evolvedSpecies)

      return {
        success: true,
        previousSpeciesId: evoResult.previousSpeciesId,
        newSpeciesId: evoResult.newSpeciesId,
        stardustSpent: evoResult.stardustSpent,
        hasBonusTrait: evoResult.bonusTrait !== null,
        hasStatBoost: evoResult.statBoost !== null,
      }
    })

    expect(result.success).toBe(true)
    expect(result.previousSpeciesId).toBe('exec-base')
    expect(result.newSpeciesId).toBe('exec-evolved')
    expect(result.stardustSpent).toBe(150)
  })

  test('transformMonster updates species and tracks previous forms', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { MonsterSystem } = (window as unknown as {
        __TEST_EXPORTS__: {
          MonsterSystem: {
            loadSpeciesData: (data: unknown[]) => void
            loadAbilityData: (data: unknown[]) => void
            createMonsterInstance: (speciesId: string, level: number) => unknown
            transformMonster: (
              monster: unknown,
              newSpeciesId: string,
              newStage: number,
            ) => { monster: { speciesId: string; evolutionStage: number; previousForms: string[] } }
          }
        }
      }).__TEST_EXPORTS__

      const baseSpecies = {
        speciesId: 'transform-base',
        name: 'Base',
        description: 'Test',
        element: 'fire',
        rarity: 'common',
        baseStats: {
          maxHp: 50, currentHp: 50, maxMp: 20, currentMp: 20,
          attack: 12, defense: 8, magicAttack: 10, magicDefense: 8, speed: 10, luck: 5,
        },
        statGrowth: { hp: 5, mp: 3, attack: 2, defense: 1, magicAttack: 2, magicDefense: 1, speed: 1 },
        abilities: [],
        captureBaseDifficulty: 0.3,
        spriteKey: 'test',
        evolutionChainId: 'transform-chain',
        obtainableVia: 'wild',
      }

      const evolvedSpecies = {
        ...baseSpecies,
        speciesId: 'transform-evolved',
        name: 'Evolved',
      }

      MonsterSystem.loadSpeciesData([baseSpecies, evolvedSpecies])
      MonsterSystem.loadAbilityData([])

      const monster = MonsterSystem.createMonsterInstance('transform-base', 10)
      const transformResult = MonsterSystem.transformMonster(monster, 'transform-evolved', 2)

      return {
        newSpeciesId: transformResult.monster.speciesId,
        evolutionStage: transformResult.monster.evolutionStage,
        previousForms: transformResult.monster.previousForms,
        tracksPreviousForm: transformResult.monster.previousForms.includes('transform-base'),
      }
    })

    expect(result.newSpeciesId).toBe('transform-evolved')
    expect(result.evolutionStage).toBe(2)
    expect(result.tracksPreviousForm).toBe(true)
    expect(result.previousForms).toContain('transform-base')
  })

  test('getEvolutionPreview projects stats for evolved form', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { MonsterSystem, EvolutionSystem } = (window as unknown as {
        __TEST_EXPORTS__: {
          MonsterSystem: {
            loadSpeciesData: (data: unknown[]) => void
            loadAbilityData: (data: unknown[]) => void
            createMonsterInstance: (speciesId: string, level: number) => unknown
          }
          EvolutionSystem: {
            loadEvolutionChains: (chains: unknown[]) => void
            getEvolutionPreview: (
              monster: unknown,
              nextSpecies: unknown,
            ) => {
              currentStats: { maxHp: number; attack: number }
              projectedStats: { maxHp: number; attack: number }
              newAbilities: string[]
              possibleTraits: string[]
            }
          }
        }
      }).__TEST_EXPORTS__

      const baseSpecies = {
        speciesId: 'preview-base',
        name: 'Base',
        description: 'Test',
        element: 'fire',
        rarity: 'common',
        baseStats: {
          maxHp: 50, currentHp: 50, maxMp: 20, currentMp: 20,
          attack: 12, defense: 8, magicAttack: 10, magicDefense: 8, speed: 10, luck: 5,
        },
        statGrowth: { hp: 5, mp: 3, attack: 2, defense: 1, magicAttack: 2, magicDefense: 1, speed: 1 },
        abilities: [{ abilityId: 'ember', learnAtLevel: 1 }],
        captureBaseDifficulty: 0.3,
        spriteKey: 'test',
        evolutionChainId: 'preview-chain',
        obtainableVia: 'wild',
      }

      const evolvedSpecies = {
        ...baseSpecies,
        speciesId: 'preview-evolved',
        name: 'Evolved',
        baseStats: {
          maxHp: 80, currentHp: 80, maxMp: 35, currentMp: 35,
          attack: 20, defense: 14, magicAttack: 18, magicDefense: 14, speed: 16, luck: 5,
        },
        statGrowth: { hp: 7, mp: 4, attack: 3, defense: 2, magicAttack: 3, magicDefense: 2, speed: 2 },
        abilities: [
          { abilityId: 'ember', learnAtLevel: 1 },
          { abilityId: 'flame-rush', learnAtLevel: 10 },
        ],
      }

      MonsterSystem.loadSpeciesData([baseSpecies, evolvedSpecies])
      MonsterSystem.loadAbilityData([])

      const monster = MonsterSystem.createMonsterInstance('preview-base', 12)
      const preview = EvolutionSystem.getEvolutionPreview(monster, evolvedSpecies)

      return {
        currentMaxHp: preview.currentStats.maxHp,
        projectedMaxHp: preview.projectedStats.maxHp,
        currentAttack: preview.currentStats.attack,
        projectedAttack: preview.projectedStats.attack,
        statsImprove: preview.projectedStats.maxHp > preview.currentStats.maxHp,
        newAbilities: preview.newAbilities,
        possibleTraits: preview.possibleTraits,
      }
    })

    // Evolved stats should be higher
    expect(result.statsImprove).toBe(true)
    expect(result.projectedMaxHp).toBeGreaterThan(result.currentMaxHp)
    expect(result.projectedAttack).toBeGreaterThan(result.currentAttack)
    // Should include the new ability
    expect(result.newAbilities).toContain('flame-rush')
    // Should list possible bonus traits
    expect(result.possibleTraits.length).toBeGreaterThan(0)
  })

  test('evolution chain traversal works for multi-stage chains', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { EvolutionSystem } = (window as unknown as {
        __TEST_EXPORTS__: {
          EvolutionSystem: {
            loadEvolutionChains: (chains: unknown[]) => void
            getChainForSpecies: (speciesId: string) => { chainId: string; stages: Array<{ speciesId: string; order: number }> } | null
            getStageForSpecies: (speciesId: string) => { speciesId: string; order: number; evolvesTo: string | null } | null
          }
        }
      }).__TEST_EXPORTS__

      EvolutionSystem.loadEvolutionChains([{
        chainId: 'multi-chain',
        name: 'Multi-Stage Chain',
        stages: [
          { speciesId: 'stage1', order: 1, evolvesTo: 'stage2', evolvesFrom: null, requiredLevel: 1, stardustCost: 0 },
          { speciesId: 'stage2', order: 2, evolvesTo: 'stage3', evolvesFrom: 'stage1', requiredLevel: 12, stardustCost: 100 },
          { speciesId: 'stage3', order: 3, evolvesTo: null, evolvesFrom: 'stage2', requiredLevel: 20, stardustCost: 300 },
        ],
      }])

      const chain1 = EvolutionSystem.getChainForSpecies('stage1')
      const chain2 = EvolutionSystem.getChainForSpecies('stage2')
      const chain3 = EvolutionSystem.getChainForSpecies('stage3')
      const chainNone = EvolutionSystem.getChainForSpecies('nonexistent')

      const stageInfo1 = EvolutionSystem.getStageForSpecies('stage1')
      const stageInfo2 = EvolutionSystem.getStageForSpecies('stage2')
      const stageInfo3 = EvolutionSystem.getStageForSpecies('stage3')

      return {
        allFindSameChain: chain1?.chainId === 'multi-chain' && chain2?.chainId === 'multi-chain' && chain3?.chainId === 'multi-chain',
        nonexistentReturnsNull: chainNone === null,
        stage1Order: stageInfo1?.order,
        stage2EvolvesTo: stageInfo2?.evolvesTo,
        stage3IsFinal: stageInfo3?.evolvesTo === null,
        chainHas3Stages: chain1?.stages.length === 3,
      }
    })

    expect(result.allFindSameChain).toBe(true)
    expect(result.nonexistentReturnsNull).toBe(true)
    expect(result.stage1Order).toBe(1)
    expect(result.stage2EvolvesTo).toBe('stage3')
    expect(result.stage3IsFinal).toBe(true)
    expect(result.chainHas3Stages).toBe(true)
  })
})

test.describe('Stardust Economy Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForGameLoad(page)

    await page.waitForFunction(
      () => (window as unknown as { __TEST_EXPORTS__?: unknown }).__TEST_EXPORTS__ !== undefined,
      { timeout: 10000 },
    )
  })

  test('evolution constants are correctly configured', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { Constants } = (window as unknown as {
        __TEST_EXPORTS__: {
          Constants: {
            STARDUST_PER_BATTLE: number
            EVOLUTION_TRAIT_CHANCE: number
            EVOLUTION_STAT_BOOST_MIN: number
            EVOLUTION_STAT_BOOST_MAX: number
            EVOLUTION_BONUS_TRAITS: ReadonlyArray<string>
          }
        }
      }).__TEST_EXPORTS__

      return {
        stardustPerBattle: Constants.STARDUST_PER_BATTLE,
        traitChance: Constants.EVOLUTION_TRAIT_CHANCE,
        statBoostMin: Constants.EVOLUTION_STAT_BOOST_MIN,
        statBoostMax: Constants.EVOLUTION_STAT_BOOST_MAX,
        bonusTraits: Constants.EVOLUTION_BONUS_TRAITS,
        hasTraits: Constants.EVOLUTION_BONUS_TRAITS.length > 0,
      }
    })

    expect(result.stardustPerBattle).toBeGreaterThan(0)
    expect(result.traitChance).toBeGreaterThan(0)
    expect(result.traitChance).toBeLessThanOrEqual(1)
    expect(result.statBoostMin).toBeGreaterThan(0)
    expect(result.statBoostMax).toBeGreaterThanOrEqual(result.statBoostMin)
    expect(result.hasTraits).toBe(true)
    expect(result.bonusTraits).toContain('swift')
    expect(result.bonusTraits).toContain('hardy')
  })
})

test.describe('World System - Evolution Exclusive Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForGameLoad(page)

    await page.waitForFunction(
      () => (window as unknown as { __TEST_EXPORTS__?: unknown }).__TEST_EXPORTS__ !== undefined,
      { timeout: 10000 },
    )
  })

  test('WorldSystem encounter generation filters evolution-only species', async ({ page }) => {
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

      // Create mock species: one wild, one evolution-only
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
        evolutionChainId: null,
        obtainableVia: 'both',
      }

      const evolutionOnlySpecies = {
        ...wildSpecies,
        speciesId: 'evolution-only-test',
        name: 'Evolution Only Monster',
        obtainableVia: 'evolution',
      }

      MonsterSystem.loadSpeciesData([wildSpecies, evolutionOnlySpecies])
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
          { speciesId: 'evolution-only-test', weight: 50, minLevel: 1, maxLevel: 5 },
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
        hasEvolutionOnly: encounteredSpecies.has('evolution-only-test'),
        species: Array.from(encounteredSpecies),
      }
    })

    expect(result.hasWild).toBe(true) // Should find wild species
    expect(result.hasEvolutionOnly).toBe(false) // Should NOT find evolution-only species
    expect(result.species).not.toContain('evolution-only-test')
  })
})
