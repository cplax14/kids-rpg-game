import type {
  BattleRewards,
  MonsterInstance,
  BreedingResult,
  PlayerCharacter,
  GameSettings,
  CaptureAttempt,
  QuestDefinition,
  QuestProgress,
  QuestRewards,
  AchievementDefinition,
  AchievementProgress,
  MonsterGear,
  MonsterGearSlot,
  WaveChallengeDefinition,
  WaveBattleState,
  BountyDefinition,
  BountyProgress,
  StreakReward,
} from '../models/types'

export const GAME_EVENTS = {
  // Battle
  BATTLE_START: 'battle:start',
  BATTLE_END: 'battle:end',
  BATTLE_TURN_START: 'battle:turn_start',
  BATTLE_TURN_END: 'battle:turn_end',
  BATTLE_VICTORY: 'battle:victory',
  BATTLE_DEFEAT: 'battle:defeat',
  BATTLE_FLEE: 'battle:flee',

  // Monster
  MONSTER_CAPTURED: 'monster:captured',
  MONSTER_DEFEATED: 'monster:defeated',
  MONSTER_LEVEL_UP: 'monster:level_up',
  MONSTER_ABILITY_LEARNED: 'monster:ability_learned',

  // Capture
  CAPTURE_ATTEMPT: 'capture:attempt',
  CAPTURE_SUCCESS: 'capture:success',
  CAPTURE_FAIL: 'capture:fail',

  // Bestiary
  BESTIARY_UPDATED: 'bestiary:updated',
  SPECIES_DISCOVERED: 'bestiary:species_discovered',

  // Bond
  BOND_INCREASED: 'bond:increased',

  // Player
  PLAYER_LEVEL_UP: 'player:level_up',
  PLAYER_DAMAGE: 'player:damage',
  PLAYER_HEAL: 'player:heal',

  // Inventory
  ITEM_ADDED: 'inventory:item_added',
  ITEM_REMOVED: 'inventory:item_removed',
  ITEM_USED: 'inventory:item_used',
  EQUIPMENT_CHANGED: 'inventory:equipment_changed',
  GOLD_CHANGED: 'inventory:gold_changed',

  // Squad
  SQUAD_CHANGED: 'squad:changed',
  SQUAD_MONSTER_ADDED: 'squad:monster_added',
  SQUAD_MONSTER_REMOVED: 'squad:monster_removed',

  // Monster Gear
  MONSTER_GEAR_EQUIPPED: 'monster:gear_equipped',
  MONSTER_GEAR_UNEQUIPPED: 'monster:gear_unequipped',

  // Wave Mode
  WAVE_COMPLETED: 'wave:completed',
  WAVE_CHALLENGE_COMPLETED: 'wave:challenge_completed',
  WAVE_CHALLENGE_FAILED: 'wave:challenge_failed',

  // Bounty Board
  BOUNTY_ACCEPTED: 'bounty:accepted',
  BOUNTY_COMPLETED: 'bounty:completed',
  BOUNTY_CLAIMED: 'bounty:claimed',
  BOUNTY_BOARD_REFRESHED: 'bounty:board_refreshed',
  BOUNTY_STREAK_UPDATED: 'bounty:streak_updated',

  // Breeding
  BREEDING_STARTED: 'breeding:started',
  BREEDING_COMPLETE: 'breeding:complete',

  // World
  AREA_TRANSITION: 'world:area_transition',
  NPC_INTERACT: 'world:npc_interact',
  OBJECT_INTERACT: 'world:object_interact',

  // Dialog
  DIALOG_START: 'dialog:start',
  DIALOG_END: 'dialog:end',

  // Save
  SAVE_GAME: 'save:game',
  LOAD_GAME: 'save:load',

  // UI
  NOTIFICATION: 'ui:notification',
  MENU_OPEN: 'ui:menu_open',
  MENU_CLOSE: 'ui:menu_close',

  // Quest
  QUEST_ACCEPTED: 'quest:accepted',
  QUEST_PROGRESS_UPDATED: 'quest:progress_updated',
  QUEST_OBJECTIVE_COMPLETE: 'quest:objective_complete',
  QUEST_READY_TO_TURN_IN: 'quest:ready_to_turn_in',
  QUEST_COMPLETED: 'quest:completed',

  // Audio
  MUSIC_PLAY: 'audio:music_play',
  SFX_PLAY: 'audio:sfx_play',

  // Achievement
  ACHIEVEMENT_UNLOCKED: 'achievement:unlocked',
  ACHIEVEMENT_PROGRESS: 'achievement:progress',

  // Fast Travel
  FAST_TRAVEL_REQUESTED: 'fast_travel:requested',
} as const

export type GameEventName = (typeof GAME_EVENTS)[keyof typeof GAME_EVENTS]

export interface GameEventPayloads {
  [GAME_EVENTS.BATTLE_START]: { areaId: string; enemySpeciesIds: ReadonlyArray<string> }
  [GAME_EVENTS.BATTLE_END]: { result: 'victory' | 'defeat' | 'fled' }
  [GAME_EVENTS.BATTLE_VICTORY]: { rewards: BattleRewards }
  [GAME_EVENTS.BATTLE_DEFEAT]: undefined
  [GAME_EVENTS.BATTLE_FLEE]: undefined
  [GAME_EVENTS.MONSTER_CAPTURED]: { monster: MonsterInstance }
  [GAME_EVENTS.MONSTER_DEFEATED]: { speciesId: string; experience: number }
  [GAME_EVENTS.PLAYER_LEVEL_UP]: { player: PlayerCharacter; newLevel: number }
  [GAME_EVENTS.MONSTER_LEVEL_UP]: { monster: MonsterInstance; newLevel: number }
  [GAME_EVENTS.ITEM_ADDED]: { itemId: string; quantity: number }
  [GAME_EVENTS.ITEM_USED]: { itemId: string }
  [GAME_EVENTS.GOLD_CHANGED]: { amount: number; newTotal: number }
  [GAME_EVENTS.BREEDING_COMPLETE]: { result: BreedingResult }
  [GAME_EVENTS.AREA_TRANSITION]: { fromAreaId: string; toAreaId: string }
  [GAME_EVENTS.NOTIFICATION]: { message: string; type: 'info' | 'success' | 'warning' }
  [GAME_EVENTS.MUSIC_PLAY]: { key: string }
  [GAME_EVENTS.SFX_PLAY]: { key: string }
  [GAME_EVENTS.SAVE_GAME]: { slot: number }
  [GAME_EVENTS.LOAD_GAME]: { slot: number }
  [GAME_EVENTS.MENU_OPEN]: { menuId: string }
  [GAME_EVENTS.MENU_CLOSE]: { menuId: string }

  // Capture events
  [GAME_EVENTS.CAPTURE_ATTEMPT]: { attempt: CaptureAttempt; shakeCount: number }
  [GAME_EVENTS.CAPTURE_SUCCESS]: { monster: MonsterInstance; attempt: CaptureAttempt }
  [GAME_EVENTS.CAPTURE_FAIL]: { attempt: CaptureAttempt; shakeCount: number }

  // Bestiary events
  [GAME_EVENTS.BESTIARY_UPDATED]: { discovered: ReadonlyArray<string>; newCount: number }
  [GAME_EVENTS.SPECIES_DISCOVERED]: { speciesId: string; speciesName: string }

  // Bond events
  [GAME_EVENTS.BOND_INCREASED]: { monster: MonsterInstance; amount: number; newLevel: number }

  // Quest events
  [GAME_EVENTS.QUEST_ACCEPTED]: { quest: QuestDefinition; progress: QuestProgress }
  [GAME_EVENTS.QUEST_PROGRESS_UPDATED]: { questId: string; objectiveId: string; current: number; required: number }
  [GAME_EVENTS.QUEST_OBJECTIVE_COMPLETE]: { questId: string; objectiveId: string }
  [GAME_EVENTS.QUEST_READY_TO_TURN_IN]: { quest: QuestDefinition; progress: QuestProgress }
  [GAME_EVENTS.QUEST_COMPLETED]: { quest: QuestDefinition; rewards: QuestRewards }

  // Achievement events
  [GAME_EVENTS.ACHIEVEMENT_UNLOCKED]: { achievement: AchievementDefinition; progress: AchievementProgress }
  [GAME_EVENTS.ACHIEVEMENT_PROGRESS]: { achievementId: string; progress: Record<string, number> }

  // Fast travel events
  [GAME_EVENTS.FAST_TRAVEL_REQUESTED]: { targetAreaId: string }

  // Monster gear events
  [GAME_EVENTS.MONSTER_GEAR_EQUIPPED]: { monster: MonsterInstance; gear: MonsterGear; slot: MonsterGearSlot }
  [GAME_EVENTS.MONSTER_GEAR_UNEQUIPPED]: { monster: MonsterInstance; gear: MonsterGear; slot: MonsterGearSlot }

  // Wave mode events
  [GAME_EVENTS.WAVE_COMPLETED]: { waveNumber: number; totalWaves: number; rewards: QuestRewards }
  [GAME_EVENTS.WAVE_CHALLENGE_COMPLETED]: { challenge: WaveChallengeDefinition; state: WaveBattleState; totalRewards: QuestRewards }
  [GAME_EVENTS.WAVE_CHALLENGE_FAILED]: { challenge: WaveChallengeDefinition; state: WaveBattleState; waveReached: number }

  // Bounty board events
  [GAME_EVENTS.BOUNTY_ACCEPTED]: { bounty: BountyDefinition; progress: BountyProgress }
  [GAME_EVENTS.BOUNTY_COMPLETED]: { bounty: BountyDefinition; progress: BountyProgress }
  [GAME_EVENTS.BOUNTY_CLAIMED]: { bounty: BountyDefinition; rewards: QuestRewards; streak: StreakReward | null }
  [GAME_EVENTS.BOUNTY_BOARD_REFRESHED]: { availableBounties: ReadonlyArray<string>; date: string }
  [GAME_EVENTS.BOUNTY_STREAK_UPDATED]: { previousStreak: number; newStreak: number; streakReward: StreakReward | null }
}
