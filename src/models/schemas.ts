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
  targetType: z.enum(['single_enemy', 'all_enemies', 'self', 'single_ally', 'all_allies']),
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

// ── Save Game ──

export const GameSettingsSchema = z.object({
  musicVolume: z.number().min(0).max(1),
  sfxVolume: z.number().min(0).max(1),
  textSpeed: z.enum(['slow', 'normal', 'fast']),
  screenShake: z.boolean(),
})
