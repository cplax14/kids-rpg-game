import type {
  WaveChallengeDefinition,
  WaveDefinition,
  WaveBattleState,
  WaveEnemyEntry,
  QuestRewards,
  QuestRewardItem,
  BattleCombatant,
} from '../models/types'
import { EventBus } from '../events/EventBus'
import { GAME_EVENTS } from '../events/GameEvents'
import { createCombatantFromEnemy } from './CombatSystem'
import { createMonsterInstance, getSpecies } from './MonsterSystem'

// ── Wave Challenge Registry ──

let challengeRegistry: ReadonlyArray<WaveChallengeDefinition> = []

export function loadWaveChallengeData(challenges: ReadonlyArray<WaveChallengeDefinition>): void {
  challengeRegistry = challenges
}

export function getChallenge(challengeId: string): WaveChallengeDefinition | undefined {
  return challengeRegistry.find((c) => c.challengeId === challengeId)
}

export function getAllChallenges(): ReadonlyArray<WaveChallengeDefinition> {
  return challengeRegistry
}

export function clearWaveChallengeRegistry(): void {
  challengeRegistry = []
}

// ── State Management ──

export function createWaveBattleState(challengeId: string): WaveBattleState | null {
  const challenge = getChallenge(challengeId)
  if (!challenge) {
    return null
  }

  return {
    challengeId,
    currentWave: 1,
    totalWaves: challenge.waves.length,
    accumulatedRewards: createEmptyRewards(),
  }
}

export function advanceToNextWave(state: WaveBattleState): WaveBattleState {
  return {
    ...state,
    currentWave: state.currentWave + 1,
  }
}

export function getCurrentWaveDefinition(
  state: WaveBattleState,
  challenge: WaveChallengeDefinition,
): WaveDefinition | null {
  const wave = challenge.waves.find((w) => w.waveNumber === state.currentWave)
  return wave ?? null
}

export function isLastWave(
  state: WaveBattleState,
  challenge: WaveChallengeDefinition,
): boolean {
  return state.currentWave >= challenge.waves.length
}

// ── Rewards ──

function createEmptyRewards(): QuestRewards {
  return {
    experience: 0,
    gold: 0,
    items: [],
    equipmentId: null,
  }
}

export function accumulateWaveRewards(
  state: WaveBattleState,
  waveRewards: QuestRewards,
): WaveBattleState {
  const mergedItems = mergeRewardItems(
    state.accumulatedRewards.items,
    waveRewards.items,
  )

  return {
    ...state,
    accumulatedRewards: {
      experience: state.accumulatedRewards.experience + waveRewards.experience,
      gold: state.accumulatedRewards.gold + waveRewards.gold,
      items: mergedItems,
      equipmentId: waveRewards.equipmentId ?? state.accumulatedRewards.equipmentId,
    },
  }
}

function mergeRewardItems(
  existing: ReadonlyArray<QuestRewardItem>,
  newItems: ReadonlyArray<QuestRewardItem>,
): ReadonlyArray<QuestRewardItem> {
  const itemMap = new Map<string, number>()

  // Add existing items
  for (const item of existing) {
    itemMap.set(item.itemId, (itemMap.get(item.itemId) ?? 0) + item.quantity)
  }

  // Add new items
  for (const item of newItems) {
    itemMap.set(item.itemId, (itemMap.get(item.itemId) ?? 0) + item.quantity)
  }

  // Convert back to array
  return Array.from(itemMap.entries()).map(([itemId, quantity]) => ({
    itemId,
    quantity,
  }))
}

export function calculateFinalRewards(
  state: WaveBattleState,
  challenge: WaveChallengeDefinition,
): QuestRewards {
  // Combine accumulated wave rewards with final rewards
  const finalItems = mergeRewardItems(
    state.accumulatedRewards.items,
    challenge.finalRewards.items,
  )

  return {
    experience: state.accumulatedRewards.experience + challenge.finalRewards.experience,
    gold: state.accumulatedRewards.gold + challenge.finalRewards.gold,
    items: finalItems,
    equipmentId: challenge.finalRewards.equipmentId ?? state.accumulatedRewards.equipmentId,
  }
}

// ── Enemy Generation ──

export function generateWaveEnemies(wave: WaveDefinition): ReadonlyArray<BattleCombatant> {
  const enemies: BattleCombatant[] = []

  for (const entry of wave.enemies) {
    for (let i = 0; i < entry.count; i++) {
      const combatant = createWaveEnemy(entry, wave.difficultyMultiplier, enemies.length)
      if (combatant) {
        enemies.push(combatant)
      }
    }
  }

  return enemies
}

function createWaveEnemy(
  entry: WaveEnemyEntry,
  difficultyMultiplier: number,
  index: number,
): BattleCombatant | null {
  const species = getSpecies(entry.speciesId)
  if (!species) {
    return null
  }

  const monster = createMonsterInstance(entry.speciesId, entry.level)
  if (!monster) {
    return null
  }

  // Apply difficulty multiplier to stats
  const scaledStats = {
    ...monster.stats,
    maxHp: Math.floor(monster.stats.maxHp * difficultyMultiplier),
    currentHp: Math.floor(monster.stats.maxHp * difficultyMultiplier),
    attack: Math.floor(monster.stats.attack * difficultyMultiplier),
    defense: Math.floor(monster.stats.defense * difficultyMultiplier),
    magicAttack: Math.floor(monster.stats.magicAttack * difficultyMultiplier),
    magicDefense: Math.floor(monster.stats.magicDefense * difficultyMultiplier),
    speed: Math.floor(monster.stats.speed * difficultyMultiplier),
  }

  return {
    combatantId: `wave-enemy-${index}`,
    name: species.name,
    isPlayer: false,
    isMonster: true,
    speciesId: entry.speciesId,
    stats: scaledStats,
    abilities: monster.learnedAbilities,
    statusEffects: [],
    cooldowns: [],
    capturable: false, // Wave mode enemies are not capturable
  }
}

// ── Event Helpers ──

export function emitWaveCompleted(
  waveNumber: number,
  totalWaves: number,
  rewards: QuestRewards,
): void {
  EventBus.emit(GAME_EVENTS.WAVE_COMPLETED, {
    waveNumber,
    totalWaves,
    rewards,
  })
}

export function emitChallengeCompleted(
  challenge: WaveChallengeDefinition,
  state: WaveBattleState,
  totalRewards: QuestRewards,
): void {
  EventBus.emit(GAME_EVENTS.WAVE_CHALLENGE_COMPLETED, {
    challenge,
    state,
    totalRewards,
  })
}

export function emitChallengeFailed(
  challenge: WaveChallengeDefinition,
  state: WaveBattleState,
): void {
  EventBus.emit(GAME_EVENTS.WAVE_CHALLENGE_FAILED, {
    challenge,
    state,
    waveReached: state.currentWave,
  })
}

// ── Challenge Checks ──

export function canAttemptChallenge(
  challengeId: string,
  playerLevel: number,
): { canAttempt: boolean; reason: string | null } {
  const challenge = getChallenge(challengeId)
  if (!challenge) {
    return { canAttempt: false, reason: 'Challenge not found' }
  }

  if (playerLevel < challenge.recommendedLevel - 5) {
    return {
      canAttempt: false,
      reason: `Recommended level: ${challenge.recommendedLevel}. Your level might be too low.`,
    }
  }

  return { canAttempt: true, reason: null }
}

// ── Challenge Summary ──

export interface ChallengeSummary {
  readonly challengeId: string
  readonly name: string
  readonly description: string
  readonly recommendedLevel: number
  readonly waveCount: number
  readonly totalEnemies: number
  readonly estimatedDifficulty: 'easy' | 'medium' | 'hard' | 'extreme'
}

export function getChallengeSummary(challengeId: string): ChallengeSummary | null {
  const challenge = getChallenge(challengeId)
  if (!challenge) {
    return null
  }

  const totalEnemies = challenge.waves.reduce(
    (sum, wave) => sum + wave.enemies.reduce((e, entry) => e + entry.count, 0),
    0,
  )

  // Calculate difficulty based on wave count, enemy count, and multipliers
  const avgMultiplier = challenge.waves.reduce(
    (sum, wave) => sum + wave.difficultyMultiplier,
    0,
  ) / challenge.waves.length

  let difficulty: 'easy' | 'medium' | 'hard' | 'extreme' = 'easy'
  if (challenge.waves.length >= 5 || avgMultiplier >= 1.5) {
    difficulty = 'extreme'
  } else if (challenge.waves.length >= 4 || avgMultiplier >= 1.3) {
    difficulty = 'hard'
  } else if (challenge.waves.length >= 3 || avgMultiplier >= 1.1) {
    difficulty = 'medium'
  }

  return {
    challengeId: challenge.challengeId,
    name: challenge.name,
    description: challenge.description,
    recommendedLevel: challenge.recommendedLevel,
    waveCount: challenge.waves.length,
    totalEnemies,
    estimatedDifficulty: difficulty,
  }
}
