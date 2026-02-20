import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  loadEvolutionChains,
  getEvolutionChains,
  getChainForSpecies,
  getStageForSpecies,
  canEvolve,
  executeEvolution,
  getEvolutionPreview,
} from '../../../src/systems/EvolutionSystem'
import { loadSpeciesData } from '../../../src/systems/MonsterSystem'
import type { EvolutionChain, MonsterInstance, MonsterSpecies, CharacterStats } from '../../../src/models/types'

function makeStats(overrides?: Partial<CharacterStats>): CharacterStats {
  return {
    maxHp: 100,
    currentHp: 100,
    maxMp: 50,
    currentMp: 50,
    attack: 20,
    defense: 15,
    magicAttack: 18,
    magicDefense: 12,
    speed: 14,
    luck: 5,
    ...overrides,
  }
}

const mockSpeciesBase: MonsterSpecies = {
  speciesId: 'miniflame',
  name: 'Miniflame',
  description: 'A tiny fire creature',
  element: 'fire',
  rarity: 'common',
  baseStats: makeStats({ maxHp: 45, maxMp: 20, attack: 12, defense: 8, magicAttack: 15, magicDefense: 10, speed: 14, luck: 5 }),
  statGrowth: { hp: 5, mp: 3, attack: 2, defense: 1, magicAttack: 3, magicDefense: 2, speed: 1 },
  abilities: [
    { abilityId: 'ember', learnAtLevel: 1 },
    { abilityId: 'fire-blast', learnAtLevel: 8 },
  ],
  captureBaseDifficulty: 0.24,
  spriteKey: 'miniflame',
  obtainableVia: 'wild',
  evolutionChainId: 'fire-hand-drawn',
}

const mockSpeciesEvolved: MonsterSpecies = {
  speciesId: 'blazecheetah',
  name: 'Blazecheetah',
  description: 'A swift fire cat',
  element: 'fire',
  rarity: 'uncommon',
  baseStats: makeStats({ maxHp: 75, maxMp: 35, attack: 22, defense: 14, magicAttack: 25, magicDefense: 16, speed: 20, luck: 5 }),
  statGrowth: { hp: 7, mp: 4, attack: 3, defense: 2, magicAttack: 4, magicDefense: 2, speed: 2 },
  abilities: [
    { abilityId: 'ember', learnAtLevel: 1 },
    { abilityId: 'fire-blast', learnAtLevel: 8 },
    { abilityId: 'flame-rush', learnAtLevel: 12 },
  ],
  captureBaseDifficulty: 0.44,
  spriteKey: 'blazecheetah',
  obtainableVia: 'wild',
  evolutionChainId: 'fire-hand-drawn',
}

const mockSpeciesFinal: MonsterSpecies = {
  speciesId: 'emberwing',
  name: 'Emberwing',
  description: 'A majestic fire bird',
  element: 'fire',
  rarity: 'rare',
  baseStats: makeStats({ maxHp: 110, maxMp: 55, attack: 30, defense: 20, magicAttack: 35, magicDefense: 22, speed: 25, luck: 5 }),
  statGrowth: { hp: 9, mp: 5, attack: 4, defense: 3, magicAttack: 5, magicDefense: 3, speed: 3 },
  abilities: [
    { abilityId: 'ember', learnAtLevel: 1 },
    { abilityId: 'fire-blast', learnAtLevel: 8 },
    { abilityId: 'flame-rush', learnAtLevel: 12 },
    { abilityId: 'inferno', learnAtLevel: 20 },
  ],
  captureBaseDifficulty: 0.6,
  spriteKey: 'emberwing',
  obtainableVia: 'evolution',
  evolutionChainId: 'fire-hand-drawn',
}

const mockChain: EvolutionChain = {
  chainId: 'fire-hand-drawn',
  name: 'Fire Evolution Line',
  stages: [
    { speciesId: 'miniflame', order: 1, evolvesTo: 'blazecheetah', evolvesFrom: null, requiredLevel: 1, stardustCost: 0 },
    { speciesId: 'blazecheetah', order: 2, evolvesTo: 'emberwing', evolvesFrom: 'miniflame', requiredLevel: 12, stardustCost: 150 },
    { speciesId: 'emberwing', order: 3, evolvesTo: null, evolvesFrom: 'blazecheetah', requiredLevel: 20, stardustCost: 400 },
  ],
}

function makeMonster(overrides?: Partial<MonsterInstance>): MonsterInstance {
  return {
    instanceId: 'test-monster-1',
    speciesId: 'miniflame',
    nickname: null,
    level: 12,
    experience: 0,
    experienceToNextLevel: 100,
    stats: makeStats(),
    learnedAbilities: ['ember', 'fire-blast'],
    traits: [],
    bond: 50,
    isShiny: false,
    caughtAt: 'sunlit-village',
    caughtTimestamp: Date.now(),
    evolutionStage: 0,
    previousForms: [],
    ...overrides,
  }
}

describe('EvolutionSystem', () => {
  beforeEach(() => {
    loadEvolutionChains([mockChain])
    loadSpeciesData([mockSpeciesBase, mockSpeciesEvolved, mockSpeciesFinal])
  })

  describe('Registry', () => {
    it('should load and retrieve evolution chains', () => {
      const chains = getEvolutionChains()
      expect(chains).toHaveLength(1)
      expect(chains[0].chainId).toBe('fire-hand-drawn')
    })

    it('should find chain for a species in the chain', () => {
      const chain = getChainForSpecies('miniflame')
      expect(chain).not.toBeNull()
      expect(chain!.chainId).toBe('fire-hand-drawn')
    })

    it('should find chain for middle stage species', () => {
      const chain = getChainForSpecies('blazecheetah')
      expect(chain).not.toBeNull()
      expect(chain!.chainId).toBe('fire-hand-drawn')
    })

    it('should find chain for final stage species', () => {
      const chain = getChainForSpecies('emberwing')
      expect(chain).not.toBeNull()
    })

    it('should return null for species not in any chain', () => {
      const chain = getChainForSpecies('bubblefin')
      expect(chain).toBeNull()
    })

    it('should get stage for species', () => {
      const stage = getStageForSpecies('blazecheetah')
      expect(stage).not.toBeNull()
      expect(stage!.order).toBe(2)
      expect(stage!.evolvesTo).toBe('emberwing')
      expect(stage!.evolvesFrom).toBe('miniflame')
    })

    it('should return null stage for unknown species', () => {
      const stage = getStageForSpecies('unknown')
      expect(stage).toBeNull()
    })
  })

  describe('canEvolve', () => {
    it('should allow evolution when monster meets level and stardust requirements', () => {
      const monster = makeMonster({ speciesId: 'miniflame', level: 12 })
      const result = canEvolve(monster, 200)
      expect(result.canEvolve).toBe(true)
      expect(result.reason).toBeNull()
      expect(result.nextStage!.speciesId).toBe('blazecheetah')
      expect(result.stardustCost).toBe(150)
    })

    it('should reject evolution when level is too low', () => {
      const monster = makeMonster({ speciesId: 'miniflame', level: 5 })
      const result = canEvolve(monster, 200)
      expect(result.canEvolve).toBe(false)
      expect(result.reason).toBe('level_too_low')
      expect(result.requiredLevel).toBe(12)
    })

    it('should reject evolution when stardust is insufficient', () => {
      const monster = makeMonster({ speciesId: 'miniflame', level: 12 })
      const result = canEvolve(monster, 50)
      expect(result.canEvolve).toBe(false)
      expect(result.reason).toBe('not_enough_stardust')
      expect(result.stardustCost).toBe(150)
    })

    it('should report already_max for final stage species', () => {
      const monster = makeMonster({ speciesId: 'emberwing', level: 25 })
      const result = canEvolve(monster, 999)
      expect(result.canEvolve).toBe(false)
      expect(result.reason).toBe('already_max')
    })

    it('should report no_evolution for species not in any chain', () => {
      // Species exists but has no chain
      loadSpeciesData([
        mockSpeciesBase,
        mockSpeciesEvolved,
        mockSpeciesFinal,
        {
          ...mockSpeciesBase,
          speciesId: 'loner',
          evolutionChainId: null,
        },
      ])
      loadEvolutionChains([mockChain])
      const monster = makeMonster({ speciesId: 'loner', level: 20 })
      const result = canEvolve(monster, 999)
      expect(result.canEvolve).toBe(false)
    })

    it('should allow middle stage to evolve to final', () => {
      const monster = makeMonster({ speciesId: 'blazecheetah', level: 20 })
      const result = canEvolve(monster, 500)
      expect(result.canEvolve).toBe(true)
      expect(result.nextStage!.speciesId).toBe('emberwing')
      expect(result.stardustCost).toBe(400)
    })
  })

  describe('executeEvolution', () => {
    it('should return evolution result with correct species ids', () => {
      const monster = makeMonster({ speciesId: 'miniflame', level: 12 })
      const nextStage = mockChain.stages[1]
      const result = executeEvolution(monster, nextStage, mockSpeciesEvolved)

      expect(result.previousSpeciesId).toBe('miniflame')
      expect(result.newSpeciesId).toBe('blazecheetah')
      expect(result.stardustSpent).toBe(150)
    })

    it('should sometimes produce a bonus trait', () => {
      const monster = makeMonster({ speciesId: 'miniflame', level: 12 })
      const nextStage = mockChain.stages[1]

      // Run multiple times — at 30% chance we should get at least one trait
      let gotTrait = false
      for (let i = 0; i < 50; i++) {
        const result = executeEvolution(monster, nextStage, mockSpeciesEvolved)
        if (result.bonusTrait !== null) {
          gotTrait = true
          break
        }
      }
      expect(gotTrait).toBe(true)
    })

    it('should produce stat boosts', () => {
      const monster = makeMonster({ speciesId: 'miniflame', level: 12 })
      const nextStage = mockChain.stages[1]

      // Run multiple times — stat boosts should appear
      let gotBoost = false
      for (let i = 0; i < 20; i++) {
        const result = executeEvolution(monster, nextStage, mockSpeciesEvolved)
        if (result.statBoost !== null) {
          gotBoost = true
          // Verify boost values are positive
          for (const val of Object.values(result.statBoost)) {
            expect(val).toBeGreaterThan(0)
          }
          break
        }
      }
      expect(gotBoost).toBe(true)
    })
  })

  describe('getEvolutionPreview', () => {
    it('should project stats at current level with new species base', () => {
      const monster = makeMonster({ speciesId: 'miniflame', level: 12 })
      const preview = getEvolutionPreview(monster, mockSpeciesEvolved)

      expect(preview.currentStats).toEqual(monster.stats)
      // Projected stats should use new species base + growth * (level - 1)
      const levelsGained = 11 // level 12 - 1
      expect(preview.projectedStats.maxHp).toBe(75 + Math.floor(7 * levelsGained))
      expect(preview.projectedStats.attack).toBe(22 + Math.floor(3 * levelsGained))
    })

    it('should list new abilities available at current level', () => {
      const monster = makeMonster({ speciesId: 'miniflame', level: 12 })
      const preview = getEvolutionPreview(monster, mockSpeciesEvolved)

      expect(preview.newAbilities).toContain('ember')
      expect(preview.newAbilities).toContain('fire-blast')
      expect(preview.newAbilities).toContain('flame-rush')
    })

    it('should list possible bonus traits', () => {
      const monster = makeMonster({ speciesId: 'miniflame', level: 12 })
      const preview = getEvolutionPreview(monster, mockSpeciesEvolved)

      expect(preview.possibleTraits.length).toBeGreaterThan(0)
      expect(preview.possibleTraits).toContain('swift')
      expect(preview.possibleTraits).toContain('hardy')
    })
  })
})
