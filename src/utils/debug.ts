/**
 * Debug utilities for development testing
 * Access via browser console: window.debug.setLevel(5)
 */

import type { GameState } from '../systems/GameStateManager'

// Will be set by WorldScene when it initializes
let gameSceneRef: Phaser.Scene | null = null
let getGameStateFn: ((scene: Phaser.Scene) => GameState) | null = null
let setGameStateFn: ((scene: Phaser.Scene, state: GameState) => void) | null = null

export function initDebug(
  scene: Phaser.Scene,
  getState: (scene: Phaser.Scene) => GameState,
  setState: (scene: Phaser.Scene, state: GameState) => void,
): void {
  gameSceneRef = scene
  getGameStateFn = getState
  setGameStateFn = setState

  // Expose debug commands to window
  const debugCommands = {
    setLevel: (level: number) => {
      if (!gameSceneRef || !getGameStateFn || !setGameStateFn) {
        console.error('Debug: Game not initialized')
        return
      }
      const state = getGameStateFn(gameSceneRef)
      const newState: GameState = {
        ...state,
        player: {
          ...state.player,
          level: Math.max(1, Math.min(100, level)),
        },
      }
      setGameStateFn(gameSceneRef, newState)
      console.log(`Debug: Player level set to ${level}`)
    },

    addGold: (amount: number) => {
      if (!gameSceneRef || !getGameStateFn || !setGameStateFn) {
        console.error('Debug: Game not initialized')
        return
      }
      const state = getGameStateFn(gameSceneRef)
      const newState: GameState = {
        ...state,
        player: {
          ...state.player,
          gold: Math.max(0, state.player.gold + amount),
        },
      }
      setGameStateFn(gameSceneRef, newState)
      console.log(`Debug: Added ${amount} gold. Total: ${newState.player.gold}`)
    },

    addXp: (amount: number) => {
      if (!gameSceneRef || !getGameStateFn || !setGameStateFn) {
        console.error('Debug: Game not initialized')
        return
      }
      const state = getGameStateFn(gameSceneRef)
      const newState: GameState = {
        ...state,
        player: {
          ...state.player,
          experience: state.player.experience + amount,
        },
      }
      setGameStateFn(gameSceneRef, newState)
      console.log(`Debug: Added ${amount} XP. Total: ${newState.player.experience}`)
    },

    getState: () => {
      if (!gameSceneRef || !getGameStateFn) {
        console.error('Debug: Game not initialized')
        return null
      }
      const state = getGameStateFn(gameSceneRef)
      console.log('Current game state:', state)
      return state
    },

    teleport: (areaId: string) => {
      if (!gameSceneRef) {
        console.error('Debug: Game not initialized')
        return
      }
      gameSceneRef.scene.start('WorldScene', {
        newGame: false,
        areaId,
        spawnPosition: { x: 200, y: 200 },
      })
      console.log(`Debug: Teleporting to ${areaId}`)
    },

    listAreas: () => {
      console.log('Available areas: sunlit-village, whispering-forest, crystal-caves, sunfire-plains')
    },

    healAll: () => {
      if (!gameSceneRef || !getGameStateFn || !setGameStateFn) {
        console.error('Debug: Game not initialized')
        return
      }
      const state = getGameStateFn(gameSceneRef)
      const healedSquad = state.squad.map((m) => ({
        ...m,
        stats: {
          ...m.stats,
          currentHp: m.stats.maxHp,
          currentMp: m.stats.maxMp,
        },
      }))
      const newState: GameState = {
        ...state,
        squad: healedSquad,
        player: {
          ...state.player,
          stats: {
            ...state.player.stats,
            currentHp: state.player.stats.maxHp,
            currentMp: state.player.stats.maxMp,
          },
        },
      }
      setGameStateFn(gameSceneRef, newState)
      console.log('Debug: All party members healed')
    },

    help: () => {
      console.log(`
Debug Commands:
  debug.setLevel(n)    - Set player level (1-100)
  debug.addGold(n)     - Add gold
  debug.addXp(n)       - Add experience points
  debug.healAll()      - Heal all party members
  debug.teleport(id)   - Teleport to area
  debug.listAreas()    - List available areas
  debug.getState()     - Print current game state
  debug.help()         - Show this help
      `)
    },
  }

  ;(window as unknown as { debug: typeof debugCommands }).debug = debugCommands
  console.log('Debug mode enabled. Type debug.help() for commands.')
}
