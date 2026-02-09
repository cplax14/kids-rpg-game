# Monster Sprites 32x32 - Mapping Guide

## Source
- **Pack**: Free Low-Level Monsters Pixel Icons 32x32
- **Source**: Craftpix.net
- **License**: Free for personal and commercial video games
- **Size**: 32x32 pixels per icon
- **Format**: PNG with transparent backgrounds

## Monster Icons (50 total)

These are static icons suitable for:
- Battle scene enemy display
- Monster collection/bestiary UI
- Party monster portraits
- Shop/breeding displays

### Suggested Game Mapping

| Icon | Monster Type | Suggested Game Species |
|------|--------------|------------------------|
| Icon1 | Dark spider | `shadowcrawler` |
| Icon2 | Red spider | `emberspider` |
| Icon3 | Blue beetle | `shellback` |
| Icon4 | Orange beetle | `firebeetle` |
| Icon5 | Mushroom warrior | `shroomling` |
| Icon6 | Mushroom mage | `sporeling` |
| Icon7 | Brown mushroom | `funglet` |
| Icon8 | Red mushroom | `toadstool` |
| Icon9 | Fire creature | `emberpup` |
| Icon10 | Lava beetle | `lavabug` |
| Icon11 | Fire elemental | `flameling` |
| Icon12 | Small flame | `cindermite` |
| Icon13 | Yellow slime | `sunslime` |
| Icon14 | Green slime | `mossblob` |
| Icon15 | Pumpkin goblin | `pumpkling` |
| Icon16 | Pumpkin warrior | `gourdian` |
| Icon17 | Jack-o-lantern | `lanternjack` |
| Icon18 | Scarecrow | `strawguard` |
| Icon19 | Small ghost | `wisp` |
| Icon20 | Plant monster | `petalfin` |
| Icon21 | Flower creature | `bloomsprout` |
| Icon22 | Vine monster | `thornwhip` |
| Icon23 | Leaf creature | `leafling` |
| Icon24 | Forest spirit | `dryad` |
| Icon25 | Ice golem | `frostgolem` |
| Icon26 | Snow creature | `snowdrift` |
| Icon27 | Ice elemental | `glaciette` |
| Icon28 | Frost spirit | `chillwind` |
| Icon29 | Crystal creature | `crystalkin` |
| Icon30 | Green slime | `muckslime` |
| Icon31 | Blue slime | `aquablob` |
| Icon32 | Purple slime | `toxislime` |
| Icon33 | Red slime | `magmaslime` |
| Icon34 | Dark slime | `shadowslime` |
| Icon35 | Dark beetle | `nightcrawler` |
| Icon36 | Purple crab | `shellclaw` |
| Icon37 | Blue crab | `tidecrab` |
| Icon38 | Red crab | `lavacrab` |
| Icon39 | Green crab | `mosscrab` |
| Icon40 | Rock golem | `stonekin` |
| Icon41 | Earth elemental | `mudgolem` |
| Icon42 | Clay creature | `clayling` |
| Icon43 | Boulder beast | `rockrunt` |
| Icon44 | Gem golem | `gemling` |
| Icon45 | Pumpkin beast | `gourdmonster` |
| Icon46 | Dark pumpkin | `nightpumpkin` |
| Icon47 | Ghost pumpkin | `spookgourd` |
| Icon48 | Pumpkin king | `pumpkingdom` |
| Icon49 | Bonus creature 1 | (bonus) |
| Icon50 | Bonus creature 2 | (bonus) |

## Usage in Phaser

```typescript
// Load individual monster icon
this.load.image('monster-shadowcrawler', 'assets/sprites/monsters/Icon1.png');

// Or load all monsters dynamically
for (let i = 1; i <= 48; i++) {
  this.load.image(`monster-icon-${i}`, `assets/sprites/monsters/Icon${i}.png`);
}
```

## Breeding Groups (Suggested)

| Group | Icons | Description |
|-------|-------|-------------|
| **Beast** | 1-4, 35-39 | Spiders, beetles, crabs |
| **Elemental** | 9-12, 25-29, 40-44 | Fire, ice, earth creatures |
| **Plant** | 5-8, 20-24 | Mushrooms, flowers, vines |
| **Aquatic** | 30-34 | Slimes (various) |
| **Spirit** | 15-19, 45-48 | Pumpkins, ghosts |

## Notes

- All icons have transparent backgrounds - ready to use
- Icons are static (no animation frames)
- For animated monsters in world/battle, consider creating sprite sheets or using these as portraits
