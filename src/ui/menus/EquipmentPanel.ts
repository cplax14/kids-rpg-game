import Phaser from 'phaser'
import type { Equipment, EquipmentSlot, CharacterStats } from '../../models/types'
import { COLORS, TEXT_STYLES, DEPTH } from '../../config'
import { getGameState, setGameState, updatePlayer, updateInventory } from '../../systems/GameStateManager'
import {
  equipItem,
  unequipItem,
  compareEquipment,
  type EquipResult,
} from '../../systems/EquipmentSystem'

const SLOT_LABELS: Readonly<Record<EquipmentSlot, string>> = {
  weapon: 'Weapon',
  armor: 'Armor',
  helmet: 'Helmet',
  accessory: 'Accessory',
}

const SLOT_ORDER: ReadonlyArray<EquipmentSlot> = ['weapon', 'armor', 'helmet', 'accessory']

export class EquipmentPanel {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private listContainer: Phaser.GameObjects.Container
  private comparisonContainer: Phaser.GameObjects.Container
  private selectedSlot: EquipmentSlot = 'weapon'

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene
    this.container = scene.add.container(x, y)
    this.container.setDepth(DEPTH.OVERLAY + 2)

    this.listContainer = scene.add.container(x + 230, y)
    this.listContainer.setDepth(DEPTH.OVERLAY + 2)

    this.comparisonContainer = scene.add.container(x + 230, y + 340)
    this.comparisonContainer.setDepth(DEPTH.OVERLAY + 2)

    this.refreshSlots()
    this.refreshAvailableList()
  }

  refresh(): void {
    this.refreshSlots()
    this.refreshAvailableList()
  }

  private refreshSlots(): void {
    this.container.removeAll(true)

    const state = getGameState(this.scene)
    const equipment = state.player.equipment

    const title = this.scene.add.text(0, 0, 'Equipment', {
      ...TEXT_STYLES.BODY,
      fontSize: '18px',
    })
    this.container.add(title)

    SLOT_ORDER.forEach((slot, index) => {
      const y = 35 + index * 75
      const equipped = equipment[slot]
      const isSelected = slot === this.selectedSlot

      // Slot background
      const bg = this.scene.add.graphics()
      bg.fillStyle(isSelected ? COLORS.PRIMARY : COLORS.PANEL_BG, isSelected ? 0.5 : 0.3)
      bg.fillRoundedRect(0, y, 210, 65, 8)
      bg.lineStyle(1, isSelected ? COLORS.PRIMARY : 0x555555)
      bg.strokeRoundedRect(0, y, 210, 65, 8)
      this.container.add(bg)

      // Slot label
      const label = this.scene.add.text(10, y + 5, SLOT_LABELS[slot], {
        ...TEXT_STYLES.SMALL,
        fontSize: '11px',
        color: '#b0bec5',
      })
      this.container.add(label)

      // Equipped item name
      const itemName = this.scene.add.text(10, y + 22, equipped ? equipped.name : '(empty)', {
        ...TEXT_STYLES.BODY,
        fontSize: '14px',
        color: equipped ? '#ffffff' : '#666666',
      })
      this.container.add(itemName)

      // Unequip button
      if (equipped) {
        const unequipBtn = this.scene.add.text(10, y + 44, 'Unequip', {
          ...TEXT_STYLES.SMALL,
          fontSize: '11px',
          color: '#ef5350',
        })
        unequipBtn.setInteractive({ useHandCursor: true })
        unequipBtn.on('pointerdown', () => this.handleUnequip(slot))
        this.container.add(unequipBtn)
      }

      // Click to select slot
      const hitArea = this.scene.add.rectangle(105, y + 32, 210, 65)
      hitArea.setInteractive({ useHandCursor: true })
      hitArea.on('pointerdown', () => {
        this.selectedSlot = slot
        this.refresh()
      })
      this.container.add(hitArea)
    })

    // Player stats summary
    const statsY = 35 + SLOT_ORDER.length * 75 + 10
    const statsTitle = this.scene.add.text(0, statsY, 'Base Stats', {
      ...TEXT_STYLES.SMALL,
      fontSize: '12px',
      color: '#b0bec5',
    })
    this.container.add(statsTitle)

    const statLines = [
      `ATK: ${state.player.stats.attack}  DEF: ${state.player.stats.defense}`,
      `MATK: ${state.player.stats.magicAttack}  MDEF: ${state.player.stats.magicDefense}`,
      `SPD: ${state.player.stats.speed}  LCK: ${state.player.stats.luck}`,
    ]

    statLines.forEach((line, i) => {
      const text = this.scene.add.text(0, statsY + 18 + i * 18, line, {
        ...TEXT_STYLES.SMALL,
        fontSize: '12px',
      })
      this.container.add(text)
    })
  }

  private refreshAvailableList(): void {
    this.listContainer.removeAll(true)
    this.comparisonContainer.removeAll(true)

    const state = getGameState(this.scene)
    const available = state.inventory.equipment.filter((e) => e.slot === this.selectedSlot)

    const title = this.scene.add.text(0, 0, `Available ${SLOT_LABELS[this.selectedSlot]}s`, {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
    })
    this.listContainer.add(title)

    if (available.length === 0) {
      const empty = this.scene.add.text(0, 30, 'No equipment available\nfor this slot.', {
        ...TEXT_STYLES.BODY,
        fontSize: '14px',
        color: '#666666',
      })
      this.listContainer.add(empty)
      return
    }

    available.forEach((equip, index) => {
      const y = 30 + index * 48

      const meetsLevel = state.player.level >= equip.levelRequirement
      const alpha = meetsLevel ? 1.0 : 0.4

      const bg = this.scene.add.graphics()
      bg.fillStyle(COLORS.PANEL_BG, 0.4)
      bg.fillRoundedRect(0, y, 660, 42, 6)
      this.listContainer.add(bg)

      const name = this.scene.add.text(10, y + 6, equip.name, {
        ...TEXT_STYLES.BODY,
        fontSize: '14px',
      })
      name.setAlpha(alpha)
      this.listContainer.add(name)

      // Level requirement
      const lvlColor = meetsLevel ? '#66bb6a' : '#ef5350'
      const lvl = this.scene.add.text(300, y + 6, `Lv.${equip.levelRequirement}`, {
        ...TEXT_STYLES.SMALL,
        fontSize: '12px',
        color: lvlColor,
      })
      this.listContainer.add(lvl)

      // Stat summary
      const statSummary = this.formatStatModifiers(equip.statModifiers)
      const stats = this.scene.add.text(360, y + 6, statSummary, {
        ...TEXT_STYLES.SMALL,
        fontSize: '11px',
        color: '#42a5f5',
      })
      this.listContainer.add(stats)

      // Equip button
      if (meetsLevel) {
        const equipBtn = this.scene.add.text(600, y + 6, 'Equip', {
          ...TEXT_STYLES.BODY,
          fontSize: '14px',
          color: '#66bb6a',
        })
        equipBtn.setInteractive({ useHandCursor: true })
        equipBtn.on('pointerdown', () => this.handleEquip(equip))
        this.listContainer.add(equipBtn)
      }

      // Hover to show comparison
      const hitArea = this.scene.add.rectangle(330, y + 21, 660, 42)
      hitArea.setInteractive()
      hitArea.on('pointerover', () => {
        bg.clear()
        bg.fillStyle(COLORS.PRIMARY, 0.3)
        bg.fillRoundedRect(0, y, 660, 42, 6)
        this.showComparison(equip)
      })
      hitArea.on('pointerout', () => {
        bg.clear()
        bg.fillStyle(COLORS.PANEL_BG, 0.4)
        bg.fillRoundedRect(0, y, 660, 42, 6)
      })
      this.listContainer.add(hitArea)
    })
  }

  private showComparison(candidate: Equipment): void {
    this.comparisonContainer.removeAll(true)

    const state = getGameState(this.scene)
    const current = state.player.equipment[candidate.slot]
    const diff = compareEquipment(current, candidate)

    const bg = this.scene.add.graphics()
    bg.fillStyle(COLORS.PANEL_BG, 0.5)
    bg.fillRoundedRect(0, 0, 660, 100, 8)
    this.comparisonContainer.add(bg)

    const title = this.scene.add.text(10, 8, 'Stat Change:', {
      ...TEXT_STYLES.SMALL,
      fontSize: '12px',
      color: '#b0bec5',
    })
    this.comparisonContainer.add(title)

    const entries = Object.entries(diff) as [keyof CharacterStats, number][]
    entries.forEach(([stat, change], index) => {
      const x = 10 + (index % 4) * 160
      const y = 30 + Math.floor(index / 4) * 22
      const color = change > 0 ? '#66bb6a' : '#ef5350'
      const prefix = change > 0 ? '+' : ''
      const text = this.scene.add.text(x, y, `${stat}: ${prefix}${change}`, {
        ...TEXT_STYLES.SMALL,
        fontSize: '12px',
        color,
      })
      this.comparisonContainer.add(text)
    })

    if (entries.length === 0) {
      const noChange = this.scene.add.text(10, 30, 'No stat change', {
        ...TEXT_STYLES.SMALL,
        fontSize: '12px',
        color: '#666666',
      })
      this.comparisonContainer.add(noChange)
    }
  }

  private handleEquip(equipment: Equipment): void {
    const state = getGameState(this.scene)
    const result = equipItem(state.player, equipment)
    if (!result) return

    // Remove equipment from inventory
    const equipIndex = state.inventory.equipment.findIndex(
      (e) => e.equipmentId === equipment.equipmentId,
    )
    const updatedEquipList = state.inventory.equipment.filter((_, i) => i !== equipIndex)

    // If there was something equipped, put it back in inventory
    const equipInventory = result.unequipped
      ? [...updatedEquipList, result.unequipped]
      : updatedEquipList

    const updatedInventory = { ...state.inventory, equipment: equipInventory }
    setGameState(this.scene, { ...state, player: result.player, inventory: updatedInventory })
    this.refresh()
  }

  private handleUnequip(slot: EquipmentSlot): void {
    const state = getGameState(this.scene)
    const result = unequipItem(state.player, slot)

    const equipInventory = result.unequipped
      ? [...state.inventory.equipment, result.unequipped]
      : [...state.inventory.equipment]

    const updatedInventory = { ...state.inventory, equipment: equipInventory }
    setGameState(this.scene, { ...state, player: result.player, inventory: updatedInventory })
    this.refresh()
  }

  private formatStatModifiers(mods: Partial<CharacterStats>): string {
    const parts: string[] = []
    if (mods.attack) parts.push(`ATK+${mods.attack}`)
    if (mods.defense) parts.push(`DEF+${mods.defense}`)
    if (mods.magicAttack) parts.push(`MATK+${mods.magicAttack}`)
    if (mods.magicDefense) parts.push(`MDEF+${mods.magicDefense}`)
    if (mods.speed) parts.push(`SPD+${mods.speed}`)
    if (mods.maxHp) parts.push(`HP+${mods.maxHp}`)
    if (mods.maxMp) parts.push(`MP+${mods.maxMp}`)
    if (mods.luck) parts.push(`LCK+${mods.luck}`)
    return parts.join(' ') || 'No bonuses'
  }

  destroy(): void {
    this.container.destroy()
    this.listContainer.destroy()
    this.comparisonContainer.destroy()
  }
}
