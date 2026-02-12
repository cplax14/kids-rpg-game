import { z } from 'zod/v4'

// ── Primitives ──

export const MonsterElementSchema = z.enum([
  'fire',
  'water',
  'earth',
  'wind',
  'light',
  'dark',
  'neutral',
])

export const MonsterRaritySchema = z.enum(['common', 'uncommon', 'rare', 'legendary'])

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
})

// ── Stats ──

export const CharacterStatsSchema = z.object({
  maxHp: z.number().int().min(1),
  currentHp: z.number().int().min(0),
  maxMp: z.number().int().min(0),
  currentMp: z.number().int().min(0),
  attack: z.number().int().min(0),
  defense: z.number().int().min(0),
  magicAttack: z.number().int().min(0),
  magicDefense: z.number().int().min(0),
  speed: z.number().int().min(0),
  luck: z.number().int().min(0),
})

export const StatGrowthRatesSchema = z.object({
  hp: z.number().min(0),
  mp: z.number().min(0),
  attack: z.number().min(0),
  defense: z.number().min(0),
  magicAttack: z.number().min(0),
  magicDefense: z.number().min(0),
  speed: z.number().min(0),
})

// ── Abilities ──

export const StatusEffectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum([
    'poison',
    'sleep',
    'slow',
    'haste',
    'shield',
    'regen',
    'attack_up',
    'defense_up',
  ]),
  duration: z.number().int().min(1),
  magnitude: z.number().min(0),
})

export const AbilitySchema = z.object({
  abilityId: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  element: MonsterElementSchema,
  type: z.enum(['physical', 'magical', 'status', 'healing']),
  power: z.number().min(0),
  accuracy: z.number().min(0).max(100),
  mpCost: z.number().int().min(0),
  targetType: z.enum([
    'single_enemy',
    'all_enemies',
    'self',
    'single_ally',
    'all_allies',
    'adjacent_enemies',
    'random_enemies_2',
    'random_enemies_3',
  ]),
  statusEffect: StatusEffectSchema.nullable(),
  animation: z.string(),
})

export const LearnableAbilitySchema = z.object({
  abilityId: z.string().min(1),
  learnAtLevel: z.number().int().min(1),
})

// ── Monsters ──

export const EvolutionStageSchema = z.object({
  evolvesTo: z.string().min(1),
  levelRequired: z.number().int().min(1),
  itemRequired: z.string().nullable(),
})

export const ObtainableViaSchema = z.enum(['wild', 'breeding', 'both'])

export const MonsterSpeciesSchema = z.object({
  speciesId: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  element: MonsterElementSchema,
  rarity: MonsterRaritySchema,
  baseStats: CharacterStatsSchema,
  statGrowth: StatGrowthRatesSchema,
  abilities: z.array(LearnableAbilitySchema),
  captureBaseDifficulty: z.number().min(0).max(1),
  spriteKey: z.string().min(1),
  evolutionChain: EvolutionStageSchema.nullable(),
  breedingGroup: z.string().min(1),
  breedingTraits: z.array(z.string()),
  obtainableVia: ObtainableViaSchema.default('both'),
})

// ── Items ──

export const ItemEffectSchema = z.object({
  type: z.enum(['heal_hp', 'heal_mp', 'cure_status', 'buff', 'capture_boost', 'breeding_boost']),
  magnitude: z.number().min(0),
  targetType: z.enum(['self', 'single_ally', 'single_monster']),
})

export const ItemSchema = z.object({
  itemId: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  category: z.enum(['consumable', 'capture_device', 'key_item', 'breeding_item', 'material']),
  iconKey: z.string().min(1),
  stackable: z.boolean(),
  maxStack: z.number().int().min(1),
  useEffect: ItemEffectSchema.nullable(),
  buyPrice: z.number().int().min(0),
  sellPrice: z.number().int().min(0),
})

export const EquipmentSchema = z.object({
  equipmentId: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  slot: z.enum(['weapon', 'armor', 'helmet', 'accessory']),
  statModifiers: CharacterStatsSchema.partial(),
  levelRequirement: z.number().int().min(1),
  iconKey: z.string().min(1),
  buyPrice: z.number().int().min(0),
  sellPrice: z.number().int().min(0),
  specialEffect: z.string().nullable(),
})

// ── Encounters ──

export const EncounterEntrySchema = z.object({
  speciesId: z.string().min(1),
  levelRange: z
    .object({
      min: z.number().int().min(1),
      max: z.number().int().min(1),
    })
    .check(
      z.refine((data) => data.max >= data.min, {
        message: 'max must be greater than or equal to min',
      }),
    ),
  weight: z.number().min(0),
})

export const EncounterTableSchema = z.object({
  zoneId: z.string().min(1),
  monsters: z.array(EncounterEntrySchema),
  encounterRate: z.number().int().min(1),
})

// ── Area ──

export const NpcDefinitionSchema = z.object({
  npcId: z.string().min(1),
  name: z.string().min(1),
  spriteKey: z.string().min(1),
  position: PositionSchema,
  dialogTreeId: z.string().min(1),
  type: z.enum(['quest', 'shop', 'info', 'breeder', 'healer']),
})

export const AreaConnectionSchema = z.object({
  targetAreaId: z.string().min(1),
  triggerZone: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number().min(1),
    height: z.number().min(1),
  }),
  spawnPosition: PositionSchema,
})

export const GameAreaSchema = z.object({
  areaId: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  tilemapKey: z.string().min(1),
  tilesetKeys: z.array(z.string().min(1)),
  backgroundMusicKey: z.string(),
  encounters: z.array(EncounterTableSchema),
  npcs: z.array(NpcDefinitionSchema),
  connections: z.array(AreaConnectionSchema),
  requiredLevel: z.number().int().min(0),
  isSafeZone: z.boolean(),
})

// ── Interactables ──

export const InteractableTypeSchema = z.enum(['chest', 'sign', 'fountain', 'waypoint'])

export const WaypointTypeSchema = z.enum(['return', 'hub'])

export const ItemDropSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().min(1),
})

export const ChestContentsSchema = z.object({
  items: z.array(ItemDropSchema),
  gold: z.number().int().min(0),
})

export const InteractableBaseSchema = z.object({
  objectId: z.string().min(1),
  type: InteractableTypeSchema,
  position: PositionSchema,
  isOneTime: z.boolean(),
})

export const ChestObjectSchema = InteractableBaseSchema.extend({
  type: z.literal('chest'),
  contents: ChestContentsSchema,
})

export const SignObjectSchema = InteractableBaseSchema.extend({
  type: z.literal('sign'),
  message: z.array(z.string()),
})

export const FountainObjectSchema = InteractableBaseSchema.extend({
  type: z.literal('fountain'),
  healPercent: z.number().min(0).max(1),
  healsSquad: z.boolean(),
})

export const WaypointObjectSchema = InteractableBaseSchema.extend({
  type: z.literal('waypoint'),
  waypointType: WaypointTypeSchema,
  targetAreaId: z.string().min(1).optional(),
})

export const InteractableObjectSchema = z.union([
  ChestObjectSchema,
  SignObjectSchema,
  FountainObjectSchema,
  WaypointObjectSchema,
])

// ── Area Transitions ──

export const TransitionZoneSchema = z.object({
  zoneId: z.string().min(1),
  targetAreaId: z.string().min(1),
  targetPosition: PositionSchema,
  triggerBounds: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number().min(1),
    height: z.number().min(1),
  }),
  requiredLevel: z.number().int().min(0).optional(),
  requiredBossDefeated: z.string().optional(),
})

// ── Boss System ──

export const BossRewardsSchema = z.object({
  experience: z.number().int().min(0),
  gold: z.number().int().min(0),
  guaranteedItems: z.array(ItemDropSchema),
  unlocksArea: z.string().optional(),
})

export const BossDefinitionSchema = z.object({
  bossId: z.string().min(1),
  speciesId: z.string().min(1),
  name: z.string().min(1),
  title: z.string().min(1),
  level: z.number().int().min(1),
  areaId: z.string().min(1),
  position: PositionSchema,
  introDialog: z.array(z.string()),
  defeatDialog: z.array(z.string()),
  rewards: BossRewardsSchema,
})

// ── Extended Area Definition ──

export const TerrainTypeSchema = z.enum(['village', 'forest', 'cave', 'volcano', 'grotto', 'swamp'])

export const AreaEncounterEntrySchema = z.object({
  speciesId: z.string().min(1),
  weight: z.number().min(0),
  minLevel: z.number().int().min(1),
  maxLevel: z.number().int().min(1),
})

export const GameAreaDefinitionSchema = z.object({
  areaId: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  recommendedLevel: z.number().int().min(0),
  isSafeZone: z.boolean(),
  mapWidth: z.number().int().min(1),
  mapHeight: z.number().int().min(1),
  terrainType: TerrainTypeSchema,
  encounters: z.array(AreaEncounterEntrySchema),
  transitions: z.array(TransitionZoneSchema),
  interactables: z.array(InteractableObjectSchema),
  bossIds: z.array(z.string()),
  ambientColor: z.number().int().optional(),
})

// ── Traits ──

export const TraitRaritySchema = z.enum(['common', 'rare', 'mutation'])

export const TraitDefinitionSchema = z.object({
  traitId: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  statModifiers: CharacterStatsSchema.partial(),
  rarity: TraitRaritySchema,
})

// ── Breeding Recipes ──

export const BreedingOffspringOptionSchema = z.object({
  speciesId: z.string().min(1),
  probability: z.number().min(0).max(1),
  bonusTraits: z.array(z.string()),
})

export const BreedingRecipeSchema = z.object({
  recipeId: z.string().min(1),
  parents: z.tuple([z.string().min(1), z.string().min(1)]),
  offspring: z.array(BreedingOffspringOptionSchema),
  requiredCompatibility: z.number().min(0).max(1),
})

// ── Save Game ──

export const GameSettingsSchema = z.object({
  musicVolume: z.number().min(0).max(1),
  sfxVolume: z.number().min(0).max(1),
  textSpeed: z.enum(['slow', 'normal', 'fast']),
  screenShake: z.boolean(),
})

// ── Quest System ──

export const QuestTypeSchema = z.enum(['defeat', 'collect', 'boss', 'explore', 'talk'])
export const QuestStatusSchema = z.enum(['available', 'active', 'completed', 'turned_in'])

export const QuestObjectiveSchema = z.object({
  objectiveId: z.string().min(1),
  type: QuestTypeSchema,
  targetId: z.string().min(1),
  targetName: z.string().min(1),
  requiredCount: z.number().int().min(1),
  description: z.string(),
})

export const QuestRewardItemSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().min(1),
})

export const QuestRewardsSchema = z.object({
  experience: z.number().int().min(0),
  gold: z.number().int().min(0),
  items: z.array(QuestRewardItemSchema),
  equipmentId: z.string().nullable(),
})

export const QuestDefinitionSchema = z.object({
  questId: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  giverNpcId: z.string().min(1),
  turnInNpcId: z.string().min(1),
  recommendedLevel: z.number().int().min(1),
  objectives: z.array(QuestObjectiveSchema),
  rewards: QuestRewardsSchema,
  rewardEquipmentTier: z.number().int().min(1).max(5),
  rewardEquipmentSlots: z.array(z.enum(['weapon', 'armor', 'helmet', 'accessory'])),
  prerequisiteQuestIds: z.array(z.string()),
  isRepeatable: z.boolean(),
  celebrationMessage: z.string(),
})

export const QuestProgressSchema = z.object({
  questId: z.string().min(1),
  status: QuestStatusSchema,
  objectiveProgress: z.record(z.string(), z.number().int().min(0)),
  acceptedAt: z.string(),
  completedAt: z.string().nullable(),
})

// ── Achievement System ──

export const AchievementCategorySchema = z.enum([
  'combat',
  'collection',
  'exploration',
  'social',
  'mastery',
])

export const AchievementRaritySchema = z.enum(['bronze', 'silver', 'gold', 'platinum'])

export const AchievementConditionTypeSchema = z.enum(['stat_threshold', 'count', 'flag'])

export const AchievementConditionSchema = z.object({
  type: AchievementConditionTypeSchema,
  statKey: z.string().min(1),
  requiredValue: z.number().int().min(0),
})

export const AchievementRewardItemSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().min(1),
})

export const AchievementDefinitionSchema = z.object({
  achievementId: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  category: AchievementCategorySchema,
  rarity: AchievementRaritySchema,
  iconKey: z.string().min(1),
  conditions: z.array(AchievementConditionSchema),
  rewardGold: z.number().int().min(0),
  rewardItems: z.array(AchievementRewardItemSchema),
  isSecret: z.boolean(),
})

export const AchievementProgressSchema = z.object({
  achievementId: z.string().min(1),
  isUnlocked: z.boolean(),
  unlockedAt: z.string().nullable(),
  currentProgress: z.record(z.string(), z.number().int().min(0)),
})

export const AchievementStatsSchema = z.object({
  battlesWon: z.number().int().min(0),
  monstersDefeated: z.number().int().min(0),
  monstersCaptured: z.number().int().min(0),
  goldEarned: z.number().int().min(0),
  questsCompleted: z.number().int().min(0),
  bossesDefeated: z.number().int().min(0),
  areasVisited: z.number().int().min(0),
  speciesDiscovered: z.number().int().min(0),
  monstersBreed: z.number().int().min(0),
  highestPlayerLevel: z.number().int().min(1),
})

// ── Save Game Validation (Permissive) ──
// These schemas validate the essential structure of save data
// while being permissive about nested object details to handle
// version migrations gracefully.

export const SaveGameSchema = z.object({
  version: z.string().min(1),
  timestamp: z.string().min(1),
  player: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    level: z.number().int().min(1),
    experience: z.number().int().min(0),
    experienceToNextLevel: z.number().int().min(1),
    stats: CharacterStatsSchema,
    equipment: z.object({
      weapon: z.any().nullable(),
      armor: z.any().nullable(),
      helmet: z.any().nullable(),
      accessory: z.any().nullable(),
    }),
    position: PositionSchema,
    currentAreaId: z.string().min(1),
    gold: z.number().int().min(0),
  }),
  inventory: z.object({
    items: z.array(z.object({
      item: z.any(),
      quantity: z.number().int().min(1),
    })),
    maxSlots: z.number().int().min(1),
    equipment: z.array(z.any()),
  }),
  squad: z.array(z.object({
    instanceId: z.string().min(1),
    speciesId: z.string().min(1),
    level: z.number().int().min(1),
  }).passthrough()),
  monsterStorage: z.array(z.object({
    instanceId: z.string().min(1),
    speciesId: z.string().min(1),
    level: z.number().int().min(1),
  }).passthrough()),
  discoveredSpecies: z.array(z.string()),
  visitedAreas: z.array(z.string()),
  defeatedBosses: z.array(z.string()),
  openedChests: z.array(z.string()),
  currentAreaId: z.string().min(1),
  questFlags: z.record(z.string(), z.boolean()),
  playTime: z.number().int().min(0),
  settings: GameSettingsSchema,
  activeQuests: z.array(QuestProgressSchema),
  completedQuestIds: z.array(z.string()),
  achievements: z.array(AchievementProgressSchema).optional().default([]),
  achievementStats: AchievementStatsSchema.optional().default({
    battlesWon: 0,
    monstersDefeated: 0,
    monstersCaptured: 0,
    goldEarned: 0,
    questsCompleted: 0,
    bossesDefeated: 0,
    areasVisited: 0,
    speciesDiscovered: 0,
    monstersBreed: 0,
    highestPlayerLevel: 1,
  }),
})
