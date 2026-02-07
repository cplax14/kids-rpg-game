import Phaser from 'phaser'
import type { AchievementDefinition, AchievementProgress, AchievementCategory } from '../../models/types'
import { COLORS, TEXT_STYLES, DEPTH } from '../../config'
import { getGameState } from '../../systems/GameStateManager'
import {
  getAllAchievements,
  getAchievement,
  getAchievementsByCategory,
  getAchievementProgress,
  getAchievementStatistics,
  getAchievementProgressPercent,
  formatAchievementProgress,
} from '../../systems/AchievementSystem'

const GRID_COLS = 5
const CELL_SIZE = 70
const DETAIL_WIDTH = 380

const RARITY_COLORS: Record<string, number> = {
  bronze: 0xcd7f32,
  silver: 0xc0c0c0,
  gold: 0xffd54f,
  platinum: 0xe5e4e2,
}

const CATEGORY_ICONS: Record<string, string> = {
  combat: '⚔️',
  collection: '📦',
  exploration: '🗺️',
  social: '💬',
  mastery: '⭐',
}

const CATEGORY_NAMES: Record<string, string> = {
  all: 'All',
  combat: 'Combat',
  collection: 'Collection',
  exploration: 'Explore',
  social: 'Social',
  mastery: 'Mastery',
}

export class AchievementPanel {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private detailContainer: Phaser.GameObjects.Container
  private tabContainer: Phaser.GameObjects.Container
  private selectedAchievement: AchievementDefinition | null = null
  private selectedCategory: AchievementCategory | 'all' = 'all'
  private scrollOffset: number = 0

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene

    this.tabContainer = scene.add.container(x, y)
    this.tabContainer.setDepth(DEPTH.OVERLAY + 2)

    this.container = scene.add.container(x, y + 40)
    this.container.setDepth(DEPTH.OVERLAY + 2)

    this.detailContainer = scene.add.container(x + GRID_COLS * (CELL_SIZE + 8) + 30, y + 40)
    this.detailContainer.setDepth(DEPTH.OVERLAY + 2)

    this.createTabs()
    this.createHeader()
    this.refreshGrid()
    this.refreshDetail()
  }

  private createTabs(): void {
    const categories: Array<AchievementCategory | 'all'> = ['all', 'combat', 'collection', 'exploration', 'social', 'mastery']
    const tabWidth = 65
    const tabHeight = 28

    categories.forEach((cat, i) => {
      const x = i * (tabWidth + 4)
      const isSelected = cat === this.selectedCategory

      const bg = this.scene.add.graphics()
      bg.fillStyle(isSelected ? COLORS.PRIMARY : COLORS.PANEL_BG, isSelected ? 0.8 : 0.5)
      bg.fillRoundedRect(x, 0, tabWidth, tabHeight, 6)
      if (isSelected) {
        bg.lineStyle(1, COLORS.PRIMARY)
        bg.strokeRoundedRect(x, 0, tabWidth, tabHeight, 6)
      }
      this.tabContainer.add(bg)

      const label = this.scene.add.text(x + tabWidth / 2, tabHeight / 2, CATEGORY_NAMES[cat], {
        ...TEXT_STYLES.SMALL,
        fontSize: '10px',
        color: isSelected ? '#ffffff' : '#aaaaaa',
      })
      label.setOrigin(0.5)
      this.tabContainer.add(label)

      const hitArea = this.scene.add.rectangle(x + tabWidth / 2, tabHeight / 2, tabWidth, tabHeight)
      hitArea.setInteractive({ useHandCursor: true })
      hitArea.on('pointerdown', () => {
        this.selectedCategory = cat
        this.scrollOffset = 0
        this.selectedAchievement = null
        this.refreshTabs()
        this.refreshGrid()
        this.refreshDetail()
      })
      this.tabContainer.add(hitArea)
    })
  }

  private refreshTabs(): void {
    this.tabContainer.removeAll(true)
    this.createTabs()
  }

  private createHeader(): void {
    const state = getGameState(this.scene)
    const stats = getAchievementStatistics(state.achievements)

    const progressText = this.scene.add.text(
      0,
      0,
      `Achievements: ${stats.unlocked}/${stats.total} (${stats.percentComplete}%)`,
      {
        ...TEXT_STYLES.BODY,
        fontSize: '15px',
        color: '#ffd54f',
      },
    )
    this.container.add(progressText)
  }

  refresh(): void {
    this.refreshGrid()
    this.refreshDetail()
  }

  private getFilteredAchievements(): ReadonlyArray<AchievementDefinition> {
    if (this.selectedCategory === 'all') {
      return getAllAchievements()
    }
    return getAchievementsByCategory(this.selectedCategory)
  }

  private refreshGrid(): void {
    // Clear previous grid elements (keep header at index 0)
    const children = this.container.getAll()
    for (let i = children.length - 1; i >= 1; i--) {
      (children[i] as Phaser.GameObjects.GameObject).destroy()
    }

    const state = getGameState(this.scene)
    const achievements = this.getFilteredAchievements()

    const visibleRows = 5
    const startIndex = this.scrollOffset * GRID_COLS
    const endIndex = Math.min(startIndex + visibleRows * GRID_COLS, achievements.length)

    for (let i = startIndex; i < endIndex; i++) {
      const definition = achievements[i]
      const localIndex = i - startIndex
      const col = localIndex % GRID_COLS
      const row = Math.floor(localIndex / GRID_COLS)
      const cellX = col * (CELL_SIZE + 8)
      const cellY = 30 + row * (CELL_SIZE + 8)

      const progress = getAchievementProgress(state.achievements, definition.achievementId)
      const isUnlocked = progress?.isUnlocked ?? false
      const isSelected = this.selectedAchievement?.achievementId === definition.achievementId
      const isSecret = definition.isSecret && !isUnlocked
      const rarityColor = RARITY_COLORS[definition.rarity] ?? 0xbdbdbd

      // Cell background
      const bg = this.scene.add.graphics()
      if (isUnlocked) {
        bg.fillStyle(isSelected ? COLORS.PRIMARY : rarityColor, isSelected ? 0.7 : 0.3)
      } else {
        bg.fillStyle(0x333333, 0.4)
      }
      bg.fillRoundedRect(cellX, cellY, CELL_SIZE, CELL_SIZE, 8)
      bg.lineStyle(2, isSelected ? COLORS.PRIMARY : isUnlocked ? rarityColor : 0x444444)
      bg.strokeRoundedRect(cellX, cellY, CELL_SIZE, CELL_SIZE, 8)
      this.container.add(bg)

      if (isSecret) {
        // Secret achievement - show lock
        const lockIcon = this.scene.add.text(cellX + CELL_SIZE / 2, cellY + CELL_SIZE / 2 - 5, '🔒', {
          fontSize: '22px',
        })
        lockIcon.setOrigin(0.5)
        this.container.add(lockIcon)

        const secretLabel = this.scene.add.text(cellX + CELL_SIZE / 2, cellY + CELL_SIZE - 12, '???', {
          ...TEXT_STYLES.SMALL,
          fontSize: '10px',
          color: '#555555',
        })
        secretLabel.setOrigin(0.5)
        this.container.add(secretLabel)
      } else {
        // Category icon
        const icon = CATEGORY_ICONS[definition.category] ?? '🎯'
        const iconText = this.scene.add.text(cellX + CELL_SIZE / 2, cellY + 18, icon, {
          fontSize: '20px',
        })
        iconText.setOrigin(0.5)
        if (!isUnlocked) {
          iconText.setAlpha(0.4)
        }
        this.container.add(iconText)

        // Achievement name (truncated)
        const shortName = definition.name.length > 9 ? definition.name.substring(0, 8) + '..' : definition.name
        const name = this.scene.add.text(cellX + CELL_SIZE / 2, cellY + 42, shortName, {
          ...TEXT_STYLES.SMALL,
          fontSize: '9px',
          color: isUnlocked ? '#ffffff' : '#888888',
        })
        name.setOrigin(0.5)
        this.container.add(name)

        // Progress bar for locked achievements
        if (!isUnlocked && progress) {
          const percent = getAchievementProgressPercent(progress, definition)
          if (percent > 0) {
            const barWidth = CELL_SIZE - 16
            const barHeight = 4
            const barX = cellX + 8
            const barY = cellY + CELL_SIZE - 10

            const barBg = this.scene.add.graphics()
            barBg.fillStyle(0x333333, 1)
            barBg.fillRoundedRect(barX, barY, barWidth, barHeight, 2)
            this.container.add(barBg)

            const barFill = this.scene.add.graphics()
            barFill.fillStyle(rarityColor, 1)
            barFill.fillRoundedRect(barX, barY, barWidth * (percent / 100), barHeight, 2)
            this.container.add(barFill)
          }
        }

        // Checkmark for unlocked
        if (isUnlocked) {
          const check = this.scene.add.text(cellX + CELL_SIZE - 12, cellY + 6, '✓', {
            fontSize: '14px',
            color: '#66bb6a',
          })
          check.setOrigin(0.5)
          this.container.add(check)
        }
      }

      // Click handler (show detail for any visible achievement, even secret if clicked)
      const hitArea = this.scene.add.rectangle(cellX + CELL_SIZE / 2, cellY + CELL_SIZE / 2, CELL_SIZE, CELL_SIZE)
      hitArea.setInteractive({ useHandCursor: true })
      hitArea.on('pointerdown', () => {
        if (!isSecret) {
          this.selectedAchievement = definition
          this.refresh()
        }
      })
      this.container.add(hitArea)
    }

    // Scroll buttons
    const totalRows = Math.ceil(achievements.length / GRID_COLS)
    if (totalRows > visibleRows) {
      if (this.scrollOffset > 0) {
        const upBtn = this.scene.add.text(GRID_COLS * (CELL_SIZE + 8) / 2 - 10, 20, '▲', {
          fontSize: '16px',
          color: '#ffffff',
        })
        upBtn.setInteractive({ useHandCursor: true })
        upBtn.on('pointerdown', () => {
          this.scrollOffset = Math.max(0, this.scrollOffset - 1)
          this.refreshGrid()
        })
        this.container.add(upBtn)
      }

      if (this.scrollOffset + visibleRows < totalRows) {
        const downBtn = this.scene.add.text(
          GRID_COLS * (CELL_SIZE + 8) / 2 - 10,
          30 + visibleRows * (CELL_SIZE + 8) + 5,
          '▼',
          {
            fontSize: '16px',
            color: '#ffffff',
          },
        )
        downBtn.setInteractive({ useHandCursor: true })
        downBtn.on('pointerdown', () => {
          this.scrollOffset++
          this.refreshGrid()
        })
        this.container.add(downBtn)
      }
    }
  }

  private refreshDetail(): void {
    this.detailContainer.removeAll(true)

    if (!this.selectedAchievement) {
      const hint = this.scene.add.text(0, 30, 'Select an achievement\nto see details', {
        ...TEXT_STYLES.BODY,
        fontSize: '16px',
        color: '#666666',
      })
      this.detailContainer.add(hint)
      return
    }

    const definition = this.selectedAchievement
    const state = getGameState(this.scene)
    const progress = getAchievementProgress(state.achievements, definition.achievementId)
    const isUnlocked = progress?.isUnlocked ?? false
    const rarityColor = RARITY_COLORS[definition.rarity] ?? 0xbdbdbd

    // Background
    const bg = this.scene.add.graphics()
    bg.fillStyle(COLORS.PANEL_BG, 0.6)
    bg.fillRoundedRect(0, 0, DETAIL_WIDTH, 380, 10)
    this.detailContainer.add(bg)

    // Rarity color bar
    const rarityBar = this.scene.add.graphics()
    rarityBar.fillStyle(rarityColor, 0.8)
    rarityBar.fillRoundedRect(0, 0, DETAIL_WIDTH, 8, { tl: 10, tr: 10, bl: 0, br: 0 })
    this.detailContainer.add(rarityBar)

    // Status indicator
    const statusBg = this.scene.add.graphics()
    statusBg.fillStyle(isUnlocked ? 0x66bb6a : 0x555555, 0.3)
    statusBg.fillRoundedRect(DETAIL_WIDTH - 90, 15, 80, 24, 6)
    this.detailContainer.add(statusBg)

    const statusText = this.scene.add.text(
      DETAIL_WIDTH - 50,
      27,
      isUnlocked ? '✓ Unlocked' : 'Locked',
      {
        ...TEXT_STYLES.SMALL,
        fontSize: '11px',
        color: isUnlocked ? '#66bb6a' : '#888888',
      },
    )
    statusText.setOrigin(0.5)
    this.detailContainer.add(statusText)

    // Category icon and name
    const icon = CATEGORY_ICONS[definition.category] ?? '🎯'
    const iconText = this.scene.add.text(15, 20, icon, { fontSize: '32px' })
    this.detailContainer.add(iconText)

    const name = this.scene.add.text(55, 18, definition.name, {
      ...TEXT_STYLES.BODY,
      fontSize: '20px',
      fontStyle: 'bold',
    })
    this.detailContainer.add(name)

    // Rarity and category
    const rarityName = definition.rarity.charAt(0).toUpperCase() + definition.rarity.slice(1)
    const categoryName = definition.category.charAt(0).toUpperCase() + definition.category.slice(1)
    const infoText = this.scene.add.text(55, 45, `${rarityName}  |  ${categoryName}`, {
      ...TEXT_STYLES.SMALL,
      fontSize: '12px',
      color: '#b0bec5',
    })
    this.detailContainer.add(infoText)

    // Description
    const desc = this.scene.add.text(15, 80, definition.description, {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
      wordWrap: { width: DETAIL_WIDTH - 30 },
      color: '#cccccc',
    })
    this.detailContainer.add(desc)

    // Progress section
    const progressY = 130
    const progressLabel = this.scene.add.text(15, progressY, 'Progress', {
      ...TEXT_STYLES.SMALL,
      fontSize: '14px',
      color: '#ffd54f',
    })
    this.detailContainer.add(progressLabel)

    if (progress) {
      const progressStr = formatAchievementProgress(progress, definition)
      const progressText = this.scene.add.text(15, progressY + 22, progressStr, {
        ...TEXT_STYLES.BODY,
        fontSize: '16px',
        color: isUnlocked ? '#66bb6a' : '#ffffff',
      })
      this.detailContainer.add(progressText)

      // Progress bar
      const percent = getAchievementProgressPercent(progress, definition)
      const barWidth = DETAIL_WIDTH - 30
      const barHeight = 12
      const barY = progressY + 50

      const barBg = this.scene.add.graphics()
      barBg.fillStyle(0x333333, 1)
      barBg.fillRoundedRect(15, barY, barWidth, barHeight, 4)
      this.detailContainer.add(barBg)

      const barFill = this.scene.add.graphics()
      barFill.fillStyle(isUnlocked ? 0x66bb6a : rarityColor, 1)
      barFill.fillRoundedRect(15, barY, barWidth * (percent / 100), barHeight, 4)
      this.detailContainer.add(barFill)

      const percentText = this.scene.add.text(15 + barWidth / 2, barY + barHeight / 2, `${percent}%`, {
        ...TEXT_STYLES.SMALL,
        fontSize: '10px',
        color: '#ffffff',
      })
      percentText.setOrigin(0.5)
      this.detailContainer.add(percentText)
    }

    // Rewards section
    const rewardsY = 210
    const rewardsLabel = this.scene.add.text(15, rewardsY, 'Rewards', {
      ...TEXT_STYLES.SMALL,
      fontSize: '14px',
      color: '#ffd54f',
    })
    this.detailContainer.add(rewardsLabel)

    let rewardY = rewardsY + 25
    if (definition.rewardGold > 0) {
      const goldText = this.scene.add.text(15, rewardY, `💰 ${definition.rewardGold} Gold`, {
        ...TEXT_STYLES.BODY,
        fontSize: '14px',
        color: '#ffd54f',
      })
      this.detailContainer.add(goldText)
      rewardY += 22
    }

    for (const item of definition.rewardItems) {
      const itemText = this.scene.add.text(15, rewardY, `📦 ${item.itemId} x${item.quantity}`, {
        ...TEXT_STYLES.BODY,
        fontSize: '14px',
        color: '#ffffff',
      })
      this.detailContainer.add(itemText)
      rewardY += 22
    }

    if (definition.rewardGold === 0 && definition.rewardItems.length === 0) {
      const noRewardsText = this.scene.add.text(15, rewardY, 'Bragging rights only!', {
        ...TEXT_STYLES.BODY,
        fontSize: '13px',
        color: '#888888',
        fontStyle: 'italic',
      })
      this.detailContainer.add(noRewardsText)
    }

    // Unlocked timestamp
    if (isUnlocked && progress?.unlockedAt) {
      const date = new Date(progress.unlockedAt)
      const dateStr = date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
      const unlockedText = this.scene.add.text(15, 340, `Unlocked on ${dateStr}`, {
        ...TEXT_STYLES.SMALL,
        fontSize: '12px',
        color: '#66bb6a',
      })
      this.detailContainer.add(unlockedText)
    }
  }

  destroy(): void {
    this.tabContainer.destroy()
    this.container.destroy()
    this.detailContainer.destroy()
  }
}
