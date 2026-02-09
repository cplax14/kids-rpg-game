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
