import { test, expect } from '@playwright/test'
import { waitForGameLoad } from './game-helpers'

/**
 * E2E Tests for the Targeting System
 * These tests verify the targeting system functions are properly loaded and work correctly
 * including multi-target resolution, adjacent targeting, and damage calculations.
 */

// Helper to create mock stats
function createMockStats(currentHp: number) {
  return {
    maxHp: 100,
    currentHp,
    maxMp: 30,
    currentMp: 30,
    attack: 15,
    defense: 10,
    magicAttack: 12,
    magicDefense: 8,
    speed: 11,
    luck: 5,
  }
}

// Helper to create mock combatant
function createMockCombatant(id: string, isPlayer: boolean, currentHp: number) {
  return {
    combatantId: id,
    name: `Combatant ${id}`,
    isPlayer,
    isMonster: true,
    stats: createMockStats(currentHp),
    abilities: [],
    statusEffects: [],
    capturable: !isPlayer,
  }
}

// Helper to create mock battle
function createMockBattle(playerCombatants: unknown[], enemyCombatants: unknown[]) {
  return {
    state: 'active',
    turnOrder: [...playerCombatants, ...enemyCombatants],
    currentTurnIndex: 0,
    playerSquad: playerCombatants,
    enemySquad: enemyCombatants,
    turnCount: 1,
    canFlee: true,
    backgroundKey: 'battle-bg',
    rewards: null,
  }
}

test.describe('Targeting System Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForGameLoad(page)

    await page.waitForFunction(
      () => (window as unknown as { __TEST_EXPORTS__?: unknown }).__TEST_EXPORTS__ !== undefined,
      { timeout: 10000 },
    )
  })

  test('TargetingSystem exports are available', async ({ page }) => {
    const result = await page.evaluate(() => {
      const exports = (window as unknown as { __TEST_EXPORTS__?: { TargetingSystem?: object } }).__TEST_EXPORTS__
      return {
        hasTargetingSystem: !!exports?.TargetingSystem,
        hasGetValidTargets: typeof exports?.TargetingSystem === 'object' && 'getValidTargets' in exports.TargetingSystem,
        hasResolveTargets: typeof exports?.TargetingSystem === 'object' && 'resolveTargets' in exports.TargetingSystem,
        hasGetAdjacentEnemies: typeof exports?.TargetingSystem === 'object' && 'getAdjacentEnemies' in exports.TargetingSystem,
        hasGetRandomEnemies: typeof exports?.TargetingSystem === 'object' && 'getRandomEnemies' in exports.TargetingSystem,
        hasIsValidTarget: typeof exports?.TargetingSystem === 'object' && 'isValidTarget' in exports.TargetingSystem,
        hasRequiresTargetSelection: typeof exports?.TargetingSystem === 'object' && 'requiresTargetSelection' in exports.TargetingSystem,
        hasGetMultiTargetDamageMultiplier: typeof exports?.TargetingSystem === 'object' && 'getMultiTargetDamageMultiplier' in exports.TargetingSystem,
      }
    })

    expect(result.hasTargetingSystem).toBe(true)
    expect(result.hasGetValidTargets).toBe(true)
    expect(result.hasResolveTargets).toBe(true)
    expect(result.hasGetAdjacentEnemies).toBe(true)
    expect(result.hasGetRandomEnemies).toBe(true)
    expect(result.hasIsValidTarget).toBe(true)
    expect(result.hasRequiresTargetSelection).toBe(true)
    expect(result.hasGetMultiTargetDamageMultiplier).toBe(true)
  })

  test('requiresTargetSelection returns correct values for different target types', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { TargetingSystem } = (window as unknown as {
        __TEST_EXPORTS__: {
          TargetingSystem: {
            requiresTargetSelection: (targetType: string) => boolean
          }
        }
      }).__TEST_EXPORTS__

      return {
        single_enemy: TargetingSystem.requiresTargetSelection('single_enemy'),
        all_enemies: TargetingSystem.requiresTargetSelection('all_enemies'),
        single_ally: TargetingSystem.requiresTargetSelection('single_ally'),
        all_allies: TargetingSystem.requiresTargetSelection('all_allies'),
        self: TargetingSystem.requiresTargetSelection('self'),
        adjacent_enemies: TargetingSystem.requiresTargetSelection('adjacent_enemies'),
        random_enemies_2: TargetingSystem.requiresTargetSelection('random_enemies_2'),
        random_enemies_3: TargetingSystem.requiresTargetSelection('random_enemies_3'),
      }
    })

    expect(result.single_enemy).toBe(true)
    expect(result.all_enemies).toBe(false)
    expect(result.single_ally).toBe(true)
    expect(result.all_allies).toBe(false)
    expect(result.self).toBe(false)
    expect(result.adjacent_enemies).toBe(true)
    expect(result.random_enemies_2).toBe(false)
    expect(result.random_enemies_3).toBe(false)
  })

  test('getMultiTargetDamageMultiplier returns correct values', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { TargetingSystem } = (window as unknown as {
        __TEST_EXPORTS__: {
          TargetingSystem: {
            getMultiTargetDamageMultiplier: (count: number) => number
          }
        }
      }).__TEST_EXPORTS__

      return {
        singleTarget: TargetingSystem.getMultiTargetDamageMultiplier(1),
        twoTargets: TargetingSystem.getMultiTargetDamageMultiplier(2),
        threeTargets: TargetingSystem.getMultiTargetDamageMultiplier(3),
        fiveTargets: TargetingSystem.getMultiTargetDamageMultiplier(5),
        zeroTargets: TargetingSystem.getMultiTargetDamageMultiplier(0),
      }
    })

    expect(result.singleTarget).toBe(1.0)
    expect(result.twoTargets).toBe(0.75)
    expect(result.threeTargets).toBe(0.75)
    expect(result.fiveTargets).toBe(0.75)
    expect(result.zeroTargets).toBe(1.0)
  })
})

test.describe('Target Resolution Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForGameLoad(page)

    await page.waitForFunction(
      () => (window as unknown as { __TEST_EXPORTS__?: unknown }).__TEST_EXPORTS__ !== undefined,
      { timeout: 10000 },
    )
  })

  test('resolveTargets returns correct targets for single_enemy', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { TargetingSystem } = (window as unknown as {
        __TEST_EXPORTS__: {
          TargetingSystem: {
            resolveTargets: (battle: unknown, targetType: string, primaryTargetId: string, actorId: string) => readonly string[]
          }
        }
      }).__TEST_EXPORTS__

      // Create proper mock battle with playerSquad and enemySquad
      const createStats = (hp: number) => ({
        maxHp: 100, currentHp: hp, maxMp: 30, currentMp: 30,
        attack: 15, defense: 10, magicAttack: 12, magicDefense: 8, speed: 11, luck: 5,
      })

      const createCombatant = (id: string, isPlayer: boolean, hp: number) => ({
        combatantId: id,
        name: `Combatant ${id}`,
        isPlayer,
        isMonster: true,
        stats: createStats(hp),
        abilities: [],
        statusEffects: [],
        capturable: !isPlayer,
      })

      const mockBattle = {
        state: 'active',
        turnOrder: [],
        currentTurnIndex: 0,
        playerSquad: [createCombatant('player-1', true, 50)],
        enemySquad: [
          createCombatant('enemy-1', false, 100),
          createCombatant('enemy-2', false, 80),
          createCombatant('enemy-3', false, 60),
        ],
        turnCount: 1,
        canFlee: true,
        backgroundKey: 'battle-bg',
        rewards: null,
      }

      const targets = TargetingSystem.resolveTargets(mockBattle, 'single_enemy', 'enemy-2', 'player-1')

      return {
        targets: [...targets],
        count: targets.length,
      }
    })

    expect(result.count).toBe(1)
    expect(result.targets).toContain('enemy-2')
  })

  test('resolveTargets returns all enemies for all_enemies', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { TargetingSystem } = (window as unknown as {
        __TEST_EXPORTS__: {
          TargetingSystem: {
            resolveTargets: (battle: unknown, targetType: string, primaryTargetId: string | null, actorId: string) => readonly string[]
          }
        }
      }).__TEST_EXPORTS__

      const createStats = (hp: number) => ({
        maxHp: 100, currentHp: hp, maxMp: 30, currentMp: 30,
        attack: 15, defense: 10, magicAttack: 12, magicDefense: 8, speed: 11, luck: 5,
      })

      const createCombatant = (id: string, isPlayer: boolean, hp: number) => ({
        combatantId: id,
        name: `Combatant ${id}`,
        isPlayer,
        isMonster: true,
        stats: createStats(hp),
        abilities: [],
        statusEffects: [],
        capturable: !isPlayer,
      })

      const mockBattle = {
        state: 'active',
        turnOrder: [],
        currentTurnIndex: 0,
        playerSquad: [createCombatant('player-1', true, 50)],
        enemySquad: [
          createCombatant('enemy-1', false, 100),
          createCombatant('enemy-2', false, 80),
          createCombatant('enemy-3', false, 60),
        ],
        turnCount: 1,
        canFlee: true,
        backgroundKey: 'battle-bg',
        rewards: null,
      }

      const targets = TargetingSystem.resolveTargets(mockBattle, 'all_enemies', null, 'player-1')

      return {
        targets: [...targets],
        count: targets.length,
      }
    })

    expect(result.count).toBe(3)
    expect(result.targets).toContain('enemy-1')
    expect(result.targets).toContain('enemy-2')
    expect(result.targets).toContain('enemy-3')
  })

  test('resolveTargets returns self for self target type', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { TargetingSystem } = (window as unknown as {
        __TEST_EXPORTS__: {
          TargetingSystem: {
            resolveTargets: (battle: unknown, targetType: string, primaryTargetId: string | null, actorId: string) => readonly string[]
          }
        }
      }).__TEST_EXPORTS__

      const createStats = (hp: number) => ({
        maxHp: 100, currentHp: hp, maxMp: 30, currentMp: 30,
        attack: 15, defense: 10, magicAttack: 12, magicDefense: 8, speed: 11, luck: 5,
      })

      const createCombatant = (id: string, isPlayer: boolean, hp: number) => ({
        combatantId: id,
        name: `Combatant ${id}`,
        isPlayer,
        isMonster: true,
        stats: createStats(hp),
        abilities: [],
        statusEffects: [],
        capturable: !isPlayer,
      })

      const mockBattle = {
        state: 'active',
        turnOrder: [],
        currentTurnIndex: 0,
        playerSquad: [createCombatant('player-1', true, 50)],
        enemySquad: [createCombatant('enemy-1', false, 100)],
        turnCount: 1,
        canFlee: true,
        backgroundKey: 'battle-bg',
        rewards: null,
      }

      const targets = TargetingSystem.resolveTargets(mockBattle, 'self', null, 'player-1')

      return {
        targets: [...targets],
        count: targets.length,
      }
    })

    expect(result.count).toBe(1)
    expect(result.targets).toContain('player-1')
  })

  test('resolveTargets excludes defeated enemies (hp <= 0)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { TargetingSystem } = (window as unknown as {
        __TEST_EXPORTS__: {
          TargetingSystem: {
            resolveTargets: (battle: unknown, targetType: string, primaryTargetId: string | null, actorId: string) => readonly string[]
          }
        }
      }).__TEST_EXPORTS__

      const createStats = (hp: number) => ({
        maxHp: 100, currentHp: hp, maxMp: 30, currentMp: 30,
        attack: 15, defense: 10, magicAttack: 12, magicDefense: 8, speed: 11, luck: 5,
      })

      const createCombatant = (id: string, isPlayer: boolean, hp: number) => ({
        combatantId: id,
        name: `Combatant ${id}`,
        isPlayer,
        isMonster: true,
        stats: createStats(hp),
        abilities: [],
        statusEffects: [],
        capturable: !isPlayer,
      })

      const mockBattle = {
        state: 'active',
        turnOrder: [],
        currentTurnIndex: 0,
        playerSquad: [createCombatant('player-1', true, 50)],
        enemySquad: [
          createCombatant('enemy-1', false, 100),
          createCombatant('enemy-2', false, 0), // Defeated
          createCombatant('enemy-3', false, 60),
        ],
        turnCount: 1,
        canFlee: true,
        backgroundKey: 'battle-bg',
        rewards: null,
      }

      const targets = TargetingSystem.resolveTargets(mockBattle, 'all_enemies', null, 'player-1')

      return {
        targets: [...targets],
        count: targets.length,
      }
    })

    expect(result.count).toBe(2)
    expect(result.targets).toContain('enemy-1')
    expect(result.targets).not.toContain('enemy-2')
    expect(result.targets).toContain('enemy-3')
  })
})

test.describe('Adjacent Enemies Targeting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForGameLoad(page)

    await page.waitForFunction(
      () => (window as unknown as { __TEST_EXPORTS__?: unknown }).__TEST_EXPORTS__ !== undefined,
      { timeout: 10000 },
    )
  })

  test('getAdjacentEnemies returns primary target and neighbors', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { TargetingSystem } = (window as unknown as {
        __TEST_EXPORTS__: {
          TargetingSystem: {
            getAdjacentEnemies: (battle: unknown, primaryTargetId: string, actorIsPlayer: boolean) => readonly string[]
          }
        }
      }).__TEST_EXPORTS__

      const createStats = (hp: number) => ({
        maxHp: 100, currentHp: hp, maxMp: 30, currentMp: 30,
        attack: 15, defense: 10, magicAttack: 12, magicDefense: 8, speed: 11, luck: 5,
      })

      const createCombatant = (id: string, isPlayer: boolean, hp: number) => ({
        combatantId: id,
        name: `Combatant ${id}`,
        isPlayer,
        isMonster: true,
        stats: createStats(hp),
        abilities: [],
        statusEffects: [],
        capturable: !isPlayer,
      })

      const mockBattle = {
        state: 'active',
        turnOrder: [],
        currentTurnIndex: 0,
        playerSquad: [createCombatant('player-1', true, 50)],
        enemySquad: [
          createCombatant('enemy-1', false, 100),
          createCombatant('enemy-2', false, 80),
          createCombatant('enemy-3', false, 60),
        ],
        turnCount: 1,
        canFlee: true,
        backgroundKey: 'battle-bg',
        rewards: null,
      }

      // Target middle enemy (enemy-2)
      const targets = TargetingSystem.getAdjacentEnemies(mockBattle, 'enemy-2', true)

      return {
        targets: [...targets],
        count: targets.length,
      }
    })

    expect(result.count).toBe(3)
    expect(result.targets).toContain('enemy-1')
    expect(result.targets).toContain('enemy-2')
    expect(result.targets).toContain('enemy-3')
  })

  test('getAdjacentEnemies handles edge position (first enemy)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { TargetingSystem } = (window as unknown as {
        __TEST_EXPORTS__: {
          TargetingSystem: {
            getAdjacentEnemies: (battle: unknown, primaryTargetId: string, actorIsPlayer: boolean) => readonly string[]
          }
        }
      }).__TEST_EXPORTS__

      const createStats = (hp: number) => ({
        maxHp: 100, currentHp: hp, maxMp: 30, currentMp: 30,
        attack: 15, defense: 10, magicAttack: 12, magicDefense: 8, speed: 11, luck: 5,
      })

      const createCombatant = (id: string, isPlayer: boolean, hp: number) => ({
        combatantId: id,
        name: `Combatant ${id}`,
        isPlayer,
        isMonster: true,
        stats: createStats(hp),
        abilities: [],
        statusEffects: [],
        capturable: !isPlayer,
      })

      const mockBattle = {
        state: 'active',
        turnOrder: [],
        currentTurnIndex: 0,
        playerSquad: [createCombatant('player-1', true, 50)],
        enemySquad: [
          createCombatant('enemy-1', false, 100),
          createCombatant('enemy-2', false, 80),
          createCombatant('enemy-3', false, 60),
        ],
        turnCount: 1,
        canFlee: true,
        backgroundKey: 'battle-bg',
        rewards: null,
      }

      // Target first enemy (enemy-1)
      const targets = TargetingSystem.getAdjacentEnemies(mockBattle, 'enemy-1', true)

      return {
        targets: [...targets],
        count: targets.length,
      }
    })

    expect(result.count).toBe(2)
    expect(result.targets).toContain('enemy-1')
    expect(result.targets).toContain('enemy-2')
    expect(result.targets).not.toContain('enemy-3')
  })

  test('getAdjacentEnemies handles edge position (last enemy)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { TargetingSystem } = (window as unknown as {
        __TEST_EXPORTS__: {
          TargetingSystem: {
            getAdjacentEnemies: (battle: unknown, primaryTargetId: string, actorIsPlayer: boolean) => readonly string[]
          }
        }
      }).__TEST_EXPORTS__

      const createStats = (hp: number) => ({
        maxHp: 100, currentHp: hp, maxMp: 30, currentMp: 30,
        attack: 15, defense: 10, magicAttack: 12, magicDefense: 8, speed: 11, luck: 5,
      })

      const createCombatant = (id: string, isPlayer: boolean, hp: number) => ({
        combatantId: id,
        name: `Combatant ${id}`,
        isPlayer,
        isMonster: true,
        stats: createStats(hp),
        abilities: [],
        statusEffects: [],
        capturable: !isPlayer,
      })

      const mockBattle = {
        state: 'active',
        turnOrder: [],
        currentTurnIndex: 0,
        playerSquad: [createCombatant('player-1', true, 50)],
        enemySquad: [
          createCombatant('enemy-1', false, 100),
          createCombatant('enemy-2', false, 80),
          createCombatant('enemy-3', false, 60),
        ],
        turnCount: 1,
        canFlee: true,
        backgroundKey: 'battle-bg',
        rewards: null,
      }

      // Target last enemy (enemy-3)
      const targets = TargetingSystem.getAdjacentEnemies(mockBattle, 'enemy-3', true)

      return {
        targets: [...targets],
        count: targets.length,
      }
    })

    expect(result.count).toBe(2)
    expect(result.targets).not.toContain('enemy-1')
    expect(result.targets).toContain('enemy-2')
    expect(result.targets).toContain('enemy-3')
  })
})

test.describe('Random Enemies Targeting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForGameLoad(page)

    await page.waitForFunction(
      () => (window as unknown as { __TEST_EXPORTS__?: unknown }).__TEST_EXPORTS__ !== undefined,
      { timeout: 10000 },
    )
  })

  test('getRandomEnemies returns correct number of targets', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { TargetingSystem } = (window as unknown as {
        __TEST_EXPORTS__: {
          TargetingSystem: {
            getRandomEnemies: (battle: unknown, count: number, actorIsPlayer: boolean) => readonly string[]
          }
        }
      }).__TEST_EXPORTS__

      const createStats = (hp: number) => ({
        maxHp: 100, currentHp: hp, maxMp: 30, currentMp: 30,
        attack: 15, defense: 10, magicAttack: 12, magicDefense: 8, speed: 11, luck: 5,
      })

      const createCombatant = (id: string, isPlayer: boolean, hp: number) => ({
        combatantId: id,
        name: `Combatant ${id}`,
        isPlayer,
        isMonster: true,
        stats: createStats(hp),
        abilities: [],
        statusEffects: [],
        capturable: !isPlayer,
      })

      const mockBattle = {
        state: 'active',
        turnOrder: [],
        currentTurnIndex: 0,
        playerSquad: [createCombatant('player-1', true, 50)],
        enemySquad: [
          createCombatant('enemy-1', false, 100),
          createCombatant('enemy-2', false, 80),
          createCombatant('enemy-3', false, 60),
          createCombatant('enemy-4', false, 40),
        ],
        turnCount: 1,
        canFlee: true,
        backgroundKey: 'battle-bg',
        rewards: null,
      }

      const twoTargets = TargetingSystem.getRandomEnemies(mockBattle, 2, true)
      const threeTargets = TargetingSystem.getRandomEnemies(mockBattle, 3, true)

      return {
        twoTargetCount: twoTargets.length,
        threeTargetCount: threeTargets.length,
      }
    })

    expect(result.twoTargetCount).toBe(2)
    expect(result.threeTargetCount).toBe(3)
  })

  test('getRandomEnemies caps at available enemies', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { TargetingSystem } = (window as unknown as {
        __TEST_EXPORTS__: {
          TargetingSystem: {
            getRandomEnemies: (battle: unknown, count: number, actorIsPlayer: boolean) => readonly string[]
          }
        }
      }).__TEST_EXPORTS__

      const createStats = (hp: number) => ({
        maxHp: 100, currentHp: hp, maxMp: 30, currentMp: 30,
        attack: 15, defense: 10, magicAttack: 12, magicDefense: 8, speed: 11, luck: 5,
      })

      const createCombatant = (id: string, isPlayer: boolean, hp: number) => ({
        combatantId: id,
        name: `Combatant ${id}`,
        isPlayer,
        isMonster: true,
        stats: createStats(hp),
        abilities: [],
        statusEffects: [],
        capturable: !isPlayer,
      })

      const mockBattle = {
        state: 'active',
        turnOrder: [],
        currentTurnIndex: 0,
        playerSquad: [createCombatant('player-1', true, 50)],
        enemySquad: [
          createCombatant('enemy-1', false, 100),
          createCombatant('enemy-2', false, 80),
        ],
        turnCount: 1,
        canFlee: true,
        backgroundKey: 'battle-bg',
        rewards: null,
      }

      // Request 5 targets but only 2 enemies exist
      const targets = TargetingSystem.getRandomEnemies(mockBattle, 5, true)

      return {
        count: targets.length,
        targets: [...targets],
      }
    })

    expect(result.count).toBe(2)
    expect(result.targets).toContain('enemy-1')
    expect(result.targets).toContain('enemy-2')
  })

  test('getRandomEnemies excludes defeated enemies', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { TargetingSystem } = (window as unknown as {
        __TEST_EXPORTS__: {
          TargetingSystem: {
            getRandomEnemies: (battle: unknown, count: number, actorIsPlayer: boolean) => readonly string[]
          }
        }
      }).__TEST_EXPORTS__

      const createStats = (hp: number) => ({
        maxHp: 100, currentHp: hp, maxMp: 30, currentMp: 30,
        attack: 15, defense: 10, magicAttack: 12, magicDefense: 8, speed: 11, luck: 5,
      })

      const createCombatant = (id: string, isPlayer: boolean, hp: number) => ({
        combatantId: id,
        name: `Combatant ${id}`,
        isPlayer,
        isMonster: true,
        stats: createStats(hp),
        abilities: [],
        statusEffects: [],
        capturable: !isPlayer,
      })

      const mockBattle = {
        state: 'active',
        turnOrder: [],
        currentTurnIndex: 0,
        playerSquad: [createCombatant('player-1', true, 50)],
        enemySquad: [
          createCombatant('enemy-1', false, 100),
          createCombatant('enemy-2', false, 0), // Defeated
          createCombatant('enemy-3', false, 60),
        ],
        turnCount: 1,
        canFlee: true,
        backgroundKey: 'battle-bg',
        rewards: null,
      }

      // Run multiple times to verify defeated enemy is never selected
      const allTargets: string[] = []
      for (let i = 0; i < 20; i++) {
        const targets = TargetingSystem.getRandomEnemies(mockBattle, 2, true)
        allTargets.push(...targets)
      }

      return {
        containsDefeated: allTargets.includes('enemy-2'),
      }
    })

    expect(result.containsDefeated).toBe(false)
  })
})

test.describe('Valid Targets Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForGameLoad(page)

    await page.waitForFunction(
      () => (window as unknown as { __TEST_EXPORTS__?: unknown }).__TEST_EXPORTS__ !== undefined,
      { timeout: 10000 },
    )
  })

  test('getValidTargets returns enemies for player single_enemy attack', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { TargetingSystem } = (window as unknown as {
        __TEST_EXPORTS__: {
          TargetingSystem: {
            getValidTargets: (battle: unknown, actorId: string, targetType: string) => readonly unknown[]
          }
        }
      }).__TEST_EXPORTS__

      const createStats = (hp: number) => ({
        maxHp: 100, currentHp: hp, maxMp: 30, currentMp: 30,
        attack: 15, defense: 10, magicAttack: 12, magicDefense: 8, speed: 11, luck: 5,
      })

      const createCombatant = (id: string, isPlayer: boolean, hp: number) => ({
        combatantId: id,
        name: `Combatant ${id}`,
        isPlayer,
        isMonster: true,
        stats: createStats(hp),
        abilities: [],
        statusEffects: [],
        capturable: !isPlayer,
      })

      const mockBattle = {
        state: 'active',
        turnOrder: [],
        currentTurnIndex: 0,
        playerSquad: [
          createCombatant('player-1', true, 50),
          createCombatant('ally-1', true, 30),
        ],
        enemySquad: [
          createCombatant('enemy-1', false, 100),
          createCombatant('enemy-2', false, 80),
        ],
        turnCount: 1,
        canFlee: true,
        backgroundKey: 'battle-bg',
        rewards: null,
      }

      const targets = TargetingSystem.getValidTargets(mockBattle, 'player-1', 'single_enemy')

      return {
        count: targets.length,
        targetIds: targets.map((t: { combatantId: string }) => t.combatantId),
      }
    })

    expect(result.count).toBe(2)
    expect(result.targetIds).toContain('enemy-1')
    expect(result.targetIds).toContain('enemy-2')
    expect(result.targetIds).not.toContain('player-1')
    expect(result.targetIds).not.toContain('ally-1')
  })

  test('getValidTargets returns allies for single_ally heal', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { TargetingSystem } = (window as unknown as {
        __TEST_EXPORTS__: {
          TargetingSystem: {
            getValidTargets: (battle: unknown, actorId: string, targetType: string) => readonly unknown[]
          }
        }
      }).__TEST_EXPORTS__

      const createStats = (hp: number) => ({
        maxHp: 100, currentHp: hp, maxMp: 30, currentMp: 30,
        attack: 15, defense: 10, magicAttack: 12, magicDefense: 8, speed: 11, luck: 5,
      })

      const createCombatant = (id: string, isPlayer: boolean, hp: number) => ({
        combatantId: id,
        name: `Combatant ${id}`,
        isPlayer,
        isMonster: true,
        stats: createStats(hp),
        abilities: [],
        statusEffects: [],
        capturable: !isPlayer,
      })

      const mockBattle = {
        state: 'active',
        turnOrder: [],
        currentTurnIndex: 0,
        playerSquad: [
          createCombatant('player-1', true, 50),
          createCombatant('ally-1', true, 30),
        ],
        enemySquad: [
          createCombatant('enemy-1', false, 100),
        ],
        turnCount: 1,
        canFlee: true,
        backgroundKey: 'battle-bg',
        rewards: null,
      }

      const targets = TargetingSystem.getValidTargets(mockBattle, 'player-1', 'single_ally')

      return {
        count: targets.length,
        targetIds: targets.map((t: { combatantId: string }) => t.combatantId),
      }
    })

    expect(result.count).toBe(2)
    expect(result.targetIds).toContain('player-1')
    expect(result.targetIds).toContain('ally-1')
    expect(result.targetIds).not.toContain('enemy-1')
  })

  test('isValidTarget correctly validates targets', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { TargetingSystem } = (window as unknown as {
        __TEST_EXPORTS__: {
          TargetingSystem: {
            isValidTarget: (battle: unknown, actorId: string, targetId: string, targetType: string) => boolean
          }
        }
      }).__TEST_EXPORTS__

      const createStats = (hp: number) => ({
        maxHp: 100, currentHp: hp, maxMp: 30, currentMp: 30,
        attack: 15, defense: 10, magicAttack: 12, magicDefense: 8, speed: 11, luck: 5,
      })

      const createCombatant = (id: string, isPlayer: boolean, hp: number) => ({
        combatantId: id,
        name: `Combatant ${id}`,
        isPlayer,
        isMonster: true,
        stats: createStats(hp),
        abilities: [],
        statusEffects: [],
        capturable: !isPlayer,
      })

      const mockBattle = {
        state: 'active',
        turnOrder: [],
        currentTurnIndex: 0,
        playerSquad: [createCombatant('player-1', true, 50)],
        enemySquad: [
          createCombatant('enemy-1', false, 100),
          createCombatant('enemy-2', false, 0), // Defeated
        ],
        turnCount: 1,
        canFlee: true,
        backgroundKey: 'battle-bg',
        rewards: null,
      }

      return {
        validEnemyTarget: TargetingSystem.isValidTarget(mockBattle, 'player-1', 'enemy-1', 'single_enemy'),
        invalidSelfTarget: TargetingSystem.isValidTarget(mockBattle, 'player-1', 'player-1', 'single_enemy'),
        invalidDefeatedTarget: TargetingSystem.isValidTarget(mockBattle, 'player-1', 'enemy-2', 'single_enemy'),
        validSelfTarget: TargetingSystem.isValidTarget(mockBattle, 'player-1', 'player-1', 'self'),
      }
    })

    expect(result.validEnemyTarget).toBe(true)
    expect(result.invalidSelfTarget).toBe(false)
    expect(result.invalidDefeatedTarget).toBe(false)
    expect(result.validSelfTarget).toBe(true)
  })
})

test.describe('Combat System Multi-Target Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForGameLoad(page)

    await page.waitForFunction(
      () => (window as unknown as { __TEST_EXPORTS__?: unknown }).__TEST_EXPORTS__ !== undefined,
      { timeout: 10000 },
    )
  })

  test('CombatSystem exports are available', async ({ page }) => {
    const result = await page.evaluate(() => {
      const exports = (window as unknown as { __TEST_EXPORTS__?: { CombatSystem?: object } }).__TEST_EXPORTS__
      return {
        hasCombatSystem: !!exports?.CombatSystem,
        hasCreateBattle: typeof exports?.CombatSystem === 'object' && 'createBattle' in exports.CombatSystem,
        hasExecuteAction: typeof exports?.CombatSystem === 'object' && 'executeAction' in exports.CombatSystem,
        hasCalculateTurnOrder: typeof exports?.CombatSystem === 'object' && 'calculateTurnOrder' in exports.CombatSystem,
      }
    })

    expect(result.hasCombatSystem).toBe(true)
    expect(result.hasCreateBattle).toBe(true)
    expect(result.hasExecuteAction).toBe(true)
    expect(result.hasCalculateTurnOrder).toBe(true)
  })

  test('TargetingSystem integrates with multi-target abilities via resolveTargets', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { TargetingSystem } = (window as unknown as {
        __TEST_EXPORTS__: {
          TargetingSystem: {
            resolveTargets: (battle: unknown, targetType: string, primaryTargetId: string | null, actorId: string) => readonly string[]
            getMultiTargetDamageMultiplier: (count: number) => number
          }
        }
      }).__TEST_EXPORTS__

      const createStats = (hp: number) => ({
        maxHp: 100, currentHp: hp, maxMp: 30, currentMp: 30,
        attack: 15, defense: 10, magicAttack: 12, magicDefense: 8, speed: 11, luck: 5,
      })

      const createCombatant = (id: string, isPlayer: boolean, hp: number) => ({
        combatantId: id,
        name: `Combatant ${id}`,
        isPlayer,
        isMonster: true,
        stats: createStats(hp),
        abilities: [],
        statusEffects: [],
        capturable: !isPlayer,
      })

      // Create a battle scenario with multi-target ability usage
      const mockBattle = {
        state: 'active',
        turnOrder: [],
        currentTurnIndex: 0,
        playerSquad: [createCombatant('player-1', true, 50)],
        enemySquad: [
          createCombatant('enemy-1', false, 100),
          createCombatant('enemy-2', false, 80),
          createCombatant('enemy-3', false, 60),
        ],
        turnCount: 1,
        canFlee: true,
        backgroundKey: 'battle-bg',
        rewards: null,
      }

      // Test all_enemies targeting
      const allEnemyTargets = TargetingSystem.resolveTargets(mockBattle, 'all_enemies', null, 'player-1')
      const damageMultiplier = TargetingSystem.getMultiTargetDamageMultiplier(allEnemyTargets.length)

      // Test adjacent_enemies targeting (middle target)
      const adjacentTargets = TargetingSystem.resolveTargets(mockBattle, 'adjacent_enemies', 'enemy-2', 'player-1')

      // Test random_enemies_2 targeting
      const randomTargets = TargetingSystem.resolveTargets(mockBattle, 'random_enemies_2', null, 'player-1')

      return {
        allEnemyTargetCount: allEnemyTargets.length,
        allEnemyTargetIds: [...allEnemyTargets],
        damageMultiplier,
        adjacentTargetCount: adjacentTargets.length,
        adjacentTargetIds: [...adjacentTargets],
        randomTargetCount: randomTargets.length,
      }
    })

    // All enemies targeting
    expect(result.allEnemyTargetCount).toBe(3)
    expect(result.allEnemyTargetIds).toContain('enemy-1')
    expect(result.allEnemyTargetIds).toContain('enemy-2')
    expect(result.allEnemyTargetIds).toContain('enemy-3')
    expect(result.damageMultiplier).toBe(0.75)

    // Adjacent enemies targeting (middle target hits all 3)
    expect(result.adjacentTargetCount).toBe(3)
    expect(result.adjacentTargetIds).toContain('enemy-1')
    expect(result.adjacentTargetIds).toContain('enemy-2')
    expect(result.adjacentTargetIds).toContain('enemy-3')

    // Random enemies targeting
    expect(result.randomTargetCount).toBe(2)
  })
})
