import Phaser from 'phaser'
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, COLORS, DEPTH, TEXT_STYLES } from '../config'
import { InventoryPanel } from '../ui/menus/InventoryPanel'
import { EquipmentPanel } from '../ui/menus/EquipmentPanel'
import { SquadPanel } from '../ui/menus/SquadPanel'
import { BestiaryPanel } from '../ui/menus/BestiaryPanel'
import { getGameState } from '../systems/GameStateManager'

type MenuTab = 'inventory' | 'equipment' | 'squad' | 'bestiary'

export class MenuScene extends Phaser.Scene {
  private activeTab: MenuTab = 'inventory'
  private inventoryPanel: InventoryPanel | null = null
  private equipmentPanel: EquipmentPanel | null = null
  private squadPanel: SquadPanel | null = null
  private bestiaryPanel: BestiaryPanel | null = null
  private tabButtons: Phaser.GameObjects.Container[] = []

  constructor() {
    super({ key: SCENE_KEYS.MENU })
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
    const state = getGameState(this)

    // Player info
    const nameText = this.add.text(70, 45, state.player.name, {
      ...TEXT_STYLES.HEADING,
      fontSize: '22px',
    })
    nameText.setDepth(DEPTH.OVERLAY + 1)

    const levelText = this.add.text(250, 48, `Level ${state.player.level}`, {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      color: '#b0bec5',
    })
    levelText.setDepth(DEPTH.OVERLAY + 1)

    // Close button
    const closeBtn = this.add.text(GAME_WIDTH - 90, 45, 'X Close', {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      color: '#ef5350',
    })
    closeBtn.setDepth(DEPTH.OVERLAY + 1)
    closeBtn.setInteractive({ useHandCursor: true })
    closeBtn.on('pointerdown', () => this.closeMenu())
  }

  private createTabBar(): void {
    const tabs: ReadonlyArray<{ label: string; tab: MenuTab }> = [
      { label: 'Inventory', tab: 'inventory' },
      { label: 'Equipment', tab: 'equipment' },
      { label: 'Squad', tab: 'squad' },
      { label: 'Bestiary', tab: 'bestiary' },
    ]

    tabs.forEach((tabDef, index) => {
      const x = 70 + index * 150
      const y = 80
      const isActive = tabDef.tab === this.activeTab

      const container = this.add.container(x, y)
      container.setDepth(DEPTH.OVERLAY + 1)

      const bg = this.add.graphics()
      bg.fillStyle(isActive ? COLORS.PRIMARY : COLORS.PANEL_BG, isActive ? 0.7 : 0.4)
      bg.fillRoundedRect(0, 0, 130, 32, 8)
      container.add(bg)

      const text = this.add.text(65, 16, tabDef.label, {
        ...TEXT_STYLES.BODY,
        fontSize: '14px',
      })
      text.setOrigin(0.5)
      container.add(text)

      const hitArea = this.add.rectangle(65, 16, 130, 32)
      hitArea.setInteractive({ useHandCursor: true })
      hitArea.on('pointerdown', () => {
        this.activeTab = tabDef.tab
        this.destroyPanels()
        this.showTab(tabDef.tab)
        this.refreshTabBar()
      })
      container.add(hitArea)

      this.tabButtons.push(container)
    })
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
      this.inventoryPanel = new InventoryPanel(this, 70, 125)
    } else if (tab === 'equipment') {
      this.equipmentPanel = new EquipmentPanel(this, 70, 125)
    } else if (tab === 'squad') {
      this.squadPanel = new SquadPanel(this, 70, 125)
    } else if (tab === 'bestiary') {
      this.bestiaryPanel = new BestiaryPanel(this, 70, 125)
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
  }

  private closeMenu(): void {
    this.destroyPanels()

    const worldScene = this.scene.get(SCENE_KEYS.WORLD)
    if (worldScene) {
      this.scene.resume(SCENE_KEYS.WORLD)
    }

    this.scene.stop()
  }
}
