import Phaser from 'phaser'
import type { Equipment, EquipmentSlot, CharacterStats } from '../../models/types'
import { COLORS, TEXT_STYLES, DEPTH } from '../../config'
import { getGameState, setGameState, updatePlayer, updateInventory } from '../../systems/GameStateManager'
import {
  equipItem,
  unequipItem,
  compareEquipment,
} from '../../systems/EquipmentSystem'

const SLOT_LABELS: Readonly<Record<EquipmentSlot, string>> = {
  weapon: 'Weapon',
  armor: 'Armor',
  helmet: 'Helmet',
  accessory: 'Accessory',
}

const SLOT_ORDER: ReadonlyArray<EquipmentSlot> = ['helmet', 'weapon', 'armor', 'accessory']

const SLOT_POSITIONS: Record<EquipmentSlot, { x: number; y: number }> = {
  helmet: { x: 85, y: 0 },
  weapon: { x: 0, y: 90 },
  armor: { x: 85, y: 180 },
  accessory: { x: 170, y: 90 },
}

export class EquipmentPanel {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private slotsContainer: Phaser.GameObjects.Container
  private listContainer: Phaser.GameObjects.Container
  private comparisonContainer: Phaser.GameObjects.Container
  private statsContainer: Phaser.GameObjects.Container
  private selectedSlot: EquipmentSlot = 'weapon'

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene
    this.container = scene.add.container(x, y)
    this.container.setDepth(DEPTH.OVERLAY + 2)

    // Equipment slots on the left
    this.slotsContainer = scene.add.container(0, 0)
    this.container.add(this.slotsContainer)

    // Stats summary below slots
    this.statsContainer = scene.add.container(0, 290)
    this.container.add(this.statsContainer)

    // Available equipment list on the right
    this.listContainer = scene.add.container(300, 0)
    this.container.add(this.listContainer)

    // Comparison panel
    this.comparisonContainer = scene.add.container(300, 320)
    this.container.add(this.comparisonContainer)

    this.createTitle()
    this.refreshSlots()
    this.refreshStats()
    this.refreshAvailableList()
  }

  private createTitle(): void {
    const title = this.scene.add.text(0, -5, 'Equipment', {
      ...TEXT_STYLES.BODY,
      fontSize: '18px',
      color: '#ffd54f',
    })
    this.slotsContainer.add(title)
  }

  refresh(): void {
    this.refreshSlots()
    this.refreshStats()
    this.refreshAvailableList()
  }

  private refreshSlots(): void {
    // Clear existing slot elements (keep title at index 0)
    const children = this.slotsContainer.getAll()
    for (let i = children.length - 1; i >= 1; i--) {
      (children[i] as Phaser.GameObjects.GameObject).destroy()
    }

    const state = getGameState(this.scene)
    const equipment = state.player.equipment

    // Draw connecting lines first (visual decoration)
    const lines = this.scene.add.graphics()
    lines.lineStyle(2, COLORS.PANEL_BG, 0.5)
    // Helmet to Armor
    lines.lineBetween(125, 70, 125, 180)
    // Weapon to center
    lines.lineBetween(70, 120, 85, 120)
    // Accessory to center
    lines.lineBetween(165, 120, 180, 120)
    this.slotsContainer.add(lines)

    // Draw each slot
    for (const slot of SLOT_ORDER) {
      const pos = SLOT_POSITIONS[slot]
      const equipped = equipment[slot]
      const isSelected = slot === this.selectedSlot

      this.createSlotCard(pos.x, pos.y + 20, slot, equipped, isSelected)
    }
  }

  private createSlotCard(
    x: number,
    y: number,
    slot: EquipmentSlot,
    equipped: Equipment | null,
    isSelected: boolean,
  ): void {
    const cardWidth = 80
    const cardHeight = 70

    const cardContainer = this.scene.add.container(x, y)
    this.slotsContainer.add(cardContainer)

    // Background
    const bg = this.scene.add.graphics()
    bg.fillStyle(isSelected ? COLORS.PRIMARY : COLORS.PANEL_BG, isSelected ? 0.5 : 0.4)
    bg.fillRoundedRect(0, 0, cardWidth, cardHeight, 8)
    bg.lineStyle(2, isSelected ? COLORS.PRIMARY : (equipped ? COLORS.SUCCESS : 0x555555), isSelected ? 1 : 0.6)
    bg.strokeRoundedRect(0, 0, cardWidth, cardHeight, 8)
    cardContainer.add(bg)

    // Slot label
    const label = this.scene.add.text(cardWidth / 2, 8, SLOT_LABELS[slot], {
      ...TEXT_STYLES.SMALL,
      fontSize: '10px',
      color: '#b0bec5',
    })
    label.setOrigin(0.5, 0)
    cardContainer.add(label)

    // Item name or empty
    const itemName = equipped ? this.truncateText(equipped.name, 10) : '(empty)'
    const name = this.scene.add.text(cardWidth / 2, 28, itemName, {
      ...TEXT_STYLES.BODY,
      fontSize: '11px',
      color: equipped ? '#ffffff' : '#666666',
    })
    name.setOrigin(0.5, 0)
    cardContainer.add(name)

    // Unequip button
    if (equipped) {
      const unequipBtn = this.scene.add.text(cardWidth / 2, 52, 'Remove', {
        ...TEXT_STYLES.SMALL,
        fontSize: '9px',
        color: '#ef5350',
      })
      unequipBtn.setOrigin(0.5, 0)
      unequipBtn.setInteractive({ useHandCursor: true })
      unequipBtn.on('pointerdown', (e: Phaser.Input.Pointer) => {
        e.event.stopPropagation()
        this.handleUnequip(slot)
      })
      unequipBtn.on('pointerover', () => unequipBtn.setColor('#ff6b6b'))
      unequipBtn.on('pointerout', () => unequipBtn.setColor('#ef5350'))
      cardContainer.add(unequipBtn)
    }

    // Click to select
    const hitArea = this.scene.add.rectangle(cardWidth / 2, cardHeight / 2, cardWidth, cardHeight)
    hitArea.setInteractive({ useHandCursor: true })
    hitArea.on('pointerdown', () => {
      this.selectedSlot = slot
      this.refresh()
    })
    hitArea.on('pointerover', () => {
      if (!isSelected) {
        bg.clear()
        bg.fillStyle(COLORS.PANEL_BG, 0.6)
        bg.fillRoundedRect(0, 0, cardWidth, cardHeight, 8)
        bg.lineStyle(2, COLORS.PRIMARY, 0.5)
        bg.strokeRoundedRect(0, 0, cardWidth, cardHeight, 8)
      }
    })
    hitArea.on('pointerout', () => {
      if (!isSelected) {
        bg.clear()
        bg.fillStyle(COLORS.PANEL_BG, 0.4)
        bg.fillRoundedRect(0, 0, cardWidth, cardHeight, 8)
        bg.lineStyle(2, equipped ? COLORS.SUCCESS : 0x555555, 0.6)
        bg.strokeRoundedRect(0, 0, cardWidth, cardHeight, 8)
      }
    })
    cardContainer.add(hitArea)
  }

  private refreshStats(): void {
    this.statsContainer.removeAll(true)

    const state = getGameState(this.scene)

    // Background
    const bg = this.scene.add.graphics()
    bg.fillStyle(COLORS.PANEL_BG, 0.4)
    bg.fillRoundedRect(0, 0, 260, 100, 8)
    this.statsContainer.add(bg)

    // Title
    const title = this.scene.add.text(10, 8, 'Total Equipment Bonuses', {
      ...TEXT_STYLES.SMALL,
      fontSize: '12px',
      color: '#ffd54f',
    })
    this.statsContainer.add(title)

    // Calculate total bonuses using mutable accumulator
    const totals: Record<string, number> = {}
    for (const slot of SLOT_ORDER) {
      const equipped = state.player.equipment[slot]
      if (equipped?.statModifiers) {
        for (const [stat, value] of Object.entries(equipped.statModifiers)) {
          totals[stat] = (totals[stat] ?? 0) + (value as number)
        }
      }
    }

    // Display bonuses in 2 columns
    const statEntries = Object.entries(totals)
    if (statEntries.length === 0) {
      const noBonus = this.scene.add.text(130, 55, 'No equipment bonuses', {
        ...TEXT_STYLES.SMALL,
        fontSize: '12px',
        color: '#666666',
      })
      noBonus.setOrigin(0.5)
      this.statsContainer.add(noBonus)
    } else {
      statEntries.forEach(([stat, value], index) => {
        const col = index % 2
        const row = Math.floor(index / 2)
        const x = 15 + col * 125
        const y = 32 + row * 20

        const statText = this.scene.add.text(x, y, `${this.formatStatName(stat)}: +${value}`, {
          ...TEXT_STYLES.SMALL,
          fontSize: '12px',
          color: '#66bb6a',
        })
        this.statsContainer.add(statText)
      })
    }
  }

  private refreshAvailableList(): void {
    this.listContainer.removeAll(true)
    this.comparisonContainer.removeAll(true)

    const state = getGameState(this.scene)
    const available = state.inventory.equipment.filter((e) => e.slot === this.selectedSlot)

    // Title
    const title = this.scene.add.text(0, 0, `Available ${SLOT_LABELS[this.selectedSlot]}s`, {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      color: '#ffd54f',
    })
    this.listContainer.add(title)

    if (available.length === 0) {
      const empty = this.scene.add.text(200, 120, 'No equipment available\nfor this slot.\n\nFind gear by completing\nquests and exploring!', {
        ...TEXT_STYLES.BODY,
        fontSize: '14px',
        color: '#666666',
        align: 'center',
      })
      empty.setOrigin(0.5)
      this.listContainer.add(empty)
      return
    }

    available.forEach((equip, index) => {
      const y = 35 + index * 55

      const meetsLevel = state.player.level >= equip.levelRequirement
      const alpha = meetsLevel ? 1.0 : 0.5

      // Card background
      const bg = this.scene.add.graphics()
      bg.fillStyle(COLORS.PANEL_BG, 0.4)
      bg.fillRoundedRect(0, y, 550, 48, 8)
      this.listContainer.add(bg)

      // Equipment name
      const name = this.scene.add.text(12, y + 8, equip.name, {
        ...TEXT_STYLES.BODY,
        fontSize: '14px',
      })
      name.setAlpha(alpha)
      this.listContainer.add(name)

      // Level requirement badge
      const lvlColor = meetsLevel ? COLORS.SUCCESS : COLORS.DANGER
      const lvlBg = this.scene.add.graphics()
      lvlBg.fillStyle(lvlColor, 0.3)
      lvlBg.fillRoundedRect(200, y + 6, 55, 20, 4)
      this.listContainer.add(lvlBg)

      const lvl = this.scene.add.text(227, y + 10, `Lv.${equip.levelRequirement}`, {
        ...TEXT_STYLES.SMALL,
        fontSize: '11px',
        color: meetsLevel ? '#66bb6a' : '#ef5350',
      })
      lvl.setOrigin(0.5, 0)
      this.listContainer.add(lvl)

      // Stat summary
      const statSummary = this.formatStatModifiers(equip.statModifiers)
      const stats = this.scene.add.text(270, y + 10, statSummary, {
        ...TEXT_STYLES.SMALL,
        fontSize: '11px',
        color: '#42a5f5',
      })
      this.listContainer.add(stats)

      // Equip button
      if (meetsLevel) {
        const equipBtnBg = this.scene.add.graphics()
        equipBtnBg.fillStyle(COLORS.SUCCESS, 0.3)
        equipBtnBg.fillRoundedRect(480, y + 6, 60, 26, 6)
        this.listContainer.add(equipBtnBg)

        const equipBtn = this.scene.add.text(510, y + 13, 'Equip', {
          ...TEXT_STYLES.BODY,
          fontSize: '12px',
          color: '#66bb6a',
        })
        equipBtn.setOrigin(0.5, 0)
        equipBtn.setInteractive({ useHandCursor: true })
        equipBtn.on('pointerdown', () => this.handleEquip(equip))
        equipBtn.on('pointerover', () => {
          equipBtnBg.clear()
          equipBtnBg.fillStyle(COLORS.SUCCESS, 0.6)
          equipBtnBg.fillRoundedRect(480, y + 6, 60, 26, 6)
        })
        equipBtn.on('pointerout', () => {
          equipBtnBg.clear()
          equipBtnBg.fillStyle(COLORS.SUCCESS, 0.3)
          equipBtnBg.fillRoundedRect(480, y + 6, 60, 26, 6)
        })
        this.listContainer.add(equipBtn)
      } else {
        const lockText = this.scene.add.text(510, y + 15, 'Locked', {
          ...TEXT_STYLES.SMALL,
          fontSize: '11px',
          color: '#666666',
        })
        lockText.setOrigin(0.5, 0)
        this.listContainer.add(lockText)
      }

      // Hover to show comparison
      const hitArea = this.scene.add.rectangle(275, y + 24, 550, 48)
      hitArea.setInteractive()
      hitArea.on('pointerover', () => {
        bg.clear()
        bg.fillStyle(COLORS.PRIMARY, 0.2)
        bg.fillRoundedRect(0, y, 550, 48, 8)
        bg.lineStyle(1, COLORS.PRIMARY, 0.5)
        bg.strokeRoundedRect(0, y, 550, 48, 8)
        this.showComparison(equip)
      })
      hitArea.on('pointerout', () => {
        bg.clear()
        bg.fillStyle(COLORS.PANEL_BG, 0.4)
        bg.fillRoundedRect(0, y, 550, 48, 8)
        this.comparisonContainer.removeAll(true)
      })
      this.listContainer.add(hitArea)
    })
  }

  private showComparison(candidate: Equipment): void {
    this.comparisonContainer.removeAll(true)

    const state = getGameState(this.scene)
    const current = state.player.equipment[candidate.slot]
    const diff = compareEquipment(current, candidate)

    // Background
    const bg = this.scene.add.graphics()
    bg.fillStyle(COLORS.PANEL_BG, 0.6)
    bg.fillRoundedRect(0, 0, 550, 80, 8)
    bg.lineStyle(1, COLORS.PRIMARY, 0.4)
    bg.strokeRoundedRect(0, 0, 550, 80, 8)
    this.comparisonContainer.add(bg)

    // Title
    const title = this.scene.add.text(15, 10, current ? 'Stat Change (vs current):' : 'Stat Bonus:', {
      ...TEXT_STYLES.SMALL,
      fontSize: '12px',
      color: '#ffd54f',
    })
    this.comparisonContainer.add(title)

    const entries = Object.entries(diff) as [keyof CharacterStats, number][]
    if (entries.length === 0) {
      const noChange = this.scene.add.text(275, 50, 'No stat change', {
        ...TEXT_STYLES.SMALL,
        fontSize: '12px',
        color: '#888888',
      })
      noChange.setOrigin(0.5)
      this.comparisonContainer.add(noChange)
    } else {
      entries.forEach(([stat, change], index) => {
        const x = 15 + (index % 4) * 135
        const y = 35 + Math.floor(index / 4) * 22
        const color = change > 0 ? '#66bb6a' : change < 0 ? '#ef5350' : '#888888'
        const prefix = change > 0 ? '+' : ''
        const text = this.scene.add.text(x, y, `${this.formatStatName(stat)}: ${prefix}${change}`, {
          ...TEXT_STYLES.SMALL,
          fontSize: '12px',
          color,
        })
        this.comparisonContainer.add(text)
      })
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

  private formatStatName(stat: string): string {
    const names: Record<string, string> = {
      maxHp: 'HP',
      currentHp: 'HP',
      maxMp: 'MP',
      currentMp: 'MP',
      attack: 'ATK',
      defense: 'DEF',
      magicAttack: 'MATK',
      magicDefense: 'MDEF',
      speed: 'SPD',
      luck: 'LCK',
    }
    return names[stat] ?? stat
  }

  private truncateText(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text
    return text.substring(0, maxLen - 2) + '..'
  }

  destroy(): void {
    this.container.destroy()
  }
}
