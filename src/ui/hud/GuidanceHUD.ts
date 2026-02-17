/**
 * GuidanceHUD - Persistent panel showing all milestone progress
 *
 * Displays all milestones in a kid-friendly checklist format:
 * - ✓ Completed steps shown with strikethrough
 * - ⭐ Current step highlighted
 * - ○ Future steps shown dimmed
 * - Minimizable (click to collapse/expand)
 * - Pulsing animation on new goals
 */

import Phaser from 'phaser'
import { COLORS, DEPTH, TEXT_STYLES } from '../../config'
import type { GuidanceMilestone, GuidanceMilestoneId } from '../../models/types'
import { shouldShowTouchControls } from '../../utils/mobile'

const HUD_WIDTH = 300
const HUD_HEADER_HEIGHT = 36
const HUD_STEP_HEIGHT = 24
const HUD_PADDING = 12
const HUD_MARGIN = 16
const MAX_VISIBLE_STEPS = 8

// Short labels for each milestone (kid-friendly, platform-aware)
function getMilestoneLabels(): Record<GuidanceMilestoneId, string> {
  const isTouch = shouldShowTouchControls()
  return {
    'talk-to-npc': isTouch ? 'Talk to villagers (Tap A)' : 'Talk to villagers (Press E)',
    'leave-village': 'Explore outside',
    'win-battle': 'Win a battle',
    'capture-monster': 'Catch a monster',
    'open-menu': isTouch ? 'Open the menu' : 'Open the menu (Press M)',
    'save-game': isTouch ? 'Save your game' : 'Save your game (Press F5)',
    'visit-shop': 'Visit the shop',
    'explore-new-area': 'Find new areas',
  }
}

export class GuidanceHUD {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private background!: Phaser.GameObjects.Graphics
  private headerIcon!: Phaser.GameObjects.Text
  private headerText!: Phaser.GameObjects.Text
  private collapseButton!: Phaser.GameObjects.Text
  private stepTexts: Phaser.GameObjects.Text[] = []
  private stepIcons: Phaser.GameObjects.Text[] = []

  private isExpanded: boolean = true
  private isVisible: boolean = true
  private currentMilestoneId: GuidanceMilestoneId | null = null
  private completedMilestones: ReadonlyArray<GuidanceMilestoneId> = []
  private allMilestones: ReadonlyArray<GuidanceMilestone> = []
  private allCompleteHandled: boolean = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.container = this.createContainer()
  }

  private getExpandedHeight(): number {
    return HUD_HEADER_HEIGHT + this.allMilestones.length * HUD_STEP_HEIGHT + HUD_PADDING
  }

  private createContainer(): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, 0)
    container.setScrollFactor(0)
    container.setDepth(DEPTH.UI)

    // Position based on camera viewport (accounts for zoom)
    this.updatePosition(container)

    // Background panel
    this.background = this.scene.add.graphics()
    this.drawBackground(HUD_HEADER_HEIGHT + HUD_PADDING)
    container.add(this.background)

    // Header icon (trophy or star)
    this.headerIcon = this.scene.add.text(HUD_PADDING, HUD_PADDING, '📋', {
      fontSize: '18px',
    })
    this.headerIcon.setResolution(2)
    container.add(this.headerIcon)

    // Header text
    this.headerText = this.scene.add.text(
      HUD_PADDING + 26,
      HUD_PADDING + 2,
      'Your Quest',
      {
        ...TEXT_STYLES.BODY,
        fontSize: '14px',
        color: '#ffd54f',
        fontStyle: 'bold',
      },
    )
    this.headerText.setResolution(2)
    container.add(this.headerText)

    // Collapse/expand button
    this.collapseButton = this.scene.add.text(
      HUD_WIDTH - HUD_PADDING - 16,
      HUD_PADDING,
      '−',
      {
        ...TEXT_STYLES.BODY,
        fontSize: '18px',
        color: '#90caf9',
      },
    )
    this.collapseButton.setResolution(2)
    container.add(this.collapseButton)

    // Use scene-level input to handle clicks on the collapse button.
    // setInteractive() doesn't work correctly inside scrollFactor(0) containers
    // because Phaser's hit testing converts pointer coords to world space,
    // but the container renders at a fixed screen position.
    this.scene.input.on('pointerdown', this.onPointerDown, this)
    this.scene.input.on('pointermove', this.onPointerMove, this)

    // Listen for resize
    this.scene.scale.on('resize', () => this.updatePosition())

    return container
  }

  private drawBackground(height: number): void {
    this.background.clear()
    this.background.fillStyle(COLORS.DARK_BG, 0.92)
    this.background.fillRoundedRect(0, 0, HUD_WIDTH, height, 10)
    this.background.lineStyle(2, COLORS.PRIMARY, 0.6)
    this.background.strokeRoundedRect(0, 0, HUD_WIDTH, height, 10)
  }

  private updatePosition(container?: Phaser.GameObjects.Container): void {
    const target = container ?? this.container
    const camera = this.scene.cameras.main
    const zoom = camera.zoom || 1

    // Calculate visible area within camera viewport
    const visibleWidth = this.scene.scale.width / zoom
    const visibleHeight = this.scene.scale.height / zoom
    const offsetX = (this.scene.scale.width - visibleWidth) / 2
    const offsetY = (this.scene.scale.height - visibleHeight) / 2

    // Position in top-right of the VISIBLE area
    const x = offsetX + visibleWidth - HUD_WIDTH - HUD_MARGIN
    const y = offsetY + HUD_MARGIN

    target.setPosition(x, y)
  }

  private isInCollapseButtonBounds(pointer: Phaser.Input.Pointer): boolean {
    const zoom = this.scene.cameras.main.zoom || 1
    // Convert canvas pointer position to pre-zoom game coordinates
    // (scrollFactor(0) objects are positioned in pre-zoom space, rendered with zoom applied)
    const gameX = pointer.x / zoom
    const gameY = pointer.y / zoom

    const btnLeft = this.container.x + this.collapseButton.x
    const btnTop = this.container.y + this.collapseButton.y
    const btnSize = 24

    return (
      gameX >= btnLeft &&
      gameX <= btnLeft + btnSize &&
      gameY >= btnTop &&
      gameY <= btnTop + btnSize
    )
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.isVisible) return
    if (this.isInCollapseButtonBounds(pointer)) {
      this.toggleCollapse()
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isVisible) return
    if (this.isInCollapseButtonBounds(pointer)) {
      this.scene.game.canvas.style.cursor = 'pointer'
      this.collapseButton.setColor('#ffffff')
    } else {
      this.scene.game.canvas.style.cursor = 'default'
      this.collapseButton.setColor('#90caf9')
    }
  }

  private toggleCollapse(): void {
    this.isExpanded = !this.isExpanded

    if (this.isExpanded) {
      // Expand - show all steps
      this.drawBackground(this.getExpandedHeight())
      this.stepTexts.forEach((text) => text.setVisible(true))
      this.stepIcons.forEach((icon) => icon.setVisible(true))
      this.strikethroughLines.forEach((line) => line.setVisible(true))
      this.collapseButton.setText('−')
    } else {
      // Collapse - hide steps
      this.drawBackground(HUD_HEADER_HEIGHT + HUD_PADDING)
      this.stepTexts.forEach((text) => text.setVisible(false))
      this.stepIcons.forEach((icon) => icon.setVisible(false))
      this.strikethroughLines.forEach((line) => line.setVisible(false))
      this.collapseButton.setText('+')
    }
  }

  /**
   * Initialize the HUD with all milestones.
   */
  setMilestones(milestones: ReadonlyArray<GuidanceMilestone>): void {
    this.allMilestones = milestones

    // Clear existing step UI
    this.stepTexts.forEach((text) => text.destroy())
    this.stepIcons.forEach((icon) => icon.destroy())
    this.stepTexts = []
    this.stepIcons = []

    // Create step UI elements
    let yOffset = HUD_HEADER_HEIGHT

    milestones.forEach((milestone, index) => {
      // Step icon (will be updated based on completion status)
      const icon = this.scene.add.text(HUD_PADDING, yOffset, '○', {
        fontSize: '14px',
        color: '#666666',
      })
      icon.setResolution(2)
      this.container.add(icon)
      this.stepIcons.push(icon)

      // Step label
      const labels = getMilestoneLabels()
      const label = labels[milestone.id] || milestone.message
      const text = this.scene.add.text(
        HUD_PADDING + 22,
        yOffset,
        `${index + 1}. ${label}`,
        {
          ...TEXT_STYLES.BODY,
          fontSize: '12px',
          color: '#666666',
        },
      )
      text.setResolution(2)
      this.container.add(text)
      this.stepTexts.push(text)

      yOffset += HUD_STEP_HEIGHT
    })

    // Update background size
    this.drawBackground(this.getExpandedHeight())
  }

  /**
   * Update the displayed progress.
   */
  update(
    currentMilestone: GuidanceMilestone | null,
    completedMilestones: ReadonlyArray<GuidanceMilestoneId>,
  ): void {
    const previousMilestoneId = this.currentMilestoneId
    this.currentMilestoneId = currentMilestone?.id ?? null
    this.completedMilestones = completedMilestones

    const allComplete = currentMilestone === null && completedMilestones.length >= this.allMilestones.length

    // Update header
    if (allComplete) {
      this.headerIcon.setText('🏆')
      this.headerText.setText('All Complete!')
      this.headerText.setColor('#66bb6a')

      // Auto-hide after a brief celebration
      if (!this.allCompleteHandled) {
        this.allCompleteHandled = true
        this.scene.time.delayedCall(3000, () => {
          this.hide()
        })
      }
    } else {
      this.headerIcon.setText('📋')
      this.headerText.setText('Your Quest')
      this.headerText.setColor('#ffd54f')
    }

    // Update each step's visual state
    this.allMilestones.forEach((milestone, index) => {
      const icon = this.stepIcons[index]
      const text = this.stepTexts[index]

      if (!icon || !text) return

      const isCompleted = completedMilestones.includes(milestone.id)
      const isCurrent = milestone.id === this.currentMilestoneId

      if (isCompleted) {
        // Completed: green checkmark with strikethrough
        icon.setText('✓')
        icon.setColor('#66bb6a')
        text.setColor('#66bb6a')
        text.setAlpha(0.7)
        // Add strikethrough effect by drawing a line
        this.addStrikethrough(text, index)
      } else if (isCurrent) {
        // Current: yellow star, highlighted
        icon.setText('⭐')
        icon.setColor('#ffd54f')
        text.setColor('#ffffff')
        text.setAlpha(1)
        this.removeStrikethrough(index)
      } else {
        // Future: dimmed circle
        icon.setText('○')
        icon.setColor('#555555')
        text.setColor('#555555')
        text.setAlpha(0.6)
        this.removeStrikethrough(index)
      }
    })

    // Play animation if milestone changed
    const isNewMilestone = currentMilestone !== null && previousMilestoneId !== this.currentMilestoneId
    if (isNewMilestone) {
      this.playNewMilestoneAnimation()
    }
  }

  private strikethroughLines: Map<number, Phaser.GameObjects.Graphics> = new Map()

  private addStrikethrough(text: Phaser.GameObjects.Text, index: number): void {
    // Remove existing line if any
    this.removeStrikethrough(index)

    const line = this.scene.add.graphics()
    line.lineStyle(1, 0x66bb6a, 0.6)
    const y = text.y + text.height / 2
    line.lineBetween(text.x, y, text.x + text.width, y)
    this.container.add(line)
    this.strikethroughLines.set(index, line)
  }

  private removeStrikethrough(index: number): void {
    const line = this.strikethroughLines.get(index)
    if (line) {
      line.destroy()
      this.strikethroughLines.delete(index)
    }
  }

  /**
   * Play celebration animation when a milestone is completed.
   */
  celebrate(message: string): void {
    // Flash the background gold
    this.scene.tweens.add({
      targets: this.background,
      alpha: { from: 1, to: 0.5 },
      duration: 200,
      yoyo: true,
      repeat: 2,
    })

    // Show celebration text briefly
    const celebrationText = this.scene.add.text(
      HUD_WIDTH / 2,
      -20,
      message,
      {
        ...TEXT_STYLES.BODY,
        fontSize: '12px',
        color: '#ffd54f',
        stroke: '#000000',
        strokeThickness: 2,
      },
    )
    celebrationText.setOrigin(0.5)
    celebrationText.setResolution(2)
    this.container.add(celebrationText)

    this.scene.tweens.add({
      targets: celebrationText,
      y: -40,
      alpha: 0,
      duration: 2000,
      ease: 'Power2',
      onComplete: () => celebrationText.destroy(),
    })
  }

  private playNewMilestoneAnimation(): void {
    // Find and animate the current step's icon
    const currentIndex = this.allMilestones.findIndex((m) => m.id === this.currentMilestoneId)
    if (currentIndex >= 0 && this.stepIcons[currentIndex]) {
      const icon = this.stepIcons[currentIndex]
      this.scene.tweens.add({
        targets: icon,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 300,
        yoyo: true,
        repeat: 2,
        ease: 'Sine.easeInOut',
      })
    }

    // Highlight the container briefly
    const highlight = this.scene.add.graphics()
    highlight.fillStyle(0xffd54f, 0.2)
    highlight.fillRoundedRect(0, 0, HUD_WIDTH, this.isExpanded ? this.getExpandedHeight() : HUD_HEADER_HEIGHT + HUD_PADDING, 10)
    this.container.addAt(highlight, 1)

    this.scene.tweens.add({
      targets: highlight,
      alpha: 0,
      duration: 500,
      onComplete: () => highlight.destroy(),
    })
  }

  /**
   * Show the HUD (if it was hidden).
   */
  show(): void {
    if (!this.isVisible) {
      this.isVisible = true
      this.container.setVisible(true)
      this.scene.tweens.add({
        targets: this.container,
        alpha: 1,
        duration: 200,
      })
    }
  }

  /**
   * Hide the HUD.
   */
  hide(): void {
    if (this.isVisible) {
      this.isVisible = false
      this.scene.tweens.add({
        targets: this.container,
        alpha: 0,
        duration: 200,
        onComplete: () => this.container.setVisible(false),
      })
    }
  }

  /**
   * Check if the HUD is currently visible.
   */
  getIsVisible(): boolean {
    return this.isVisible
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    this.scene.input.off('pointerdown', this.onPointerDown, this)
    this.scene.input.off('pointermove', this.onPointerMove, this)
    this.scene.scale.off('resize', () => this.updatePosition())
    this.scene.game.canvas.style.cursor = 'default'
    this.strikethroughLines.forEach((line) => line.destroy())
    this.strikethroughLines.clear()
    this.container.destroy()
  }
}
