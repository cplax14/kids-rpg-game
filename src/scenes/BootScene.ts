import Phaser from 'phaser'
import { SCENE_KEYS, COLORS, GAME_WIDTH, GAME_HEIGHT } from '../config'

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.BOOT })
  }

  preload(): void {
    this.createPlaceholderTextures()
  }

  create(): void {
    this.scene.start(SCENE_KEYS.PRELOADER)
  }

  private createPlaceholderTextures(): void {
    this.createPlayerTexture()
    this.createTilesetTexture()
    this.createForestTilesetTexture()
    this.createCaveTilesetTexture()
    this.createUITextures()
  }

  private createPlayerTexture(): void {
    const frameWidth = 32
    const frameHeight = 48
    const directions = 4
    const framesPerDirection = 3

    const graphics = this.add.graphics()
    const canvas = this.textures.createCanvas(
      'player',
      frameWidth * framesPerDirection,
      frameHeight * directions,
    )

    if (!canvas) return

    const ctx = canvas.context

    for (let dir = 0; dir < directions; dir++) {
      for (let frame = 0; frame < framesPerDirection; frame++) {
        const x = frame * frameWidth
        const y = dir * frameHeight

        // Body
        ctx.fillStyle = '#4fc3f7'
        ctx.fillRect(x + 8, y + 16, 16, 24)

        // Head
        ctx.fillStyle = '#ffe0b2'
        ctx.fillRect(x + 10, y + 4, 12, 14)

        // Hair
        ctx.fillStyle = '#5d4037'
        ctx.fillRect(x + 9, y + 2, 14, 8)

        // Eyes based on direction
        ctx.fillStyle = '#333333'
        if (dir === 0) {
          // Down
          ctx.fillRect(x + 13, y + 10, 2, 3)
          ctx.fillRect(x + 17, y + 10, 2, 3)
        } else if (dir === 1) {
          // Left
          ctx.fillRect(x + 11, y + 10, 2, 3)
        } else if (dir === 2) {
          // Right
          ctx.fillRect(x + 19, y + 10, 2, 3)
        }
        // Up = no eyes visible

        // Legs with walk offset
        ctx.fillStyle = '#1565c0'
        const legOffset = frame === 1 ? 2 : frame === 2 ? -2 : 0
        ctx.fillRect(x + 10, y + 38, 5, 10)
        ctx.fillRect(x + 17 + legOffset, y + 38, 5, 10)

        // Boots
        ctx.fillStyle = '#795548'
        ctx.fillRect(x + 9, y + 44, 7, 4)
        ctx.fillRect(x + 16 + legOffset, y + 44, 7, 4)
      }
    }

    canvas.refresh()
    graphics.destroy()
  }

  private createTilesetTexture(): void {
    const tileSize = 32
    const tilesPerRow = 8
    const rows = 4
    const canvas = this.textures.createCanvas(
      'village-tileset',
      tileSize * tilesPerRow,
      tileSize * rows,
    )

    if (!canvas) return

    const ctx = canvas.context

    const tileColors: ReadonlyArray<{ color: string; label: string }> = [
      // Row 0: Ground tiles
      { color: '#4caf50', label: 'grass' },
      { color: '#66bb6a', label: 'grass2' },
      { color: '#d7ccc8', label: 'path' },
      { color: '#bcaaa4', label: 'path2' },
      { color: '#e8d5b7', label: 'sand' },
      { color: '#90caf9', label: 'water' },
      { color: '#42a5f5', label: 'water2' },
      { color: '#795548', label: 'dirt' },
      // Row 1: Obstacles
      { color: '#2e7d32', label: 'tree' },
      { color: '#1b5e20', label: 'tree2' },
      { color: '#9e9e9e', label: 'rock' },
      { color: '#757575', label: 'rock2' },
      { color: '#8d6e63', label: 'fence' },
      { color: '#5d4037', label: 'wall' },
      { color: '#3e2723', label: 'wall2' },
      { color: '#ef5350', label: 'roof' },
      // Row 2: Buildings/structures
      { color: '#ffcc80', label: 'house' },
      { color: '#ffe0b2', label: 'house2' },
      { color: '#a1887f', label: 'door' },
      { color: '#ffd54f', label: 'window' },
      { color: '#ff8a65', label: 'shop' },
      { color: '#ce93d8', label: 'magic' },
      { color: '#80cbc4', label: 'fountain' },
      { color: '#ffab91', label: 'sign' },
      // Row 3: Decorations
      { color: '#e91e63', label: 'flower' },
      { color: '#ffc107', label: 'flower2' },
      { color: '#9c27b0', label: 'flower3' },
      { color: '#4db6ac', label: 'bush' },
      { color: '#c8e6c9', label: 'tallgrass' },
      { color: '#455a64', label: 'stone' },
      { color: '#000000', label: 'empty' },
      { color: '#ffffff', label: 'blank' },
    ]

    tileColors.forEach((tile, index) => {
      const col = index % tilesPerRow
      const row = Math.floor(index / tilesPerRow)
      const x = col * tileSize
      const y = row * tileSize

      ctx.fillStyle = tile.color
      ctx.fillRect(x, y, tileSize, tileSize)

      // Add subtle border for definition
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)'
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, y + 0.5, tileSize - 1, tileSize - 1)

      // Add simple patterns for certain tiles
      if (tile.label === 'tree' || tile.label === 'tree2') {
        ctx.fillStyle = '#4e342e'
        ctx.fillRect(x + 13, y + 20, 6, 12)
        ctx.fillStyle = tile.color
        ctx.beginPath()
        ctx.arc(x + 16, y + 14, 10, 0, Math.PI * 2)
        ctx.fill()
      }

      if (tile.label === 'water' || tile.label === 'water2') {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x + 4, y + 12)
        ctx.quadraticCurveTo(x + 16, y + 8, x + 28, y + 12)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x + 4, y + 22)
        ctx.quadraticCurveTo(x + 16, y + 18, x + 28, y + 22)
        ctx.stroke()
      }

      if (tile.label.startsWith('flower')) {
        ctx.fillStyle = '#4caf50'
        ctx.fillRect(x, y, tileSize, tileSize)
        ctx.fillStyle = tile.color
        ctx.beginPath()
        ctx.arc(x + 16, y + 14, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#ffeb3b'
        ctx.beginPath()
        ctx.arc(x + 16, y + 14, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    })

    canvas.refresh()
  }

  private createForestTilesetTexture(): void {
    const tileSize = 32
    const tilesPerRow = 8
    const rows = 4
    const canvas = this.textures.createCanvas(
      'forest-tileset',
      tileSize * tilesPerRow,
      tileSize * rows,
    )

    if (!canvas) return

    const ctx = canvas.context

    const forestTiles: ReadonlyArray<{ color: string; label: string }> = [
      // Row 0: Ground tiles
      { color: '#2d5a27', label: 'dark-grass' },
      { color: '#3d6b37', label: 'dark-grass2' },
      { color: '#5a3d2b', label: 'dirt' },
      { color: '#4a2d1b', label: 'dirt2' },
      { color: '#1a3d14', label: 'moss' },
      { color: '#4a7a44', label: 'grass-light' },
      { color: '#6b4a3a', label: 'path' },
      { color: '#3d2a1a', label: 'mud' },
      // Row 1: Trees and obstacles
      { color: '#1a3d14', label: 'tree-dark' },
      { color: '#0d2b0d', label: 'tree-darker' },
      { color: '#5a5a5a', label: 'rock' },
      { color: '#4a4a4a', label: 'rock2' },
      { color: '#3d6b37', label: 'bush' },
      { color: '#2d5a27', label: 'shrub' },
      { color: '#8b6914', label: 'log' },
      { color: '#7a5a0a', label: 'log2' },
      // Row 2: Decorations
      { color: '#6b3d8b', label: 'mushroom-purple' },
      { color: '#8b3d3d', label: 'mushroom-red' },
      { color: '#d4a574', label: 'stump' },
      { color: '#3d8b6b', label: 'fern' },
      { color: '#8b6b3d', label: 'fallen-branch' },
      { color: '#5a8b3d', label: 'tall-grass' },
      { color: '#80cbc4', label: 'fountain' },
      { color: '#8b5a3d', label: 'sign' },
      // Row 3: Flowers and extras
      { color: '#e91e63', label: 'flower-pink' },
      { color: '#ff9800', label: 'flower-orange' },
      { color: '#9c27b0', label: 'flower-purple' },
      { color: '#2d5a27', label: 'bush-dark' },
      { color: '#4a7a44', label: 'grass-patch' },
      { color: '#8b4513', label: 'mushroom-brown' },
      { color: '#1a1a1a', label: 'empty' },
      { color: '#2a2a2a', label: 'shadow' },
    ]

    forestTiles.forEach((tile, index) => {
      const col = index % tilesPerRow
      const row = Math.floor(index / tilesPerRow)
      const x = col * tileSize
      const y = row * tileSize

      ctx.fillStyle = tile.color
      ctx.fillRect(x, y, tileSize, tileSize)

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, y + 0.5, tileSize - 1, tileSize - 1)

      // Add tree foliage pattern
      if (tile.label.startsWith('tree')) {
        ctx.fillStyle = '#3d2a1a'
        ctx.fillRect(x + 13, y + 20, 6, 12)
        ctx.fillStyle = tile.color
        ctx.beginPath()
        ctx.arc(x + 16, y + 12, 11, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
        ctx.beginPath()
        ctx.arc(x + 18, y + 14, 8, 0, Math.PI * 2)
        ctx.fill()
      }

      // Add mushroom cap
      if (tile.label.startsWith('mushroom')) {
        ctx.fillStyle = '#f5deb3'
        ctx.fillRect(x + 13, y + 20, 6, 10)
        ctx.fillStyle = tile.color
        ctx.beginPath()
        ctx.arc(x + 16, y + 16, 8, Math.PI, 0)
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(x + 12, y + 13, 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(x + 20, y + 14, 2, 0, Math.PI * 2)
        ctx.fill()
      }

      // Add flower pattern
      if (tile.label.startsWith('flower')) {
        ctx.fillStyle = '#2d5a27'
        ctx.fillRect(x, y, tileSize, tileSize)
        ctx.fillStyle = tile.color
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2
          const px = x + 16 + Math.cos(angle) * 4
          const py = y + 14 + Math.sin(angle) * 4
          ctx.beginPath()
          ctx.arc(px, py, 4, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = '#ffeb3b'
        ctx.beginPath()
        ctx.arc(x + 16, y + 14, 3, 0, Math.PI * 2)
        ctx.fill()
      }
    })

    canvas.refresh()
  }

  private createCaveTilesetTexture(): void {
    const tileSize = 32
    const tilesPerRow = 8
    const rows = 4
    const canvas = this.textures.createCanvas(
      'cave-tileset',
      tileSize * tilesPerRow,
      tileSize * rows,
    )

    if (!canvas) return

    const ctx = canvas.context

    const caveTiles: ReadonlyArray<{ color: string; label: string }> = [
      // Row 0: Floor tiles
      { color: '#3d3d3d', label: 'stone' },
      { color: '#4a4a4a', label: 'stone2' },
      { color: '#2d2d2d', label: 'dark-stone' },
      { color: '#5a5a5a', label: 'light-stone' },
      { color: '#3a3a4a', label: 'blue-stone' },
      { color: '#4a3a3a', label: 'red-stone' },
      { color: '#3a4a3a', label: 'green-stone' },
      { color: '#2a2a2a', label: 'shadow' },
      // Row 1: Walls and rocks
      { color: '#1a1a1a', label: 'wall' },
      { color: '#0d0d0d', label: 'wall-dark' },
      { color: '#5a5a5a', label: 'rock' },
      { color: '#4a4a4a', label: 'rock2' },
      { color: '#3d3d3d', label: 'boulder' },
      { color: '#2d2d2d', label: 'boulder2' },
      { color: '#6a6a7a', label: 'stalagmite' },
      { color: '#5a5a6a', label: 'stalactite' },
      // Row 2: Crystals and specials
      { color: '#00bcd4', label: 'crystal-cyan' },
      { color: '#9c27b0', label: 'crystal-purple' },
      { color: '#e91e63', label: 'crystal-pink' },
      { color: '#4caf50', label: 'crystal-green' },
      { color: '#ff9800', label: 'crystal-orange' },
      { color: '#03a9f4', label: 'crystal-blue' },
      { color: '#80cbc4', label: 'pool' },
      { color: '#8b5a3d', label: 'sign' },
      // Row 3: Extras
      { color: '#6a5acd', label: 'gem' },
      { color: '#ffd700', label: 'gold-vein' },
      { color: '#c0c0c0', label: 'silver-vein' },
      { color: '#4a3a2a', label: 'gravel' },
      { color: '#3a3a3a', label: 'cracked' },
      { color: '#5a4a3a', label: 'dirt-patch' },
      { color: '#0a0a0a', label: 'pit' },
      { color: '#1a1a2a', label: 'deep-shadow' },
    ]

    caveTiles.forEach((tile, index) => {
      const col = index % tilesPerRow
      const row = Math.floor(index / tilesPerRow)
      const x = col * tileSize
      const y = row * tileSize

      ctx.fillStyle = tile.color
      ctx.fillRect(x, y, tileSize, tileSize)

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)'
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, y + 0.5, tileSize - 1, tileSize - 1)

      // Add crystal glow effect
      if (tile.label.startsWith('crystal')) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
        ctx.beginPath()
        ctx.moveTo(x + 16, y + 4)
        ctx.lineTo(x + 24, y + 28)
        ctx.lineTo(x + 8, y + 28)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = tile.color
        ctx.beginPath()
        ctx.moveTo(x + 16, y + 6)
        ctx.lineTo(x + 22, y + 26)
        ctx.lineTo(x + 10, y + 26)
        ctx.closePath()
        ctx.fill()
        // Glow
        ctx.shadowColor = tile.color
        ctx.shadowBlur = 8
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
        ctx.beginPath()
        ctx.arc(x + 16, y + 16, 3, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      }

      // Add stalagmite pattern
      if (tile.label === 'stalagmite') {
        ctx.fillStyle = '#2d2d2d'
        ctx.fillRect(x, y, tileSize, tileSize)
        ctx.fillStyle = tile.color
        ctx.beginPath()
        ctx.moveTo(x + 16, y + 4)
        ctx.lineTo(x + 26, y + 28)
        ctx.lineTo(x + 6, y + 28)
        ctx.closePath()
        ctx.fill()
      }

      // Add rock texture
      if (tile.label.startsWith('rock') || tile.label.startsWith('boulder')) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
        ctx.beginPath()
        ctx.arc(x + 10, y + 12, 3, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(x + 22, y + 18, 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
        ctx.beginPath()
        ctx.arc(x + 8, y + 8, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    })

    canvas.refresh()
  }

  private createUITextures(): void {
    // Button background
    const btnCanvas = this.textures.createCanvas('button', 200, 60)
    if (btnCanvas) {
      const ctx = btnCanvas.context
      ctx.fillStyle = '#7e57c2'
      this.roundRect(ctx, 0, 0, 200, 60, 12)
      ctx.fill()
      ctx.strokeStyle = '#b39ddb'
      ctx.lineWidth = 2
      this.roundRect(ctx, 1, 1, 198, 58, 12)
      ctx.stroke()
      btnCanvas.refresh()
    }

    // Button hover
    const btnHoverCanvas = this.textures.createCanvas('button-hover', 200, 60)
    if (btnHoverCanvas) {
      const ctx = btnHoverCanvas.context
      ctx.fillStyle = '#9575cd'
      this.roundRect(ctx, 0, 0, 200, 60, 12)
      ctx.fill()
      ctx.strokeStyle = '#d1c4e9'
      ctx.lineWidth = 2
      this.roundRect(ctx, 1, 1, 198, 58, 12)
      ctx.stroke()
      btnHoverCanvas.refresh()
    }

    // Panel background
    const panelCanvas = this.textures.createCanvas('panel', 400, 300)
    if (panelCanvas) {
      const ctx = panelCanvas.context
      ctx.fillStyle = 'rgba(22, 33, 62, 0.95)'
      this.roundRect(ctx, 0, 0, 400, 300, 16)
      ctx.fill()
      ctx.strokeStyle = '#4fc3f7'
      ctx.lineWidth = 2
      this.roundRect(ctx, 1, 1, 398, 298, 16)
      ctx.stroke()
      panelCanvas.refresh()
    }
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }
}
