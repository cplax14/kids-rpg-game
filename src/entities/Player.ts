import Phaser from 'phaser'
import { PLAYER_SPEED, TILE_SIZE } from '../config'
import type { InputState } from '../systems/InputSystem'

export type PlayerDirection = 'up' | 'down' | 'left' | 'right'

export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite
  private direction: PlayerDirection = 'down'
  private isMoving: boolean = false

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.sprite = scene.physics.add.sprite(x, y, 'player', 'down-1')
    this.sprite.setSize(16, 16)
    this.sprite.setOffset(8, 32)
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
  }

  private playIdleAnimation(): void {
    this.sprite.anims.play(`player-idle-${this.direction}`, true)
  }
}
