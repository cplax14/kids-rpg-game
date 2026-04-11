import Phaser from 'phaser'
import {
  DEPTH,
  TILE_SIZE,
  ROAMING_MONSTER_SPEED,
  ROAMING_ENCOUNTER_RADIUS,
  ROAMING_NOTICE_RADIUS,
  ROAMING_DIRECTION_CHANGE_MIN_MS,
  ROAMING_DIRECTION_CHANGE_MAX_MS,
  ROAMING_MONSTER_SCALE,
} from '../config'
import { getMonsterIconKey } from '../config/spriteMapping'
import { randomInt } from '../utils/math'

export interface RoamingMonsterConfig {
  readonly speciesId: string
  readonly level: number
  readonly x: number
  readonly y: number
}

export class RoamingMonster {
  readonly sprite: Phaser.Physics.Arcade.Sprite
  readonly triggerZone: Phaser.GameObjects.Zone
  readonly speciesId: string
  readonly level: number

  private readonly scene: Phaser.Scene
  private patrolTimer: Phaser.Time.TimerEvent | null = null
  private idleTween: Phaser.Tweens.Tween | null = null
  private alertIcon: Phaser.GameObjects.Text | null = null
  private alertTween: Phaser.Tweens.Tween | null = null
  private isApproachingPlayer: boolean = false
  private destroyed: boolean = false

  constructor(scene: Phaser.Scene, config: RoamingMonsterConfig) {
    this.scene = scene
    this.speciesId = config.speciesId
    this.level = config.level

    // Create physics sprite using the 32x32 monster icon
    const textureKey = getMonsterIconKey(config.speciesId)
    this.sprite = scene.physics.add.sprite(config.x, config.y, textureKey)
    this.sprite.setScale(ROAMING_MONSTER_SCALE)
    this.sprite.setDepth(DEPTH.PLAYER - 1)
    this.sprite.setCollideWorldBounds(true)

    // Set up a smaller collision body
    this.sprite.setSize(24, 24)
    this.sprite.setOffset(4, 4)

    // Create trigger zone for encounter detection
    this.triggerZone = scene.add.zone(
      config.x,
      config.y,
      ROAMING_ENCOUNTER_RADIUS * 2,
      ROAMING_ENCOUNTER_RADIUS * 2,
    )
    scene.physics.add.existing(this.triggerZone, false)
    this.triggerZone.setDepth(DEPTH.GROUND)

    // Idle bobbing animation
    this.idleTween = scene.tweens.add({
      targets: this.sprite,
      y: config.y - 3,
      duration: 800 + randomInt(0, 400),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Start patrol behavior
    this.startPatrol()
  }

  update(playerX: number, playerY: number): void {
    if (this.destroyed) return

    // Keep trigger zone following the sprite
    this.triggerZone.setPosition(this.sprite.x, this.sprite.y)

    // Check if player is within notice radius
    const dx = playerX - this.sprite.x
    const dy = playerY - this.sprite.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance < ROAMING_NOTICE_RADIUS && distance > ROAMING_ENCOUNTER_RADIUS) {
      // Player is close — approach them
      if (!this.isApproachingPlayer) {
        this.isApproachingPlayer = true
        this.stopPatrol()
        this.showAlert()
      }
      this.moveToward(playerX, playerY)
    } else if (this.isApproachingPlayer && distance >= ROAMING_NOTICE_RADIUS) {
      // Player moved away — resume patrol
      this.isApproachingPlayer = false
      this.hideAlert()
      this.startPatrol()
    }
  }

  private moveToward(targetX: number, targetY: number): void {
    const dx = targetX - this.sprite.x
    const dy = targetY - this.sprite.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance < 1) return

    const speed = ROAMING_MONSTER_SPEED * 1.2
    this.sprite.setVelocity(
      (dx / distance) * speed,
      (dy / distance) * speed,
    )

    // Flip sprite to face movement direction
    this.sprite.setFlipX(dx < 0)
  }

  private startPatrol(): void {
    if (this.destroyed) return

    this.pickRandomDirection()

    const delay = randomInt(ROAMING_DIRECTION_CHANGE_MIN_MS, ROAMING_DIRECTION_CHANGE_MAX_MS)
    this.patrolTimer = this.scene.time.addEvent({
      delay,
      callback: () => {
        if (this.destroyed || this.isApproachingPlayer) return
        this.pickRandomDirection()
        this.startPatrol()
      },
    })
  }

  private stopPatrol(): void {
    if (this.patrolTimer) {
      this.patrolTimer.destroy()
      this.patrolTimer = null
    }
  }

  private pickRandomDirection(): void {
    // 20% chance to pause, 80% chance to move in a random direction
    if (Math.random() < 0.2) {
      this.sprite.setVelocity(0, 0)
      return
    }

    const angle = Math.random() * Math.PI * 2
    this.sprite.setVelocity(
      Math.cos(angle) * ROAMING_MONSTER_SPEED,
      Math.sin(angle) * ROAMING_MONSTER_SPEED,
    )

    // Flip sprite to face movement direction
    this.sprite.setFlipX(Math.cos(angle) < 0)
  }

  private showAlert(): void {
    if (this.alertIcon) return

    this.alertIcon = this.scene.add.text(
      this.sprite.x,
      this.sprite.y - 20,
      '!',
      {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '16px',
        color: '#ff4444',
        stroke: '#000000',
        strokeThickness: 3,
      },
    )
    this.alertIcon.setOrigin(0.5)
    this.alertIcon.setDepth(DEPTH.ABOVE_PLAYER)

    this.alertTween = this.scene.tweens.add({
      targets: this.alertIcon,
      y: this.sprite.y - 26,
      duration: 300,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.hideAlert()
      },
    })
  }

  private hideAlert(): void {
    if (this.alertTween) {
      this.alertTween.stop()
      this.alertTween = null
    }
    if (this.alertIcon) {
      this.alertIcon.destroy()
      this.alertIcon = null
    }
  }

  /** Called when monster collides with a wall — pick a new direction */
  onCollision(): void {
    if (this.destroyed || this.isApproachingPlayer) return
    this.pickRandomDirection()
  }

  getPosition(): { readonly x: number; readonly y: number } {
    return { x: this.sprite.x, y: this.sprite.y }
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true

    this.stopPatrol()

    if (this.idleTween) {
      this.idleTween.stop()
      this.idleTween = null
    }

    this.hideAlert()
    this.sprite.destroy()
    this.triggerZone.destroy()
  }
}
