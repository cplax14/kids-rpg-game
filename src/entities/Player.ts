import Phaser from 'phaser'
import { PLAYER_SPEED, TILE_SIZE } from '../config'
import type { InputState } from '../systems/InputSystem'

export type PlayerDirection = 'up' | 'down' | 'left' | 'right'

// Scale factors for different sprite sizes
const SCALE_32x32 = 1.5 // 32x32 sprites look good at 1.5x
const SCALE_16x16 = 3   // 16x16 sprites need 3x to be visible

export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite
  private direction: PlayerDirection = 'down'
  private isMoving: boolean = false

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // Prefer 32x32 character sheet, fall back to 16x16, then procedural
    const has32Sheet = scene.textures.exists('characters-32')
    const has16Sheet = scene.textures.exists('characters-sheet')

    let textureKey: string
    let initialFrame: number | string
    let scale: number

    if (has32Sheet) {
      // Use new 32x32 character sprites
      // Player is row 2, idle down is frame 25 (row 2 * 12 cols + col 1)
      textureKey = 'characters-32'
      initialFrame = 25 // Row 2, column 1 (down-facing idle)
      scale = SCALE_32x32
    } else if (has16Sheet) {
      // Fall back to 16x16 sprites
      textureKey = 'characters-sheet'
      initialFrame = 1
      scale = SCALE_16x16
    } else {
      // Fall back to procedural texture
      textureKey = 'player'
      initialFrame = 'down-1'
      scale = 1
    }

    this.sprite = scene.physics.add.sprite(x, y, textureKey, initialFrame)
    this.sprite.setScale(scale)

    // Set collision body based on sprite type
    if (has32Sheet) {
      // 32x32 sprite collision body
      this.sprite.setSize(20, 20)
      this.sprite.setOffset(6, 10)
    } else if (has16Sheet) {
      // 16x16 sprite collision body
      this.sprite.setSize(10, 10)
      this.sprite.setOffset(3, 5)
    } else {
      // Procedural texture collision body
      this.sprite.setSize(12, 12)
      this.sprite.setOffset(10, 34)
    }

    this.sprite.setDepth(10)
  }

  update(input: InputState): void {
    const velocity = this.calculateVelocity(input)
    this.sprite.setVelocity(velocity.x, velocity.y)

    const wasMoving = this.isMoving
    this.isMoving = velocity.x !== 0 || velocity.y !== 0

    if (this.isMoving) {
      this.direction = this.getDirectionFromVelocity(velocity)
      this.playWalkAnimation()
    } else if (wasMoving) {
      this.playIdleAnimation()
    }
  }

  getPosition(): { readonly x: number; readonly y: number } {
    return { x: this.sprite.x, y: this.sprite.y }
  }

  getDirection(): PlayerDirection {
    return this.direction
  }

  getIsMoving(): boolean {
    return this.isMoving
  }

  setPosition(x: number, y: number): void {
    this.sprite.setPosition(x, y)
  }

  private calculateVelocity(input: InputState): { readonly x: number; readonly y: number } {
    let x = 0
    let y = 0

    if (input.left) x -= 1
    if (input.right) x += 1
    if (input.up) y -= 1
    if (input.down) y += 1

    // Normalize diagonal movement
    if (x !== 0 && y !== 0) {
      const factor = Math.SQRT1_2
      x *= factor
      y *= factor
    }

    return {
      x: x * PLAYER_SPEED,
      y: y * PLAYER_SPEED,
    }
  }

  private getDirectionFromVelocity(velocity: {
    readonly x: number
    readonly y: number
  }): PlayerDirection {
    // Prioritize horizontal over vertical if moving diagonally
    if (Math.abs(velocity.x) > Math.abs(velocity.y)) {
      return velocity.x > 0 ? 'right' : 'left'
    }
    return velocity.y > 0 ? 'down' : 'up'
  }

  private playWalkAnimation(): void {
    const animKey = `player-walk-${this.direction}`
    if (this.sprite.anims.currentAnim?.key !== animKey) {
      this.sprite.anims.play(animKey, true)
    }
    this.updateSpriteFlip()
  }

  private playIdleAnimation(): void {
    this.sprite.anims.play(`player-idle-${this.direction}`, true)
    this.updateSpriteFlip()
  }

  private updateSpriteFlip(): void {
    // The side-facing sprite faces RIGHT by default
    // Flip horizontally when moving LEFT to face the correct direction
    this.sprite.setFlipX(this.direction === 'left')
  }
}
