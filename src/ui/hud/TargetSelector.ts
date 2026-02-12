import Phaser from 'phaser'
import type { BattleCombatant } from '../../models/types'
import { COLORS, TEXT_STYLES, DEPTH } from '../../config'

export interface TargetPosition {
  readonly combatantId: string
  readonly x: number
  readonly y: number
}

export class TargetSelector {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container | null = null
  private targetIndicators: Map<string, Phaser.GameObjects.Graphics> = new Map()
  private selectedIndex: number = 0
  private validTargets: ReadonlyArray<BattleCombatant> = []
  private targetPositions: ReadonlyArray<TargetPosition> = []
  private onSelectCallback: ((targetId: string) => void) | null = null
  private onCancelCallback: (() => void) | null = null
  private keyboardEnabled: boolean = false
  private instructionText: Phaser.GameObjects.Text | null = null
  private cancelButton: Phaser.GameObjects.Container | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  show(
    validTargets: ReadonlyArray<BattleCombatant>,
    targetPositions: ReadonlyArray<TargetPosition>,
    onSelect: (targetId: string) => void,
    onCancel: () => void,
  ): void {
    this.hide()

    this.validTargets = validTargets
    this.targetPositions = targetPositions
    this.onSelectCallback = onSelect
    this.onCancelCallback = onCancel
    this.selectedIndex = 0

    if (validTargets.length === 0) {
      onCancel()
      return
    }

    this.container = this.scene.add.container(0, 0)
    this.container.setDepth(DEPTH.UI + 2)

    // Create selection indicators for each target
    this.createTargetIndicators()

    // Create instruction text
    this.createInstructionText()

    // Create cancel button
    this.createCancelButton()

    // Enable keyboard controls
    this.enableKeyboardControls()

    // Highlight the first target
    this.highlightTarget(this.selectedIndex)
  }

  hide(): void {
    this.disableKeyboardControls()

    if (this.container) {
      this.container.destroy()
      this.container = null
    }

    this.targetIndicators.clear()
    this.instructionText = null
    this.cancelButton = null
    this.validTargets = []
    this.targetPositions = []
    this.onSelectCallback = null
    this.onCancelCallback = null
  }

  destroy(): void {
    this.hide()
  }

  private createTargetIndicators(): void {
    this.validTargets.forEach((target, index) => {
      const position = this.targetPositions.find((p) => p.combatantId === target.combatantId)
      if (!position) return

      // Create indicator graphics
      const indicator = this.scene.add.graphics()
      indicator.setDepth(DEPTH.UI + 2)
      this.targetIndicators.set(target.combatantId, indicator)
      this.container?.add(indicator)

      // Create clickable area
      const hitArea = this.scene.add.rectangle(position.x, position.y - 40, 120, 120)
      hitArea.setInteractive({ useHandCursor: true })

      hitArea.on('pointerover', () => {
        this.selectedIndex = index
        this.highlightTarget(index)
      })

      hitArea.on('pointerdown', () => {
        this.confirmSelection()
      })

      this.container?.add(hitArea)

      // Draw initial indicator (unselected)
      this.drawIndicator(indicator, position.x, position.y, false)
    })
  }

  private drawIndicator(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    isSelected: boolean,
  ): void {
    graphics.clear()

    if (isSelected) {
      // Selected: bright pulsing ring
      graphics.lineStyle(4, COLORS.WARNING, 1)
      graphics.strokeCircle(x, y - 40, 55)

      // Arrow pointing down
      graphics.fillStyle(COLORS.WARNING, 1)
      graphics.fillTriangle(
        x, y - 85,
        x - 10, y - 100,
        x + 10, y - 100,
      )
    } else {
      // Unselected: subtle ring
      graphics.lineStyle(2, COLORS.PRIMARY, 0.5)
      graphics.strokeCircle(x, y - 40, 50)
    }
  }

  private highlightTarget(index: number): void {
    this.validTargets.forEach((target, i) => {
      const indicator = this.targetIndicators.get(target.combatantId)
      const position = this.targetPositions.find((p) => p.combatantId === target.combatantId)

      if (indicator && position) {
        this.drawIndicator(indicator, position.x, position.y, i === index)
      }
    })

    // Update instruction text with current target name
    const currentTarget = this.validTargets[index]
    if (this.instructionText && currentTarget) {
      this.instructionText.setText(`Select target: ${currentTarget.name}`)
    }
  }

  private createInstructionText(): void {
    this.instructionText = this.scene.add.text(
      this.scene.scale.width / 2,
      30,
      'Select a target (Arrow keys to change, Enter to confirm)',
      {
        ...TEXT_STYLES.BODY,
        fontSize: '18px',
        backgroundColor: '#16213e',
        padding: { x: 16, y: 10 },
      },
    )
    this.instructionText.setOrigin(0.5, 0)
    this.instructionText.setDepth(DEPTH.UI + 3)
    this.container?.add(this.instructionText)
  }

  private createCancelButton(): void {
    const btnX = this.scene.scale.width / 2
    const btnY = this.scene.scale.height - 50

    this.cancelButton = this.scene.add.container(btnX, btnY)
    this.cancelButton.setDepth(DEPTH.UI + 3)

    const bg = this.scene.add.graphics()
    bg.fillStyle(0x16213e, 0.95)
    bg.fillRoundedRect(-80, -20, 160, 40, 8)
    bg.lineStyle(2, COLORS.HP_RED)
    bg.strokeRoundedRect(-80, -20, 160, 40, 8)
    this.cancelButton.add(bg)

    const text = this.scene.add.text(0, 0, 'Cancel (Esc)', {
      ...TEXT_STYLES.BUTTON,
      fontSize: '16px',
      color: '#ef5350',
    })
    text.setOrigin(0.5)
    this.cancelButton.add(text)

    const hitArea = this.scene.add.rectangle(0, 0, 160, 40)
    hitArea.setInteractive({ useHandCursor: true })
    hitArea.on('pointerdown', () => this.cancelSelection())
    hitArea.on('pointerover', () => {
      bg.clear()
      bg.fillStyle(COLORS.HP_RED, 0.3)
      bg.fillRoundedRect(-80, -20, 160, 40, 8)
      bg.lineStyle(2, COLORS.HP_RED)
      bg.strokeRoundedRect(-80, -20, 160, 40, 8)
    })
    hitArea.on('pointerout', () => {
      bg.clear()
      bg.fillStyle(0x16213e, 0.95)
      bg.fillRoundedRect(-80, -20, 160, 40, 8)
      bg.lineStyle(2, COLORS.HP_RED)
      bg.strokeRoundedRect(-80, -20, 160, 40, 8)
    })
    this.cancelButton.add(hitArea)

    this.container?.add(this.cancelButton)
  }

  private enableKeyboardControls(): void {
    if (this.keyboardEnabled) return
    this.keyboardEnabled = true

    this.scene.input.keyboard?.on('keydown-LEFT', this.onLeftKey, this)
    this.scene.input.keyboard?.on('keydown-RIGHT', this.onRightKey, this)
    this.scene.input.keyboard?.on('keydown-UP', this.onLeftKey, this)
    this.scene.input.keyboard?.on('keydown-DOWN', this.onRightKey, this)
    this.scene.input.keyboard?.on('keydown-ENTER', this.onEnterKey, this)
    this.scene.input.keyboard?.on('keydown-SPACE', this.onEnterKey, this)
    this.scene.input.keyboard?.on('keydown-ESC', this.onEscKey, this)
  }

  private disableKeyboardControls(): void {
    if (!this.keyboardEnabled) return
    this.keyboardEnabled = false

    this.scene.input.keyboard?.off('keydown-LEFT', this.onLeftKey, this)
    this.scene.input.keyboard?.off('keydown-RIGHT', this.onRightKey, this)
    this.scene.input.keyboard?.off('keydown-UP', this.onLeftKey, this)
    this.scene.input.keyboard?.off('keydown-DOWN', this.onRightKey, this)
    this.scene.input.keyboard?.off('keydown-ENTER', this.onEnterKey, this)
    this.scene.input.keyboard?.off('keydown-SPACE', this.onEnterKey, this)
    this.scene.input.keyboard?.off('keydown-ESC', this.onEscKey, this)
  }

  private onLeftKey = (): void => {
    if (this.validTargets.length === 0) return
    this.selectedIndex = (this.selectedIndex - 1 + this.validTargets.length) % this.validTargets.length
    this.highlightTarget(this.selectedIndex)
  }

  private onRightKey = (): void => {
    if (this.validTargets.length === 0) return
    this.selectedIndex = (this.selectedIndex + 1) % this.validTargets.length
    this.highlightTarget(this.selectedIndex)
  }

  private onEnterKey = (): void => {
    this.confirmSelection()
  }

  private onEscKey = (): void => {
    this.cancelSelection()
  }

  private confirmSelection(): void {
    const target = this.validTargets[this.selectedIndex]
    if (target && this.onSelectCallback) {
      const callback = this.onSelectCallback
      this.hide()
      callback(target.combatantId)
    }
  }

  private cancelSelection(): void {
    if (this.onCancelCallback) {
      const callback = this.onCancelCallback
      this.hide()
      callback()
    }
  }
}
