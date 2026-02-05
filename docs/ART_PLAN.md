# Final Art Pass - Implementation Plan

## Current State

The game currently uses **procedurally generated placeholder textures**:
- Player: 32x48 pixel sprite with simple colored shapes (cyan body, tan face, brown hair)
- Monsters: Colored rectangles (64x64) in battle
- NPCs: Colored rectangles with type indicators
- Tilesets: Solid color tiles with minimal patterns (trees, mushrooms, crystals)
- UI: Canvas-drawn buttons and panels

## Goals

Transform the game into a visually appealing, kid-friendly RPG with:
1. Colorful, expressive character sprites
2. Unique monster designs for all 18+ species
3. Rich, detailed tilesets for each area
4. Polished UI with icons and decorations
5. Battle effects and animations

---

## Art Style Direction

### Target Aesthetic
- **Pixel art** at 32x32 base tile size (character sprites 32x48)
- **Bright, saturated colors** appealing to children
- **Soft edges** and rounded shapes (friendly, not intimidating)
- **Consistent 4-color palette** per sprite for cohesion
- **Expressive faces** with large eyes on characters and monsters

### Color Palette Guidelines
| Element | Primary | Highlight | Shadow | Accent |
|---------|---------|-----------|--------|--------|
| Player | #4FC3F7 | #81D4FA | #29B6F6 | #FFE082 |
| Fire monsters | #FF7043 | #FFAB91 | #E64A19 | #FFC107 |
| Water monsters | #42A5F5 | #90CAF9 | #1976D2 | #80DEEA |
| Earth monsters | #8D6E63 | #BCAAA4 | #5D4037 | #A5D6A7 |
| Grass monsters | #66BB6A | #A5D6A7 | #388E3C | #FFF59D |

---

## Phase 1: Free Asset Integration

### Recommended Asset Packs (All Free/CC0)

#### Characters & NPCs
| Source | Pack | Use For |
|--------|------|---------|
| Kenney.nl | [Tiny Town](https://kenney.nl/assets/tiny-town) | NPCs, buildings |
| Kenney.nl | [Tiny Dungeon](https://kenney.nl/assets/tiny-dungeon) | Player, enemies |
| OpenGameArt | [LPC Characters](https://opengameart.org/content/lpc-medieval-fantasy-character-sprites) | Animated characters |

#### Tilesets
| Source | Pack | Use For |
|--------|------|---------|
| Kenney.nl | [Tiny Town](https://kenney.nl/assets/tiny-town) | Village tiles |
| Kenney.nl | [Tiny Dungeon](https://kenney.nl/assets/tiny-dungeon) | Cave/dungeon tiles |
| OpenGameArt | [LPC Terrain](https://opengameart.org/content/lpc-terrains) | Forest, grass |

#### UI Elements
| Source | Pack | Use For |
|--------|------|---------|
| Kenney.nl | [UI Pack](https://kenney.nl/assets/ui-pack) | Buttons, panels, icons |
| Kenney.nl | [Game Icons](https://kenney.nl/assets/game-icons) | Item/ability icons |

#### Monsters
| Source | Pack | Use For |
|--------|------|---------|
| OpenGameArt | [16x16 RPG Creatures](https://opengameart.org/content/16x16-rpg-creatures-extended) | Monster base |
| itch.io | [Monster Pack](https://bakudas.itch.io/generic-rpg-pack) | Additional creatures |

---

## Phase 2: Asset Requirements

### Character Sprites

#### Player Hero
- **Size**: 32x48 pixels
- **Animations**:
  - Walk (4 directions x 4 frames = 16 frames)
  - Idle (4 directions x 2 frames = 8 frames)
  - Attack (4 frames)
  - Hurt (2 frames)
  - Victory (4 frames)
- **File**: `public/assets/sprites/characters/hero.png`

#### NPCs (6 types)
| NPC Type | Color Theme | Distinguishing Feature |
|----------|-------------|----------------------|
| Shopkeeper | Orange apron | Hat, coins |
| Healer | White/pink robes | Staff with heart |
| Breeder | Green outfit | Egg symbol |
| Quest Giver | Yellow/gold | Exclamation mark |
| Guide | Blue cloak | Book/scroll |
| Guard | Gray armor | Shield |

- **Size**: 32x48 pixels each
- **Animations**: Idle (2 frames), Talk (2 frames)
- **File**: `public/assets/sprites/npcs/npc-sheet.png`

### Monster Sprites (18 species)

| Monster | Element | Visual Description | Size |
|---------|---------|-------------------|------|
| Flamepup | Fire | Small dog with flame tail | 48x48 |
| Aquaslime | Water | Blue blob with water drops | 48x48 |
| Leafling | Earth | Plant creature with leaf arms | 48x48 |
| Zephyrbird | Wind | Small bird with wind swirls | 48x48 |
| Sparkbug | Light | Glowing beetle | 40x40 |
| Shadowmouse | Dark | Dark mouse with glowing eyes | 40x40 |
| Mossbun | Earth | Bunny covered in moss | 48x48 |
| Emberfox | Fire | Fox with ember-tipped ears | 56x56 |
| Bubblefin | Water | Fish with bubble crown | 48x48 |
| Thornsprout | Earth | Spiky plant creature | 48x48 |
| Gustling | Wind | Cloud-like creature | 48x48 |
| Sunmote | Light | Floating sun spirit | 40x40 |
| Nightcrawler | Dark | Shadowy worm | 56x40 |
| Rockshell | Earth | Turtle with rocky shell | 56x48 |
| Waveling | Water | Wave-shaped creature | 48x48 |
| Cinderbat | Fire | Bat with flaming wings | 48x48 |
| Breezepuff | Wind | Dandelion puff creature | 40x40 |
| Gloomcat | Dark | Dark cat with purple eyes | 48x48 |

**Each monster needs**:
- Idle animation (4 frames)
- Attack animation (4 frames)
- Hurt animation (2 frames)
- Faint animation (4 frames)

- **Files**: `public/assets/sprites/monsters/{species-id}.png`

### Tilesets

#### Village Tileset (32 tiles)
- Grass variations (4)
- Path/road (4)
- Water/pond (4)
- Trees (4)
- Houses (4)
- Fences/walls (4)
- Decorations (flowers, bushes) (4)
- Special (shop sign, fountain, etc.) (4)
- **File**: `public/assets/tilesets/village.png` (256x128)

#### Forest Tileset (32 tiles)
- Dark grass (4)
- Dirt paths (4)
- Dense trees (4)
- Logs/stumps (4)
- Mushrooms (4)
- Bushes/shrubs (4)
- Flowers (4)
- Special (healing spring, boss area) (4)
- **File**: `public/assets/tilesets/forest.png` (256x128)

#### Cave Tileset (32 tiles)
- Stone floor (4)
- Cave walls (4)
- Crystals (4)
- Stalagmites (4)
- Underground water (4)
- Rocks/boulders (4)
- Glowing elements (4)
- Special (treasure, boss pedestal) (4)
- **File**: `public/assets/tilesets/cave.png` (256x128)

### UI Assets

#### Icons (32x32 each)
- Item categories: Consumable, Capture Device, Material, Key Item, Equipment
- Elements: Fire, Water, Earth, Wind, Light, Dark, Neutral
- Stats: HP, MP, ATK, DEF, SPD, LCK
- Actions: Attack, Defend, Flee, Capture
- Equipment slots: Weapon, Armor, Helmet, Accessory

#### Panels & Frames
- Dialog box background (400x120)
- Menu panel (600x400)
- Button normal/hover/pressed (120x40)
- Health bar frame (200x24)
- Quest tracker frame (200x150)

### Battle Backgrounds (3)
- Village/field battle (1280x360)
- Forest battle (1280x360)
- Cave battle (1280x360)

### Effects
- Attack slash (4 frames)
- Magic circle (4 frames)
- Heal sparkles (4 frames)
- Capture device throw (8 frames)
- Capture shake (4 frames)
- Level up burst (8 frames)
- Element effects (fire, water, etc.) (4 frames each)

---

## Phase 3: Implementation Steps

### Step 1: Download and Organize Assets
```
public/assets/
├── sprites/
│   ├── characters/
│   │   └── hero.png          # Player sprite sheet
│   ├── monsters/
│   │   ├── flamepup.png
│   │   ├── aquaslime.png
│   │   └── ... (18 monsters)
│   ├── npcs/
│   │   └── npc-sheet.png     # All NPCs in one sheet
│   └── effects/
│       ├── attacks.png
│       ├── magic.png
│       └── capture.png
├── tilesets/
│   ├── village.png
│   ├── forest.png
│   └── cave.png
├── ui/
│   ├── icons.png             # All icons in one sheet
│   ├── panels.png
│   └── buttons.png
└── backgrounds/
    ├── battle-village.png
    ├── battle-forest.png
    └── battle-cave.png
```

### Step 2: Update PreloaderScene
- Load sprite sheets with correct frame dimensions
- Create animations for player, NPCs, monsters
- Load UI assets as atlas

### Step 3: Update BootScene
- Remove procedural texture generation (optional fallback)
- Load actual image assets

### Step 4: Update Entity Renderers
- **Player.ts**: Use loaded sprite sheet with animations
- **NPC.ts**: Use NPC sprite sheet
- **BattleScene.ts**: Use monster sprites and battle backgrounds
- **WorldScene.ts**: Update tilemap rendering

### Step 5: Update UI Components
- Replace canvas-drawn UI with loaded sprites
- Add icons to inventory items
- Add element icons to monster displays

---

## Phase 4: Custom Asset Creation (If Needed)

If free assets don't fully match the game's needs, consider:

### Tools for Creating Pixel Art
- **Aseprite** ($20, best for animation) - https://www.aseprite.org/
- **Piskel** (Free, browser-based) - https://www.piskelapp.com/
- **Pixilart** (Free, browser-based) - https://www.pixilart.com/

### Style Guide for Custom Art
1. Use 4-color palettes per sprite
2. 1-pixel black outlines for characters
3. Anti-aliasing only on large shapes
4. Consistent light source (top-left)
5. Expressive faces with 2-3 pixel eyes

---

## File Modifications Required

| File | Changes |
|------|---------|
| `src/scenes/BootScene.ts` | Remove/optional procedural textures |
| `src/scenes/PreloaderScene.ts` | Load real asset files, create animations |
| `src/scenes/BattleScene.ts` | Use sprite sheets, add battle backgrounds |
| `src/scenes/WorldScene.ts` | Use real tilesets, update tilemap |
| `src/entities/Player.ts` | Use loaded animations |
| `src/entities/NPC.ts` | Use NPC sprite sheet |
| `src/ui/hud/BattleHUD.ts` | Add UI sprite icons |
| `src/ui/menus/*.ts` | Use UI sprites for panels/buttons |

---

## Priority Order

1. **High Priority** (Core gameplay visual improvement)
   - Player sprite with walk animation
   - Monster sprites (at least 6 starter species)
   - Battle backgrounds
   - Basic UI icons

2. **Medium Priority** (Polish)
   - Full NPC sprites
   - All monster species
   - Tileset upgrades
   - Effect animations

3. **Lower Priority** (Nice to have)
   - Additional player outfits
   - Seasonal tileset variants
   - Particle effects
   - Animated UI elements

---

## Estimated Asset Count

| Category | Count | Status |
|----------|-------|--------|
| Player frames | 36 | Needed |
| Monster sprites | 18 x 14 = 252 frames | Needed |
| NPC sprites | 6 x 4 = 24 frames | Needed |
| Tileset tiles | 3 x 32 = 96 tiles | Needed |
| UI icons | ~40 icons | Needed |
| Battle backgrounds | 3 | Needed |
| Effect animations | ~60 frames | Needed |
| **Total** | ~500+ individual assets | |

---

## Next Steps

1. [ ] Download Kenney asset packs (Tiny Town, Tiny Dungeon, UI Pack)
2. [ ] Organize assets into project structure
3. [ ] Update PreloaderScene to load real assets
4. [ ] Create monster sprite sheets (or source from free packs)
5. [ ] Implement player animation system
6. [ ] Add battle backgrounds
7. [ ] Update UI with icons
8. [ ] Test all visual changes
