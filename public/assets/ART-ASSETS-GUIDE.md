# Art Assets Guide

## Asset Sources Overview

| Asset Type | Source | Size | Status |
|------------|--------|------|--------|
| **Characters/NPCs** | RPGCharacterSprites32x32 (OpenGameArt) | 32x32 | ✅ Ready |
| **Monsters** | Craftpix Low-Level Monsters | 32x32 | ✅ Ready |
| **Tilesets** | Mixel Top-Down RPG v1.4 | 32x32 | ✅ Ready |
| **UI Elements** | Ninja Adventure | 16x16 | ✅ Ready |
| **Music** | Ninja Adventure | .ogg | ✅ Ready |
| **Sound FX** | Ninja Adventure | .wav | ✅ Ready |
| **Items/Icons** | Ninja Adventure | 16x16 | ✅ Ready |

---

## Directory Structure

```
public/assets/
├── sprites/
│   ├── characters/
│   │   ├── rpg-characters-32x32.png      # 32x32 player/NPC sprites
│   │   └── CHARACTER-MAP.md              # Sprite mapping guide
│   │
│   └── monsters/                          # NEW - 32x32 monster icons
│       ├── Icon1.png - Icon50.png        # 50 monster portraits
│       ├── MONSTER-MAP.md                # Monster mapping guide
│       └── LICENSE-craftpix.txt          # License info
│
├── tilesets/
│   └── mixel-32x32/                       # NEW - 32x32 environment tiles
│       ├── Topdown RPG 32x32 - Ground Tileset.png
│       ├── Topdown RPG 32x32 - Trees.PNG
│       ├── Topdown RPG 32x32 - Bushes.PNG
│       ├── Topdown RPG 32x32 - Rocks.PNG
│       ├── Topdown RPG 32x32 - Mushrooms.png
│       ├── Topdown RPG 32x32 - Tree Stumps and Logs.png
│       ├── Topdown RPG 32x32 - Nature Details.png
│       ├── Topdown RPG 32x32 - Ruins.PNG
│       ├── Sample.PNG                     # Preview of assembled scene
│       ├── TILESET-MAP.md                 # Tileset mapping guide
│       └── LICENSE-mixel.txt              # License info
│
├── ninja-adventure/                        # 16x16 asset pack (UI/Audio)
│   ├── hud/                               # ✅ USE FOR UI
│   │   ├── heart.png
│   │   ├── dialogue-bubble.png
│   │   └── ...
│   ├── items/                             # ✅ USE FOR ITEMS
│   │   ├── heart.png
│   │   ├── gold-coin.png
│   │   └── food/
│   ├── musics/                            # ✅ USE FOR MUSIC
│   │   └── *.ogg
│   └── sounds/                            # ✅ USE FOR SFX
│
└── data/                                   # Game data JSON files
```

---

## What We're Using From Each Source

### RPGCharacterSprites32x32 (OpenGameArt)
- ✅ Player character sprites (row 2-3)
- ✅ NPC sprites (Guide, Shopkeeper, Healer, Breeder)
- ✅ Guard/knight sprites (rows 6-7)
- ✅ Skeleton enemy sprites (rows 0-1)
- ✅ Transparent version: `rpg-characters-32x32-transparent.png`

### Craftpix Low-Level Monsters (NEW)
- ✅ 50 monster portrait icons
- ✅ Transparent backgrounds (ready to use)
- ✅ Variety: spiders, slimes, elementals, plants, golems
- ✅ Kid-friendly stylized pixel art

### Mixel Top-Down RPG v1.4 (NEW)
- ✅ Ground tileset (grass, dirt, paths, cobblestone)
- ✅ Trees (multiple sizes, shadows, leaves)
- ✅ Bushes (with flowers and berries)
- ✅ Rocks (boulders, stones, pebbles)
- ✅ Mushrooms (colorful varieties)
- ✅ Tree stumps and logs
- ✅ Nature details (grass tufts, flowers)
- ✅ Ruins (dungeon walls, doors, stairs)

### Ninja Adventure Pack
- ✅ UI elements (hearts, dialog bubbles, buttons)
- ✅ Item icons (potions, coins, food)
- ✅ Music tracks (19 .ogg files)
- ✅ Sound effects

---

## Licenses

| Pack | License | Commercial Use |
|------|---------|----------------|
| RPGCharacterSprites32x32 | OpenGameArt (check specific) | ✅ Yes |
| Craftpix Monsters | Craftpix Free License | ✅ Yes |
| Mixel Tilesets | Free for video games | ✅ Yes |
| Ninja Adventure | CC0 | ✅ Yes |

---

## Processing Required

### 1. Character Sprite Sheet
The `rpg-characters-32x32.png` has a magenta background (#FF00FF).

**Option A - Run script:**
```bash
npm install sharp
node scripts/process-sprites.js
```

**Option B - Manual (any image editor):**
1. Open in GIMP/Photoshop
2. Select magenta color (#FF00FF)
3. Delete/make transparent
4. Save as PNG with transparency

---

## Character Mapping Quick Reference

| Role | Sprite Row | Notes |
|------|------------|-------|
| Player | 2 or 3 | Light-skinned human |
| Village Guide | 10 | Brown clothed |
| Shopkeeper | 14 | Tan/merchant |
| Healer | 8 | White robed |
| Monster Breeder | 16 | Orange clothed |
| Guards | 6-7 | Armored knights |
| Skeleton Enemy | 0-1 | Undead |

See `sprites/characters/CHARACTER-MAP.md` for full details.

---

## Monster Mapping Quick Reference

| Icon Range | Monster Type |
|------------|--------------|
| 1-4 | Spiders/Beetles |
| 5-8 | Mushroom creatures |
| 9-12 | Fire elementals |
| 13-14 | Slimes |
| 15-19 | Pumpkins/Ghosts |
| 20-24 | Plant monsters |
| 25-29 | Ice creatures |
| 30-34 | Slime variants |
| 35-39 | Crabs/Beetles |
| 40-44 | Rock/Earth golems |
| 45-48 | More pumpkins |

See `sprites/monsters/MONSTER-MAP.md` for full details.

---

## Tileset Quick Reference

| File | Contents |
|------|----------|
| Ground Tileset | Grass, dirt, paths, transitions |
| Trees | Large/small trees, shadows, leaves |
| Bushes | Shrubs, flowering bushes |
| Rocks | Boulders, stones, pebbles |
| Mushrooms | Colorful mushroom varieties |
| Tree Stumps | Stumps, logs, wood pieces |
| Nature Details | Grass tufts, flowers |
| Ruins | Dungeon walls, doors, stairs |

See `tilesets/mixel-32x32/TILESET-MAP.md` for full details.

---

## Migration Checklist

- [x] Download 32x32 character sprites
- [x] Copy to project
- [x] Create character mapping guide
- [x] Remove magenta background from characters ✅
- [x] Find 32x32 monster sprites ✅ Craftpix pack
- [x] Copy monsters to project ✅ 50 icons
- [x] Create monster mapping guide
- [x] Find 32x32 tileset ✅ Mixel pack
- [x] Copy tilesets to project ✅ 8 tileset files
- [x] Create tileset mapping guide
- [x] Update PreloaderScene.ts to load new assets ✅
- [x] Update sprite frame configurations ✅
- [ ] Adjust camera zoom (2x → 1.5x for 32x32)
- [ ] Create/update Tiled maps with new tilesets
- [ ] Test all animations
