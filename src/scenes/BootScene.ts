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
