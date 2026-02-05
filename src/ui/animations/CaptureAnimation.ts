import Phaser from 'phaser'
import { COLORS, DEPTH } from '../../config'

export interface CaptureAnimationConfig {
  readonly scene: Phaser.Scene
  readonly deviceX: number
  readonly deviceY: number
  readonly targetX: number
  readonly targetY: number
  readonly shakeCount: number
  readonly succeeded: boolean
  readonly deviceName: string
}

export function playCaptureAnimation(config: CaptureAnimationConfig): Promise<void> {
  const { scene, deviceX, deviceY, targetX, targetY, shakeCount, succeeded, deviceName } = config

  return new Promise((resolve) => {
    // Create capsule sprite (simple rectangle for now)
    const capsule = scene.add.graphics()
    capsule.fillStyle(COLORS.WARNING, 1)
    capsule.fillRoundedRect(-15, -20, 30, 40, 8)
    capsule.lineStyle(2, 0xffffff, 0.8)
    capsule.strokeRoundedRect(-15, -20, 30, 40, 8)

    const capsuleContainer = scene.add.container(deviceX, deviceY, [capsule])
    capsuleContainer.setDepth(DEPTH.UI + 5)
    capsuleContainer.setScale(0.5)
    capsuleContainer.setAlpha(0)

    // Phase 1: Capsule appears and arcs toward target
    scene.tweens.add({
      targets: capsuleContainer,
      alpha: 1,
      scale: 1,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        // Arc tween toward target
        const controlPointX = (deviceX + targetX) / 2
        const controlPointY = Math.min(deviceY, targetY) - 100 // Arc upward

        scene.tweens.add({
          targets: capsuleContainer,
          x: targetX,
          y: targetY,
          duration: 500,
          ease: 'Sine.easeOut',
          onUpdate: (tween) => {
            // Simple arc - adjust Y based on progress
            const progress = tween.progress
            const arcHeight = -80 * Math.sin(progress * Math.PI)
            capsuleContainer.setY(
              deviceY + (targetY - deviceY) * progress + arcHeight,
            )
          },
          onComplete: () => {
            // Phase 2: Target shrinks into capsule
            animateTargetShrink(scene, targetX, targetY, () => {
              // Phase 3: Shake animation
              animateShakes(scene, capsuleContainer, shakeCount, () => {
                if (succeeded) {
                  // Phase 4a: Success sparkle
                  animateSuccess(scene, capsuleContainer, () => {
                    capsuleContainer.destroy()
                    resolve()
                  })
                } else {
                  // Phase 4b: Failure break
                  animateFailure(scene, capsuleContainer, targetX, targetY, () => {
                    capsuleContainer.destroy()
                    resolve()
                  })
                }
              })
            })
          },
        })
      },
    })
  })
}

function animateTargetShrink(
  scene: Phaser.Scene,
  x: number,
  y: number,
  onComplete: () => void,
): void {
  // Create a shrinking circle effect
  const shrinkEffect = scene.add.graphics()
  shrinkEffect.fillStyle(0xffffff, 0.8)
  shrinkEffect.fillCircle(0, 0, 40)

  const container = scene.add.container(x, y, [shrinkEffect])
  container.setDepth(DEPTH.UI + 4)

  scene.tweens.add({
    targets: container,
    scaleX: 0,
    scaleY: 0,
    alpha: 0.5,
    duration: 300,
    ease: 'Power2',
    onComplete: () => {
      container.destroy()
      onComplete()
    },
  })
}

function animateShakes(
  scene: Phaser.Scene,
  capsule: Phaser.GameObjects.Container,
  shakeCount: number,
  onComplete: () => void,
): void {
  if (shakeCount <= 0) {
    scene.time.delayedCall(200, onComplete)
    return
  }

  const origX = capsule.x

  let shakesCompleted = 0

  const doShake = () => {
    scene.tweens.add({
      targets: capsule,
      x: origX - 10,
      duration: 80,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        shakesCompleted++

        // Pause between shakes
        scene.time.delayedCall(400, () => {
          if (shakesCompleted < shakeCount) {
            doShake()
          } else {
            onComplete()
          }
        })
      },
    })
  }

  // Initial delay before first shake
  scene.time.delayedCall(300, doShake)
}

function animateSuccess(
  scene: Phaser.Scene,
  capsule: Phaser.GameObjects.Container,
  onComplete: () => void,
): void {
  // Sparkle effect using simple circles
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    const sparkle = scene.add.graphics()
    sparkle.fillStyle(COLORS.GOLD, 1)
    sparkle.fillCircle(0, 0, 6)

    const container = scene.add.container(
      capsule.x + Math.cos(angle) * 20,
      capsule.y + Math.sin(angle) * 20,
      [sparkle],
    )
    container.setDepth(DEPTH.UI + 6)
    container.setScale(0)

    scene.tweens.add({
      targets: container,
      x: capsule.x + Math.cos(angle) * 60,
      y: capsule.y + Math.sin(angle) * 60,
      scale: 1,
      alpha: 0,
      duration: 500,
      delay: i * 50,
      ease: 'Power2',
      onComplete: () => container.destroy(),
    })
  }

  // Flash the capsule
  scene.tweens.add({
    targets: capsule,
    alpha: 0.3,
    duration: 100,
    yoyo: true,
    repeat: 2,
    onComplete: () => {
      scene.tweens.add({
        targets: capsule,
        scale: 0,
        alpha: 0,
        duration: 300,
        delay: 300,
        ease: 'Back.easeIn',
        onComplete,
      })
    },
  })
}

function animateFailure(
  scene: Phaser.Scene,
  capsule: Phaser.GameObjects.Container,
  targetX: number,
  targetY: number,
  onComplete: () => void,
): void {
  // Capsule breaks open
  scene.tweens.add({
    targets: capsule,
    scaleX: 1.5,
    scaleY: 0.5,
    duration: 150,
    yoyo: true,
    onComplete: () => {
      // Red flash
      const flash = scene.add.graphics()
      flash.fillStyle(COLORS.DANGER, 0.4)
      flash.fillCircle(0, 0, 50)

      const flashContainer = scene.add.container(targetX, targetY, [flash])
      flashContainer.setDepth(DEPTH.UI + 3)

      scene.tweens.add({
        targets: flashContainer,
        scale: 2,
        alpha: 0,
        duration: 300,
        onComplete: () => flashContainer.destroy(),
      })

      // Capsule flies away
      scene.tweens.add({
        targets: capsule,
        y: capsule.y + 200,
        rotation: Math.PI * 2,
        alpha: 0,
        duration: 500,
        ease: 'Power2',
        onComplete,
      })
    },
  })
}
