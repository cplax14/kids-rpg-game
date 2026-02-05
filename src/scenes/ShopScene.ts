import Phaser from 'phaser'
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, COLORS, DEPTH, TEXT_STYLES } from '../config'
import {
  getShopInventory,
  calculateBuyPrice,
  calculateItemSellPrice,
  canAfford,
  getShopItemDetails,
  type ShopInventory,
  type ShopItem,
} from '../systems/ShopSystem'
import { getGameState, setGameState, updatePlayer, updateInventory } from '../systems/GameStateManager'
import { updatePlayerGold } from '../systems/CharacterSystem'
import { addItem, removeItem, getItem } from '../systems/InventorySystem'
import { getEquipment } from '../systems/EquipmentSystem'
import type { Inventory, Equipment } from '../models/types'

interface ShopSceneData {
  readonly shopId: string
  readonly mode?: string
}

export class ShopScene extends Phaser.Scene {
  private shop!: ShopInventory
  private mode: 'buy' | 'sell' = 'buy'
  private selectedIndex: number = 0
  private goldText!: Phaser.GameObjects.Text
  private itemListContainer!: Phaser.GameObjects.Container
  private detailContainer!: Phaser.GameObjects.Container
  private messageText!: Phaser.GameObjects.Text

  constructor() {
    super({ key: SCENE_KEYS.SHOP })
  }

  create(data: ShopSceneData): void {
    const shop = getShopInventory(data.shopId ?? 'village-shop')
    if (!shop) {
      this.closeShop()
      return
    }

    this.shop = shop
    this.mode = (data.mode === 'sell' ? 'sell' : 'buy') as 'buy' | 'sell'
    this.selectedIndex = 0

    this.createBackground()
    this.createHeader()
    this.createItemList()
    this.createDetailPanel()
    this.createMessageBar()
    this.refreshItemList()

    this.input.keyboard?.on('keydown-ESC', () => this.closeShop())
  }

  private createBackground(): void {
    const bg = this.add.graphics()
    bg.fillStyle(0x000000, 0.7)
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    bg.setDepth(DEPTH.OVERLAY)

    const panel = this.add.graphics()
    panel.fillStyle(COLORS.DARK_BG, 0.95)
    panel.fillRoundedRect(80, 40, GAME_WIDTH - 160, GAME_HEIGHT - 80, 16)
    panel.lineStyle(2, COLORS.GOLD)
    panel.strokeRoundedRect(80, 40, GAME_WIDTH - 160, GAME_HEIGHT - 80, 16)
    panel.setDepth(DEPTH.OVERLAY)
  }

  private createHeader(): void {
    const container = this.add.container(100, 55)
    container.setDepth(DEPTH.OVERLAY + 1)

    const title = this.add.text(0, 0, this.mode === 'buy' ? 'Buy Items' : 'Sell Items', {
      ...TEXT_STYLES.HEADING,
      fontSize: '24px',
    })
    container.add(title)

    // Mode toggle buttons
    const buyBtn = this.createTabButton(300, 0, 'Buy', this.mode === 'buy', () => {
      this.mode = 'buy'
      this.selectedIndex = 0
      this.refreshAll()
    })
    container.add(buyBtn)

    const sellBtn = this.createTabButton(400, 0, 'Sell', this.mode === 'sell', () => {
      this.mode = 'sell'
      this.selectedIndex = 0
      this.refreshAll()
    })
    container.add(sellBtn)

    // Gold display
    const state = getGameState(this)
    this.goldText = this.add.text(900, 0, `Gold: ${state.player.gold}`, {
      ...TEXT_STYLES.BODY,
      fontSize: '18px',
      color: '#ffd54f',
    })
    container.add(this.goldText)

    // Close button
    const closeBtn = this.add.text(1000, 0, 'X Close', {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      color: '#ef5350',
    })
    closeBtn.setInteractive({ useHandCursor: true })
    closeBtn.on('pointerdown', () => this.closeShop())
    container.add(closeBtn)
  }

  private createTabButton(
    x: number,
    y: number,
    label: string,
    active: boolean,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y)

    const bg = this.add.graphics()
    bg.fillStyle(active ? COLORS.PRIMARY : COLORS.PANEL_BG, active ? 0.8 : 0.5)
    bg.fillRoundedRect(0, 0, 80, 30, 6)
    container.add(bg)

    const text = this.add.text(40, 15, label, {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
    })
    text.setOrigin(0.5)
    container.add(text)

    const hitArea = this.add.rectangle(40, 15, 80, 30)
    hitArea.setInteractive({ useHandCursor: true })
    hitArea.on('pointerdown', onClick)
    container.add(hitArea)

    return container
  }

  private createItemList(): void {
    this.itemListContainer = this.add.container(100, 100)
    this.itemListContainer.setDepth(DEPTH.OVERLAY + 1)
  }

  private createDetailPanel(): void {
    this.detailContainer = this.add.container(700, 100)
    this.detailContainer.setDepth(DEPTH.OVERLAY + 1)
  }

  private createMessageBar(): void {
    this.messageText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 60, '', {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      color: '#66bb6a',
    })
    this.messageText.setOrigin(0.5)
    this.messageText.setDepth(DEPTH.OVERLAY + 2)
  }

  private refreshAll(): void {
    // Recreate header for mode toggle
    this.scene.restart({
      shopId: this.shop.shopId,
      mode: this.mode,
    })
  }

  private refreshItemList(): void {
    this.itemListContainer.removeAll(true)

    const items = this.mode === 'buy' ? this.getShopBuyList() : this.getShopSellList()

    if (items.length === 0) {
      const emptyText = this.add.text(0, 0, this.mode === 'buy' ? 'Nothing to buy' : 'Nothing to sell', {
        ...TEXT_STYLES.BODY,
        fontSize: '16px',
        color: '#b0bec5',
      })
      this.itemListContainer.add(emptyText)
      return
    }

    items.forEach((entry, index) => {
      const y = index * 42
      const isSelected = index === this.selectedIndex

      const bg = this.add.graphics()
      bg.fillStyle(isSelected ? COLORS.PRIMARY : COLORS.PANEL_BG, isSelected ? 0.4 : 0.3)
      bg.fillRoundedRect(0, y, 560, 38, 6)
      this.itemListContainer.add(bg)

      const nameText = this.add.text(12, y + 9, entry.name, {
        ...TEXT_STYLES.BODY,
        fontSize: '14px',
      })
      this.itemListContainer.add(nameText)

      const priceText = this.add.text(400, y + 9, `${entry.price} G`, {
        ...TEXT_STYLES.BODY,
        fontSize: '14px',
        color: '#ffd54f',
      })
      this.itemListContainer.add(priceText)

      // Buy/Sell button
      const actionLabel = this.mode === 'buy' ? 'Buy' : 'Sell'
      const actionBtn = this.add.text(500, y + 9, actionLabel, {
        ...TEXT_STYLES.BODY,
        fontSize: '14px',
        color: '#66bb6a',
      })
      actionBtn.setInteractive({ useHandCursor: true })
      actionBtn.on('pointerdown', () => {
        if (this.mode === 'buy') {
          this.handleBuy(entry.id, entry.type, entry.price)
        } else {
          this.handleSell(entry.id, entry.price)
        }
      })
      this.itemListContainer.add(actionBtn)

      // Row hover
      const hitArea = this.add.rectangle(280, y + 19, 560, 38)
      hitArea.setInteractive()
      hitArea.on('pointerover', () => {
        this.selectedIndex = index
        bg.clear()
        bg.fillStyle(COLORS.PRIMARY, 0.4)
        bg.fillRoundedRect(0, y, 560, 38, 6)
        this.showDetail(entry)
      })
      hitArea.on('pointerout', () => {
        bg.clear()
        bg.fillStyle(COLORS.PANEL_BG, 0.3)
        bg.fillRoundedRect(0, y, 560, 38, 6)
      })
      this.itemListContainer.add(hitArea)
    })
  }

  private getShopBuyList(): ReadonlyArray<{
    readonly id: string
    readonly name: string
    readonly description: string
    readonly price: number
    readonly type: 'item' | 'equipment'
    readonly equipment: Equipment | null
  }> {
    return this.shop.items
      .map((shopItem) => {
        const details = getShopItemDetails(shopItem)
        if (!details) return null
        const equipment = shopItem.type === 'equipment' ? getEquipment(shopItem.id) : null
        return {
          id: shopItem.id,
          name: details.name,
          description: details.description,
          price: calculateBuyPrice(shopItem, this.shop),
          type: shopItem.type,
          equipment: equipment ?? null,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
  }

  private getShopSellList(): ReadonlyArray<{
    readonly id: string
    readonly name: string
    readonly description: string
    readonly price: number
    readonly type: 'item' | 'equipment'
    readonly equipment: Equipment | null
  }> {
    const state = getGameState(this)
    return state.inventory.items
      .filter((slot) => slot.item.sellPrice > 0)
      .map((slot) => ({
        id: slot.item.itemId,
        name: `${slot.item.name} x${slot.quantity}`,
        description: slot.item.description,
        price: calculateItemSellPrice(slot.item, this.shop),
        type: 'item' as const,
        equipment: null,
      }))
  }

  private showDetail(entry: {
    readonly name: string
    readonly description: string
    readonly price: number
    readonly equipment: Equipment | null
  }): void {
    this.detailContainer.removeAll(true)

    // Calculate panel height based on content
    const hasStats = entry.equipment && Object.keys(entry.equipment.statModifiers).length > 0
    const panelHeight = hasStats ? 320 : 200

    const bg = this.add.graphics()
    bg.fillStyle(COLORS.PANEL_BG, 0.6)
    bg.fillRoundedRect(0, 0, 380, panelHeight, 10)
    this.detailContainer.add(bg)

    const name = this.add.text(15, 15, entry.name, {
      ...TEXT_STYLES.BODY,
      fontSize: '18px',
      color: '#ffffff',
    })
    this.detailContainer.add(name)

    const desc = this.add.text(15, 45, entry.description, {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
      wordWrap: { width: 350 },
      color: '#cccccc',
    })
    this.detailContainer.add(desc)

    let nextY = 100

    // Show equipment stats if available
    if (entry.equipment) {
      const stats = entry.equipment.statModifiers

      // Slot type badge
      const slotLabel = this.add.text(15, nextY, `Slot: ${entry.equipment.slot.charAt(0).toUpperCase() + entry.equipment.slot.slice(1)}`, {
        ...TEXT_STYLES.BODY,
        fontSize: '13px',
        color: '#90caf9',
      })
      this.detailContainer.add(slotLabel)
      nextY += 22

      // Level requirement
      if (entry.equipment.levelRequirement > 1) {
        const levelReq = this.add.text(15, nextY, `Required Level: ${entry.equipment.levelRequirement}`, {
          ...TEXT_STYLES.BODY,
          fontSize: '13px',
          color: '#ffab91',
        })
        this.detailContainer.add(levelReq)
        nextY += 22
      }

      // Stats header
      if (Object.keys(stats).length > 0) {
        nextY += 8
        const statsHeader = this.add.text(15, nextY, 'Stats:', {
          ...TEXT_STYLES.BODY,
          fontSize: '14px',
          color: '#ffffff',
        })
        this.detailContainer.add(statsHeader)
        nextY += 22

        // Display each stat modifier
        const statLabels: Record<string, string> = {
          maxHp: 'HP',
          maxMp: 'MP',
          attack: 'Attack',
          defense: 'Defense',
          magicAttack: 'Magic Atk',
          magicDefense: 'Magic Def',
          speed: 'Speed',
          luck: 'Luck',
        }

        Object.entries(stats).forEach(([stat, value]) => {
          if (value === undefined || value === 0) return
          const label = statLabels[stat] ?? stat
          const sign = value > 0 ? '+' : ''
          const color = value > 0 ? '#66bb6a' : '#ef5350'

          const statText = this.add.text(25, nextY, `${label}: ${sign}${value}`, {
            ...TEXT_STYLES.BODY,
            fontSize: '13px',
            color,
          })
          this.detailContainer.add(statText)
          nextY += 20
        })
      }

      // Special effect
      if (entry.equipment.specialEffect) {
        nextY += 8
        const effectText = this.add.text(15, nextY, `Special: ${entry.equipment.specialEffect}`, {
          ...TEXT_STYLES.BODY,
          fontSize: '13px',
          color: '#ce93d8',
          wordWrap: { width: 350 },
        })
        this.detailContainer.add(effectText)
        nextY += 24
      }

      nextY += 10
    }

    const price = this.add.text(15, Math.max(nextY, 140), `Price: ${entry.price} G`, {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      color: '#ffd54f',
    })
    this.detailContainer.add(price)
  }

  private handleBuy(itemId: string, type: 'item' | 'equipment', price: number): void {
    const state = getGameState(this)

    if (!canAfford(state.player, price)) {
      this.showMessage("Not enough gold!", '#ef5350')
      return
    }

    if (type === 'item') {
      const newInventory = addItem(state.inventory, itemId, 1)
      if (!newInventory) {
        this.showMessage("Inventory is full!", '#ef5350')
        return
      }

      const updatedPlayer = updatePlayerGold(state.player, -price)
      setGameState(this, { ...state, player: updatedPlayer, inventory: newInventory })
    } else {
      const equipment = getEquipment(itemId)
      if (!equipment) return

      const updatedPlayer = updatePlayerGold(state.player, -price)
      const updatedInventory: Inventory = {
        ...state.inventory,
        equipment: [...state.inventory.equipment, equipment],
      }
      setGameState(this, { ...state, player: updatedPlayer, inventory: updatedInventory })
    }

    this.goldText.setText(`Gold: ${getGameState(this).player.gold}`)
    this.showMessage("Purchased!", '#66bb6a')
    this.refreshItemList()
  }

  private handleSell(itemId: string, price: number): void {
    const state = getGameState(this)

    const newInventory = removeItem(state.inventory, itemId, 1)
    if (!newInventory) {
      this.showMessage("Cannot sell this item!", '#ef5350')
      return
    }

    const updatedPlayer = updatePlayerGold(state.player, price)
    setGameState(this, { ...state, player: updatedPlayer, inventory: newInventory })

    this.goldText.setText(`Gold: ${getGameState(this).player.gold}`)
    this.showMessage("Sold!", '#66bb6a')
    this.refreshItemList()
  }

  private showMessage(text: string, color: string): void {
    this.messageText.setText(text)
    this.messageText.setColor(color)
    this.time.delayedCall(1500, () => {
      this.messageText.setText('')
    })
  }

  private closeShop(): void {
    const worldScene = this.scene.get(SCENE_KEYS.WORLD)
    if (worldScene) {
      this.scene.resume(SCENE_KEYS.WORLD)
    }
    this.scene.stop()
  }
}
