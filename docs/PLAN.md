# Implementation Plan: Kids RPG Game (Monster Quest)

## Overview

A browser-based, kid-friendly RPG game inspired by Final Fantasy's turn-based combat and exploration, combined with a monster capture and breeding system. The player explores a colorful 2D world, fights turn-based battles, captures monsters to join their squad, and breeds monsters to discover new hybrid species. The game targets children ages 7-12 and must be playable in Chrome with an intuitive, colorful UI.

---

## 1. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Game Engine** | Phaser 3.90+ | Best 2D game framework for browser RPGs -- tilemaps, scenes, cameras, input, audio |
| **Language** | TypeScript (strict mode) | Type safety for complex game data models |
| **Build Tool** | Vite | Fast HMR, native TS support, simple config |
| **Map Editor** | Tiled (external tool) | Industry-standard 2D tilemap editor; exports JSON that Phaser loads natively |
| **Testing** | Vitest (unit/integration) + Playwright (E2E) | Vitest is Vite-native; Playwright for browser testing |
| **Data Format** | JSON files (static game data) | Monsters, items, areas defined as JSON; easy to edit and extend |
| **Validation** | Zod | Runtime validation for game data schemas |
| **Package Manager** | pnpm | Fast, efficient disk usage |

No backend required initially -- all game state stored in `localStorage`.

---

## 2. Game Architecture

### Scene Graph

```
BootScene          -- Load minimal assets, generate placeholder textures
PreloaderScene     -- Load all game assets, create animations
TitleScene         -- Main menu (New Game, Continue, Settings)
WorldScene         -- Top-down overworld exploration (player walks around)
BattleScene        -- Turn-based combat (FF-style side view)
MenuScene          -- Pause menu overlay (inventory, squad, equipment, stats)
ShopScene          -- Buy/sell items and equipment
BreedingScene      -- Monster breeding interface
DialogScene        -- NPC dialog overlay
TransitionScene    -- Scene transition effects (fade, swirl)
GameOverScene      -- Game over / victory screen
```

### Core Systems (Decoupled via Event Bus)

| System | Responsibility |
|---|---|
| CharacterSystem | Player stats, leveling, XP curves |
| CombatSystem | Turn order, damage calc, status effects, AI |
| MonsterSystem | Monster species data, instance creation, abilities |
| CaptureSystem | Capture rate calculation, success/failure |
| BreedingSystem | Compatibility, trait inheritance, mutation, offspring creation |
| InventorySystem | Items, stacking, usage |
| EquipmentSystem | Equip/unequip, stat modifiers |
| SquadSystem | Party management (player + up to 3 monsters) |
| WorldSystem | Area transitions, encounters, NPC placement |
| DialogSystem | Dialog trees, typewriter text, branching choices |
| SaveSystem | Serialize/deserialize to localStorage, 3 save slots |
| AudioSystem | Music loops, SFX, volume controls |
| InputSystem | Keyboard/mouse/touch abstraction |

---

## 3. Data Models

All models use **immutable TypeScript interfaces** (readonly fields, never mutated). See `src/models/types.ts` for full definitions.

Key entities:
- **PlayerCharacter** -- name, level, stats, equipment slots, position, gold
- **MonsterSpecies** (static JSON) -- base stats, element, rarity, abilities, capture difficulty, breeding group, traits
- **MonsterInstance** (runtime) -- specific captured monster with nickname, level, inherited traits, parent lineage, bond level
- **Battle** -- state machine (player_turn/enemy_turn/animating/victory/defeat), turn order, combatant arrays, rewards
- **Equipment** -- slot (weapon/armor/helmet/accessory), stat modifiers, level requirement
- **BreedingPair** -- compatibility score, possible offspring with probabilities, inheritable traits
- **GameArea** -- tilemap key, encounter tables, NPCs, connections to other areas

### Element System

Fire > Earth > Wind > Water > Fire (cycle), Light <> Dark (mutual weakness), Neutral = no advantage.

---

## 4. Phase-by-Phase Implementation

### Phase 1: Foundation (COMPLETED)
- [x] Project setup (pnpm, Vite, TypeScript, Phaser 3, Vitest, Zod)
- [x] Type definitions and Zod schemas for all game entities
- [x] Event bus and game event constants
- [x] Utility modules (math formulas, storage, ID generation, text formatting, logger)
- [x] BootScene with procedurally generated placeholder textures
- [x] PreloaderScene with loading bar and player animation setup
- [x] TitleScene with main menu (New Game / Continue)
- [x] WorldScene with Tiled tilemap, collision, camera follow
- [x] Player entity with 4-direction movement (WASD + arrows)
- [x] InputSystem abstraction
- [x] 86 unit tests passing (math, storage, text, ID, schemas)

### Phase 2: Character System and Basic Combat (COMPLETED)
- [x] CharacterSystem -- player stats, XP curve, level-up logic
- [x] 18 starter monsters across all elements with base stats and abilities
- [x] 35 abilities spanning physical/magical/status/healing
- [x] Random encounter system (step counter, encounter tables)
- [x] BattleScene with FF-style side-view layout
- [x] BattleHUD -- command menu (Attack, Ability, Defend, Flee), HP/MP bars
- [x] CombatSystem -- turn order, damage formula, element effectiveness, status effects, enemy AI
- [x] Battle resolution -- victory/defeat conditions, XP/gold rewards
- [x] Battle animations -- attack, hit, damage numbers, KO, victory fanfare
- [x] 127 unit tests for CharacterSystem, MonsterSystem, CombatSystem (86%+ coverage)

### Phase 3: Inventory, Equipment, and Items (COMPLETED)
- [x] 28 consumable items, 15 weapons, 15 armor, 15 helmets, 10 accessories (55 equipment total)
- [x] GameStateManager -- registry-based cross-scene state sharing
- [x] InventorySystem -- add/remove items, stacking, sorting, usage
- [x] EquipmentSystem -- equip/unequip, stat bonuses, comparison preview
- [x] ItemEffectSystem -- heal/cure/buff effects on combatants and players
- [x] LootSystem -- species-based loot tables with weighted drops
- [x] Inventory and Equipment menu UI (MenuScene with tab panels)
- [x] Item usage in battle (Item command in BattleHUD)
- [x] Loot drops from defeated monsters
- [x] NPC entity with color-coded types, interaction zones, press-E prompts
- [x] ShopScene -- buy/sell interface with gold display and inventory checks
- [x] DialogSystem -- JSON-driven dialog trees, typewriter effect, branching choices
- [x] DialogScene -- overlay with actions (open_shop, heal_party)
- [x] 429 unit tests passing, 93.56% statement coverage on src/systems/

### Phase 4: Monster Capture System (COMPLETED)
- [x] SquadSystem -- player + up to 3 monsters (4 total combatants)
- [x] CaptureSystem -- success rate based on HP%, rarity, device quality, status, luck
- [x] 4 capture devices (capture-capsule, super-capsule, ultra-capsule, master-capsule)
- [x] Capture animation in battle (device flies, shakes, success/fail)
- [x] Squad members fight alongside player with AI control
- [x] Squad management UI with storage, monster detail view
- [x] BestiaryPanel -- discovered monsters catalog with stats and abilities
- [x] Bond system -- monsters grow stronger with use (0-100 bond level)
- [x] 534 unit tests passing

### Phase 5: Monster Breeding System (COMPLETED)
- [x] Breeding group compatibility rules (beast, dragon, aquatic, elemental, avian)
- [x] 25 breeding recipes (specific combos produce specific offspring)
- [x] Stat inheritance (averaged from parents with +/-10% variance)
- [x] Trait inheritance (50% chance per parent trait, 5% mutation chance)
- [x] BreedingScene with NPC, parent selection, compatibility preview
- [x] 7 breeding-exclusive monsters (emberbun, steampup, magmawyrm, etc.)
- [x] 18 traits (10 common, 5 rare, 3 mutation)
- [x] 4 breeding items (breeding-charm, trait-crystal, mutation-catalyst, harmony-bell)
- [x] 602 unit tests passing, 85%+ coverage on breeding systems

### Phase 6: Multiple Game Areas (COMPLETED)
- [x] 3 game areas with progression:
  - **Sunlit Village** (safe zone center, grass encounters Level 1-3)
  - **Whispering Forest** (Level 3-8, Elderwood boss)
  - **Crystal Caves** (Level 7-12, Crystallix boss)
- [x] Procedural tilemap generation for forest/cave areas
- [x] WorldSystem -- area registry, transitions, level requirements
- [x] Area-specific encounters and unique monsters per zone
- [x] Interactable objects (chests, signs, healing fountains)
- [x] Boss encounters with intro/defeat dialogs and rewards
- [x] TransitionZone system with level and boss-defeat requirements
- [x] 647 unit tests passing

### Phase 7: Audio, Save System, Polish (COMPLETED)
- [x] AudioSystem -- background music per area, battle themes, SFX with volume controls
- [x] SaveSystem -- 3 slots with play time tracking, auto-save support
- [x] SettingsManager -- volume, text speed, screen shake settings with persistence
- [x] TutorialSystem -- progressive disclosure with trigger-based tutorials
- [x] Accessibility utilities (color-blind indicators, readable fonts, keyboard navigation)
- [x] SaveLoadPanel -- save/load UI with slot management
- [x] 732 unit tests passing

### Phase 8: Quest System (COMPLETED)
- [x] QuestSystem with registry pattern for quest management
- [x] Quest types: defeat, collect, boss, explore, talk
- [x] Quest objectives with progress tracking
- [x] Level-appropriate equipment rewards (tier 1-5)
- [x] NPC quest indicators (! for available, ? for ready)
- [x] QuestTrackerHUD for active quest progress display
- [x] QuestLogPanel in menu for full quest management
- [x] QuestCelebration overlay with confetti and reward reveal
- [x] Quest integration in BattleScene, WorldScene, DialogScene
- [x] Quest-related game events (accepted, progress, completed)
- [ ] Expand to 60-80 monster species, 40+ items, 30+ weapons/armor
- [ ] Game balance pass (XP curve, difficulty, economy, capture rates)
- [ ] Final art pass
- [ ] QA and bug fixing

### Phase 9: Menu UI Polish (COMPLETED)
- [x] PlayerHeader component with XP/HP/MP progress bars
- [x] Level display with XP percentage (e.g., "340/500 XP (68%)")
- [x] HP bar with color changes based on health (green/yellow/red)
- [x] Improved MenuScene tab bar with hover effects and active indicators
- [x] InventoryPanel overhaul with category badges and filter buttons
- [x] EquipmentPanel with visual slot layout and total stat bonuses
- [x] SettingsPanel polish with section headers and reset defaults
- [x] Slider component for volume controls
- [x] Empty state messages for inventory and equipment

---

## 5. File Structure

```
kids-rpg-game/
├── docs/
│   └── PLAN.md              # This file
├── public/
│   └── assets/
│       ├── sprites/          # Character, monster, NPC, effect, UI sprites
│       ├── tilemaps/         # Tiled JSON maps
│       ├── tilesets/         # Tileset images
│       ├── audio/            # Music and SFX
│       ├── fonts/            # Custom fonts
│       └── data/             # JSON game data (monsters, items, abilities, etc.)
├── src/
│   ├── main.ts              # Entry point, Phaser game config
│   ├── config.ts            # Game constants, colors, fonts, scene keys
│   ├── scenes/              # Phaser scenes (Boot, Preloader, Title, World, Battle, etc.)
│   ├── systems/             # Game systems (Combat, Capture, Breeding, Inventory, etc.)
│   ├── entities/            # Game entities (Player, Monster, NPC, InteractableObject)
│   ├── ui/
│   │   ├── components/      # Reusable UI components (Button, Panel, HealthBar, etc.)
│   │   ├── hud/             # HUD overlays (BattleHUD, WorldHUD, SquadHUD)
│   │   └── menus/           # Menu screens (Inventory, Equipment, Squad, Bestiary, etc.)
│   ├── models/
│   │   ├── types.ts         # All TypeScript interfaces
│   │   ├── schemas.ts       # Zod validation schemas
│   │   └── constants.ts     # Balance values, element table, XP curve
│   ├── utils/               # Pure utility functions (math, storage, id, text, logger)
│   └── events/              # Event bus and event type definitions
└── tests/
    ├── unit/                # Unit tests for systems, utils, models
    ├── integration/         # Integration tests for game flows
    └── e2e/                 # Playwright E2E tests
```

---

## 6. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Art asset availability** | High | Use free packs (Kenney, LPC, OpenGameArt) early; design systems to be art-agnostic |
| **Scope creep** | High | Strict phase gates; each phase produces a playable game |
| **Game balance for kids** | Medium | Err on too-easy; playtest with actual kids; add difficulty settings later |
| **Breeding too complex for kids** | Medium | Clear UI hints, NPC explanations, reward experimentation |
| **Complex state management** | Medium | Immutable patterns, Zod validation, extensive unit tests |
| **Performance on low-end devices** | Medium | Phaser handles well by default; texture atlases; profile early |

---

## 7. Success Criteria

- [ ] Game loads and runs at 60fps in Chrome
- [ ] Player can walk around a tilemap world with collision
- [ ] Turn-based battles with FF-style UI
- [ ] Combat handles damage, healing, status effects, element effectiveness
- [ ] Player can level up and gain stats
- [ ] Equipment modifies stats
- [ ] Consumable items work in and out of battle
- [ ] Monster capture system functional
- [ ] Captured monsters fight alongside player
- [ ] Monster breeding produces offspring with inherited traits
- [ ] 6+ distinct game areas with unique encounters
- [ ] NPC dialog and shop systems
- [ ] Save/load with localStorage
- [ ] Music and sound effects
- [ ] UI usable by a 7-year-old
- [ ] 80%+ test coverage on game systems
