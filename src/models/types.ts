// ── Element & Rarity ──

export type MonsterElement = 'fire' | 'water' | 'earth' | 'wind' | 'light' | 'dark' | 'neutral'
export type MonsterRarity = 'common' | 'uncommon' | 'rare' | 'legendary'

// ── Position ──

export interface Position {
  readonly x: number
  readonly y: number
}

// ── Stats ──

export interface CharacterStats {
  readonly maxHp: number
  readonly currentHp: number
  readonly maxMp: number
  readonly currentMp: number
  readonly attack: number
  readonly defense: number
  readonly magicAttack: number
  readonly magicDefense: number
  readonly speed: number
  readonly luck: number
}

export interface StatGrowthRates {
  readonly hp: number
  readonly mp: number
  readonly attack: number
  readonly defense: number
  readonly magicAttack: number
  readonly magicDefense: number
  readonly speed: number
}

// ── Equipment ──

export type EquipmentSlot = 'weapon' | 'armor' | 'helmet' | 'accessory'

export interface EquipmentSlots {
  readonly weapon: Equipment | null
  readonly armor: Equipment | null
  readonly helmet: Equipment | null
  readonly accessory: Equipment | null
}

export interface Equipment {
  readonly equipmentId: string
  readonly name: string
  readonly description: string
  readonly slot: EquipmentSlot
  readonly statModifiers: Partial<CharacterStats>
  readonly levelRequirement: number
  readonly iconKey: string
  readonly buyPrice: number
  readonly sellPrice: number
  readonly specialEffect: string | null
}

// ── Player Character ──

export interface PlayerCharacter {
  readonly id: string
  readonly name: string
  readonly level: number
  readonly experience: number
  readonly experienceToNextLevel: number
  readonly stats: CharacterStats
  readonly equipment: EquipmentSlots
  readonly position: Position
  readonly currentAreaId: string
  readonly gold: number
}

// ── Abilities ──

export type AbilityType = 'physical' | 'magical' | 'status' | 'healing'
export type TargetType = 'single_enemy' | 'all_enemies' | 'self' | 'single_ally' | 'all_allies'

export interface Ability {
  readonly abilityId: string
  readonly name: string
  readonly description: string
  readonly element: MonsterElement
  readonly type: AbilityType
  readonly power: number
  readonly accuracy: number
  readonly mpCost: number
  readonly targetType: TargetType
  readonly statusEffect: StatusEffect | null
  readonly animation: string
}

export interface LearnableAbility {
  readonly abilityId: string
  readonly learnAtLevel: number
}

// ── Status Effects ──

export type StatusEffectType =
  | 'poison'
  | 'sleep'
  | 'slow'
  | 'haste'
  | 'shield'
  | 'regen'
  | 'attack_up'
  | 'defense_up'

export interface StatusEffect {
  readonly id: string
  readonly name: string
  readonly type: StatusEffectType
  readonly duration: number
  readonly magnitude: number
}

export interface ActiveStatusEffect {
  readonly effect: StatusEffect
  readonly turnsRemaining: number
  readonly appliedBy: string
}

// ── Monsters ──

export interface EvolutionStage {
  readonly evolvesTo: string
  readonly levelRequired: number
  readonly itemRequired: string | null
}

export interface MonsterSpecies {
  readonly speciesId: string
  readonly name: string
  readonly description: string
  readonly element: MonsterElement
  readonly rarity: MonsterRarity
  readonly baseStats: CharacterStats
  readonly statGrowth: StatGrowthRates
  readonly abilities: ReadonlyArray<LearnableAbility>
  readonly captureBaseDifficulty: number
  readonly spriteKey: string
  readonly evolutionChain: EvolutionStage | null
  readonly breedingGroup: string
  readonly breedingTraits: ReadonlyArray<string>
}

export interface MonsterInstance {
  readonly instanceId: string
  readonly speciesId: string
  readonly nickname: string | null
  readonly level: number
  readonly experience: number
  readonly stats: CharacterStats
  readonly learnedAbilities: ReadonlyArray<Ability>
  readonly inheritedTraits: ReadonlyArray<string>
  readonly parentSpeciesIds: ReadonlyArray<string>
  readonly isInSquad: boolean
  readonly capturedAt: string
  readonly bondLevel: number
}

// ── Items ──

export type ItemCategory =
  | 'consumable'
  | 'capture_device'
  | 'key_item'
  | 'breeding_item'
  | 'material'

export type ItemEffectType =
  | 'heal_hp'
  | 'heal_mp'
  | 'cure_status'
  | 'buff'
  | 'capture_boost'
  | 'breeding_boost'

export interface ItemEffect {
  readonly type: ItemEffectType
  readonly magnitude: number
  readonly targetType: 'self' | 'single_ally' | 'single_monster'
}

export interface Item {
  readonly itemId: string
  readonly name: string
  readonly description: string
  readonly category: ItemCategory
  readonly iconKey: string
  readonly stackable: boolean
  readonly maxStack: number
  readonly useEffect: ItemEffect | null
  readonly buyPrice: number
  readonly sellPrice: number
}

export interface InventorySlot {
  readonly item: Item
  readonly quantity: number
}

export interface Inventory {
  readonly items: ReadonlyArray<InventorySlot>
  readonly maxSlots: number
  readonly equipment: ReadonlyArray<Equipment>
}

// ── Combat ──

export type BattleState =
  | 'start'
  | 'player_turn'
  | 'enemy_turn'
  | 'animating'
  | 'victory'
  | 'defeat'
  | 'fled'
  | 'capture_attempt'

export interface BattleCombatant {
  readonly combatantId: string
  readonly name: string
  readonly isPlayer: boolean
  readonly isMonster: boolean
  readonly stats: CharacterStats
  readonly abilities: ReadonlyArray<Ability>
  readonly statusEffects: ReadonlyArray<ActiveStatusEffect>
  readonly capturable: boolean
}

export type BattleActionType = 'attack' | 'ability' | 'item' | 'capture' | 'flee' | 'defend'

export interface BattleAction {
  readonly type: BattleActionType
  readonly actorId: string
  readonly targetId: string | null
  readonly abilityId: string | null
  readonly itemId: string | null
}

export interface ItemDrop {
  readonly itemId: string
  readonly quantity: number
}

export interface BattleRewards {
  readonly experience: number
  readonly gold: number
  readonly items: ReadonlyArray<ItemDrop>
  readonly capturedMonster: MonsterInstance | null
}

export interface Battle {
  readonly state: BattleState
  readonly turnOrder: ReadonlyArray<BattleCombatant>
  readonly currentTurnIndex: number
  readonly playerSquad: ReadonlyArray<BattleCombatant>
  readonly enemySquad: ReadonlyArray<BattleCombatant>
  readonly turnCount: number
  readonly canFlee: boolean
  readonly backgroundKey: string
  readonly rewards: BattleRewards | null
}

// ── Capture ──

export interface CaptureModifier {
  readonly source: string
  readonly modifier: number
  readonly reason: string
}

export interface CaptureAttempt {
  readonly targetMonster: BattleCombatant
  readonly captureDevice: Item
  readonly baseSuccessRate: number
  readonly modifiers: ReadonlyArray<CaptureModifier>
  readonly finalSuccessRate: number
  readonly succeeded: boolean
}

// ── Traits ──

export type TraitRarity = 'common' | 'rare' | 'mutation'

export interface TraitDefinition {
  readonly traitId: string
  readonly name: string
  readonly description: string
  readonly statModifiers: Partial<CharacterStats>
  readonly rarity: TraitRarity
}

// ── Breeding ──

export interface BreedingOffspringOption {
  readonly speciesId: string
  readonly probability: number
  readonly bonusTraits: ReadonlyArray<string>
}

export interface BreedingRecipe {
  readonly recipeId: string
  readonly parents: readonly [string, string]
  readonly offspring: ReadonlyArray<BreedingOffspringOption>
  readonly requiredCompatibility: number
}

export interface BreedingOutcome {
  readonly resultSpeciesId: string
  readonly probability: number
  readonly inheritableTraits: ReadonlyArray<string>
  readonly bonusStats: Partial<StatGrowthRates> | null
}

export interface BreedingPair {
  readonly parent1: MonsterInstance
  readonly parent2: MonsterInstance
  readonly compatibility: number
  readonly possibleOffspring: ReadonlyArray<BreedingOutcome>
}

export interface BreedingResult {
  readonly offspring: MonsterInstance
  readonly inheritedTraitsFromParent1: ReadonlyArray<string>
  readonly inheritedTraitsFromParent2: ReadonlyArray<string>
  readonly mutationOccurred: boolean
  readonly mutationTrait: string | null
}

// ── World ──

export interface EncounterEntry {
  readonly speciesId: string
  readonly levelRange: { readonly min: number; readonly max: number }
  readonly weight: number
}

export interface EncounterTable {
  readonly zoneId: string
  readonly monsters: ReadonlyArray<EncounterEntry>
  readonly encounterRate: number
}

export type NpcType = 'quest' | 'shop' | 'info' | 'breeder' | 'healer'

export interface NpcDefinition {
  readonly npcId: string
  readonly name: string
  readonly spriteKey: string
  readonly position: Position
  readonly dialogTreeId: string
  readonly type: NpcType
}

export interface AreaConnection {
  readonly targetAreaId: string
  readonly triggerZone: {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
  }
  readonly spawnPosition: Position
}

export interface GameArea {
  readonly areaId: string
  readonly name: string
  readonly description: string
  readonly tilemapKey: string
  readonly tilesetKeys: ReadonlyArray<string>
  readonly backgroundMusicKey: string
  readonly encounters: ReadonlyArray<EncounterTable>
  readonly npcs: ReadonlyArray<NpcDefinition>
  readonly connections: ReadonlyArray<AreaConnection>
  readonly requiredLevel: number
  readonly isSafeZone: boolean
}

// ── Interactables ──

export type InteractableType = 'chest' | 'sign' | 'fountain'

export interface InteractableObject {
  readonly objectId: string
  readonly type: InteractableType
  readonly position: Position
  readonly isOneTime: boolean
}

export interface ChestContents {
  readonly items: ReadonlyArray<ItemDrop>
  readonly gold: number
}

export interface ChestObject extends InteractableObject {
  readonly type: 'chest'
  readonly contents: ChestContents
}

export interface SignObject extends InteractableObject {
  readonly type: 'sign'
  readonly message: ReadonlyArray<string>
}

export interface FountainObject extends InteractableObject {
  readonly type: 'fountain'
  readonly healPercent: number
  readonly healsSquad: boolean
}

// ── Area Transitions ──

export interface TransitionZone {
  readonly zoneId: string
  readonly targetAreaId: string
  readonly targetPosition: Position
  readonly triggerBounds: {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
  }
  readonly requiredLevel?: number
  readonly requiredBossDefeated?: string
}

// ── Boss System ──

export interface BossRewards {
  readonly experience: number
  readonly gold: number
  readonly guaranteedItems: ReadonlyArray<ItemDrop>
  readonly unlocksArea?: string
}

export interface BossDefinition {
  readonly bossId: string
  readonly speciesId: string
  readonly name: string
  readonly title: string
  readonly level: number
  readonly areaId: string
  readonly position: Position
  readonly introDialog: ReadonlyArray<string>
  readonly defeatDialog: ReadonlyArray<string>
  readonly rewards: BossRewards
}

// ── Extended Area Definition ──

export type TerrainType = 'village' | 'forest' | 'cave'

export interface AreaEncounterEntry {
  readonly speciesId: string
  readonly weight: number
  readonly minLevel: number
  readonly maxLevel: number
}

export interface GameAreaDefinition {
  readonly areaId: string
  readonly name: string
  readonly description: string
  readonly recommendedLevel: number
  readonly isSafeZone: boolean
  readonly mapWidth: number
  readonly mapHeight: number
  readonly terrainType: TerrainType
  readonly encounters: ReadonlyArray<AreaEncounterEntry>
  readonly transitions: ReadonlyArray<TransitionZone>
  readonly interactables: ReadonlyArray<InteractableObject>
  readonly bossIds: ReadonlyArray<string>
  readonly ambientColor?: number
}

// ── Tutorial ──

export type TutorialTrigger =
  | 'first_battle'
  | 'first_capture'
  | 'first_menu'
  | 'first_shop'
  | 'first_breeding'
  | 'first_area_transition'

export interface TutorialStep {
  readonly id: string
  readonly trigger: TutorialTrigger
  readonly title: string
  readonly message: string
  readonly position: 'top' | 'bottom' | 'center'
}

// ── Save Game ──

export interface GameSettings {
  readonly musicVolume: number
  readonly sfxVolume: number
  readonly textSpeed: 'slow' | 'normal' | 'fast'
  readonly screenShake: boolean
}

export interface SaveGame {
  readonly version: string
  readonly timestamp: string
  readonly player: PlayerCharacter
  readonly inventory: Inventory
  readonly squad: ReadonlyArray<MonsterInstance>
  readonly monsterStorage: ReadonlyArray<MonsterInstance>
  readonly discoveredSpecies: ReadonlyArray<string>
  readonly visitedAreas: ReadonlyArray<string>
  readonly defeatedBosses: ReadonlyArray<string>
  readonly openedChests: ReadonlyArray<string>
  readonly currentAreaId: string
  readonly questFlags: Record<string, boolean>
  readonly playTime: number
  readonly settings: GameSettings
  readonly activeQuests: ReadonlyArray<QuestProgress>
  readonly completedQuestIds: ReadonlyArray<string>
}

// ── Quest System ──

export type QuestType = 'defeat' | 'collect' | 'boss' | 'explore' | 'talk'
export type QuestStatus = 'available' | 'active' | 'completed' | 'turned_in'

export interface QuestObjective {
  readonly objectiveId: string
  readonly type: QuestType
  readonly targetId: string
  readonly targetName: string
  readonly requiredCount: number
  readonly description: string
}

export interface QuestRewardItem {
  readonly itemId: string
  readonly quantity: number
}

export interface QuestRewards {
  readonly experience: number
  readonly gold: number
  readonly items: ReadonlyArray<QuestRewardItem>
  readonly equipmentId: string | null
}

export interface QuestDefinition {
  readonly questId: string
  readonly name: string
  readonly description: string
  readonly giverNpcId: string
  readonly turnInNpcId: string
  readonly recommendedLevel: number
  readonly objectives: ReadonlyArray<QuestObjective>
  readonly rewards: QuestRewards
  readonly rewardEquipmentTier: number
  readonly rewardEquipmentSlots: ReadonlyArray<EquipmentSlot>
  readonly prerequisiteQuestIds: ReadonlyArray<string>
  readonly isRepeatable: boolean
  readonly celebrationMessage: string
}

export interface QuestProgress {
  readonly questId: string
  readonly status: QuestStatus
  readonly objectiveProgress: Record<string, number>
  readonly acceptedAt: string
  readonly completedAt: string | null
}
