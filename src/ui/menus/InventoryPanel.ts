import Phaser from 'phaser'
import type { Inventory, InventorySlot, ItemCategory } from '../../models/types'
import { COLORS, TEXT_STYLES, DEPTH } from '../../config'
import { getGameState, setGameState, updateInventory, updatePlayer } from '../../systems/GameStateManager'
import { useItem, sortInventory, removeItem } from '../../systems/InventorySystem'
import { useItemOnPlayer } from '../../systems/ItemEffectSystem'

const GRID_COLS = 5
const CELL_WIDTH = 100
const CELL_HEIGHT = 90
const CELL_GAP = 10
const PANEL_WIDTH = (CELL_WIDTH + CELL_GAP) * GRID_COLS
const DETAIL_WIDTH = 380

type CategoryFilter = 'all' | ItemCategory

const CATEGORY_COLORS: Record<ItemCategory, number> = {
  consumable: 0x66bb6a,
  capture_device: 0x42a5f5,
  material: 0x8d6e63,
  breeding_item: 0x7e57c2,
  key_item: 0xffd54f,
}

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  consumable: 'Consumable',
  capture_device: 'Capture',
  material: 'Material',
  breeding_item: 'Breeding',
  key_item: 'Key Item',
}

export class InventoryPanel {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private detailContainer: Phaser.GameObjects.Container
  private gridContainer: Phaser.GameObjects.Container
  private goldText!: Phaser.GameObjects.Text
  private slotCountText!: Phaser.GameObjects.Text
  private selectedSlot: InventorySlot | null = null
  private activeFilter: CategoryFilter = 'all'
  private filterButtons: Phaser.GameObjects.Container[] = []

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene
    this.container = scene.add.container(x, y)
    this.container.setDepth(DEPTH.OVERLAY + 2)

    this.gridContainer = scene.add.container(0, 70)
    this.container.add(this.gridContainer)

    this.detailContainer = scene.add.container(PANEL_WIDTH + 30, 0)
    this.container.add(this.detailContainer)

    this.createHeader()
    this.createFilterBar()
    this.refreshGrid()
    this.refreshDetail()
  }

  private createHeader(): void {
    const state = getGameState(this.scene)

    // Gold display with styled background
    const goldBg = this.scene.add.graphics()
    goldBg.fillStyle(COLORS.GOLD, 0.15)
    goldBg.fillRoundedRect(0, 0, 110, 28, 6)
    this.container.add(goldBg)

    this.goldText = this.scene.add.text(10, 5, `Gold: ${state.player.gold}`, {
      ...TEXT_STYLES.BODY,
      fontSize: '15px',
      color: '#ffd54f',
    })
    this.container.add(this.goldText)

    // Slot count
    this.slotCountText = this.scene.add.text(130, 5, `${state.inventory.items.length}/${state.inventory.maxSlots} slots`, {
      ...TEXT_STYLES.SMALL,
      fontSize: '14px',
      color: '#b0bec5',
    })
    this.container.add(this.slotCountText)

    // Sort button with styling
    const sortBg = this.scene.add.graphics()
    sortBg.fillStyle(COLORS.PRIMARY, 0.2)
    sortBg.fillRoundedRect(280, 0, 70, 28, 6)
    this.container.add(sortBg)

    const sortBtn = this.scene.add.text(315, 5, 'Sort', {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
      color: '#42a5f5',
    })
    sortBtn.setOrigin(0.5, 0)
    sortBtn.setInteractive({ useHandCursor: true })
    sortBtn.on('pointerdown', () => {
      const state = getGameState(this.scene)
      const sorted = sortInventory(state.inventory)
      setGameState(this.scene, updateInventory(state, sorted))
      this.refresh()
    })
    sortBtn.on('pointerover', () => {
      sortBg.clear()
      sortBg.fillStyle(COLORS.PRIMARY, 0.4)
      sortBg.fillRoundedRect(280, 0, 70, 28, 6)
    })
    sortBtn.on('pointerout', () => {
      sortBg.clear()
      sortBg.fillStyle(COLORS.PRIMARY, 0.2)
      sortBg.fillRoundedRect(280, 0, 70, 28, 6)
    })
    this.container.add(sortBtn)
  }

  private createFilterBar(): void {
    const filters: ReadonlyArray<{ label: string; filter: CategoryFilter }> = [
      { label: 'All', filter: 'all' },
      { label: 'Items', filter: 'consumable' },
      { label: 'Capture', filter: 'capture_device' },
      { label: 'Materials', filter: 'material' },
      { label: 'Key', filter: 'key_item' },
    ]

    filters.forEach((filterDef, index) => {
      const x = index * 70
      const y = 35
      const isActive = filterDef.filter === this.activeFilter

      const container = this.scene.add.container(x, y)

      const bg = this.scene.add.graphics()
      this.drawFilterButton(bg, isActive, filterDef.filter)
      container.add(bg)

      const text = this.scene.add.text(32, 12, filterDef.label, {
        ...TEXT_STYLES.SMALL,
        fontSize: '11px',
        color: isActive ? '#ffffff' : '#b0bec5',
      })
      text.setOrigin(0.5)
      container.add(text)

      const hitArea = this.scene.add.rectangle(32, 12, 64, 24)
      hitArea.setInteractive({ useHandCursor: true })
      hitArea.on('pointerdown', () => {
        this.activeFilter = filterDef.filter
        this.selectedSlot = null
        this.refreshFilterBar()
        this.refreshGrid()
        this.refreshDetail()
      })
      container.add(hitArea)

      this.container.add(container)
      this.filterButtons.push(container)
    })
  }

  private drawFilterButton(graphics: Phaser.GameObjects.Graphics, isActive: boolean, filter: CategoryFilter): void {
    const color = filter === 'all' ? COLORS.PRIMARY : CATEGORY_COLORS[filter as ItemCategory] ?? COLORS.PRIMARY
    graphics.fillStyle(color, isActive ? 0.5 : 0.15)
    graphics.fillRoundedRect(0, 0, 64, 24, 4)
    if (isActive) {
      graphics.lineStyle(1, color, 0.8)
      graphics.strokeRoundedRect(0, 0, 64, 24, 4)
    }
  }

  private refreshFilterBar(): void {
    for (const btn of this.filterButtons) {
      btn.destroy()
    }
    this.filterButtons = []
    this.createFilterBar()
  }

  refresh(): void {
    this.refreshGrid()
    this.refreshDetail()
    this.updateHeader()
  }

  private updateHeader(): void {
    const state = getGameState(this.scene)
    this.goldText.setText(`Gold: ${state.player.gold}`)
    this.slotCountText.setText(`${state.inventory.items.length}/${state.inventory.maxSlots} slots`)
  }

  private refreshGrid(): void {
    this.gridContainer.removeAll(true)

    const state = getGameState(this.scene)
    let items = state.inventory.items

    // Apply filter
    if (this.activeFilter !== 'all') {
      items = items.filter((slot) => slot.item.category === this.activeFilter)
    }

    if (items.length === 0) {
      this.showEmptyState()
      return
    }

    items.forEach((slot, index) => {
      const col = index % GRID_COLS
      const row = Math.floor(index / GRID_COLS)
      const cellX = col * (CELL_WIDTH + CELL_GAP)
      const cellY = row * (CELL_HEIGHT + CELL_GAP)

      const isSelected = this.selectedSlot?.item.itemId === slot.item.itemId

      // Cell container
      const cellContainer = this.scene.add.container(cellX, cellY)
      this.gridContainer.add(cellContainer)

      // Background
      const bg = this.scene.add.graphics()
      const categoryColor = CATEGORY_COLORS[slot.item.category] ?? 0x888888
      bg.fillStyle(isSelected ? COLORS.PRIMARY : COLORS.PANEL_BG, isSelected ? 0.6 : 0.5)
      bg.fillRoundedRect(0, 0, CELL_WIDTH, CELL_HEIGHT, 10)
      bg.lineStyle(2, isSelected ? COLORS.PRIMARY : categoryColor, isSelected ? 1 : 0.5)
      bg.strokeRoundedRect(0, 0, CELL_WIDTH, CELL_HEIGHT, 10)
      cellContainer.add(bg)

      // Category badge
      const badgeColor = CATEGORY_COLORS[slot.item.category] ?? 0x888888
      const badgeBg = this.scene.add.graphics()
      badgeBg.fillStyle(badgeColor, 0.8)
      badgeBg.fillRoundedRect(4, 4, 50, 16, 4)
      cellContainer.add(badgeBg)

      const categoryShort = this.getShortCategoryName(slot.item.category)
      const categoryText = this.scene.add.text(29, 6, categoryShort, {
        ...TEXT_STYLES.SMALL,
        fontSize: '9px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      categoryText.setOrigin(0.5, 0)
      cellContainer.add(categoryText)

      // Item name (2 lines max)
      const itemName = this.wrapText(slot.item.name, 12)
      const name = this.scene.add.text(CELL_WIDTH / 2, 32, itemName, {
        ...TEXT_STYLES.BODY,
        fontSize: '12px',
        align: 'center',
        lineSpacing: 2,
      })
      name.setOrigin(0.5, 0)
      cellContainer.add(name)

      // Quantity badge
      if (slot.quantity > 1) {
        const qtyBg = this.scene.add.graphics()
        qtyBg.fillStyle(0x000000, 0.6)
        qtyBg.fillRoundedRect(CELL_WIDTH - 32, CELL_HEIGHT - 22, 28, 18, 4)
        cellContainer.add(qtyBg)

        const qty = this.scene.add.text(CELL_WIDTH - 18, CELL_HEIGHT - 13, `x${slot.quantity}`, {
          ...TEXT_STYLES.SMALL,
          fontSize: '11px',
          color: '#ffd54f',
          fontStyle: 'bold',
        })
        qty.setOrigin(0.5)
        cellContainer.add(qty)
      }

      // Click handler
      const hitArea = this.scene.add.rectangle(CELL_WIDTH / 2, CELL_HEIGHT / 2, CELL_WIDTH, CELL_HEIGHT)
      hitArea.setInteractive({ useHandCursor: true })
      hitArea.on('pointerdown', () => {
        this.selectedSlot = slot
        this.refresh()
      })
      hitArea.on('pointerover', () => {
        if (!isSelected) {
          bg.clear()
          bg.fillStyle(COLORS.PANEL_BG, 0.7)
          bg.fillRoundedRect(0, 0, CELL_WIDTH, CELL_HEIGHT, 10)
          bg.lineStyle(2, categoryColor, 0.8)
          bg.strokeRoundedRect(0, 0, CELL_WIDTH, CELL_HEIGHT, 10)
        }
      })
      hitArea.on('pointerout', () => {
        if (!isSelected) {
          bg.clear()
          bg.fillStyle(COLORS.PANEL_BG, 0.5)
          bg.fillRoundedRect(0, 0, CELL_WIDTH, CELL_HEIGHT, 10)
          bg.lineStyle(2, categoryColor, 0.5)
          bg.strokeRoundedRect(0, 0, CELL_WIDTH, CELL_HEIGHT, 10)
        }
      })
      cellContainer.add(hitArea)
    })
  }

  private showEmptyState(): void {
    const emptyText = this.scene.add.text(
      PANEL_WIDTH / 2,
      120,
      this.activeFilter === 'all'
        ? 'Your bag is empty!\n\nDefeat monsters and\nexplore to find items.'
        : `No ${CATEGORY_LABELS[this.activeFilter as ItemCategory] ?? 'items'} found.`,
      {
        ...TEXT_STYLES.BODY,
        fontSize: '16px',
        color: '#666666',
        align: 'center',
      },
    )
    emptyText.setOrigin(0.5)
    this.gridContainer.add(emptyText)
  }

  private refreshDetail(): void {
    this.detailContainer.removeAll(true)

    if (!this.selectedSlot) {
      const hint = this.scene.add.text(DETAIL_WIDTH / 2, 100, 'Select an item\nto see details', {
        ...TEXT_STYLES.BODY,
        fontSize: '18px',
        color: '#555555',
        align: 'center',
      })
      hint.setOrigin(0.5)
      this.detailContainer.add(hint)
      return
    }

    const slot = this.selectedSlot

    // Background panel
    const bg = this.scene.add.graphics()
    bg.fillStyle(COLORS.PANEL_BG, 0.6)
    bg.fillRoundedRect(0, 0, DETAIL_WIDTH, 340, 12)
    bg.lineStyle(1, COLORS.PRIMARY, 0.3)
    bg.strokeRoundedRect(0, 0, DETAIL_WIDTH, 340, 12)
    this.detailContainer.add(bg)

    // Category badge
    const categoryColor = CATEGORY_COLORS[slot.item.category] ?? 0x888888
    const badgeBg = this.scene.add.graphics()
    badgeBg.fillStyle(categoryColor, 0.8)
    badgeBg.fillRoundedRect(15, 15, 90, 24, 6)
    this.detailContainer.add(badgeBg)

    const categoryLabel = CATEGORY_LABELS[slot.item.category] ?? 'Item'
    const categoryText = this.scene.add.text(60, 21, categoryLabel, {
      ...TEXT_STYLES.SMALL,
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
    })
    categoryText.setOrigin(0.5)
    this.detailContainer.add(categoryText)

    // Name
    const name = this.scene.add.text(15, 50, slot.item.name, {
      ...TEXT_STYLES.HEADING,
      fontSize: '20px',
    })
    this.detailContainer.add(name)

    // Description
    const desc = this.scene.add.text(15, 80, slot.item.description, {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
      wordWrap: { width: DETAIL_WIDTH - 30 },
      color: '#cccccc',
      lineSpacing: 4,
    })
    this.detailContainer.add(desc)

    let yOffset = 80 + desc.height + 20

    // Use effect preview
    if (slot.item.useEffect) {
      const effectBg = this.scene.add.graphics()
      effectBg.fillStyle(COLORS.SUCCESS, 0.15)
      effectBg.fillRoundedRect(15, yOffset, DETAIL_WIDTH - 30, 30, 6)
      this.detailContainer.add(effectBg)

      const effectText = this.getEffectPreview(slot.item.useEffect)
      const effect = this.scene.add.text(25, yOffset + 7, `Effect: ${effectText}`, {
        ...TEXT_STYLES.BODY,
        fontSize: '13px',
        color: '#66bb6a',
      })
      this.detailContainer.add(effect)
      yOffset += 45
    }

    // Quantity
    const qty = this.scene.add.text(15, yOffset, `Quantity: ${slot.quantity}`, {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
    })
    this.detailContainer.add(qty)
    yOffset += 25

    // Sell price
    if (slot.item.sellPrice > 0) {
      const price = this.scene.add.text(15, yOffset, `Sell Value: ${slot.item.sellPrice} gold`, {
        ...TEXT_STYLES.BODY,
        fontSize: '14px',
        color: '#ffd54f',
      })
      this.detailContainer.add(price)
      yOffset += 25
    }

    yOffset += 20

    // Action buttons
    if (slot.item.useEffect && slot.item.category === 'consumable') {
      const useBtn = this.createActionButton(15, yOffset, 'Use Item', COLORS.SUCCESS, () => {
        this.handleUseItem(slot)
      })
      this.detailContainer.add(useBtn)
    }

    if (slot.item.sellPrice > 0) {
      const dropBtn = this.createActionButton(130, yOffset, 'Drop', COLORS.DANGER, () => {
        this.handleDropItem(slot)
      })
      this.detailContainer.add(dropBtn)
    }
  }

  private createActionButton(
    x: number,
    y: number,
    label: string,
    color: number,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y)

    const bg = this.scene.add.graphics()
    bg.fillStyle(color, 0.4)
    bg.fillRoundedRect(0, 0, 100, 36, 8)
    bg.lineStyle(1, color, 0.8)
    bg.strokeRoundedRect(0, 0, 100, 36, 8)
    container.add(bg)

    const text = this.scene.add.text(50, 18, label, {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
    })
    text.setOrigin(0.5)
    container.add(text)

    const hitArea = this.scene.add.rectangle(50, 18, 100, 36)
    hitArea.setInteractive({ useHandCursor: true })
    hitArea.on('pointerdown', onClick)
    hitArea.on('pointerover', () => {
      bg.clear()
      bg.fillStyle(color, 0.7)
      bg.fillRoundedRect(0, 0, 100, 36, 8)
      bg.lineStyle(1, color, 1)
      bg.strokeRoundedRect(0, 0, 100, 36, 8)
    })
    hitArea.on('pointerout', () => {
      bg.clear()
      bg.fillStyle(color, 0.4)
      bg.fillRoundedRect(0, 0, 100, 36, 8)
      bg.lineStyle(1, color, 0.8)
      bg.strokeRoundedRect(0, 0, 100, 36, 8)
    })
    container.add(hitArea)

    return container
  }

  private handleUseItem(slot: InventorySlot): void {
    const state = getGameState(this.scene)

    // Use on player in overworld
    const { player: updatedPlayer, result } = useItemOnPlayer(slot.item, state.player)
    if (!result.success) return

    const newInventory = useItem(state.inventory, slot.item.itemId)
    if (!newInventory) return

    setGameState(this.scene, { ...state, player: updatedPlayer, inventory: newInventory })

    // Check if this slot is now empty
    const stillExists = newInventory.items.find((s) => s.item.itemId === slot.item.itemId)
    if (!stillExists) {
      this.selectedSlot = null
    } else {
      this.selectedSlot = stillExists
    }

    this.refresh()
  }

  private handleDropItem(slot: InventorySlot): void {
    const state = getGameState(this.scene)
    const newInventory = removeItem(state.inventory, slot.item.itemId, 1)
    if (!newInventory) return

    setGameState(this.scene, updateInventory(state, newInventory))
    this.selectedSlot = null
    this.refresh()
  }

  private getShortCategoryName(category: ItemCategory): string {
    const shorts: Record<ItemCategory, string> = {
      consumable: 'Item',
      capture_device: 'Capture',
      material: 'Material',
      breeding_item: 'Breed',
      key_item: 'Key',
    }
    return shorts[category] ?? 'Item'
  }

  private wrapText(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text
    const words = text.split(' ')
    let line1 = ''
    let line2 = ''
    for (const word of words) {
      if ((line1 + word).length <= maxChars) {
        line1 += (line1 ? ' ' : '') + word
      } else {
        line2 += (line2 ? ' ' : '') + word
      }
    }
    if (line2.length > maxChars) {
      line2 = line2.substring(0, maxChars - 2) + '..'
    }
    return line1 + (line2 ? '\n' + line2 : '')
  }

  private getEffectPreview(effect: { type: string; amount?: number }): string {
    switch (effect.type) {
      case 'heal_hp':
        return `+${effect.amount ?? 0} HP`
      case 'heal_mp':
        return `+${effect.amount ?? 0} MP`
      case 'heal_full':
        return 'Full restore'
      case 'cure_status':
        return 'Cures status'
      default:
        return 'Special effect'
    }
  }

  destroy(): void {
    this.container.destroy()
  }
}
