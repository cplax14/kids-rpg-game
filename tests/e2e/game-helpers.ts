import { Page, expect } from '@playwright/test'

/**
 * Helper functions for interacting with the Phaser game in E2E tests
 */

export async function waitForGameLoad(page: Page): Promise<void> {
  // Wait for the Phaser canvas to be present
  await page.waitForSelector('canvas', { timeout: 30000 })

  // Wait for the game to fully load (title screen should be active)
  // We check by waiting for game state to be initialized
  await page.waitForFunction(
    () => {
      const game = (window as unknown as { game?: { scene?: { scenes?: unknown[] } } }).game
      return game && game.scene && game.scene.scenes && game.scene.scenes.length > 0
    },
    { timeout: 30000 },
  )
}

export async function getGameState(page: Page): Promise<unknown> {
  return await page.evaluate(() => {
    const game = (window as unknown as { game?: unknown }).game
    return game
  })
}

export async function waitForScene(page: Page, sceneName: string): Promise<void> {
  await page.waitForFunction(
    (name: string) => {
      const game = (window as unknown as { game?: { scene?: { isActive?: (name: string) => boolean } } }).game
      return game?.scene?.isActive?.(name) === true
    },
    sceneName,
    { timeout: 15000 },
  )
}

export async function clickCanvas(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.locator('canvas')
  await canvas.click({ position: { x, y } })
}

export async function pressKey(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key)
}

export async function typeText(page: Page, text: string): Promise<void> {
  await page.keyboard.type(text)
}

/**
 * Execute JavaScript in the game context
 */
export async function executeInGame<T>(page: Page, fn: () => T): Promise<T> {
  return await page.evaluate(fn)
}

/**
 * Get monster data from the game state manager
 */
export async function getSquadMonsters(page: Page): Promise<unknown[]> {
  return await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gameState = (window as any).__GAME_STATE__
    return gameState?.squad || []
  })
}

/**
 * Get breeding system state
 */
export async function getBreedingState(page: Page): Promise<unknown> {
  return await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gameState = (window as any).__GAME_STATE__
    return {
      squad: gameState?.squad || [],
      storage: gameState?.monsterStorage || [],
    }
  })
}

/**
 * Wait for test exports to be available
 */
export async function waitForTestExports(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as { __TEST_EXPORTS__?: unknown }).__TEST_EXPORTS__ !== undefined,
    { timeout: 15000 },
  )
}

/**
 * Reset tutorial completion state for clean testing
 */
export async function resetTutorials(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('completed-tutorials')
  })
}

/**
 * Check if a specific tutorial is marked as complete
 */
export async function isTutorialComplete(page: Page, tutorialId: string): Promise<boolean> {
  return await page.evaluate((id) => {
    const saved = localStorage.getItem('completed-tutorials')
    if (!saved) return false
    const completed = JSON.parse(saved) as string[]
    return completed.includes(id)
  }, tutorialId)
}

/**
 * Mark a tutorial as complete
 */
export async function markTutorialComplete(page: Page, tutorialId: string): Promise<void> {
  await page.evaluate((id) => {
    const saved = localStorage.getItem('completed-tutorials')
    const completed = saved ? JSON.parse(saved) : []
    if (!completed.includes(id)) {
      completed.push(id)
      localStorage.setItem('completed-tutorials', JSON.stringify(completed))
    }
  }, tutorialId)
}

/**
 * Get battle state from BattleScene
 */
export async function getBattleState(page: Page): Promise<{
  isActive: boolean
  enemyCount: number
  enemies: Array<{ name: string; currentHp: number; maxHp: number; hpPercent: number }>
  playerCount: number
  phase: string
}> {
  return await page.evaluate(() => {
    const game = (window as unknown as { game?: Phaser.Game }).game
    if (!game) {
      return { isActive: false, enemyCount: 0, enemies: [], playerCount: 0, phase: 'unknown' }
    }

    const battleScene = game.scene.getScene('BattleScene') as Phaser.Scene & {
      battle?: {
        enemySquad: ReadonlyArray<{
          name: string
          stats: { currentHp: number; maxHp: number }
        }>
        playerSquad: ReadonlyArray<unknown>
      }
      phase?: string
    }

    const isActive = game.scene.isActive('BattleScene')
    if (!isActive || !battleScene?.battle) {
      return { isActive, enemyCount: 0, enemies: [], playerCount: 0, phase: 'unknown' }
    }

    const enemies = battleScene.battle.enemySquad.map((e) => ({
      name: e.name,
      currentHp: e.stats.currentHp,
      maxHp: e.stats.maxHp,
      hpPercent: e.stats.maxHp > 0 ? (e.stats.currentHp / e.stats.maxHp) * 100 : 0,
    }))

    return {
      isActive: true,
      enemyCount: enemies.length,
      enemies,
      playerCount: battleScene.battle.playerSquad.length,
      phase: battleScene.phase ?? 'unknown',
    }
  })
}

/**
 * Check if capture hint tooltip is currently visible
 */
export async function isCaptureHintVisible(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const game = (window as unknown as { game?: Phaser.Game }).game
    if (!game) return false

    const battleScene = game.scene.getScene('BattleScene') as Phaser.Scene & {
      activeTooltip?: { container?: Phaser.GameObjects.Container }
    }

    return battleScene?.activeTooltip?.container?.visible === true
  })
}

/**
 * Check if capture button is highlighted in battle HUD
 */
export async function isCaptureButtonHighlighted(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const game = (window as unknown as { game?: Phaser.Game }).game
    if (!game) return false

    const battleScene = game.scene.getScene('BattleScene') as Phaser.Scene & {
      hud?: {
        highlightGraphics?: Phaser.GameObjects.Graphics | null
      }
    }

    return (
      battleScene?.hud?.highlightGraphics !== null &&
      battleScene?.hud?.highlightGraphics !== undefined
    )
  })
}

/**
 * Get canvas dimensions
 */
export async function getCanvasDimensions(page: Page): Promise<{ width: number; height: number }> {
  const canvas = page.locator('canvas')
  const box = await canvas.boundingBox()
  return {
    width: box?.width ?? 1280,
    height: box?.height ?? 960,
  }
}

/**
 * Click a battle command button by name
 * Commands layout: 2x3 grid (attack, ability, item, capture, defend, flee)
 */
export async function clickBattleCommand(
  page: Page,
  command: 'attack' | 'ability' | 'item' | 'capture' | 'defend' | 'flee',
): Promise<void> {
  const commands = ['attack', 'ability', 'item', 'capture', 'defend', 'flee']
  const index = commands.indexOf(command)
  if (index === -1) return

  const col = index % 2
  const row = Math.floor(index / 2)

  // Button dimensions from BattleHUD
  const btnWidth = 125
  const btnHeight = 52
  const btnSpacing = 60
  const menuX = 20
  const menuPadding = 15

  const { height } = await getCanvasDimensions(page)
  const menuY = height - 260

  const x = menuX + menuPadding + col * (btnWidth + 10) + btnWidth / 2
  const y = menuY + 12 + row * btnSpacing + btnHeight / 2

  await clickCanvas(page, x, y)
  await page.waitForTimeout(200)
}
