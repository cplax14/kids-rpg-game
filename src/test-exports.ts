/**
 * Exports for E2E testing
 * This file exposes game systems to the window object for Playwright tests
 * Only included in development builds
 */

import * as MonsterSystem from './systems/MonsterSystem'
import * as BreedingSystem from './systems/BreedingSystem'
import * as WorldSystem from './systems/WorldSystem'
import * as TraitSystem from './systems/TraitSystem'
import * as CombatSystem from './systems/CombatSystem'
import * as TargetingSystem from './systems/TargetingSystem'
import * as Constants from './models/constants'

// Type declaration for global test exports
declare global {
  interface Window {
    __TEST_EXPORTS__?: {
      MonsterSystem: typeof MonsterSystem
      BreedingSystem: typeof BreedingSystem
      WorldSystem: typeof WorldSystem
      TraitSystem: typeof TraitSystem
      CombatSystem: typeof CombatSystem
      TargetingSystem: typeof TargetingSystem
      Constants: typeof Constants
    }
  }
}

// Only expose in development mode
if (import.meta.env.DEV) {
  window.__TEST_EXPORTS__ = {
    MonsterSystem,
    BreedingSystem,
    WorldSystem,
    TraitSystem,
    CombatSystem,
    TargetingSystem,
    Constants,
  }
}

export {}
