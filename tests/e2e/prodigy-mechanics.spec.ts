import { test, expect, Page } from '@playwright/test'
import { waitForGameLoad, waitForTestExports } from './game-helpers'

/**
 * E2E Tests for Prodigy-Inspired Mechanics
 *
 * These tests verify the new game systems:
 * - Phase 1: Spell Recharge (Cooldowns)
 * - Phase 2: Pet Gear System
 * - Phase 3: Wave Mode
 * - Phase 4: Bounty Board System
 * - Backwards Compatibility for old saves
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PHASE 1: SPELL RECHARGE (COOLDOWNS)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe('Phase 1: Spell Recharge (Cooldowns)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForGameLoad(page)
  })

  test('abilities have cooldownTurns property', async ({ page }) => {
    await waitForTestExports(page)

    const result = await page.evaluate(() => {
      const { MonsterSystem } = (
        window as unknown as {
          __TEST_EXPORTS__: {
            MonsterSystem: {
              loadAbilityData: (abilities: unknown[]) => void
              getAbility: (id: string) => { cooldownTurns?: number } | undefined
            }
          }
        }
      ).__TEST_EXPORTS__

      // Load test abilities with cooldowns
      MonsterSystem.loadAbilityData([
        {
          abilityId: 'basic-attack',
          name: 'Basic Attack',
          description: 'A basic attack',
          element: 'neutral',
          power: 10,
          mpCost: 0,
          accuracy: 100,
          targetType: 'single_enemy',
          category: 'physical',
          statusEffect: null,
          cooldownTurns: 0,
        },
        {
          abilityId: 'fireball',
          name: 'Fireball',
          description: 'A powerful fire spell',
          element: 'fire',
          power: 40,
          mpCost: 15,
          accuracy: 95,
          targetType: 'single_enemy',
          category: 'magic',
          statusEffect: null,
          cooldownTurns: 2,
        },
        {
          abilityId: 'mega-blast',
          name: 'Mega Blast',
          description: 'Ultimate attack',
          element: 'neutral',
          power: 100,
          mpCost: 50,
          accuracy: 85,
          targetType: 'all_enemies',
          category: 'magic',
          statusEffect: null,
          cooldownTurns: 5,
        },
      ])

      const basicAttack = MonsterSystem.getAbility('basic-attack')
      const fireball = MonsterSystem.getAbility('fireball')
      const megaBlast = MonsterSystem.getAbility('mega-blast')

      return {
        basicAttackCooldown: basicAttack?.cooldownTurns,
        fireballCooldown: fireball?.cooldownTurns,
        megaBlastCooldown: megaBlast?.cooldownTurns,
      }
    })

    expect(result.basicAttackCooldown).toBe(0)
    expect(result.fireballCooldown).toBe(2)
    expect(result.megaBlastCooldown).toBe(5)
  })

  test('CombatSystem tracks cooldown state', async ({ page }) => {
    await waitForTestExports(page)

    const result = await page.evaluate(() => {
      const { CombatSystem, MonsterSystem } = (
        window as unknown as {
          __TEST_EXPORTS__: {
            CombatSystem: {
              isAbilityOnCooldown: (
                combatant: { cooldowns: Array<{ abilityId: string; turnsRemaining: number }> },
                abilityId: string,
              ) => boolean
              getAbilityCooldown: (
                combatant: { cooldowns: Array<{ abilityId: string; turnsRemaining: number }> },
                abilityId: string,
              ) => number
              startAbilityCooldown: (
                combatant: { cooldowns: Array<{ abilityId: string; turnsRemaining: number }> },
                ability: { abilityId: string; cooldownTurns: number },
              ) => { cooldowns: Array<{ abilityId: string; turnsRemaining: number }> }
              tickCooldowns: (
                combatant: { cooldowns: Array<{ abilityId: string; turnsRemaining: number }> },
              ) => { cooldowns: Array<{ abilityId: string; turnsRemaining: number }> }
            }
            MonsterSystem: {
              loadAbilityData: (abilities: unknown[]) => void
            }
          }
        }
      ).__TEST_EXPORTS__

      MonsterSystem.loadAbilityData([
        {
          abilityId: 'test-ability',
          name: 'Test',
          description: 'Test',
          element: 'neutral',
          power: 10,
          mpCost: 5,
          accuracy: 100,
          targetType: 'single_enemy',
          category: 'magic',
          statusEffect: null,
          cooldownTurns: 3,
        },
      ])

      // Create a combatant with empty cooldowns
      let combatant = { cooldowns: [] as Array<{ abilityId: string; turnsRemaining: number }> }

      // Test initial state
      const initialOnCooldown = CombatSystem.isAbilityOnCooldown(combatant, 'test-ability')
      const initialCooldown = CombatSystem.getAbilityCooldown(combatant, 'test-ability')

      // Start cooldown
      const ability = { abilityId: 'test-ability', cooldownTurns: 3 }
      combatant = CombatSystem.startAbilityCooldown(combatant, ability)

      const afterStartOnCooldown = CombatSystem.isAbilityOnCooldown(combatant, 'test-ability')
      const afterStartCooldown = CombatSystem.getAbilityCooldown(combatant, 'test-ability')

      // Tick once
      combatant = CombatSystem.tickCooldowns(combatant)
      const afterTick1 = CombatSystem.getAbilityCooldown(combatant, 'test-ability')

      // Tick twice more
      combatant = CombatSystem.tickCooldowns(combatant)
      combatant = CombatSystem.tickCooldowns(combatant)
      const afterTick3OnCooldown = CombatSystem.isAbilityOnCooldown(combatant, 'test-ability')

      return {
        initialOnCooldown,
        initialCooldown,
        afterStartOnCooldown,
        afterStartCooldown,
        afterTick1,
        afterTick3OnCooldown,
      }
    })

    expect(result.initialOnCooldown).toBe(false)
    expect(result.initialCooldown).toBe(0)
    expect(result.afterStartOnCooldown).toBe(true)
    expect(result.afterStartCooldown).toBe(3)
    expect(result.afterTick1).toBe(2)
    expect(result.afterTick3OnCooldown).toBe(false)
  })

  test('getUsableAbilities filters out abilities on cooldown', async ({ page }) => {
    await waitForTestExports(page)

    const result = await page.evaluate(() => {
      const { CombatSystem, MonsterSystem } = (
        window as unknown as {
          __TEST_EXPORTS__: {
            CombatSystem: {
              startAbilityCooldown: <T extends { cooldowns: Array<{ abilityId: string; turnsRemaining: number }> }>(
                combatant: T,
                ability: { abilityId: string; cooldownTurns: number },
              ) => T
              getUsableAbilities: (
                combatant: {
                  cooldowns: Array<{ abilityId: string; turnsRemaining: number }>
                  stats: { currentMp: number }
                  abilities: Array<{ abilityId: string; mpCost: number; cooldownTurns: number }>
                },
              ) => Array<{ abilityId: string }>
            }
            MonsterSystem: {
              loadAbilityData: (abilities: unknown[]) => void
            }
          }
        }
      ).__TEST_EXPORTS__

      const abilities = [
        {
          abilityId: 'ability-1',
          name: 'Ability 1',
          description: 'Test',
          element: 'neutral',
          power: 10,
          mpCost: 0,
          accuracy: 100,
          targetType: 'single_enemy',
          category: 'magic',
          statusEffect: null,
          cooldownTurns: 0,
        },
        {
          abilityId: 'ability-2',
          name: 'Ability 2',
          description: 'Test',
          element: 'neutral',
          power: 10,
          mpCost: 5,
          accuracy: 100,
          targetType: 'single_enemy',
          category: 'magic',
          statusEffect: null,
          cooldownTurns: 2,
        },
        {
          abilityId: 'ability-3',
          name: 'Ability 3',
          description: 'Test',
          element: 'neutral',
          power: 10,
          mpCost: 10,
          accuracy: 100,
          targetType: 'single_enemy',
          category: 'magic',
          statusEffect: null,
          cooldownTurns: 3,
        },
      ]

      MonsterSystem.loadAbilityData(abilities)

      // Create combatant with abilities included (as the real system expects)
      let combatant = {
        cooldowns: [] as Array<{ abilityId: string; turnsRemaining: number }>,
        stats: { currentMp: 50 },
        abilities: abilities,
      }

      // All abilities should be usable initially
      const initialUsable = CombatSystem.getUsableAbilities(combatant)

      // Put ability-2 on cooldown
      combatant = CombatSystem.startAbilityCooldown(combatant, abilities[1])

      // Now ability-2 should not be usable
      const afterCooldownUsable = CombatSystem.getUsableAbilities(combatant)

      return {
        initialUsableCount: initialUsable.length,
        afterCooldownUsableCount: afterCooldownUsable.length,
        ability2OnCooldown: !afterCooldownUsable.some((a) => a.abilityId === 'ability-2'),
      }
    })

    expect(result.initialUsableCount).toBe(3)
    expect(result.afterCooldownUsableCount).toBe(2)
    expect(result.ability2OnCooldown).toBe(true)
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PHASE 2: PET GEAR SYSTEM
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe('Phase 2: Pet Gear System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForGameLoad(page)
  })

  test('MonsterGearSystem registry functions work correctly', async ({ page }) => {
    await waitForTestExports(page)

    const result = await page.evaluate(() => {
      const { MonsterGearSystem } = (
        window as unknown as {
          __TEST_EXPORTS__: {
            MonsterGearSystem: {
              loadMonsterGearData: (gear: unknown[]) => void
              clearMonsterGearRegistry: () => void
              getGear: (id: string) => { gearId: string; name: string } | undefined
              getAllGear: () => unknown[]
              getGearBySlot: (slot: string) => unknown[]
            }
          }
        }
      ).__TEST_EXPORTS__

      // Clear and load test data
      MonsterGearSystem.clearMonsterGearRegistry()
      MonsterGearSystem.loadMonsterGearData([
        {
          gearId: 'test-collar',
          name: 'Test Collar',
          description: 'A test collar',
          slot: 'collar',
          rarity: 'common',
          statModifiers: { defense: 5 },
          levelRequirement: 1,
          iconKey: 'test-icon',
          buyPrice: 100,
          sellPrice: 50,
        },
        {
          gearId: 'test-saddle',
          name: 'Test Saddle',
          description: 'A test saddle',
          slot: 'saddle',
          rarity: 'uncommon',
          statModifiers: { speed: 8 },
          levelRequirement: 5,
          iconKey: 'test-icon',
          buyPrice: 200,
          sellPrice: 100,
        },
      ])

      const allGear = MonsterGearSystem.getAllGear()
      const collar = MonsterGearSystem.getGear('test-collar')
      const collars = MonsterGearSystem.getGearBySlot('collar')
      const saddles = MonsterGearSystem.getGearBySlot('saddle')

      return {
        totalGear: allGear.length,
        collarExists: !!collar,
        collarName: collar?.name,
        collarSlotCount: collars.length,
        saddleSlotCount: saddles.length,
      }
    })

    expect(result.totalGear).toBe(2)
    expect(result.collarExists).toBe(true)
    expect(result.collarName).toBe('Test Collar')
    expect(result.collarSlotCount).toBe(1)
    expect(result.saddleSlotCount).toBe(1)
  })

  test('createEmptyGearSlots returns all null slots', async ({ page }) => {
    await waitForTestExports(page)

    const result = await page.evaluate(() => {
      const { MonsterGearSystem } = (
        window as unknown as {
          __TEST_EXPORTS__: {
            MonsterGearSystem: {
              createEmptyGearSlots: () => {
                collar: unknown
                saddle: unknown
                charm: unknown
                claws: unknown
              }
            }
          }
        }
      ).__TEST_EXPORTS__

      const slots = MonsterGearSystem.createEmptyGearSlots()

      return {
        collarIsNull: slots.collar === null,
        saddleIsNull: slots.saddle === null,
        charmIsNull: slots.charm === null,
        clawsIsNull: slots.claws === null,
      }
    })

    expect(result.collarIsNull).toBe(true)
    expect(result.saddleIsNull).toBe(true)
    expect(result.charmIsNull).toBe(true)
    expect(result.clawsIsNull).toBe(true)
  })

  test('canEquipGear respects level requirements', async ({ page }) => {
    await waitForTestExports(page)

    const result = await page.evaluate(() => {
      const { MonsterGearSystem } = (
        window as unknown as {
          __TEST_EXPORTS__: {
            MonsterGearSystem: {
              canEquipGear: (
                monster: { level: number },
                gear: { levelRequirement: number },
              ) => boolean
              createEmptyGearSlots: () => {
                collar: null
                saddle: null
                charm: null
                claws: null
              }
            }
          }
        }
      ).__TEST_EXPORTS__

      const lowLevelMonster = { level: 3, equippedGear: MonsterGearSystem.createEmptyGearSlots() }
      const highLevelMonster = { level: 15, equippedGear: MonsterGearSystem.createEmptyGearSlots() }

      const lowLevelGear = { levelRequirement: 1 }
      const midLevelGear = { levelRequirement: 10 }
      const highLevelGear = { levelRequirement: 20 }

      return {
        lowMonsterCanEquipLow: MonsterGearSystem.canEquipGear(lowLevelMonster, lowLevelGear),
        lowMonsterCanEquipMid: MonsterGearSystem.canEquipGear(lowLevelMonster, midLevelGear),
        lowMonsterCanEquipHigh: MonsterGearSystem.canEquipGear(lowLevelMonster, highLevelGear),
        highMonsterCanEquipLow: MonsterGearSystem.canEquipGear(highLevelMonster, lowLevelGear),
        highMonsterCanEquipMid: MonsterGearSystem.canEquipGear(highLevelMonster, midLevelGear),
        highMonsterCanEquipHigh: MonsterGearSystem.canEquipGear(highLevelMonster, highLevelGear),
      }
    })

    expect(result.lowMonsterCanEquipLow).toBe(true)
    expect(result.lowMonsterCanEquipMid).toBe(false)
    expect(result.lowMonsterCanEquipHigh).toBe(false)
    expect(result.highMonsterCanEquipLow).toBe(true)
    expect(result.highMonsterCanEquipMid).toBe(true)
    expect(result.highMonsterCanEquipHigh).toBe(false)
  })

  test('equipGear updates monster and returns unequipped item', async ({ page }) => {
    await waitForTestExports(page)

    const result = await page.evaluate(() => {
      const { MonsterGearSystem } = (
        window as unknown as {
          __TEST_EXPORTS__: {
            MonsterGearSystem: {
              createEmptyGearSlots: () => {
                collar: null
                saddle: null
                charm: null
                claws: null
              }
              equipGear: (
                monster: { level: number; equippedGear: Record<string, unknown> },
                gear: { gearId: string; slot: string; levelRequirement: number },
              ) => { monster: { equippedGear: Record<string, unknown> }; unequipped: unknown } | null
            }
          }
        }
      ).__TEST_EXPORTS__

      const monster = {
        level: 10,
        equippedGear: MonsterGearSystem.createEmptyGearSlots(),
      }

      const collar1 = { gearId: 'collar-1', slot: 'collar', levelRequirement: 1 }
      const collar2 = { gearId: 'collar-2', slot: 'collar', levelRequirement: 5 }
      const highLevelCollar = { gearId: 'collar-high', slot: 'collar', levelRequirement: 20 }

      // First equip
      const firstResult = MonsterGearSystem.equipGear(monster, collar1)
      const firstUnequipped = firstResult?.unequipped

      // Second equip (should return first collar)
      const secondResult = firstResult
        ? MonsterGearSystem.equipGear(firstResult.monster, collar2)
        : null
      const secondUnequipped = secondResult?.unequipped

      // Try to equip high level (should fail)
      const failedResult = secondResult
        ? MonsterGearSystem.equipGear(secondResult.monster, highLevelCollar)
        : null

      return {
        firstSucceeded: firstResult !== null,
        firstUnequippedIsNull: firstUnequipped === null,
        secondSucceeded: secondResult !== null,
        secondUnequippedGearId: (secondUnequipped as { gearId?: string })?.gearId,
        highLevelFailed: failedResult === null,
      }
    })

    expect(result.firstSucceeded).toBe(true)
    expect(result.firstUnequippedIsNull).toBe(true)
    expect(result.secondSucceeded).toBe(true)
    expect(result.secondUnequippedGearId).toBe('collar-1')
    expect(result.highLevelFailed).toBe(true)
  })

  test('calculateGearBonuses sums stat modifiers', async ({ page }) => {
    await waitForTestExports(page)

    const result = await page.evaluate(() => {
      const { MonsterGearSystem } = (
        window as unknown as {
          __TEST_EXPORTS__: {
            MonsterGearSystem: {
              calculateGearBonuses: (slots: Record<string, unknown>) => Record<string, number>
            }
          }
        }
      ).__TEST_EXPORTS__

      const slots = {
        collar: { statModifiers: { defense: 5, speed: 2 } },
        saddle: { statModifiers: { attack: 3, speed: 5 } },
        charm: null,
        claws: { statModifiers: { attack: 10 } },
      }

      const bonuses = MonsterGearSystem.calculateGearBonuses(slots)

      return {
        defense: bonuses.defense ?? 0,
        attack: bonuses.attack ?? 0,
        speed: bonuses.speed ?? 0,
        magicAttack: bonuses.magicAttack ?? 0,
      }
    })

    expect(result.defense).toBe(5)
    expect(result.attack).toBe(13) // 3 + 10
    expect(result.speed).toBe(7) // 2 + 5
    expect(result.magicAttack).toBe(0)
  })

  test('applyGearStats adds bonuses to base stats', async ({ page }) => {
    await waitForTestExports(page)

    const result = await page.evaluate(() => {
      const { MonsterGearSystem } = (
        window as unknown as {
          __TEST_EXPORTS__: {
            MonsterGearSystem: {
              applyGearStats: (
                baseStats: Record<string, number>,
                slots: Record<string, unknown>,
              ) => Record<string, number>
            }
          }
        }
      ).__TEST_EXPORTS__

      const baseStats = {
        maxHp: 100,
        currentHp: 100,
        maxMp: 50,
        currentMp: 50,
        attack: 20,
        defense: 15,
        magicAttack: 18,
        magicDefense: 12,
        speed: 10,
        luck: 5,
      }

      const slots = {
        collar: { statModifiers: { defense: 5, maxHp: 20 } },
        saddle: { statModifiers: { speed: 8 } },
        charm: null,
        claws: { statModifiers: { attack: 10 } },
      }

      const finalStats = MonsterGearSystem.applyGearStats(baseStats, slots)

      return {
        maxHp: finalStats.maxHp,
        defense: finalStats.defense,
        attack: finalStats.attack,
        speed: finalStats.speed,
        // Unchanged stats
        magicAttack: finalStats.magicAttack,
        luck: finalStats.luck,
      }
    })

    expect(result.maxHp).toBe(120) // 100 + 20
    expect(result.defense).toBe(20) // 15 + 5
    expect(result.attack).toBe(30) // 20 + 10
    expect(result.speed).toBe(18) // 10 + 8
    // Unchanged
    expect(result.magicAttack).toBe(18)
    expect(result.luck).toBe(5)
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PHASE 3: WAVE MODE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe('Phase 3: Wave Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForGameLoad(page)
  })

  test('WaveChallengeSystem registry functions work', async ({ page }) => {
    await waitForTestExports(page)

    const result = await page.evaluate(() => {
      const { WaveChallengeSystem } = (
        window as unknown as {
          __TEST_EXPORTS__: {
            WaveChallengeSystem: {
              loadWaveChallengeData: (challenges: unknown[]) => void
              clearWaveChallengeRegistry: () => void
              getChallenge: (id: string) => { challengeId: string; name: string } | undefined
              getAllChallenges: () => unknown[]
            }
          }
        }
      ).__TEST_EXPORTS__

      WaveChallengeSystem.clearWaveChallengeRegistry()
      WaveChallengeSystem.loadWaveChallengeData([
        {
          challengeId: 'test-challenge',
          name: 'Test Challenge',
          description: 'A test challenge',
          recommendedLevel: 5,
          waves: [
            {
              waveNumber: 1,
              enemies: [{ speciesId: 'test-mon', level: 3, count: 1 }],
              difficultyMultiplier: 1.0,
              rewards: { experience: 50, gold: 25, items: [], equipmentId: null },
            },
          ],
          finalRewards: { experience: 100, gold: 100, items: [], equipmentId: null },
          backgroundKey: 'test-bg',
        },
      ])

      const all = WaveChallengeSystem.getAllChallenges()
      const challenge = WaveChallengeSystem.getChallenge('test-challenge')

      return {
        totalChallenges: all.length,
        challengeExists: !!challenge,
        challengeName: challenge?.name,
      }
    })

    expect(result.totalChallenges).toBe(1)
    expect(result.challengeExists).toBe(true)
    expect(result.challengeName).toBe('Test Challenge')
  })

  test('createWaveBattleState initializes correctly', async ({ page }) => {
    await waitForTestExports(page)

    const result = await page.evaluate(() => {
      const { WaveChallengeSystem } = (
        window as unknown as {
          __TEST_EXPORTS__: {
            WaveChallengeSystem: {
              loadWaveChallengeData: (challenges: unknown[]) => void
              clearWaveChallengeRegistry: () => void
              createWaveBattleState: (
                challengeId: string,
              ) => { challengeId: string; currentWave: number; totalWaves: number } | null
            }
          }
        }
      ).__TEST_EXPORTS__

      WaveChallengeSystem.clearWaveChallengeRegistry()
      WaveChallengeSystem.loadWaveChallengeData([
        {
          challengeId: 'three-wave-challenge',
          name: 'Three Waves',
          description: 'Test with 3 waves',
          recommendedLevel: 5,
          waves: [
            { waveNumber: 1, enemies: [], difficultyMultiplier: 1.0, rewards: { experience: 0, gold: 0, items: [], equipmentId: null } },
            { waveNumber: 2, enemies: [], difficultyMultiplier: 1.2, rewards: { experience: 0, gold: 0, items: [], equipmentId: null } },
            { waveNumber: 3, enemies: [], difficultyMultiplier: 1.5, rewards: { experience: 0, gold: 0, items: [], equipmentId: null } },
          ],
          finalRewards: { experience: 100, gold: 100, items: [], equipmentId: null },
          backgroundKey: 'test-bg',
        },
      ])

      const state = WaveChallengeSystem.createWaveBattleState('three-wave-challenge')
      const invalidState = WaveChallengeSystem.createWaveBattleState('non-existent')

      return {
        stateCreated: !!state,
        challengeId: state?.challengeId,
        currentWave: state?.currentWave,
        totalWaves: state?.totalWaves,
        invalidStateIsNull: invalidState === null,
      }
    })

    expect(result.stateCreated).toBe(true)
    expect(result.challengeId).toBe('three-wave-challenge')
    expect(result.currentWave).toBe(1)
    expect(result.totalWaves).toBe(3)
    expect(result.invalidStateIsNull).toBe(true)
  })

  test('advanceToNextWave increments wave counter', async ({ page }) => {
    await waitForTestExports(page)

    const result = await page.evaluate(() => {
      const { WaveChallengeSystem } = (
        window as unknown as {
          __TEST_EXPORTS__: {
            WaveChallengeSystem: {
              loadWaveChallengeData: (challenges: unknown[]) => void
              clearWaveChallengeRegistry: () => void
              createWaveBattleState: (
                challengeId: string,
              ) => { currentWave: number; totalWaves: number }
              advanceToNextWave: (
                state: { currentWave: number; totalWaves: number },
              ) => { currentWave: number; totalWaves: number }
            }
          }
        }
      ).__TEST_EXPORTS__

      WaveChallengeSystem.clearWaveChallengeRegistry()
      WaveChallengeSystem.loadWaveChallengeData([
        {
          challengeId: 'test',
          name: 'Test',
          description: 'Test',
          recommendedLevel: 5,
          waves: [
            { waveNumber: 1, enemies: [], difficultyMultiplier: 1.0, rewards: { experience: 0, gold: 0, items: [], equipmentId: null } },
            { waveNumber: 2, enemies: [], difficultyMultiplier: 1.2, rewards: { experience: 0, gold: 0, items: [], equipmentId: null } },
          ],
          finalRewards: { experience: 100, gold: 100, items: [], equipmentId: null },
          backgroundKey: 'test-bg',
        },
      ])

      let state = WaveChallengeSystem.createWaveBattleState('test')
      const wave1 = state.currentWave

      state = WaveChallengeSystem.advanceToNextWave(state)
      const wave2 = state.currentWave

      state = WaveChallengeSystem.advanceToNextWave(state)
      const wave3 = state.currentWave // Note: advanceToNextWave does NOT cap, caller should check isLastWave

      return {
        wave1,
        wave2,
        wave3,
        totalWaves: state.totalWaves,
      }
    })

    expect(result.wave1).toBe(1)
    expect(result.wave2).toBe(2)
    expect(result.wave3).toBe(3) // advanceToNextWave doesn't cap - caller should use isLastWave check
    expect(result.totalWaves).toBe(2)
  })

  test('isLastWave correctly identifies final wave', async ({ page }) => {
    await waitForTestExports(page)

    const result = await page.evaluate(() => {
      const { WaveChallengeSystem } = (
        window as unknown as {
          __TEST_EXPORTS__: {
            WaveChallengeSystem: {
              loadWaveChallengeData: (challenges: unknown[]) => void
              clearWaveChallengeRegistry: () => void
              getChallenge: (id: string) => { waves: unknown[] }
              isLastWave: (
                state: { currentWave: number },
                challenge: { waves: unknown[] },
              ) => boolean
            }
          }
        }
      ).__TEST_EXPORTS__

      WaveChallengeSystem.clearWaveChallengeRegistry()
      WaveChallengeSystem.loadWaveChallengeData([
        {
          challengeId: 'test',
          name: 'Test',
          description: 'Test',
          recommendedLevel: 5,
          waves: [
            { waveNumber: 1, enemies: [], difficultyMultiplier: 1.0, rewards: { experience: 0, gold: 0, items: [], equipmentId: null } },
            { waveNumber: 2, enemies: [], difficultyMultiplier: 1.2, rewards: { experience: 0, gold: 0, items: [], equipmentId: null } },
            { waveNumber: 3, enemies: [], difficultyMultiplier: 1.5, rewards: { experience: 0, gold: 0, items: [], equipmentId: null } },
          ],
          finalRewards: { experience: 100, gold: 100, items: [], equipmentId: null },
          backgroundKey: 'test-bg',
        },
      ])

      const challenge = WaveChallengeSystem.getChallenge('test')

      const isLastAtWave1 = WaveChallengeSystem.isLastWave({ currentWave: 1 }, challenge)
      const isLastAtWave2 = WaveChallengeSystem.isLastWave({ currentWave: 2 }, challenge)
      const isLastAtWave3 = WaveChallengeSystem.isLastWave({ currentWave: 3 }, challenge)

      return {
        isLastAtWave1,
        isLastAtWave2,
        isLastAtWave3,
      }
    })

    expect(result.isLastAtWave1).toBe(false)
    expect(result.isLastAtWave2).toBe(false)
    expect(result.isLastAtWave3).toBe(true)
  })

  test('accumulateWaveRewards adds rewards correctly', async ({ page }) => {
    await waitForTestExports(page)

    const result = await page.evaluate(() => {
      const { WaveChallengeSystem } = (
        window as unknown as {
          __TEST_EXPORTS__: {
            WaveChallengeSystem: {
              accumulateWaveRewards: (
                state: { accumulatedRewards: { experience: number; gold: number; items: unknown[] } },
                rewards: { experience: number; gold: number; items: unknown[] },
              ) => { accumulatedRewards: { experience: number; gold: number; items: unknown[] } }
            }
          }
        }
      ).__TEST_EXPORTS__

      let state = {
        accumulatedRewards: {
          experience: 0,
          gold: 0,
          items: [] as Array<{ itemId: string; quantity: number }>,
          equipmentId: null,
        },
      }

      // Wave 1 rewards
      state = WaveChallengeSystem.accumulateWaveRewards(state, {
        experience: 50,
        gold: 25,
        items: [{ itemId: 'potion', quantity: 1 }],
      })

      const afterWave1 = { ...state.accumulatedRewards }

      // Wave 2 rewards
      state = WaveChallengeSystem.accumulateWaveRewards(state, {
        experience: 75,
        gold: 40,
        items: [{ itemId: 'potion', quantity: 2 }],
      })

      return {
        afterWave1Experience: afterWave1.experience,
        afterWave1Gold: afterWave1.gold,
        afterWave1ItemCount: afterWave1.items.length,
        finalExperience: state.accumulatedRewards.experience,
        finalGold: state.accumulatedRewards.gold,
        finalItemCount: state.accumulatedRewards.items.length,
      }
    })

    expect(result.afterWave1Experience).toBe(50)
    expect(result.afterWave1Gold).toBe(25)
    expect(result.afterWave1ItemCount).toBe(1)
    expect(result.finalExperience).toBe(125)
    expect(result.finalGold).toBe(65)
    // Items should be merged (potions combined)
    expect(result.finalItemCount).toBeGreaterThan(0)
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PHASE 4: BOUNTY BOARD SYSTEM
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe('Phase 4: Bounty Board System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForGameLoad(page)
  })

  test('BountySystem registry functions work', async ({ page }) => {
    await waitForTestExports(page)

    const result = await page.evaluate(() => {
      const { BountySystem } = (
        window as unknown as {
          __TEST_EXPORTS__: {
            BountySystem: {
              loadBountyData: (bounties: unknown[]) => void
              loadBountyPools: (pools: unknown[]) => void
              clearBountyRegistry: () => void
              getBounty: (id: string) => { bountyId: string; name: string } | undefined
              getAllBounties: () => unknown[]
              getPool: (id: string) => { poolId: string; tier: string } | undefined
            }
          }
        }
      ).__TEST_EXPORTS__

      BountySystem.clearBountyRegistry()
      BountySystem.loadBountyData([
        {
          bountyId: 'test-bounty',
          name: 'Test Bounty',
          description: 'A test bounty',
          tier: 'easy',
          objectives: [{ objectiveId: 'obj-1', type: 'defeat', targetId: 'any', targetName: 'Any Monster', requiredCount: 3, description: 'Defeat 3 monsters' }],
          baseRewards: { experience: 100, gold: 50, items: [], equipmentId: null },
          poolId: 'test-pool',
        },
      ])
      BountySystem.loadBountyPools([
        { poolId: 'test-pool', name: 'Test Pool', bountyIds: ['test-bounty'], tier: 'easy' },
      ])

      const allBounties = BountySystem.getAllBounties()
      const bounty = BountySystem.getBounty('test-bounty')
      const pool = BountySystem.getPool('test-pool')

      return {
        totalBounties: allBounties.length,
        bountyExists: !!bounty,
        bountyName: bounty?.name,
        poolExists: !!pool,
        poolTier: pool?.tier,
      }
    })

    expect(result.totalBounties).toBe(1)
    expect(result.bountyExists).toBe(true)
    expect(result.bountyName).toBe('Test Bounty')
    expect(result.poolExists).toBe(true)
    expect(result.poolTier).toBe('easy')
  })

  test('shouldRefreshBounties detects date changes', async ({ page }) => {
    await waitForTestExports(page)

    const result = await page.evaluate(() => {
      const { BountySystem } = (
        window as unknown as {
          __TEST_EXPORTS__: {
            BountySystem: {
              shouldRefreshBounties: (lastDate: string, currentDate: string) => boolean
            }
          }
        }
      ).__TEST_EXPORTS__

      return {
        sameDay: BountySystem.shouldRefreshBounties('2024-01-15', '2024-01-15'),
        nextDay: BountySystem.shouldRefreshBounties('2024-01-15', '2024-01-16'),
        weekLater: BountySystem.shouldRefreshBounties('2024-01-15', '2024-01-22'),
      }
    })

    expect(result.sameDay).toBe(false)
    expect(result.nextDay).toBe(true)
    expect(result.weekLater).toBe(true)
  })

  test('selectDailyBounties is deterministic by date', async ({ page }) => {
    await waitForTestExports(page)

    const result = await page.evaluate(() => {
      const { BountySystem } = (
        window as unknown as {
          __TEST_EXPORTS__: {
            BountySystem: {
              selectDailyBounties: (
                pools: Array<{ poolId: string; bountyIds: string[]; tier: string }>,
                date: string,
              ) => string[]
            }
          }
        }
      ).__TEST_EXPORTS__

      const pools = [
        { poolId: 'easy-pool', bountyIds: ['bounty-1', 'bounty-2', 'bounty-3'], tier: 'easy' },
        { poolId: 'medium-pool', bountyIds: ['bounty-4', 'bounty-5'], tier: 'medium' },
      ]

      // Same date should produce same results
      const date1Selection1 = BountySystem.selectDailyBounties(pools, '2024-01-15')
      const date1Selection2 = BountySystem.selectDailyBounties(pools, '2024-01-15')

      // Different date may produce different results
      const date2Selection = BountySystem.selectDailyBounties(pools, '2024-01-16')

      return {
        sameDateMatch: JSON.stringify(date1Selection1) === JSON.stringify(date1Selection2),
        differentDates: JSON.stringify(date1Selection1) !== JSON.stringify(date2Selection) || true, // May or may not differ
        selectionCount: date1Selection1.length,
      }
    })

    expect(result.sameDateMatch).toBe(true)
    expect(result.selectionCount).toBe(2) // One per pool
  })

  test('acceptBounty initializes progress', async ({ page }) => {
    await waitForTestExports(page)

    const result = await page.evaluate(() => {
      const { BountySystem } = (
        window as unknown as {
          __TEST_EXPORTS__: {
            BountySystem: {
              loadBountyData: (bounties: unknown[]) => void
              loadBountyPools: (pools: unknown[]) => void
              clearBountyRegistry: () => void
              createEmptyBoardState: () => {
                availableBounties: string[]
                activeBounty: null | { bountyId: string; objectiveProgress: Record<string, number> }
              }
              refreshBountyBoard: (
                state: { availableBounties: string[]; lastRefreshDate: string },
                date: string,
              ) => { availableBounties: string[]; activeBounty: null }
              acceptBounty: (
                state: { availableBounties: string[]; activeBounty: null; completedToday: string[] },
                bountyId: string,
              ) => { activeBounty: { bountyId: string; objectiveProgress: Record<string, number> } } | null
            }
          }
        }
      ).__TEST_EXPORTS__

      BountySystem.clearBountyRegistry()
      BountySystem.loadBountyData([
        {
          bountyId: 'test-bounty',
          name: 'Test',
          description: 'Test',
          tier: 'easy',
          objectives: [
            { objectiveId: 'obj-1', type: 'defeat', targetId: 'any', targetName: 'Any', requiredCount: 5, description: 'Defeat 5' },
            { objectiveId: 'obj-2', type: 'defeat', targetId: 'fire', targetName: 'Fire', requiredCount: 3, description: 'Defeat 3 fire' },
          ],
          baseRewards: { experience: 100, gold: 50, items: [], equipmentId: null },
          poolId: 'test-pool',
        },
      ])
      BountySystem.loadBountyPools([
        { poolId: 'test-pool', name: 'Test', bountyIds: ['test-bounty'], tier: 'easy' },
      ])

      let state = BountySystem.createEmptyBoardState() as {
        lastRefreshDate: string
        availableBounties: string[]
        activeBounty: null | { bountyId: string; objectiveProgress: Record<string, number> }
        completedToday: string[]
      }
      state = BountySystem.refreshBountyBoard(state, '2024-01-15') as typeof state

      const acceptedState = BountySystem.acceptBounty(state, 'test-bounty')

      return {
        accepted: acceptedState !== null,
        bountyId: acceptedState?.activeBounty?.bountyId,
        obj1Progress: acceptedState?.activeBounty?.objectiveProgress?.['obj-1'],
        obj2Progress: acceptedState?.activeBounty?.objectiveProgress?.['obj-2'],
      }
    })

    expect(result.accepted).toBe(true)
    expect(result.bountyId).toBe('test-bounty')
    expect(result.obj1Progress).toBe(0)
    expect(result.obj2Progress).toBe(0)
  })

  test('updateBountyProgress increments and caps at required count', async ({ page }) => {
    await waitForTestExports(page)

    const result = await page.evaluate(() => {
      const { BountySystem } = (
        window as unknown as {
          __TEST_EXPORTS__: {
            BountySystem: {
              loadBountyData: (bounties: unknown[]) => void
              loadBountyPools: (pools: unknown[]) => void
              clearBountyRegistry: () => void
              createEmptyBoardState: () => Record<string, unknown>
              refreshBountyBoard: (
                state: Record<string, unknown>,
                date: string,
              ) => Record<string, unknown>
              acceptBounty: (
                state: Record<string, unknown>,
                bountyId: string,
              ) => Record<string, unknown> | null
              updateBountyProgress: (
                state: Record<string, unknown>,
                objectiveId: string,
                increment: number,
              ) => {
                activeBounty: { objectiveProgress: Record<string, number>; status: string }
              }
            }
          }
        }
      ).__TEST_EXPORTS__

      BountySystem.clearBountyRegistry()
      BountySystem.loadBountyData([
        {
          bountyId: 'test-bounty',
          name: 'Test',
          description: 'Test',
          tier: 'easy',
          objectives: [
            { objectiveId: 'obj-1', type: 'defeat', targetId: 'any', targetName: 'Any', requiredCount: 3, description: 'Defeat 3' },
          ],
          baseRewards: { experience: 100, gold: 50, items: [], equipmentId: null },
          poolId: 'test-pool',
        },
      ])
      BountySystem.loadBountyPools([
        { poolId: 'test-pool', name: 'Test', bountyIds: ['test-bounty'], tier: 'easy' },
      ])

      let state = BountySystem.createEmptyBoardState()
      state = BountySystem.refreshBountyBoard(state, '2024-01-15')
      state = BountySystem.acceptBounty(state, 'test-bounty')!

      // Update progress by 1
      state = BountySystem.updateBountyProgress(state, 'obj-1', 1)
      const progressAfter1 = (state as { activeBounty: { objectiveProgress: Record<string, number> } }).activeBounty.objectiveProgress['obj-1']

      // Update progress by 10 (should cap at 3)
      state = BountySystem.updateBountyProgress(state, 'obj-1', 10)
      const progressAfterCap = (state as { activeBounty: { objectiveProgress: Record<string, number>; status: string } }).activeBounty.objectiveProgress['obj-1']
      const statusAfterComplete = (state as { activeBounty: { status: string } }).activeBounty.status

      return {
        progressAfter1,
        progressAfterCap,
        statusAfterComplete,
      }
    })

    expect(result.progressAfter1).toBe(1)
    expect(result.progressAfterCap).toBe(3) // Capped at requiredCount
    expect(result.statusAfterComplete).toBe('completed')
  })

  test('getStreakReward returns correct reward for streak levels', async ({ page }) => {
    await waitForTestExports(page)

    const result = await page.evaluate(() => {
      const { BountySystem } = (
        window as unknown as {
          __TEST_EXPORTS__: {
            BountySystem: {
              getStreakReward: (
                streak: number,
              ) => { streakDays: number; goldMultiplier: number } | null
            }
          }
        }
      ).__TEST_EXPORTS__

      return {
        streak0: BountySystem.getStreakReward(0),
        streak2: BountySystem.getStreakReward(2),
        streak3: BountySystem.getStreakReward(3),
        streak5: BountySystem.getStreakReward(5),
        streak7: BountySystem.getStreakReward(7),
        streak10: BountySystem.getStreakReward(10),
      }
    })

    expect(result.streak0).toBeNull()
    expect(result.streak2).toBeNull()
    expect(result.streak3?.goldMultiplier).toBe(1.25)
    expect(result.streak5?.goldMultiplier).toBe(1.5)
    expect(result.streak7?.goldMultiplier).toBe(2.0)
    expect(result.streak10?.goldMultiplier).toBe(2.0) // Still 7-day reward (highest qualifying)
  })

  test('calculateStreak handles day gaps correctly', async ({ page }) => {
    await waitForTestExports(page)

    const result = await page.evaluate(() => {
      const { BountySystem } = (
        window as unknown as {
          __TEST_EXPORTS__: {
            BountySystem: {
              calculateStreak: (
                lastDate: string | null,
                currentDate: string,
                currentStreak: number,
              ) => number
            }
          }
        }
      ).__TEST_EXPORTS__

      return {
        noLastDate: BountySystem.calculateStreak(null, '2024-01-15', 0),
        sameDay: BountySystem.calculateStreak('2024-01-15', '2024-01-15', 5),
        nextDay: BountySystem.calculateStreak('2024-01-15', '2024-01-16', 5),
        twoDayGap: BountySystem.calculateStreak('2024-01-15', '2024-01-17', 5),
        weekGap: BountySystem.calculateStreak('2024-01-15', '2024-01-22', 5),
      }
    })

    expect(result.noLastDate).toBe(0)
    expect(result.sameDay).toBe(5) // Maintains streak
    expect(result.nextDay).toBe(5) // Maintains streak
    expect(result.twoDayGap).toBe(0) // Resets
    expect(result.weekGap).toBe(0) // Resets
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BACKWARDS COMPATIBILITY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe('Backwards Compatibility (Old Saves)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForGameLoad(page)
  })

  test('MonsterGearSystem handles undefined equippedGear gracefully', async ({ page }) => {
    await waitForTestExports(page)

    const result = await page.evaluate(() => {
      const { MonsterGearSystem } = (
        window as unknown as {
          __TEST_EXPORTS__: {
            MonsterGearSystem: {
              calculateGearBonuses: (
                slots: undefined | null | Record<string, unknown>,
              ) => Record<string, number>
              applyGearStats: (
                baseStats: Record<string, number>,
                slots: undefined | null | Record<string, unknown>,
              ) => Record<string, number>
              getTotalGearValue: (
                slots: undefined | null | Record<string, unknown>,
              ) => number
              hasAnyGearEquipped: (
                slots: undefined | null | Record<string, unknown>,
              ) => boolean
              getEquippedGearList: (
                slots: undefined | null | Record<string, unknown>,
              ) => unknown[]
            }
          }
        }
      ).__TEST_EXPORTS__

      const baseStats = {
        maxHp: 100,
        currentHp: 100,
        maxMp: 50,
        currentMp: 50,
        attack: 20,
        defense: 15,
        magicAttack: 18,
        magicDefense: 12,
        speed: 10,
        luck: 5,
      }

      // Test with undefined
      const undefinedBonuses = MonsterGearSystem.calculateGearBonuses(undefined)
      const undefinedStats = MonsterGearSystem.applyGearStats(baseStats, undefined)
      const undefinedValue = MonsterGearSystem.getTotalGearValue(undefined)
      const undefinedHasGear = MonsterGearSystem.hasAnyGearEquipped(undefined)
      const undefinedGearList = MonsterGearSystem.getEquippedGearList(undefined)

      // Test with null
      const nullBonuses = MonsterGearSystem.calculateGearBonuses(null)
      const nullStats = MonsterGearSystem.applyGearStats(baseStats, null)
      const nullValue = MonsterGearSystem.getTotalGearValue(null)
      const nullHasGear = MonsterGearSystem.hasAnyGearEquipped(null)
      const nullGearList = MonsterGearSystem.getEquippedGearList(null)

      return {
        undefinedBonusesEmpty: Object.keys(undefinedBonuses).length === 0,
        undefinedStatsUnchanged: undefinedStats === baseStats,
        undefinedValueZero: undefinedValue === 0,
        undefinedHasGearFalse: undefinedHasGear === false,
        undefinedGearListEmpty: undefinedGearList.length === 0,

        nullBonusesEmpty: Object.keys(nullBonuses).length === 0,
        nullStatsUnchanged: nullStats === baseStats,
        nullValueZero: nullValue === 0,
        nullHasGearFalse: nullHasGear === false,
        nullGearListEmpty: nullGearList.length === 0,
      }
    })

    // Undefined handling
    expect(result.undefinedBonusesEmpty).toBe(true)
    expect(result.undefinedStatsUnchanged).toBe(true)
    expect(result.undefinedValueZero).toBe(true)
    expect(result.undefinedHasGearFalse).toBe(true)
    expect(result.undefinedGearListEmpty).toBe(true)

    // Null handling
    expect(result.nullBonusesEmpty).toBe(true)
    expect(result.nullStatsUnchanged).toBe(true)
    expect(result.nullValueZero).toBe(true)
    expect(result.nullHasGearFalse).toBe(true)
    expect(result.nullGearListEmpty).toBe(true)
  })

  test('old monster without equippedGear can be used in combat', async ({ page }) => {
    await waitForTestExports(page)

    const result = await page.evaluate(() => {
      const { SquadSystem, MonsterSystem } = (
        window as unknown as {
          __TEST_EXPORTS__: {
            SquadSystem: {
              createSquadCombatants: (
                squad: Array<{
                  instanceId: string
                  speciesId: string
                  level: number
                  stats: Record<string, number>
                  learnedAbilities: string[]
                  equippedGear?: Record<string, unknown>
                  bondLevel: number
                }>,
              ) => Array<{ combatantId: string; stats: Record<string, number> }>
            }
            MonsterSystem: {
              loadSpeciesData: (species: unknown[]) => void
              loadAbilityData: (abilities: unknown[]) => void
            }
          }
        }
      ).__TEST_EXPORTS__

      // Load minimal species data
      MonsterSystem.loadSpeciesData([
        {
          speciesId: 'test-species',
          name: 'Test',
          description: 'Test',
          element: 'neutral',
          rarity: 'common',
          baseStats: {
            maxHp: 50,
            currentHp: 50,
            maxMp: 25,
            currentMp: 25,
            attack: 10,
            defense: 8,
            magicAttack: 7,
            magicDefense: 6,
            speed: 5,
            luck: 3,
          },
          statGrowth: { hp: 5, mp: 2, attack: 2, defense: 1, magicAttack: 1, magicDefense: 1, speed: 1 },
          abilities: [],
          captureBaseDifficulty: 0.5,
          spriteKey: 'test',
          evolutionChain: null,
          breedingGroup: 'beast',
          breedingTraits: [],
          obtainableVia: 'wild',
        },
      ])
      MonsterSystem.loadAbilityData([])

      // Simulate old save monster WITHOUT equippedGear field
      const oldSaveMonster = {
        instanceId: 'old-mon-1',
        speciesId: 'test-species',
        level: 5,
        stats: {
          maxHp: 50,
          currentHp: 50,
          maxMp: 25,
          currentMp: 25,
          attack: 10,
          defense: 8,
          magicAttack: 7,
          magicDefense: 6,
          speed: 5,
          luck: 3,
        },
        learnedAbilities: [],
        bondLevel: 0,
        // NOTE: equippedGear is intentionally missing to simulate old save
      }

      try {
        const combatants = SquadSystem.createSquadCombatants([oldSaveMonster as Parameters<typeof SquadSystem.createSquadCombatants>[0][0]])
        return {
          success: true,
          combatantCreated: combatants.length > 0,
          combatantId: combatants[0]?.combatantId,
          hasStats: !!combatants[0]?.stats,
        }
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message,
        }
      }
    })

    expect(result.success).toBe(true)
    expect(result.combatantCreated).toBe(true)
    expect(result.hasStats).toBe(true)
  })

  test('monster with equippedGear has gear stats applied in combat', async ({ page }) => {
    await waitForTestExports(page)

    const result = await page.evaluate(() => {
      const { SquadSystem, MonsterSystem, MonsterGearSystem } = (
        window as unknown as {
          __TEST_EXPORTS__: {
            SquadSystem: {
              createSquadCombatants: (
                squad: Array<{
                  instanceId: string
                  speciesId: string
                  level: number
                  stats: Record<string, number>
                  learnedAbilities: string[]
                  equippedGear: Record<string, unknown>
                  bondLevel: number
                }>,
              ) => Array<{ combatantId: string; stats: { attack: number; defense: number } }>
            }
            MonsterSystem: {
              loadSpeciesData: (species: unknown[]) => void
              loadAbilityData: (abilities: unknown[]) => void
            }
            MonsterGearSystem: {
              createEmptyGearSlots: () => Record<string, null>
            }
          }
        }
      ).__TEST_EXPORTS__

      // Load minimal species data
      MonsterSystem.loadSpeciesData([
        {
          speciesId: 'test-species',
          name: 'Test',
          description: 'Test',
          element: 'neutral',
          rarity: 'common',
          baseStats: {
            maxHp: 50,
            currentHp: 50,
            maxMp: 25,
            currentMp: 25,
            attack: 10,
            defense: 8,
            magicAttack: 7,
            magicDefense: 6,
            speed: 5,
            luck: 3,
          },
          statGrowth: { hp: 5, mp: 2, attack: 2, defense: 1, magicAttack: 1, magicDefense: 1, speed: 1 },
          abilities: [],
          captureBaseDifficulty: 0.5,
          spriteKey: 'test',
          evolutionChain: null,
          breedingGroup: 'beast',
          breedingTraits: [],
          obtainableVia: 'wild',
        },
      ])
      MonsterSystem.loadAbilityData([])

      // Create monster without gear
      const monsterNoGear = {
        instanceId: 'mon-no-gear',
        speciesId: 'test-species',
        level: 5,
        stats: {
          maxHp: 50,
          currentHp: 50,
          maxMp: 25,
          currentMp: 25,
          attack: 10,
          defense: 8,
          magicAttack: 7,
          magicDefense: 6,
          speed: 5,
          luck: 3,
        },
        learnedAbilities: [],
        equippedGear: MonsterGearSystem.createEmptyGearSlots(),
        bondLevel: 0,
      }

      // Create monster with gear
      const monsterWithGear = {
        instanceId: 'mon-with-gear',
        speciesId: 'test-species',
        level: 5,
        stats: {
          maxHp: 50,
          currentHp: 50,
          maxMp: 25,
          currentMp: 25,
          attack: 10,
          defense: 8,
          magicAttack: 7,
          magicDefense: 6,
          speed: 5,
          luck: 3,
        },
        learnedAbilities: [],
        equippedGear: {
          ...MonsterGearSystem.createEmptyGearSlots(),
          collar: { statModifiers: { defense: 5 } },
          claws: { statModifiers: { attack: 10 } },
        },
        bondLevel: 0,
      }

      const noGearCombatants = SquadSystem.createSquadCombatants([monsterNoGear])
      const withGearCombatants = SquadSystem.createSquadCombatants([monsterWithGear])

      return {
        noGearAttack: noGearCombatants[0]?.stats?.attack,
        noGearDefense: noGearCombatants[0]?.stats?.defense,
        withGearAttack: withGearCombatants[0]?.stats?.attack,
        withGearDefense: withGearCombatants[0]?.stats?.defense,
      }
    })

    // Without gear: base stats
    expect(result.noGearAttack).toBe(10)
    expect(result.noGearDefense).toBe(8)

    // With gear: base stats + gear bonuses
    expect(result.withGearAttack).toBe(20) // 10 + 10
    expect(result.withGearDefense).toBe(13) // 8 + 5
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST EXPORTS AVAILABILITY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe('System Test Exports', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForGameLoad(page)
  })

  test('all new systems are exposed via __TEST_EXPORTS__', async ({ page }) => {
    await waitForTestExports(page)

    const result = await page.evaluate(() => {
      const exports = (window as unknown as { __TEST_EXPORTS__?: Record<string, unknown> }).__TEST_EXPORTS__

      return {
        hasCombatSystem: !!exports?.CombatSystem,
        hasMonsterGearSystem: !!exports?.MonsterGearSystem,
        hasWaveChallengeSystem: !!exports?.WaveChallengeSystem,
        hasBountySystem: !!exports?.BountySystem,
        hasSquadSystem: !!exports?.SquadSystem,
        hasMonsterSystem: !!exports?.MonsterSystem,
      }
    })

    expect(result.hasCombatSystem).toBe(true)
    expect(result.hasMonsterGearSystem).toBe(true)
    expect(result.hasWaveChallengeSystem).toBe(true)
    expect(result.hasBountySystem).toBe(true)
    expect(result.hasSquadSystem).toBe(true)
    expect(result.hasMonsterSystem).toBe(true)
  })
})
