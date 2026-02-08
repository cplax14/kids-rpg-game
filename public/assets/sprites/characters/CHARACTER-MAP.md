# RPG Character Sprites 32x32 - Mapping Guide

## Source
- **File**: `rpg-characters-32x32.png`
- **Original**: https://opengameart.org/sites/default/files/RPGCharacterSprites32x32.png
- **License**: Check OpenGameArt for specific license
- **Size**: 384 x 672 pixels (12 columns × 21 rows of 32x32 sprites)

## Sprite Sheet Layout

Each character has **12 frames** arranged as:
- 3 frames per direction × 4 directions
- Columns 0-2: Down-facing / Front (3 frames)
- Columns 3-5: Up-facing / Back (3 frames)
- Columns 6-8: Left-facing (3 frames)
- Columns 9-11: Right-facing (3 frames)

**Note**: This is Down, Up, Left, Right order (not the common Down, Left, Right, Up)

## Character Rows

| Row | Character Type | Suggested Use |
|-----|----------------|---------------|
| 0 | White skeleton | Enemy |
| 1 | Gray skeleton | Enemy |
| 2 | Light skin, blonde hair | Player option |
| 3 | Light skin, brown hair | Player option |
| 4 | Red mage/clothed | Villager / Mage NPC |
| 5 | Red mage variant | Villager |
| 6 | Gray armored knight | Guard NPC |
| 7 | Blue armored knight | Guard NPC |
| 8 | White robed | **Healer** |
| 9 | Dark robed | Mysterious NPC |
| 10 | Brown clothed | **Village Guide** |
| 11 | Dark skin variant | Villager |
| 12 | Blue clothed | Villager |
| 13 | Blue/gray variant | Villager |
| 14 | Tan/brown clothed | **Shopkeeper** |
| 15 | Color variant | Villager |
| 16 | Orange/yellow clothed | **Monster Breeder** |
| 17 | Teal clothed | Villager |
| 18 | Striped/colorful | Child NPC |
| 19 | More variants | Villager |
| 20 | Additional row | Extra characters |

## Recommended Game Mapping

### Player Character
- **Row 2 or 3** - Light skin human (classic hero look)
- Frame size: 32x32
- Animation: 3 frames per direction

### NPCs

| NPC | Row | Description |
|-----|-----|-------------|
| Village Guide | 10 | Brown clothed, friendly |
| Shopkeeper | 14 | Tan/merchant look |
| Healer | 8 | White robed |
| Monster Breeder | 16 | Orange/yellow, elder look |
| Guards | 6-7 | Armored knights |

### Enemies
- **Rows 0-1**: Skeletons (undead enemies)

## Frame Extraction Formula

To get a specific frame:
```
x = (column * 32)
y = (row * 32)
width = 32
height = 32
```

Example - Player facing down, middle frame:
```
x = 1 * 32 = 32
y = 2 * 32 = 64
```

## Weapons (Right side of sheet)

Small weapon sprites are included on the right side:
- Sword
- Staff
- Shield
- Bow
- Other equipment

## Processing Required

The sprite sheet has a **magenta background** (#FF00FF) that needs to be made transparent.

Run the processing script:
```bash
npm install sharp
node scripts/process-sprites.js
```

Or manually remove magenta in any image editor (GIMP, Photoshop, etc.)
