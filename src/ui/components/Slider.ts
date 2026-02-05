import Phaser from 'phaser'
import { COLORS, TEXT_STYLES, DEPTH } from '../../config'

export interface SliderOptions {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height?: number
  readonly min?: number
  readonly max?: number
  readonly value: number
  readonly label: string
  readonly showValue?: boolean
  readonly onValueChange?: (value: number) => void
}

export class Slider {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private track: Phaser.GameObjects.Graphics
  private fill: Phaser.GameObjects.Graphics
  private handle: Phaser.GameObjects.Ellipse
  private valueText: Phaser.GameObjects.Text | null = null
  private labelText: Phaser.GameObjects.Text

  private width: number
  private height: number
  private min: number
  private max: number
  private value: number
  private isDragging = false
  private onValueChange?: (value: number) => void

  constructor(scene: Phaser.Scene, options: SliderOptions) {
    this.scene = scene
    this.width = options.width
    this.height = options.height ?? 8
    this.min = options.min ?? 0
    this.max = options.max ?? 1
    this.value = Math.max(this.min, Math.min(this.max, options.value))
    this.onValueChange = options.onValueChange

    this.container = scene.add.container(options.x, options.y)
    this.container.setDepth(DEPTH.OVERLAY + 3)

    // Label
    this.labelText = scene.add.text(0, -20, options.label, {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
    })
    this.container.add(this.labelText)

    // Track background
    this.track = scene.add.graphics()
    this.track.fillStyle(0x333333, 1)
    this.track.fillRoundedRect(0, 0, this.width, this.height, this.height / 2)
    this.container.add(this.track)

    // Fill
    this.fill = scene.add.graphics()
    this.container.add(this.fill)

    // Handle
    const handleX = this.valueToX(this.value)
    this.handle = scene.add.ellipse(handleX, this.height / 2, 18, 18, COLORS.PRIMARY)
    this.handle.setStrokeStyle(2, 0xffffff)
    this.handle.setInteractive({ useHandCursor: true, draggable: true })
    this.container.add(this.handle)

    // Value text
    if (options.showValue !== false) {
      this.valueText = scene.add.text(this.width + 15, -4, this.formatValue(this.value), {
        ...TEXT_STYLES.BODY,
        fontSize: '14px',
      })
      this.container.add(this.valueText)
    }

    this.updateFill()
    this.setupInput()
  }

  private setupInput(): void {
    // Drag handle
    this.handle.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number) => {
      const clampedX = Math.max(0, Math.min(this.width, dragX))
      this.handle.setX(clampedX)
      this.value = this.xToValue(clampedX)
      this.updateFill()
      this.updateValueText()
      this.onValueChange?.(this.value)
    })

    // Click on track to set value
    const hitArea = this.scene.add.rectangle(this.width / 2, this.height / 2, this.width, 24)
    hitArea.setInteractive({ useHandCursor: true })
    this.container.add(hitArea)

    hitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const localX = pointer.x - this.container.x
      const clampedX = Math.max(0, Math.min(this.width, localX))
      this.handle.setX(clampedX)
      this.value = this.xToValue(clampedX)
      this.updateFill()
      this.updateValueText()
      this.onValueChange?.(this.value)
    })
  }

  private valueToX(value: number): number {
    const ratio = (value - this.min) / (this.max - this.min)
    return ratio * this.width
  }

  private xToValue(x: number): number {
    const ratio = x / this.width
    return this.min + ratio * (this.max - this.min)
  }

  private updateFill(): void {
    this.fill.clear()
    this.fill.fillStyle(COLORS.PRIMARY, 1)
    const fillWidth = this.valueToX(this.value)
    if (fillWidth > 0) {
      this.fill.fillRoundedRect(0, 0, fillWidth, this.height, this.height / 2)
    }
  }

  private updateValueText(): void {
    if (this.valueText) {
      this.valueText.setText(this.formatValue(this.value))
    }
  }

  private formatValue(value: number): string {
    return `${Math.round(value * 100)}%`
  }

  getValue(): number {
    return this.value
  }

  setValue(value: number): void {
    this.value = Math.max(this.min, Math.min(this.max, value))
    this.handle.setX(this.valueToX(this.value))
    this.updateFill()
    this.updateValueText()
  }

  setEnabled(enabled: boolean): void {
    this.handle.setInteractive(enabled ? { useHandCursor: true, draggable: true } : false)
    this.handle.setAlpha(enabled ? 1 : 0.5)
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container
  }

  destroy(): void {
    this.container.destroy()
  }
}
