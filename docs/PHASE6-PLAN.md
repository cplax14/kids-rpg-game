# Phase 6: Multiple Game Areas

## Summary

Add 2 new game areas (Whispering Forest, Crystal Caves) with procedural tilemap generation, area transitions, boss monsters, and interactable objects. The existing Sunlit Village remains as the starting safe zone.

## Areas Overview

| Area | Level Range | Key Features |
|------|-------------|--------------|
| Sunlit Village | 1-3 | Safe zone, shops, NPCs (exists) |
| Whispering Forest | 3-8 | Dense trees, Elderwood boss, healing fountain |
| Crystal Caves | 7-12 | Glowing crystals, Crystallix boss, rare monsters |

---

## Task Breakdown

### Task 1: New Types and Schemas
**Modify:** `src/models/types.ts` (~80 lines)
**Modify:** `src/models/schemas.ts` (~60 lines)

```typescript
// Interactable types
export type InteractableType = 'chest' | 'sign' | 'fountain' | 'transition'

export interface InteractableObject {
  readonly objectId: string
  readonly type: InteractableType
  readonly position: Position
  readonly isOneTime: boolean
}

export interface ChestObject extends InteractableObject {
  readonly contents: ReadonlyArray<ItemDrop>
  readonly goldAmount: number
}

export interface SignObject extends InteractableObject {
  readonly message: ReadonlyArray<string>
}

export interface FountainObject extends InteractableObject {
  readonly healPercent: number
  readonly healsSquad: boolean
}

export interface TransitionZone {
  readonly targetAreaId: string
  readonly targetPosition: Position
  readonly triggerBounds: { x: number; y: number; width: number; height: number }
  readonly requiredLevel?: number
  readonly requiredBossDefeated?: string
}

// Boss types
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

export interface BossRewards {
  readonly experience: number
  readonly gold: number
  readonly guaranteedItems: ReadonlyArray<ItemDrop>
  readonly unlocksArea?: string
}

// Area encounter entry
export interface AreaEncounterEntry {
  readonly speciesId: string
  readonly weight: number
  readonly minLevel: number
  readonly maxLevel: number
}

// Extended area definition
export interface GameAreaDefinition {
  readonly areaId: string
  readonly name: string
  readonly description: string
  readonly recommendedLevel: number
  readonly isSafeZone: boolean
  readonly mapWidth: number
  readonly mapHeight: number
  readonly terrainType: 'village' | 'forest' | 'cave'
  readonly encounters: ReadonlyArray<AreaEncounterEntry>
  readonly connections: ReadonlyArray<TransitionZone>
  readonly interactables: ReadonlyArray<InteractableObject>
  readonly bossIds: ReadonlyArray<string>
  readonly ambientColor?: number
}
```

**GameState additions:**
```typescript
readonly currentAreaId: string
readonly defeatedBosses: ReadonlyArray<string>
readonly openedChests: ReadonlyArray<string>
```

### Task 2: Area Data Files
**New file:** `public/assets/data/areas.json` (~200 lines)
**New file:** `public/assets/data/bosses.json` (~80 lines)

Three areas:
- **Sunlit Village**: Safe zone, existing NPCs, transition south to forest
- **Whispering Forest**: 6 monster types (mossbun L3-5, breezling L3-5, glowmoth L4-6, shadowpup L5-7, etc.), chest, fountain, Elderwood boss
- **Crystal Caves**: 4 monster types (pebblit L7-9, crystalgolem L8-10, ironshell L9-11, magnetite L10-12), Crystallix boss

### Task 3: Boss Monster Species
**Modify:** `public/assets/data/monsters.json` (~150 lines)

| Boss | Element | Level | HP | Key Abilities |
|------|---------|-------|-----|---------------|
| Thornwarden | earth | 5 | 180 | vine-whip, poison-sting, shield-wall (mini-boss) |
| Elderwood | earth | 8 | 280 | earthquake, regen, slam, vine-whip |
| Crystallix | earth | 12 | 350 | boulder-crush, light-beam, shield-wall, earthquake |

All have `captureBaseDifficulty: 1.0` (uncapturable).

### Task 4: Procedural Map Generator
**New file:** `src/utils/mapGenerator.ts` (~200 lines)

```typescript
export interface MapConfig {
  readonly width: number
  readonly height: number
  readonly terrainType: 'village' | 'forest' | 'cave'
  readonly entryPoints: ReadonlyArray<Position>
  readonly exitPoints: ReadonlyArray<Position>
  readonly reservedPositions: ReadonlyArray<Position>  // bosses, interactables
}

export interface GeneratedMap {
  readonly groundLayer: number[]
  readonly objectLayer: number[]
  readonly width: number
  readonly height: number
}

export function generateMap(config: MapConfig): GeneratedMap
```

Algorithm:
1. Fill ground with terrain tiles (grass/dirt for forest, stone for caves)
2. Use flood-fill to guarantee walkable paths between entry/exit
3. Scatter obstacles based on terrain (trees/mushrooms for forest, rocks/crystals for caves)
4. Keep reserved positions clear for bosses and interactables
5. Add random decorations

### Task 5: Area Tilesets
**Modify:** `src/scenes/BootScene.ts` (~100 lines)

Add two tileset generators:
- `createForestTilesetTexture()`: Dark grass, dense trees, mushrooms, fallen logs, bushes
- `createCaveTilesetTexture()`: Stone floor, rocky walls, crystals (cyan glow), stalagmites

### Task 6: WorldSystem
**New file:** `src/systems/WorldSystem.ts` (~150 lines)

```typescript
// Registry
export function loadAreaData(areas: ReadonlyArray<GameAreaDefinition>): void
export function loadBossData(bosses: ReadonlyArray<BossDefinition>): void
export function getArea(areaId: string): GameAreaDefinition | undefined
export function getBoss(bossId: string): BossDefinition | undefined
export function getAllAreas(): ReadonlyArray<GameAreaDefinition>

// Encounters
export function generateAreaEncounter(areaId: string): {
  combatants: ReadonlyArray<BattleCombatant>
  speciesIds: ReadonlyArray<string>
} | null

// Validation
export function canAccessArea(
  areaId: string,
  gameState: GameState
): { allowed: boolean; reason?: string }

export function isBossDefeated(bossId: string, gameState: GameState): boolean
```

### Task 7: InteractableSystem
**New file:** `src/systems/InteractableSystem.ts` (~120 lines)

```typescript
export function openChest(
  chest: ChestObject,
  gameState: GameState
): { newState: GameState; itemsGained: ReadonlyArray<ItemDrop>; goldGained: number }

export function readSign(sign: SignObject): ReadonlyArray<string>

export function useFountain(
  fountain: FountainObject,
  gameState: GameState
): { newState: GameState; healed: boolean }

export function checkTransition(
  zone: TransitionZone,
  gameState: GameState
): { allowed: boolean; reason?: string }
```

### Task 8: Interactable Entity
**New file:** `src/entities/Interactable.ts` (~100 lines)

Following NPC.ts pattern:
- Sprite rendering based on type
- Interaction zone (physics overlap)
- "Press E" prompt when nearby
- State tracking (chest open/closed)

### Task 9: WorldScene Area System
**Modify:** `src/scenes/WorldScene.ts` (~200 lines)

Key changes:
1. Accept `areaId` in scene data, default to 'sunlit-village'
2. Load area definition from WorldSystem
3. For non-village areas, generate procedural map
4. Create transition zones at area boundaries
5. Spawn interactables from area definition
6. Handle boss encounters (check if defeated first)
7. Area-specific encounter tables

New methods:
```typescript
private loadArea(areaId: string): void
private createProceduralMap(area: GameAreaDefinition): void
private createTransitionZones(area: GameAreaDefinition): void
private createInteractables(area: GameAreaDefinition): void
private handleTransition(zone: TransitionZone): void
private checkBossEncounter(): void
```

### Task 10: BattleScene Boss Handling
**Modify:** `src/scenes/BattleScene.ts` (~80 lines)

Add boss battle flow:
1. Check if combatant is boss (new `isBoss` flag)
2. Show intro dialog before battle
3. Boss combatants are non-capturable
4. Show defeat dialog after victory
5. Apply boss rewards (XP, gold, items)
6. Update `defeatedBosses` in game state
7. Unlock area if specified

### Task 11: GameStateManager Updates
**Modify:** `src/systems/GameStateManager.ts` (~40 lines)

```typescript
export function updateCurrentArea(state: GameState, areaId: string): GameState
export function addDefeatedBoss(state: GameState, bossId: string): GameState
export function addOpenedChest(state: GameState, chestId: string): GameState
```

Update `createInitialGameState` to include:
- `currentAreaId: 'sunlit-village'`
- `defeatedBosses: []`
- `openedChests: []`

### Task 12: PreloaderScene Updates
**Modify:** `src/scenes/PreloaderScene.ts` (~10 lines)

```typescript
this.load.json('areas-data', 'assets/data/areas.json')
this.load.json('bosses-data', 'assets/data/bosses.json')
```

### Task 13: Unit Tests
**New file:** `tests/unit/systems/WorldSystem.test.ts` (~150 lines)
**New file:** `tests/unit/systems/InteractableSystem.test.ts` (~100 lines)
**New file:** `tests/unit/utils/mapGenerator.test.ts` (~120 lines)

---

## Implementation Order

```
Task 1 (Types/Schemas)
         |
Task 2 (areas.json + bosses.json) + Task 3 (Boss monsters)  [parallel]
         |
Task 4 (Map Generator) + Task 5 (Tilesets)  [parallel]
         |
Task 6 (WorldSystem) + Task 7 (InteractableSystem)  [parallel]
         |
Task 8 (Interactable Entity)
         |
Task 9 (WorldScene) + Task 10 (BattleScene) + Task 11 (GameStateManager)  [parallel]
         |
Task 12 (PreloaderScene)
         |
Task 13 (Unit Tests)
```

---

## New Files Summary

| File | Lines | Purpose |
|------|-------|---------|
| `src/systems/WorldSystem.ts` | ~150 | Area registry, encounter generation |
| `src/systems/InteractableSystem.ts` | ~120 | Chest/sign/fountain logic |
| `src/entities/Interactable.ts` | ~100 | Visual interactable entity |
| `src/utils/mapGenerator.ts` | ~200 | Procedural tilemap generation |
| `public/assets/data/areas.json` | ~200 | Area definitions |
| `public/assets/data/bosses.json` | ~80 | Boss definitions |
| `tests/unit/systems/WorldSystem.test.ts` | ~150 | WorldSystem tests |
| `tests/unit/systems/InteractableSystem.test.ts` | ~100 | Interactable tests |
| `tests/unit/utils/mapGenerator.test.ts` | ~120 | Map generator tests |

## Modified Files Summary

| File | Changes |
|------|---------|
| `src/models/types.ts` | Add interactable, boss, area types |
| `src/models/schemas.ts` | Add Zod schemas |
| `src/scenes/BootScene.ts` | Add forest/cave tilesets |
| `src/scenes/WorldScene.ts` | Area loading, transitions, interactables, boss spawning |
| `src/scenes/BattleScene.ts` | Boss battle handling |
| `src/scenes/PreloaderScene.ts` | Load areas.json, bosses.json |
| `src/systems/GameStateManager.ts` | Area progress tracking |
| `public/assets/data/monsters.json` | Add 3 boss species |

---

## Verification

1. `npx tsc --noEmit` - Clean TypeScript build
2. `npx vitest run` - All tests pass
3. `pnpm dev` - Manual testing:
   - Start in Sunlit Village
   - Walk south to forest transition zone
   - See level warning if player < level 3
   - Enter Whispering Forest
   - Encounter forest monsters (mossbun, breezling, glowmoth)
   - Find and open chest (get items once)
   - Use healing fountain
   - Fight Thornwarden mini-boss (optional)
   - Find and defeat Elderwood boss
   - See boss intro/defeat dialogs
   - Path to Crystal Caves unlocks
   - Enter caves (east exit of forest)
   - Fight cave monsters (crystalgolem, ironshell)
   - Defeat Crystallix boss
   - All progress saved to game state
