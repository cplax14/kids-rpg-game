import Phaser from 'phaser'
import type { QuestProgress, QuestDefinition, QuestType } from '../../models/types'
import { COLORS, DEPTH, TEXT_STYLES } from '../../config'
import { getQuest, getObjectiveProgress, getQuestProgressPercent } from '../../systems/QuestSystem'
import { EventBus } from '../../events/EventBus'
import { GAME_EVENTS } from '../../events/GameEvents'
import { ProgressRing } from '../components/ProgressRing'

const TRACKER_WIDTH = 320
const TRACKER_PADDING = 10  // Padding from visible area edge
const MAX_DISPLAYED_QUESTS = 3

const QUEST_TYPE_ICONS: Record<QuestType, string> = {
  defeat: '⚔️',
  collect: '🎒',
  boss: '👑',
  explore: '🗺️',
  talk: '💬',
}

const QUEST_TYPE_COLORS: Record<QuestType, number> = {
  defeat: 0xef5350,
  collect: 0x66bb6a,
  boss: 0xffd54f,
  explore: 0x42a5f5,
  talk: 0x7e57c2,
}

interface QuestEntry {
  readonly container: Phaser.GameObjects.Container
  readonly progressBars: Phaser.GameObjects.Graphics[]
  readonly progressTexts: Phaser.GameObjects.Text[]
  readonly progressRing: ProgressRing | null
}

export class QuestTrackerHUD {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private questEntries: Map<string, QuestEntry> = new Map()
  private currentQuests: ReadonlyArray<QuestProgress> = []
  private flashTweens: Map<string, Phaser.Tweens.Tween> = new Map()
  private emptyStateText: Phaser.GameObjects.Text | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.container = scene.add.container(0, 0)
    this.container.setScrollFactor(0)
    this.container.setDepth(DEPTH.UI)

    this.updatePosition()
    this.createEmptyState()
    this.setupEventListeners()

    // Listen for resize events
    scene.scale.on('resize', this.updatePosition, this)
  }

  /**
   * Update container position based on camera zoom.
   * With zoom > 1, only the center of the canvas is visible,
   * so we need to offset the position to appear in the top-left of the visible area.
   */
  private updatePosition(): void {
    const camera = this.scene.cameras.main
    const zoom = camera.zoom

    // Calculate visible area within canvas coordinates
    const canvasWidth = this.scene.scale.width
    const canvasHeight = this.scene.scale.height
    const visibleWidth = canvasWidth / zoom
    const visibleHeight = canvasHeight / zoom
    const offsetX = (canvasWidth - visibleWidth) / 2
    const offsetY = (canvasHeight - visibleHeight) / 2

    // Position in top-left of the VISIBLE area
    const x = offsetX + TRACKER_PADDING
    const y = offsetY + TRACKER_PADDING

    this.container.setPosition(x, y)
  }

  private createEmptyState(): void {
    // Show empty state when no quests are active
    this.emptyStateText = this.scene.add.text(0, 0, '📋 No active quests', {
      ...TEXT_STYLES.SMALL,
      fontSize: '11px',
      color: '#888888',
    })
    this.emptyStateText.setResolution(2) // Crisp text at zoom levels
    this.emptyStateText.setAlpha(0.7)
    this.container.add(this.emptyStateText)
  }

  private setupEventListeners(): void {
    EventBus.on(GAME_EVENTS.QUEST_PROGRESS_UPDATED, (payload: unknown) => {
      const data = payload as {
        questId: string
        objectiveId: string
        current: number
        required: number
      }
      this.handleProgressUpdate(data)
    })
    EventBus.on(GAME_EVENTS.QUEST_READY_TO_TURN_IN, (payload: unknown) => {
      const data = payload as {
        quest: QuestDefinition
        progress: QuestProgress
      }
      this.handleReadyToTurnIn(data)
    })
  }

  update(activeQuests: ReadonlyArray<QuestProgress>): void {
    // Filter to only active quests (not yet completed)
    const activeOnly = activeQuests.filter((q) => q.status === 'active')

    // Take only the first MAX_DISPLAYED_QUESTS
    const displayedQuests = activeOnly.slice(0, MAX_DISPLAYED_QUESTS)

    // Show/hide empty state based on quest count
    if (this.emptyStateText) {
      this.emptyStateText.setVisible(displayedQuests.length === 0)
    }

    // Check if quests changed
    const currentIds = this.currentQuests.map((q) => q.questId).join(',')
    const newIds = displayedQuests.map((q) => q.questId).join(',')

    if (currentIds !== newIds) {
      this.rebuildEntries(displayedQuests)
    } else {
      this.updateProgress(displayedQuests)
    }

    this.currentQuests = displayedQuests
  }

  private rebuildEntries(quests: ReadonlyArray<QuestProgress>): void {
    // Clear existing entries
    this.clearEntries()

    let yOffset = 0

    for (const progress of quests) {
      const quest = getQuest(progress.questId)
      if (!quest) continue

      const entry = this.createQuestEntry(quest, progress, yOffset)
      this.questEntries.set(progress.questId, entry)

      yOffset += this.getEntryHeight(quest) + 8
    }
  }

  private createQuestEntry(
    quest: QuestDefinition,
    progress: QuestProgress,
    yOffset: number,
  ): QuestEntry {
    const entryContainer = this.scene.add.container(0, yOffset)
    this.container.add(entryContainer)

    const entryHeight = this.getEntryHeight(quest)
    const isReadyToTurnIn = progress.status === 'completed'

    // Get quest type from first objective
    const primaryType: QuestType = quest.objectives[0]?.type ?? 'defeat'
    const typeIcon = QUEST_TYPE_ICONS[primaryType]
    const typeColor = QUEST_TYPE_COLORS[primaryType]

    // Background panel with type-colored left border
    const bg = this.scene.add.graphics()
    bg.fillStyle(COLORS.DARK_BG, 0.9)
    bg.fillRoundedRect(0, 0, TRACKER_WIDTH, entryHeight, 8)
    bg.lineStyle(1, isReadyToTurnIn ? COLORS.SUCCESS : typeColor, 0.7)
    bg.strokeRoundedRect(0, 0, TRACKER_WIDTH, entryHeight, 8)
    entryContainer.add(bg)

    // Type color accent bar on left
    const accentBar = this.scene.add.graphics()
    accentBar.fillStyle(isReadyToTurnIn ? COLORS.SUCCESS : typeColor, 0.8)
    accentBar.fillRoundedRect(0, 0, 4, entryHeight, { tl: 8, bl: 8, tr: 0, br: 0 })
    entryContainer.add(accentBar)

    // Quest type icon
    const iconText = this.scene.add.text(14, 8, typeIcon, {
      fontSize: '14px',
    })
    iconText.setResolution(2)
    entryContainer.add(iconText)

    // Quest name (next to icon)
    const displayName = quest.name.length > 28 ? quest.name.substring(0, 26) + '..' : quest.name
    const nameText = this.scene.add.text(34, 7, displayName, {
      ...TEXT_STYLES.SMALL,
      fontSize: '12px',
      color: isReadyToTurnIn ? '#66bb6a' : '#ffd54f',
      fontStyle: 'bold',
    })
    nameText.setResolution(2)
    entryContainer.add(nameText)

    // Progress ring on the right
    const percent = getQuestProgressPercent(progress, quest)
    const ringColor = isReadyToTurnIn ? COLORS.SUCCESS : typeColor
    const ring = new ProgressRing(this.scene, TRACKER_WIDTH - 22, entryHeight / 2, percent, {
      radius: 14,
      thickness: 3,
      fillColor: ringColor,
      showPercent: true,
      animate: false,
    })
    entryContainer.add(ring.getContainer())

    // Pulsing animation if ready to turn in
    if (isReadyToTurnIn) {
      this.scene.tweens.add({
        targets: ring.getContainer(),
        scaleX: 1.15,
        scaleY: 1.15,
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }

    // Objectives
    const progressBars: Phaser.GameObjects.Graphics[] = []
    const progressTexts: Phaser.GameObjects.Text[] = []

    let objY = 26
    for (const objective of quest.objectives) {
      const current = getObjectiveProgress(progress, objective.objectiveId)
      const required = objective.requiredCount
      const isComplete = current >= required
      const objIcon = QUEST_TYPE_ICONS[objective.type] ?? '📌'

      // Objective with icon (truncated)
      const objDesc = objective.description.length > 35
        ? objective.description.substring(0, 32) + '...'
        : objective.description

      const objText = this.scene.add.text(10, objY, `${objIcon} ${objDesc}`, {
        ...TEXT_STYLES.SMALL,
        fontSize: '10px',
        color: isComplete ? '#66bb6a' : '#cccccc',
      })
      objText.setResolution(2)
      entryContainer.add(objText)
      progressTexts.push(objText)

      // Progress bar (narrower to make room for ring)
      const barBg = this.scene.add.graphics()
      barBg.fillStyle(0x333333, 1)
      barBg.fillRoundedRect(10, objY + 14, TRACKER_WIDTH - 70, 5, 2)
      entryContainer.add(barBg)

      const barFill = this.scene.add.graphics()
      this.drawProgressBar(barFill, current, required, objY + 14)
      entryContainer.add(barFill)
      progressBars.push(barFill)

      // Count text
      const countText = this.scene.add.text(
        TRACKER_WIDTH - 50,
        objY + 11,
        `${current}/${required}`,
        {
          ...TEXT_STYLES.SMALL,
          fontSize: '9px',
          color: isComplete ? '#66bb6a' : '#b0bec5',
        },
      )
      countText.setResolution(2)
      countText.setOrigin(1, 0)
      entryContainer.add(countText)
      progressTexts.push(countText)

      objY += 24
    }

    return { container: entryContainer, progressBars, progressTexts, progressRing: ring }
  }

  private drawProgressBar(graphics: Phaser.GameObjects.Graphics, current: number, required: number, yPos: number): void {
    const progress = Math.min(current / required, 1)
    const barWidth = (TRACKER_WIDTH - 70) * progress
    const color = progress >= 1 ? COLORS.SUCCESS : COLORS.PRIMARY

    graphics.clear()
    if (barWidth > 0) {
      graphics.fillStyle(color, 1)
      graphics.fillRoundedRect(10, yPos, barWidth, 5, 2)
    }
  }

  private getEntryHeight(quest: QuestDefinition): number {
    return 26 + quest.objectives.length * 24 + 6
  }

  private updateProgress(quests: ReadonlyArray<QuestProgress>): void {
    for (const progress of quests) {
      const entry = this.questEntries.get(progress.questId)
      if (!entry) continue

      const quest = getQuest(progress.questId)
      if (!quest) continue

      // Update progress ring
      if (entry.progressRing) {
        const percent = getQuestProgressPercent(progress, quest)
        entry.progressRing.setProgress(percent)
      }

      quest.objectives.forEach((objective, index) => {
        const current = getObjectiveProgress(progress, objective.objectiveId)
        const required = objective.requiredCount
        const isComplete = current >= required

        // Update progress bar
        // objY for this objective = 26 + index * 24, bar is at objY + 14
        const barYPos = 26 + index * 24 + 14
        const bar = entry.progressBars[index]
        if (bar) {
          this.drawProgressBar(bar, current, required, barYPos)
        }

        // Update texts
        const descText = entry.progressTexts[index * 2]
        const countText = entry.progressTexts[index * 2 + 1]

        if (descText) {
          descText.setColor(isComplete ? '#66bb6a' : '#cccccc')
        }
        if (countText) {
          countText.setText(`${current}/${required}`)
          countText.setColor(isComplete ? '#66bb6a' : '#b0bec5')
        }
      })
    }
  }

  private handleProgressUpdate(data: {
    questId: string
    objectiveId: string
    current: number
    required: number
  }): void {
    const entry = this.questEntries.get(data.questId)
    if (!entry) return

    // Flash animation
    this.flashEntry(entry)
  }

  private handleReadyToTurnIn(data: {
    quest: QuestDefinition
    progress: QuestProgress
  }): void {
    const entry = this.questEntries.get(data.quest.questId)
    if (!entry) return

    // Pulse animation for ready to turn in
    this.pulseEntry(entry)
  }

  private flashEntry(entry: QuestEntry): void {
    const existingTween = this.flashTweens.get(entry.container.name)
    if (existingTween) {
      existingTween.stop()
    }

    // Create flash effect
    const flash = this.scene.add.graphics()
    flash.fillStyle(COLORS.SUCCESS, 0.3)
    flash.fillRoundedRect(0, 0, TRACKER_WIDTH, entry.container.height || 60, 6)
    entry.container.add(flash)
    entry.container.sendToBack(flash)

    const tween = this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => {
        flash.destroy()
      },
    })

    this.flashTweens.set(entry.container.name, tween)
  }

  private pulseEntry(entry: QuestEntry): void {
    this.scene.tweens.add({
      targets: entry.container,
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 300,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
    })
  }

  private clearEntries(): void {
    for (const [, entry] of this.questEntries) {
      if (entry.progressRing) {
        entry.progressRing.destroy()
      }
      entry.container.destroy()
    }
    this.questEntries.clear()

    for (const [, tween] of this.flashTweens) {
      tween.stop()
    }
    this.flashTweens.clear()
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible)
  }

  destroy(): void {
    this.scene.scale.off('resize', this.updatePosition, this)
    EventBus.off(GAME_EVENTS.QUEST_PROGRESS_UPDATED)
    EventBus.off(GAME_EVENTS.QUEST_READY_TO_TURN_IN)

    this.clearEntries()
    this.container.destroy()
  }
}
