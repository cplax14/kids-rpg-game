import Phaser from 'phaser'
import type { Inventory, InventorySlot } from '../../models/types'
import { COLORS, TEXT_STYLES, DEPTH } from '../../config'
import { getGameState, setGameState, updateInventory, updatePlayer } from '../../systems/GameStateManager'
import { useItem, sortInventory, removeItem } from '../../systems/InventorySystem'
import { useItemOnPlayer } from '../../systems/ItemEffectSystem'

const GRID_COLS = 6
const CELL_SIZE = 80
const PANEL_WIDTH = 540
const DETAIL_WIDTH = 350

export class InventoryPanel {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private detailContainer: Phaser.GameObjects.Container
  private goldText!: Phaser.GameObjects.Text
  private slotCountText!: Phaser.GameObjects.Text
  private selectedSlot: InventorySlot | null = null

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene
    this.container = scene.add.container(x, y)
    this.container.setDepth(DEPTH.OVERLAY + 2)

    this.detailContainer = scene.add.container(x + PANEL_WIDTH + 20, y)
    this.detailContainer.setDepth(DEPTH.OVERLAY + 2)

    this.createHeader()
    this.refreshGrid()
    this.refreshDetail()
  }

  private createHeader(): void {
    const state = getGameState(this.scene)

    this.goldText = this.scene.add.text(0, 0, `Gold: ${state.player.gold}`, {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      color: '#ffd54f',
    })
    this.container.add(this.goldText)

    this.slotCountText = this.scene.add.text(200, 0, `${state.inventory.items.length}/${state.inventory.maxSlots} slots`, {
      ...TEXT_STYLES.SMALL,
      fontSize: '14px',
      color: '#b0bec5',
    })
    this.container.add(this.slotCountText)

    // Sort button
    const sortBtn = this.scene.add.text(420, 0, 'Sort', {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
      color: '#42a5f5',
    })
    sortBtn.setInteractive({ useHandCursor: true })
    sortBtn.on('pointerdown', () => {
      const state = getGameState(this.scene)
      const sorted = sortInventory(state.inventory)
      setGameState(this.scene, updateInventory(state, sorted))
      this.refresh()
    })
    this.container.add(sortBtn)
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
    // Remove old grid elements (keep header at indices 0-2)
    const children = this.container.getAll()
    for (let i = children.length - 1; i >= 3; i--) {
      (children[i] as Phaser.GameObjects.GameObject).destroy()
    }

    const state = getGameState(this.scene)
    const items = state.inventory.items

    items.forEach((slot, index) => {
      const col = index % GRID_COLS
      const row = Math.floor(index / GRID_COLS)
      const cellX = col * (CELL_SIZE + 8)
      const cellY = 30 + row * (CELL_SIZE + 8)

      const isSelected = this.selectedSlot?.item.itemId === slot.item.itemId

      const bg = this.scene.add.graphics()
      bg.fillStyle(isSelected ? COLORS.PRIMARY : COLORS.PANEL_BG, isSelected ? 0.6 : 0.5)
      bg.fillRoundedRect(cellX, cellY, CELL_SIZE, CELL_SIZE, 8)
      bg.lineStyle(1, isSelected ? COLORS.PRIMARY : 0x555555)
      bg.strokeRoundedRect(cellX, cellY, CELL_SIZE, CELL_SIZE, 8)
      this.container.add(bg)

      // Item name (truncated)
      const shortName = slot.item.name.length > 8 ? slot.item.name.substring(0, 7) + '...' : slot.item.name
      const name = this.scene.add.text(cellX + CELL_SIZE / 2, cellY + 30, shortName, {
        ...TEXT_STYLES.SMALL,
        fontSize: '11px',
      })
      name.setOrigin(0.5)
      this.container.add(name)

      // Quantity
      if (slot.quantity > 1) {
        const qty = this.scene.add.text(cellX + CELL_SIZE - 8, cellY + CELL_SIZE - 8, `x${slot.quantity}`, {
          ...TEXT_STYLES.SMALL,
          fontSize: '11px',
          color: '#ffd54f',
        })
        qty.setOrigin(1, 1)
        this.container.add(qty)
      }

      // Category color dot
      const catColor = this.getCategoryColor(slot.item.category)
      const dot = this.scene.add.graphics()
      dot.fillStyle(catColor, 1)
      dot.fillCircle(cellX + 10, cellY + 10, 4)
      this.container.add(dot)

      // Click handler
      const hitArea = this.scene.add.rectangle(cellX + CELL_SIZE / 2, cellY + CELL_SIZE / 2, CELL_SIZE, CELL_SIZE)
      hitArea.setInteractive({ useHandCursor: true })
      hitArea.on('pointerdown', () => {
        this.selectedSlot = slot
        this.refresh()
      })
      this.container.add(hitArea)
    })
  }

  private refreshDetail(): void {
    this.detailContainer.removeAll(true)

    if (!this.selectedSlot) {
      const hint = this.scene.add.text(0, 30, 'Select an item to\nsee details', {
        ...TEXT_STYLES.BODY,
        fontSize: '16px',
        color: '#666666',
      })
      this.detailContainer.add(hint)
      return
    }

    const slot = this.selectedSlot

    // Background
    const bg = this.scene.add.graphics()
    bg.fillStyle(COLORS.PANEL_BG, 0.6)
    bg.fillRoundedRect(0, 0, DETAIL_WIDTH, 280, 10)
    this.detailContainer.add(bg)

    // Name
    const name = this.scene.add.text(15, 15, slot.item.name, {
      ...TEXT_STYLES.BODY,
      fontSize: '18px',
    })
    this.detailContainer.add(name)

    // Category
    const cat = this.scene.add.text(15, 40, slot.item.category.replace('_', ' '), {
      ...TEXT_STYLES.SMALL,
      fontSize: '12px',
      color: '#b0bec5',
    })
    this.detailContainer.add(cat)

    // Description
    const desc = this.scene.add.text(15, 65, slot.item.description, {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
      wordWrap: { width: DETAIL_WIDTH - 30 },
      color: '#cccccc',
    })
    this.detailContainer.add(desc)

    // Quantity
    const qty = this.scene.add.text(15, 150, `Quantity: ${slot.quantity}`, {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
    })
    this.detailContainer.add(qty)

    // Action buttons
    if (slot.item.useEffect && slot.item.category === 'consumable') {
      const useBtn = this.createActionButton(15, 200, 'Use', COLORS.SUCCESS, () => {
        this.handleUseItem(slot)
      })
      this.detailContainer.add(useBtn)
    }

    if (slot.item.sellPrice > 0) {
      const dropBtn = this.createActionButton(120, 200, 'Drop', COLORS.DANGER, () => {
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
    bg.fillStyle(color, 0.5)
    bg.fillRoundedRect(0, 0, 90, 34, 8)
    container.add(bg)

    const text = this.scene.add.text(45, 17, label, {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
    })
    text.setOrigin(0.5)
    container.add(text)

    const hitArea = this.scene.add.rectangle(45, 17, 90, 34)
    hitArea.setInteractive({ useHandCursor: true })
    hitArea.on('pointerdown', onClick)
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

  private getCategoryColor(category: string): number {
    const colors: Record<string, number> = {
      consumable: 0x66bb6a,
      capture_device: 0x42a5f5,
      material: 0x8d6e63,
      breeding_item: 0x7e57c2,
      key_item: 0xffd54f,
    }
    return colors[category] ?? 0xbdbdbd
  }

  destroy(): void {
    this.container.destroy()
    this.detailContainer.destroy()
  }
}
