# Mixel Top-Down RPG 32x32 Tileset - Mapping Guide

## Source
- **Pack**: Top-Down RPG 32x32 by Mixel v1.4
- **Author**: Mixel (mixelslime@gmail.com)
- **License**: Free for video games (personal & commercial)
- **Size**: 32x32 pixels per tile
- **Format**: PNG with transparent backgrounds

## Available Tilesets

### 1. Ground Tileset (`Topdown RPG 32x32 - Ground Tileset.png`)
Primary terrain tiles for world maps.

| Tile Type | Description |
|-----------|-------------|
| Grass | Multiple green grass variants |
| Dirt/Paths | Brown dirt paths and roads |
| Cobblestone | Grey stone path tiles |
| Transitions | Grass-to-dirt edge tiles |
| Flowers/Details | Small grass detail tiles |

### 2. Trees (`Topdown RPG 32x32 - Trees.PNG`)
Forest and nature elements.

| Element | Variants |
|---------|----------|
| Large trees | 3+ sizes with shadows |
| Small trees | Saplings and young trees |
| Dead trees | Bare branches |
| Fallen leaves | Seasonal ground scatter |

### 3. Bushes (`Topdown RPG 32x32 - Bushes.PNG`)
Vegetation and ground cover.

| Element | Variants |
|---------|----------|
| Large bushes | Dense foliage |
| Small bushes | Compact shrubs |
| Flowering | With colored flowers |
| Berry bushes | With red/blue berries |

### 4. Rocks (`Topdown RPG 32x32 - Rocks.PNG`)
Stone and boulder elements.

| Element | Sizes |
|---------|-------|
| Boulders | Large grey stones |
| Rocks | Medium stones |
| Pebbles | Small stone clusters |

### 5. Mushrooms (`Topdown RPG 32x32 - Mushrooms.png`)
Decorative fungi.

| Type | Colors |
|------|--------|
| Cap mushrooms | Red, brown, white |
| Cluster mushrooms | Various |
| Small mushrooms | Tiny variants |

### 6. Tree Stumps and Logs (`Topdown RPG 32x32 - Tree Stumps and Logs.png`)
Forest floor elements.

| Element | Description |
|---------|-------------|
| Stumps | Cut tree bases |
| Logs | Fallen tree trunks |
| Wood pieces | Chopped wood |

### 7. Nature Details (`Topdown RPG 32x32 - Nature Details.png`)
Small decorative elements.

| Element | Description |
|---------|-------------|
| Grass tufts | Tall grass patches |
| Flowers | Yellow, white flowers |
| Plants | Small vegetation |

### 8. Ruins (`Topdown RPG 32x32 - Ruins.PNG`)
Dungeon and structure elements.

| Element | Description |
|---------|-------------|
| Stone walls | Grey brick walls |
| Floors | Stone floor tiles |
| Doors | Wooden doors |
| Stairs | Stone staircases |
| Columns | Pillar elements |
| Debris | Broken stone pieces |

## Usage in Phaser

```typescript
// Load tilesets in PreloaderScene
this.load.image('tileset-ground', 'assets/tilesets/mixel-32x32/Topdown RPG 32x32 - Ground Tileset.png');
this.load.image('tileset-trees', 'assets/tilesets/mixel-32x32/Topdown RPG 32x32 - Trees.PNG');
this.load.image('tileset-bushes', 'assets/tilesets/mixel-32x32/Topdown RPG 32x32 - Bushes.PNG');
this.load.image('tileset-rocks', 'assets/tilesets/mixel-32x32/Topdown RPG 32x32 - Rocks.PNG');
this.load.image('tileset-ruins', 'assets/tilesets/mixel-32x32/Topdown RPG 32x32 - Ruins.PNG');

// For Tiled map editor integration
// Export as embedded tileset or reference external PNG
```

## Recommended Map Layers

1. **Ground** - Base terrain (grass, dirt, stone)
2. **Ground Details** - Flowers, grass tufts
3. **Objects Below** - Rocks, stumps, mushrooms
4. **Objects Above** - Trees, bushes (with depth sorting)
5. **Structures** - Ruins, walls, doors

## Game Area Suggestions

| Area | Primary Tilesets |
|------|------------------|
| Village | Ground, Trees, Bushes, Flowers |
| Forest | Ground, Trees, Mushrooms, Stumps |
| Cave/Dungeon | Ruins, Rocks |
| Meadow | Ground, Bushes, Flowers |

## Sample Image
`Sample.PNG` shows a complete assembled scene demonstrating how all tiles work together.
