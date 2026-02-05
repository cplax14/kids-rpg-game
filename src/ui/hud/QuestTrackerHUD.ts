import Phaser from 'phaser'
import type { QuestProgress, QuestDefinition } from '../../models/types'
import { COLORS, DEPTH, TEXT_STYLES } from '../../config'
import { getQuest, getObjectiveProgress } from '../../systems/QuestSystem'
import { EventBus } from '../../events/EventBus'
import { GAME_EVENTS } from '../../events/GameEvents'

const TRACKER_WIDTH = 220
const TRACKER_X = 10
const TRACKER_Y = 10
const MAX_DISPLAYED_QUESTS = 3

interface QuestEntry {
  readonly container: Phaser.GameObjects.Container
  readonly progressBars: Phaser.GameObjects.Graphics[]
  readonly progressTexts: Phaser.GameObjects.Text[]
}

export class QuestTrackerHUD {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private questEntries: Map<string, QuestEntry> = new Map()
  private currentQuests: ReadonlyArray<QuestProgress> = []
  private flashTweens: Map<string, Phaser.Tweens.Tween> = new Map()

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.container = scene.add.container(TRACKER_X, TRACKER_Y)
    this.container.setScrollFactor(0)
    this.container.setDepth(DEPTH.UI)

    this.setupEventListeners()
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

    // Background panel
    const bg = this.scene.add.graphics()
    bg.fillStyle(COLORS.DARK_BG, 0.85)
    bg.fillRoundedRect(0, 0, TRACKER_WIDTH, entryHeight, 6)
    bg.lineStyle(1, COLORS.PRIMARY, 0.5)
    bg.strokeRoundedRect(0, 0, TRACKER_WIDTH, entryHeight, 6)
    entryContainer.add(bg)

    // Quest name
    const nameText = this.scene.add.text(8, 6, quest.name, {
      ...TEXT_STYLES.SMALL,
      fontSize: '12px',
      color: '#ffd54f',
      fontStyle: 'bold',
    })
    entryContainer.add(nameText)

    // Objectives
    const progressBars: Phaser.GameObjects.Graphics[] = []
    const progressTexts: Phaser.GameObjects.Text[] = []

    let objY = 24
    for (const objective of quest.objectives) {
      const current = getObjectiveProgress(progress, objective.objectiveId)
      const required = objective.requiredCount
      const isComplete = current >= required

      // Objective description (truncated)
      const objDesc = objective.description.length > 28
        ? objective.description.substring(0, 25) + '...'
        : objective.description

      const objText = this.scene.add.text(8, objY, objDesc, {
        ...TEXT_STYLES.SMALL,
        fontSize: '10px',
        color: isComplete ? '#66bb6a' : '#cccccc',
      })
      entryContainer.add(objText)
      progressTexts.push(objText)

      // Progress bar
      const barBg = this.scene.add.graphics()
      barBg.fillStyle(0x333333, 1)
      barBg.fillRoundedRect(8, objY + 14, TRACKER_WIDTH - 50, 6, 3)
      entryContainer.add(barBg)

      const barFill = this.scene.add.graphics()
      this.drawProgressBar(barFill, current, required)
      entryContainer.add(barFill)
      progressBars.push(barFill)

      // Count text
      const countText = this.scene.add.text(
        TRACKER_WIDTH - 8,
        objY + 10,
        `${current}/${required}`,
        {
          ...TEXT_STYLES.SMALL,
          fontSize: '10px',
          color: isComplete ? '#66bb6a' : '#b0bec5',
        },
      )
      countText.setOrigin(1, 0)
      entryContainer.add(countText)
      progressTexts.push(countText)

      objY += 26
    }

    return { container: entryContainer, progressBars, progressTexts }
  }

  private drawProgressBar(graphics: Phaser.GameObjects.Graphics, current: number, required: number): void {
    const progress = Math.min(current / required, 1)
    const barWidth = (TRACKER_WIDTH - 50) * progress
    const color = progress >= 1 ? COLORS.SUCCESS : COLORS.PRIMARY

    graphics.clear()
    if (barWidth > 0) {
      graphics.fillStyle(color, 1)
      graphics.fillRoundedRect(8, 14, barWidth, 6, 3)
    }
  }

  private getEntryHeight(quest: QuestDefinition): number {
    return 24 + quest.objectives.length * 26 + 4
  }

  private updateProgress(quests: ReadonlyArray<QuestProgress>): void {
    for (const progress of quests) {
      const entry = this.questEntries.get(progress.questId)
      if (!entry) continue

      const quest = getQuest(progress.questId)
      if (!quest) continue

      quest.objectives.forEach((objective, index) => {
        const current = getObjectiveProgress(progress, objective.objectiveId)
        const required = objective.requiredCount
        const isComplete = current >= required

        // Update progress bar
        const bar = entry.progressBars[index]
        if (bar) {
          this.drawProgressBar(bar, current, required)
          bar.y = 24 + index * 26
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
    EventBus.off(GAME_EVENTS.QUEST_PROGRESS_UPDATED)
    EventBus.off(GAME_EVENTS.QUEST_READY_TO_TURN_IN)

    this.clearEntries()
    this.container.destroy()
  }
}
