import type { MonsterElement } from '../models/types'

export type ElementShape = 'circle' | 'triangle' | 'square' | 'diamond' | 'star' | 'hexagon'

export interface ElementIndicator {
  readonly color: number
  readonly shape: ElementShape
}

// Color-blind friendly element indicators using both color and shape
export const ELEMENT_INDICATORS: Record<MonsterElement, ElementIndicator> = {
  fire: { color: 0xef5350, shape: 'triangle' },
  water: { color: 0x42a5f5, shape: 'circle' },
  earth: { color: 0x8d6e63, shape: 'square' },
  wind: { color: 0x66bb6a, shape: 'diamond' },
  light: { color: 0xffd54f, shape: 'star' },
  dark: { color: 0x7e57c2, shape: 'hexagon' },
  neutral: { color: 0xbdbdbd, shape: 'circle' },
}

export function drawElementIndicator(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  element: MonsterElement,
  size: number,
): void {
  const indicator = ELEMENT_INDICATORS[element]

  graphics.fillStyle(indicator.color, 1)
  graphics.lineStyle(1, 0xffffff, 0.5)

  switch (indicator.shape) {
    case 'circle':
      graphics.fillCircle(x, y, size / 2)
      graphics.strokeCircle(x, y, size / 2)
      break

    case 'triangle':
      drawTriangle(graphics, x, y, size)
      break

    case 'square':
      const halfSize = size / 2
      graphics.fillRect(x - halfSize, y - halfSize, size, size)
      graphics.strokeRect(x - halfSize, y - halfSize, size, size)
      break

    case 'diamond':
      drawDiamond(graphics, x, y, size)
      break

    case 'star':
      drawStar(graphics, x, y, size)
      break

    case 'hexagon':
      drawHexagon(graphics, x, y, size)
      break
  }
}

function drawTriangle(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
): void {
  const halfSize = size / 2
  const height = (size * Math.sqrt(3)) / 2

  graphics.fillTriangle(
    x,
    y - height / 2,
    x - halfSize,
    y + height / 2,
    x + halfSize,
    y + height / 2,
  )

  graphics.strokeTriangle(
    x,
    y - height / 2,
    x - halfSize,
    y + height / 2,
    x + halfSize,
    y + height / 2,
  )
}

function drawDiamond(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
): void {
  const halfSize = size / 2

  graphics.beginPath()
  graphics.moveTo(x, y - halfSize)
  graphics.lineTo(x + halfSize, y)
  graphics.lineTo(x, y + halfSize)
  graphics.lineTo(x - halfSize, y)
  graphics.closePath()
  graphics.fillPath()
  graphics.strokePath()
}

function drawStar(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
): void {
  const outerRadius = size / 2
  const innerRadius = outerRadius * 0.4
  const points = 5

  graphics.beginPath()

  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius
    const angle = (Math.PI / points) * i - Math.PI / 2

    const px = x + Math.cos(angle) * radius
    const py = y + Math.sin(angle) * radius

    if (i === 0) {
      graphics.moveTo(px, py)
    } else {
      graphics.lineTo(px, py)
    }
  }

  graphics.closePath()
  graphics.fillPath()
  graphics.strokePath()
}

function drawHexagon(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
): void {
  const radius = size / 2

  graphics.beginPath()

  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2
    const px = x + Math.cos(angle) * radius
    const py = y + Math.sin(angle) * radius

    if (i === 0) {
      graphics.moveTo(px, py)
    } else {
      graphics.lineTo(px, py)
    }
  }

  graphics.closePath()
  graphics.fillPath()
  graphics.strokePath()
}

// Get element name for accessibility labels
export function getElementName(element: MonsterElement): string {
  return element.charAt(0).toUpperCase() + element.slice(1)
}

// Get contrast-safe text color for an element background
export function getContrastTextColor(element: MonsterElement): number {
  const darkElements: MonsterElement[] = ['dark', 'earth', 'water']
  return darkElements.includes(element) ? 0xffffff : 0x000000
}
