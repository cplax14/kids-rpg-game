import Phaser from 'phaser'
import type { QuestProgress, QuestDefinition, QuestType } from '../../models/types'
import { COLORS, TEXT_STYLES, DEPTH } from '../../config'
import { getGameState, setGameState, updateActiveQuests } from '../../systems/GameStateManager'
import {
  getQuest,
  getQuestProgressPercent,
  getObjectiveProgress,
  abandonQuest,
} from '../../systems/QuestSystem'
import { ProgressRing } from '../components/ProgressRing'

const PANEL_WIDTH = 540
const DETAIL_WIDTH = 500
const LIST_HEIGHT = 400

type QuestTab = 'active' | 'completed'

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

export class QuestLogPanel {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private detailContainer: Phaser.GameObjects.Container
  private listContainer: Phaser.GameObjects.Container
  private activeTab: QuestTab = 'active'
  private selectedQuestId: string | null = null
  private tabButtons: Phaser.GameObjects.Container[] = []
  private progressRings: ProgressRing[] = []

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene
    this.container = scene.add.container(x, y)
    this.container.setDepth(DEPTH.OVERLAY + 2)

    this.listContainer = scene.add.container(0, 50)
    this.container.add(this.listContainer)

    this.detailContainer = scene.add.container(PANEL_WIDTH + 30, 0)
    this.container.add(this.detailContainer)

    this.createTabs()
    this.refreshList()
  }

  private createTabs(): void {
    const tabs: ReadonlyArray<{ label: string; tab: QuestTab }> = [
      { label: 'Active', tab: 'active' },
      { label: 'Completed', tab: 'completed' },
    ]

    tabs.forEach((tabDef, index) => {
      const x = index * 120
      const isActive = tabDef.tab === this.activeTab

      const tabContainer = this.scene.add.container(x, 0)

      const bg = this.scene.add.graphics()
      bg.fillStyle(isActive ? COLORS.PRIMARY : COLORS.PANEL_BG, isActive ? 0.7 : 0.4)
      bg.fillRoundedRect(0, 0, 110, 36, 8)
      tabContainer.add(bg)

      const text = this.scene.add.text(55, 18, tabDef.label, {
        ...TEXT_STYLES.BODY,
        fontSize: '14px',
      })
      text.setOrigin(0.5)
      tabContainer.add(text)

      const hitArea = this.scene.add.rectangle(55, 18, 110, 36)
      hitArea.setInteractive({ useHandCursor: true })
      hitArea.on('pointerdown', () => {
        this.activeTab = tabDef.tab
        this.selectedQuestId = null
        this.refreshTabs()
        this.refreshList()
        this.refreshDetail()
      })
      tabContainer.add(hitArea)

      this.container.add(tabContainer)
      this.tabButtons.push(tabContainer)
    })
  }

  private refreshTabs(): void {
    this.tabButtons.forEach((tab, index) => {
      const isActive =
        (index === 0 && this.activeTab === 'active') ||
        (index === 1 && this.activeTab === 'completed')

      const bg = tab.getAt(0) as Phaser.GameObjects.Graphics
      bg.clear()
      bg.fillStyle(isActive ? COLORS.PRIMARY : COLORS.PANEL_BG, isActive ? 0.7 : 0.4)
      bg.fillRoundedRect(0, 0, 110, 36, 8)
    })
  }

  private refreshList(): void {
    // Clear list container and progress rings
    this.listContainer.removeAll(true)
    for (const ring of this.progressRings) {
      ring.destroy()
    }
    this.progressRings = []

    const state = getGameState(this.scene)
    const quests =
      this.activeTab === 'active'
        ? state.activeQuests
        : state.completedQuestIds.map((id) => ({ questId: id }))

    if (quests.length === 0) {
      const emptyText = this.scene.add.text(
        PANEL_WIDTH / 2,
        LIST_HEIGHT / 2,
        this.activeTab === 'active' ? 'No active quests' : 'No completed quests',
        {
          ...TEXT_STYLES.BODY,
          fontSize: '16px',
          color: '#888888',
        },
      )
      emptyText.setOrigin(0.5)
      this.listContainer.add(emptyText)
      return
    }

    let yOffset = 0

    for (const questData of quests) {
      const questId = 'questId' in questData ? questData.questId : questData
      const quest = getQuest(questId as string)
      if (!quest) continue

      const progress =
        this.activeTab === 'active'
          ? state.activeQuests.find((q) => q.questId === questId) ?? null
          : null

      const entry = this.createQuestListEntry(quest, progress, yOffset)
      this.listContainer.add(entry)

      yOffset += 78
    }
  }

  private createQuestListEntry(
    quest: QuestDefinition,
    progress: QuestProgress | null,
    yOffset: number,
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, yOffset)
    const isSelected = this.selectedQuestId === quest.questId
    const isCompleted = this.activeTab === 'completed' || progress?.status === 'completed'
    const isReadyToTurnIn = progress?.status === 'completed'

    // Get primary quest type from first objective
    const primaryType: QuestType = quest.objectives[0]?.type ?? 'defeat'
    const typeIcon = QUEST_TYPE_ICONS[primaryType]
    const typeColor = QUEST_TYPE_COLORS[primaryType]

    // Background
    const bg = this.scene.add.graphics()
    bg.fillStyle(isSelected ? COLORS.PRIMARY : COLORS.PANEL_BG, isSelected ? 0.5 : 0.3)
    bg.fillRoundedRect(0, 0, PANEL_WIDTH, 70, 8)
    if (isSelected) {
      bg.lineStyle(2, COLORS.PRIMARY)
      bg.strokeRoundedRect(0, 0, PANEL_WIDTH, 70, 8)
    }
    container.add(bg)

    // Type icon badge
    const iconBg = this.scene.add.graphics()
    iconBg.fillStyle(typeColor, 0.3)
    iconBg.fillRoundedRect(8, 8, 36, 36, 8)
    container.add(iconBg)

    const iconText = this.scene.add.text(26, 26, typeIcon, {
      fontSize: '20px',
    })
    iconText.setOrigin(0.5)
    container.add(iconText)

    // Quest name
    const nameText = this.scene.add.text(52, 10, quest.name, {
      ...TEXT_STYLES.BODY,
      fontSize: '15px',
      color: isCompleted ? '#66bb6a' : '#ffffff',
      fontStyle: 'bold',
    })
    container.add(nameText)

    // Level recommendation
    const levelText = this.scene.add.text(PANEL_WIDTH - 50, 10, `Lv ${quest.recommendedLevel}`, {
      ...TEXT_STYLES.SMALL,
      fontSize: '12px',
      color: '#b0bec5',
    })
    levelText.setOrigin(1, 0)
    container.add(levelText)

    // Progress ring (for active quests)
    if (progress && this.activeTab === 'active') {
      const percent = getQuestProgressPercent(progress, quest)
      const ringColor = isReadyToTurnIn ? COLORS.SUCCESS : typeColor

      const ring = new ProgressRing(this.scene, PANEL_WIDTH - 30, 35, percent, {
        radius: 18,
        thickness: 4,
        fillColor: ringColor,
        showPercent: true,
        animate: false,
      })
      this.listContainer.add(ring.getContainer())
      ring.getContainer().setPosition(PANEL_WIDTH - 30, yOffset + 35)
      this.progressRings.push(ring)

      // Pulsing animation if ready to turn in
      if (isReadyToTurnIn) {
        this.scene.tweens.add({
          targets: ring.getContainer(),
          scaleX: 1.1,
          scaleY: 1.1,
          duration: 600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      }
    }

    // Progress or status text
    if (progress) {
      const statusColor = isReadyToTurnIn ? '#66bb6a' : '#ffd54f'
      const statusText = isReadyToTurnIn ? '✓ Ready to turn in!' : `In Progress`

      const progText = this.scene.add.text(52, 32, statusText, {
        ...TEXT_STYLES.SMALL,
        fontSize: '12px',
        color: statusColor,
      })
      container.add(progText)

      // Progress bar for active quests
      if (progress.status === 'active') {
        const percent = getQuestProgressPercent(progress, quest)
        const barBg = this.scene.add.graphics()
        barBg.fillStyle(0x333333, 1)
        barBg.fillRoundedRect(52, 50, 380, 8, 4)
        container.add(barBg)

        const barFill = this.scene.add.graphics()
        barFill.fillStyle(typeColor, 1)
        barFill.fillRoundedRect(52, 50, 380 * (percent / 100), 8, 4)
        container.add(barFill)
      }
    } else if (this.activeTab === 'completed') {
      const completedText = this.scene.add.text(52, 32, '✓ Completed', {
        ...TEXT_STYLES.SMALL,
        fontSize: '12px',
        color: '#66bb6a',
      })
      container.add(completedText)
    }

    // Hit area for selection
    const hitArea = this.scene.add.rectangle(PANEL_WIDTH / 2 - 25, 35, PANEL_WIDTH - 50, 70)
    hitArea.setInteractive({ useHandCursor: true })
    hitArea.on('pointerdown', () => {
      this.selectedQuestId = quest.questId
      this.refreshList()
      this.refreshDetail()
    })
    container.add(hitArea)

    return container
  }

  private refreshDetail(): void {
    this.detailContainer.removeAll(true)

    if (!this.selectedQuestId) {
      const placeholder = this.scene.add.text(DETAIL_WIDTH / 2, 200, 'Select a quest to view details', {
        ...TEXT_STYLES.BODY,
        fontSize: '16px',
        color: '#888888',
      })
      placeholder.setOrigin(0.5)
      this.detailContainer.add(placeholder)
      return
    }

    const quest = getQuest(this.selectedQuestId)
    if (!quest) return

    const state = getGameState(this.scene)
    const progress = state.activeQuests.find((q) => q.questId === this.selectedQuestId)
    const isCompleted = state.completedQuestIds.includes(this.selectedQuestId)

    let yOffset = 0

    // Quest title
    const titleText = this.scene.add.text(0, yOffset, quest.name, {
      ...TEXT_STYLES.HEADING,
      fontSize: '20px',
      color: '#ffd54f',
    })
    this.detailContainer.add(titleText)
    yOffset += 30

    // Description
    const descText = this.scene.add.text(0, yOffset, quest.description, {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
      wordWrap: { width: DETAIL_WIDTH },
      lineSpacing: 4,
    })
    this.detailContainer.add(descText)
    yOffset += descText.height + 20

    // Objectives
    const objHeader = this.scene.add.text(0, yOffset, 'Objectives:', {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
      color: '#42a5f5',
      fontStyle: 'bold',
    })
    this.detailContainer.add(objHeader)
    yOffset += 22

    for (const objective of quest.objectives) {
      const current = progress ? getObjectiveProgress(progress, objective.objectiveId) : 0
      const required = objective.requiredCount
      const objComplete = current >= required || isCompleted
      const objIcon = QUEST_TYPE_ICONS[objective.type] ?? '📌'

      const checkmark = objComplete ? '✓' : '○'
      const objText = this.scene.add.text(
        0,
        yOffset,
        `${checkmark} ${objIcon} ${objective.description} (${objComplete ? required : current}/${required})`,
        {
          ...TEXT_STYLES.BODY,
          fontSize: '13px',
          color: objComplete ? '#66bb6a' : '#cccccc',
        },
      )
      this.detailContainer.add(objText)
      yOffset += 22
    }

    yOffset += 15

    // Rewards
    const rewardsHeader = this.scene.add.text(0, yOffset, 'Rewards:', {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
      color: '#ffd54f',
      fontStyle: 'bold',
    })
    this.detailContainer.add(rewardsHeader)
    yOffset += 22

    // XP and Gold
    const xpGoldText = this.scene.add.text(
      0,
      yOffset,
      `${quest.rewards.experience} XP, ${quest.rewards.gold} Gold`,
      {
        ...TEXT_STYLES.BODY,
        fontSize: '13px',
        color: '#cccccc',
      },
    )
    this.detailContainer.add(xpGoldText)
    yOffset += 20

    // Item rewards
    for (const item of quest.rewards.items) {
      const itemText = this.scene.add.text(0, yOffset, `${item.itemId} x${item.quantity}`, {
        ...TEXT_STYLES.BODY,
        fontSize: '13px',
        color: '#cccccc',
      })
      this.detailContainer.add(itemText)
      yOffset += 18
    }

    yOffset += 20

    // Abandon button (only for active quests)
    if (progress && this.activeTab === 'active') {
      const abandonBtn = this.createButton(0, yOffset, 'Abandon Quest', COLORS.DANGER, () => {
        this.handleAbandonQuest(quest.questId)
      })
      this.detailContainer.add(abandonBtn)
    }
  }

  private createButton(
    x: number,
    y: number,
    text: string,
    color: number,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y)

    const bg = this.scene.add.graphics()
    bg.fillStyle(color, 0.3)
    bg.fillRoundedRect(0, 0, 140, 32, 6)
    bg.lineStyle(1, color)
    bg.strokeRoundedRect(0, 0, 140, 32, 6)
    container.add(bg)

    const btnText = this.scene.add.text(70, 16, text, {
      ...TEXT_STYLES.BODY,
      fontSize: '13px',
      color: '#ffffff',
    })
    btnText.setOrigin(0.5)
    container.add(btnText)

    const hitArea = this.scene.add.rectangle(70, 16, 140, 32)
    hitArea.setInteractive({ useHandCursor: true })
    hitArea.on('pointerdown', onClick)
    hitArea.on('pointerover', () => {
      bg.clear()
      bg.fillStyle(color, 0.6)
      bg.fillRoundedRect(0, 0, 140, 32, 6)
      bg.lineStyle(1, color)
      bg.strokeRoundedRect(0, 0, 140, 32, 6)
    })
    hitArea.on('pointerout', () => {
      bg.clear()
      bg.fillStyle(color, 0.3)
      bg.fillRoundedRect(0, 0, 140, 32, 6)
      bg.lineStyle(1, color)
      bg.strokeRoundedRect(0, 0, 140, 32, 6)
    })
    container.add(hitArea)

    return container
  }

  private handleAbandonQuest(questId: string): void {
    const state = getGameState(this.scene)
    const newActiveQuests = abandonQuest(state.activeQuests, questId)
    setGameState(this.scene, updateActiveQuests(state, newActiveQuests))

    this.selectedQuestId = null
    this.refreshList()
    this.refreshDetail()
  }

  destroy(): void {
    for (const ring of this.progressRings) {
      ring.destroy()
    }
    this.progressRings = []
    this.container.destroy()
  }
}
