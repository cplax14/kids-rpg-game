import Phaser from 'phaser'
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, COLORS, DEPTH, TEXT_STYLES } from '../config'
import { InventoryPanel } from '../ui/menus/InventoryPanel'
import { EquipmentPanel } from '../ui/menus/EquipmentPanel'
import { SquadPanel } from '../ui/menus/SquadPanel'
import { BestiaryPanel } from '../ui/menus/BestiaryPanel'
import { SettingsPanel } from '../ui/menus/SettingsPanel'
import { SaveLoadPanel } from '../ui/menus/SaveLoadPanel'
import { QuestLogPanel } from '../ui/menus/QuestLogPanel'
import { AchievementPanel } from '../ui/menus/AchievementPanel'
import { PlayerHeader } from '../ui/menus/PlayerHeader'

type MenuTab = 'inventory' | 'equipment' | 'squad' | 'bestiary' | 'quests' | 'badges' | 'settings' | 'save'

const TAB_WIDTH = 88
const TAB_HEIGHT = 36
const TAB_GAP = 8
const PANEL_START_Y = 175

export class MenuScene extends Phaser.Scene {
  private activeTab: MenuTab = 'inventory'
  private inventoryPanel: InventoryPanel | null = null
  private equipmentPanel: EquipmentPanel | null = null
  private squadPanel: SquadPanel | null = null
  private bestiaryPanel: BestiaryPanel | null = null
  private settingsPanel: SettingsPanel | null = null
  private saveLoadPanel: SaveLoadPanel | null = null
  private questLogPanel: QuestLogPanel | null = null
  private achievementPanel: AchievementPanel | null = null
  private playerHeader: PlayerHeader | null = null
  private tabButtons: Phaser.GameObjects.Container[] = []
  private playTime: number = 0

  constructor() {
    super({ key: SCENE_KEYS.MENU })
  }

  init(data: { playTime?: number }): void {
    this.playTime = data?.playTime ?? 0
  }

  create(): void {
    this.activeTab = 'inventory'

    // Overlay background
    const bg = this.add.graphics()
    bg.fillStyle(0x000000, 0.7)
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    bg.setDepth(DEPTH.OVERLAY)

    // Main panel
    const panel = this.add.graphics()
    panel.fillStyle(COLORS.DARK_BG, 0.95)
    panel.fillRoundedRect(40, 30, GAME_WIDTH - 80, GAME_HEIGHT - 60, 16)
    panel.lineStyle(2, COLORS.PRIMARY)
    panel.strokeRoundedRect(40, 30, GAME_WIDTH - 80, GAME_HEIGHT - 60, 16)
    panel.setDepth(DEPTH.OVERLAY)

    this.createHeader()
    this.createTabBar()
    this.showTab(this.activeTab)

    // ESC to close
    this.input.keyboard?.on('keydown-ESC', () => this.closeMenu())
  }

  private createHeader(): void {
    // Player header with stats
    this.playerHeader = new PlayerHeader(this, 55, 40, this.playTime)

    // Close button
    const closeBtnBg = this.add.graphics()
    closeBtnBg.fillStyle(COLORS.DANGER, 0.3)
    closeBtnBg.fillRoundedRect(GAME_WIDTH - 115, 40, 70, 28, 6)
    closeBtnBg.setDepth(DEPTH.OVERLAY + 1)

    const closeBtn = this.add.text(GAME_WIDTH - 80, 48, 'Close', {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
      color: '#ef5350',
    })
    closeBtn.setOrigin(0.5, 0.5)
    closeBtn.setDepth(DEPTH.OVERLAY + 1)
    closeBtn.setInteractive({ useHandCursor: true })
    closeBtn.on('pointerdown', () => this.closeMenu())
    closeBtn.on('pointerover', () => {
      closeBtnBg.clear()
      closeBtnBg.fillStyle(COLORS.DANGER, 0.6)
      closeBtnBg.fillRoundedRect(GAME_WIDTH - 115, 40, 70, 28, 6)
    })
    closeBtn.on('pointerout', () => {
      closeBtnBg.clear()
      closeBtnBg.fillStyle(COLORS.DANGER, 0.3)
      closeBtnBg.fillRoundedRect(GAME_WIDTH - 115, 40, 70, 28, 6)
    })
  }

  private createTabBar(): void {
    const tabs: ReadonlyArray<{ label: string; tab: MenuTab }> = [
      { label: 'Inventory', tab: 'inventory' },
      { label: 'Equipment', tab: 'equipment' },
      { label: 'Squad', tab: 'squad' },
      { label: 'Bestiary', tab: 'bestiary' },
      { label: 'Quests', tab: 'quests' },
      { label: 'Badges', tab: 'badges' },
      { label: 'Settings', tab: 'settings' },
      { label: 'Save', tab: 'save' },
    ]

    const startX = 60
    const y = 130

    tabs.forEach((tabDef, index) => {
      const x = startX + index * (TAB_WIDTH + TAB_GAP)
      const isActive = tabDef.tab === this.activeTab

      const container = this.add.container(x, y)
      container.setDepth(DEPTH.OVERLAY + 1)

      // Tab background
      const bg = this.add.graphics()
      this.drawTabBackground(bg, isActive, TAB_WIDTH, TAB_HEIGHT)
      container.add(bg)

      // Active indicator (underline)
      if (isActive) {
        const indicator = this.add.graphics()
        indicator.fillStyle(COLORS.PRIMARY, 1)
        indicator.fillRoundedRect(4, TAB_HEIGHT - 4, TAB_WIDTH - 8, 3, 1)
        container.add(indicator)
      }

      // Tab text
      const text = this.add.text(TAB_WIDTH / 2, TAB_HEIGHT / 2, tabDef.label, {
        ...TEXT_STYLES.BODY,
        fontSize: '13px',
        color: isActive ? '#ffffff' : '#b0bec5',
        fontStyle: isActive ? 'bold' : 'normal',
      })
      text.setOrigin(0.5)
      container.add(text)

      // Hit area for interaction
      const hitArea = this.add.rectangle(TAB_WIDTH / 2, TAB_HEIGHT / 2, TAB_WIDTH, TAB_HEIGHT)
      hitArea.setInteractive({ useHandCursor: true })
      hitArea.on('pointerdown', () => {
        this.activeTab = tabDef.tab
        this.destroyPanels()
        this.showTab(tabDef.tab)
        this.refreshTabBar()
      })
      hitArea.on('pointerover', () => {
        if (!isActive) {
          bg.clear()
          this.drawTabBackground(bg, false, TAB_WIDTH, TAB_HEIGHT, true)
          text.setColor('#ffffff')
        }
      })
      hitArea.on('pointerout', () => {
        if (!isActive) {
          bg.clear()
          this.drawTabBackground(bg, false, TAB_WIDTH, TAB_HEIGHT, false)
          text.setColor('#b0bec5')
        }
      })
      container.add(hitArea)

      this.tabButtons.push(container)
    })
  }

  private drawTabBackground(
    graphics: Phaser.GameObjects.Graphics,
    isActive: boolean,
    width: number,
    height: number,
    isHover: boolean = false,
  ): void {
    if (isActive) {
      graphics.fillStyle(COLORS.PRIMARY, 0.5)
      graphics.fillRoundedRect(0, 0, width, height, 8)
      graphics.lineStyle(1, COLORS.PRIMARY, 0.8)
      graphics.strokeRoundedRect(0, 0, width, height, 8)
    } else if (isHover) {
      graphics.fillStyle(COLORS.PANEL_BG, 0.7)
      graphics.fillRoundedRect(0, 0, width, height, 8)
      graphics.lineStyle(1, COLORS.PRIMARY, 0.4)
      graphics.strokeRoundedRect(0, 0, width, height, 8)
    } else {
      graphics.fillStyle(COLORS.PANEL_BG, 0.4)
      graphics.fillRoundedRect(0, 0, width, height, 8)
    }
  }

  private refreshTabBar(): void {
    // Destroy old tabs and recreate
    for (const btn of this.tabButtons) {
      btn.destroy()
    }
    this.tabButtons = []
    this.createTabBar()
  }

  private showTab(tab: MenuTab): void {
    this.destroyPanels()

    if (tab === 'inventory') {
      this.inventoryPanel = new InventoryPanel(this, 70, PANEL_START_Y)
    } else if (tab === 'equipment') {
      this.equipmentPanel = new EquipmentPanel(this, 70, PANEL_START_Y)
    } else if (tab === 'squad') {
      this.squadPanel = new SquadPanel(this, 70, PANEL_START_Y)
    } else if (tab === 'bestiary') {
      this.bestiaryPanel = new BestiaryPanel(this, 70, PANEL_START_Y)
    } else if (tab === 'quests') {
      this.questLogPanel = new QuestLogPanel(this, 70, PANEL_START_Y)
    } else if (tab === 'badges') {
      this.achievementPanel = new AchievementPanel(this, 70, PANEL_START_Y)
    } else if (tab === 'settings') {
      this.settingsPanel = new SettingsPanel(this, 70, PANEL_START_Y)
    } else if (tab === 'save') {
      this.saveLoadPanel = new SaveLoadPanel(this, 70, PANEL_START_Y, {
        mode: 'save',
        playTime: this.playTime,
        onCancel: () => {
          this.activeTab = 'inventory'
          this.refreshTabBar()
          this.showTab('inventory')
        },
      })
    }
  }

  private destroyPanels(): void {
    if (this.inventoryPanel) {
      this.inventoryPanel.destroy()
      this.inventoryPanel = null
    }
    if (this.equipmentPanel) {
      this.equipmentPanel.destroy()
      this.equipmentPanel = null
    }
    if (this.squadPanel) {
      this.squadPanel.destroy()
      this.squadPanel = null
    }
    if (this.bestiaryPanel) {
      this.bestiaryPanel.destroy()
      this.bestiaryPanel = null
    }
    if (this.settingsPanel) {
      this.settingsPanel.destroy()
      this.settingsPanel = null
    }
    if (this.saveLoadPanel) {
      this.saveLoadPanel.destroy()
      this.saveLoadPanel = null
    }
    if (this.questLogPanel) {
      this.questLogPanel.destroy()
      this.questLogPanel = null
    }
    if (this.achievementPanel) {
      this.achievementPanel.destroy()
      this.achievementPanel = null
    }
  }

  private closeMenu(): void {
    this.destroyPanels()

    if (this.playerHeader) {
      this.playerHeader.destroy()
      this.playerHeader = null
    }

    const worldScene = this.scene.get(SCENE_KEYS.WORLD)
    if (worldScene) {
      this.scene.resume(SCENE_KEYS.WORLD)
    }

    this.scene.stop()
  }
}
