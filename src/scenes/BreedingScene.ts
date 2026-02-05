import Phaser from 'phaser'
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, COLORS, DEPTH, TEXT_STYLES } from '../config'
import {
  getGameState,
  setGameState,
  updateMonsterStorage,
  updateInventory,
} from '../systems/GameStateManager'
import { getSpecies } from '../systems/MonsterSystem'
import {
  createBreedingPair,
  executeBreeding,
  getCompatibleMonstersForBreeding,
  canBreed,
} from '../systems/BreedingSystem'
import { getItem, removeItem } from '../systems/InventorySystem'
import type { MonsterInstance, Item, BreedingPair, BreedingResult } from '../models/types'

type BreedingPhase = 'select_parent1' | 'select_parent2' | 'preview' | 'breeding' | 'result'

const PANEL_WIDTH = 280
const PANEL_HEIGHT = 450
const SLOT_HEIGHT = 60

export class BreedingScene extends Phaser.Scene {
  private phase: BreedingPhase = 'select_parent1'
  private parent1: MonsterInstance | null = null
  private parent2: MonsterInstance | null = null
  private selectedItems: Item[] = []
  private breedingPair: BreedingPair | null = null
  private breedingResult: BreedingResult | null = null

  private parent1Panel!: Phaser.GameObjects.Container
  private parent2Panel!: Phaser.GameObjects.Container
  private previewPanel!: Phaser.GameObjects.Container
  private itemPanel!: Phaser.GameObjects.Container
  private resultPanel!: Phaser.GameObjects.Container
  private messageText!: Phaser.GameObjects.Text

  private scrollOffset1: number = 0
  private scrollOffset2: number = 0

  constructor() {
    super({ key: SCENE_KEYS.BREEDING })
  }

  create(): void {
    this.phase = 'select_parent1'
    this.parent1 = null
    this.parent2 = null
    this.selectedItems = []
    this.breedingPair = null
    this.breedingResult = null
    this.scrollOffset1 = 0
    this.scrollOffset2 = 0

    this.createBackground()
    this.createHeader()
    this.createPanels()
    this.createMessageBar()
    this.refreshUI()

    this.input.keyboard?.on('keydown-ESC', () => this.closeBreeding())
  }

  private createBackground(): void {
    const bg = this.add.graphics()
    bg.fillStyle(0x000000, 0.8)
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    bg.setDepth(DEPTH.OVERLAY)

    const panel = this.add.graphics()
    panel.fillStyle(COLORS.DARK_BG, 0.98)
    panel.fillRoundedRect(40, 30, GAME_WIDTH - 80, GAME_HEIGHT - 60, 16)
    panel.lineStyle(2, COLORS.SECONDARY)
    panel.strokeRoundedRect(40, 30, GAME_WIDTH - 80, GAME_HEIGHT - 60, 16)
    panel.setDepth(DEPTH.OVERLAY)
  }

  private createHeader(): void {
    const title = this.add.text(GAME_WIDTH / 2, 50, 'Monster Breeding', {
      ...TEXT_STYLES.HEADING,
      fontSize: '28px',
    })
    title.setOrigin(0.5)
    title.setDepth(DEPTH.OVERLAY + 1)

    const closeBtn = this.add.text(GAME_WIDTH - 80, 50, 'X Close', {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      color: '#ef5350',
    })
    closeBtn.setOrigin(0.5)
    closeBtn.setInteractive({ useHandCursor: true })
    closeBtn.on('pointerdown', () => this.closeBreeding())
    closeBtn.setDepth(DEPTH.OVERLAY + 1)
  }

  private createPanels(): void {
    this.parent1Panel = this.add.container(60, 90)
    this.parent1Panel.setDepth(DEPTH.OVERLAY + 1)

    this.parent2Panel = this.add.container(360, 90)
    this.parent2Panel.setDepth(DEPTH.OVERLAY + 1)

    this.previewPanel = this.add.container(660, 90)
    this.previewPanel.setDepth(DEPTH.OVERLAY + 1)

    this.itemPanel = this.add.container(960, 90)
    this.itemPanel.setDepth(DEPTH.OVERLAY + 1)

    this.resultPanel = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2)
    this.resultPanel.setDepth(DEPTH.OVERLAY + 2)
    this.resultPanel.setVisible(false)
  }

  private createMessageBar(): void {
    this.messageText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 50, '', {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
    })
    this.messageText.setOrigin(0.5)
    this.messageText.setDepth(DEPTH.OVERLAY + 2)
  }

  private refreshUI(): void {
    this.refreshParent1Panel()
    this.refreshParent2Panel()
    this.refreshPreviewPanel()
    this.refreshItemPanel()
    this.updateMessage()
  }

  private refreshParent1Panel(): void {
    this.parent1Panel.removeAll(true)

    const bg = this.add.graphics()
    bg.fillStyle(COLORS.PANEL_BG, 0.7)
    bg.fillRoundedRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 10)
    bg.lineStyle(2, this.parent1 ? COLORS.SUCCESS : COLORS.PRIMARY)
    bg.strokeRoundedRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 10)
    this.parent1Panel.add(bg)

    const header = this.add.text(PANEL_WIDTH / 2, 15, 'Parent 1', {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      color: '#4fc3f7',
    })
    header.setOrigin(0.5)
    this.parent1Panel.add(header)

    if (this.parent1) {
      this.renderSelectedMonster(this.parent1Panel, this.parent1, 40, () => {
        this.parent1 = null
        this.parent2 = null
        this.breedingPair = null
        this.phase = 'select_parent1'
        this.refreshUI()
      })
    } else {
      this.renderMonsterList(this.parent1Panel, this.getAvailableMonsters(), 40, (monster) => {
        this.parent1 = monster
        this.phase = 'select_parent2'
        this.refreshUI()
      })
    }
  }

  private refreshParent2Panel(): void {
    this.parent2Panel.removeAll(true)

    const bg = this.add.graphics()
    bg.fillStyle(COLORS.PANEL_BG, 0.7)
    bg.fillRoundedRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 10)
    bg.lineStyle(2, this.parent2 ? COLORS.SUCCESS : COLORS.SECONDARY)
    bg.strokeRoundedRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 10)
    this.parent2Panel.add(bg)

    const header = this.add.text(PANEL_WIDTH / 2, 15, 'Parent 2', {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      color: '#7e57c2',
    })
    header.setOrigin(0.5)
    this.parent2Panel.add(header)

    if (this.parent2) {
      this.renderSelectedMonster(this.parent2Panel, this.parent2, 40, () => {
        this.parent2 = null
        this.breedingPair = null
        this.phase = 'select_parent2'
        this.refreshUI()
      })
    } else if (this.parent1) {
      const compatible = getCompatibleMonstersForBreeding(this.parent1, this.getAvailableMonsters())
      this.renderMonsterList(this.parent2Panel, compatible, 40, (monster) => {
        this.parent2 = monster
        this.breedingPair = createBreedingPair(this.parent1!, this.parent2!, this.selectedItems)
        this.phase = 'preview'
        this.refreshUI()
      })
    } else {
      const hint = this.add.text(PANEL_WIDTH / 2, PANEL_HEIGHT / 2, 'Select Parent 1 first', {
        ...TEXT_STYLES.SMALL,
        fontSize: '14px',
        color: '#666666',
      })
      hint.setOrigin(0.5)
      this.parent2Panel.add(hint)
    }
  }

  private refreshPreviewPanel(): void {
    this.previewPanel.removeAll(true)

    const bg = this.add.graphics()
    bg.fillStyle(COLORS.PANEL_BG, 0.7)
    bg.fillRoundedRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 10)
    bg.lineStyle(2, COLORS.GOLD)
    bg.strokeRoundedRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 10)
    this.previewPanel.add(bg)

    const header = this.add.text(PANEL_WIDTH / 2, 15, 'Breeding Preview', {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      color: '#ffd54f',
    })
    header.setOrigin(0.5)
    this.previewPanel.add(header)

    if (!this.breedingPair) {
      const hint = this.add.text(PANEL_WIDTH / 2, PANEL_HEIGHT / 2, 'Select both parents\nto see preview', {
        ...TEXT_STYLES.SMALL,
        fontSize: '14px',
        color: '#666666',
        align: 'center',
      })
      hint.setOrigin(0.5)
      this.previewPanel.add(hint)
      return
    }

    // Compatibility display
    const compatPercent = Math.round(this.breedingPair.compatibility * 100)
    const compatColor = compatPercent >= 70 ? '#66bb6a' : compatPercent >= 40 ? '#ffa726' : '#ef5350'

    const compatLabel = this.add.text(15, 45, 'Compatibility:', {
      ...TEXT_STYLES.SMALL,
      fontSize: '13px',
    })
    this.previewPanel.add(compatLabel)

    const compatValue = this.add.text(PANEL_WIDTH - 15, 45, `${compatPercent}%`, {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      color: compatColor,
    })
    compatValue.setOrigin(1, 0)
    this.previewPanel.add(compatValue)

    // Compatibility bar
    const barBg = this.add.graphics()
    barBg.fillStyle(0x333333, 1)
    barBg.fillRoundedRect(15, 70, PANEL_WIDTH - 30, 12, 4)
    this.previewPanel.add(barBg)

    const barFill = this.add.graphics()
    barFill.fillStyle(parseInt(compatColor.slice(1), 16), 1)
    barFill.fillRoundedRect(15, 70, (PANEL_WIDTH - 30) * this.breedingPair.compatibility, 12, 4)
    this.previewPanel.add(barFill)

    // Possible offspring
    const offspringHeader = this.add.text(15, 95, 'Possible Offspring:', {
      ...TEXT_STYLES.SMALL,
      fontSize: '13px',
      color: '#b0bec5',
    })
    this.previewPanel.add(offspringHeader)

    this.breedingPair.possibleOffspring.forEach((outcome, i) => {
      const species = getSpecies(outcome.resultSpeciesId)
      const name = species?.name ?? outcome.resultSpeciesId
      const prob = Math.round(outcome.probability * 100)
      const y = 120 + i * 24

      const text = this.add.text(20, y, `• ${name}`, {
        ...TEXT_STYLES.SMALL,
        fontSize: '12px',
      })
      this.previewPanel.add(text)

      const probText = this.add.text(PANEL_WIDTH - 20, y, `${prob}%`, {
        ...TEXT_STYLES.SMALL,
        fontSize: '12px',
        color: '#b0bec5',
      })
      probText.setOrigin(1, 0)
      this.previewPanel.add(probText)
    })

    // Breed button
    const breedBtnY = PANEL_HEIGHT - 60
    const breedBtn = this.add.graphics()
    breedBtn.fillStyle(COLORS.SUCCESS, 0.8)
    breedBtn.fillRoundedRect(30, breedBtnY, PANEL_WIDTH - 60, 40, 8)
    this.previewPanel.add(breedBtn)

    const breedText = this.add.text(PANEL_WIDTH / 2, breedBtnY + 20, 'Breed!', {
      ...TEXT_STYLES.BUTTON,
      fontSize: '18px',
    })
    breedText.setOrigin(0.5)
    this.previewPanel.add(breedText)

    const breedHit = this.add.rectangle(PANEL_WIDTH / 2, breedBtnY + 20, PANEL_WIDTH - 60, 40)
    breedHit.setInteractive({ useHandCursor: true })
    breedHit.on('pointerover', () => {
      breedBtn.clear()
      breedBtn.fillStyle(COLORS.SUCCESS, 1)
      breedBtn.fillRoundedRect(30, breedBtnY, PANEL_WIDTH - 60, 40, 8)
    })
    breedHit.on('pointerout', () => {
      breedBtn.clear()
      breedBtn.fillStyle(COLORS.SUCCESS, 0.8)
      breedBtn.fillRoundedRect(30, breedBtnY, PANEL_WIDTH - 60, 40, 8)
    })
    breedHit.on('pointerdown', () => this.performBreeding())
    this.previewPanel.add(breedHit)
  }

  private refreshItemPanel(): void {
    this.itemPanel.removeAll(true)

    const bg = this.add.graphics()
    bg.fillStyle(COLORS.PANEL_BG, 0.7)
    bg.fillRoundedRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 10)
    bg.lineStyle(2, COLORS.WARNING)
    bg.strokeRoundedRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 10)
    this.itemPanel.add(bg)

    const header = this.add.text(PANEL_WIDTH / 2, 15, 'Breeding Items', {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      color: '#ffa726',
    })
    header.setOrigin(0.5)
    this.itemPanel.add(header)

    const breedingItems = this.getBreedingItems()

    if (breedingItems.length === 0) {
      const hint = this.add.text(PANEL_WIDTH / 2, PANEL_HEIGHT / 2, 'No breeding items\nin inventory', {
        ...TEXT_STYLES.SMALL,
        fontSize: '14px',
        color: '#666666',
        align: 'center',
      })
      hint.setOrigin(0.5)
      this.itemPanel.add(hint)
      return
    }

    breedingItems.forEach((entry, i) => {
      const y = 45 + i * 55
      const isSelected = this.selectedItems.some((s) => s.itemId === entry.item.itemId)

      const itemBg = this.add.graphics()
      itemBg.fillStyle(isSelected ? COLORS.WARNING : COLORS.PANEL_BG, isSelected ? 0.5 : 0.3)
      itemBg.fillRoundedRect(10, y, PANEL_WIDTH - 20, 50, 6)
      this.itemPanel.add(itemBg)

      const name = this.add.text(20, y + 8, entry.item.name, {
        ...TEXT_STYLES.SMALL,
        fontSize: '13px',
      })
      this.itemPanel.add(name)

      const qty = this.add.text(PANEL_WIDTH - 20, y + 8, `x${entry.quantity}`, {
        ...TEXT_STYLES.SMALL,
        fontSize: '12px',
        color: '#b0bec5',
      })
      qty.setOrigin(1, 0)
      this.itemPanel.add(qty)

      const desc = this.add.text(20, y + 28, entry.item.description.slice(0, 35) + '...', {
        ...TEXT_STYLES.SMALL,
        fontSize: '10px',
        color: '#888888',
      })
      this.itemPanel.add(desc)

      const hitArea = this.add.rectangle(PANEL_WIDTH / 2, y + 25, PANEL_WIDTH - 20, 50)
      hitArea.setInteractive({ useHandCursor: true })
      hitArea.on('pointerdown', () => {
        if (isSelected) {
          this.selectedItems = this.selectedItems.filter((s) => s.itemId !== entry.item.itemId)
        } else {
          this.selectedItems = [...this.selectedItems, entry.item]
        }
        if (this.parent1 && this.parent2) {
          this.breedingPair = createBreedingPair(this.parent1, this.parent2, this.selectedItems)
        }
        this.refreshUI()
      })
      this.itemPanel.add(hitArea)
    })
  }

  private renderMonsterList(
    container: Phaser.GameObjects.Container,
    monsters: ReadonlyArray<MonsterInstance>,
    startY: number,
    onSelect: (monster: MonsterInstance) => void,
  ): void {
    const maxVisible = 6

    if (monsters.length === 0) {
      const hint = this.add.text(PANEL_WIDTH / 2, startY + 100, 'No monsters available', {
        ...TEXT_STYLES.SMALL,
        fontSize: '14px',
        color: '#666666',
      })
      hint.setOrigin(0.5)
      container.add(hint)
      return
    }

    const visible = monsters.slice(0, maxVisible)

    visible.forEach((monster, i) => {
      const y = startY + i * (SLOT_HEIGHT + 5)
      const species = getSpecies(monster.speciesId)

      const slotBg = this.add.graphics()
      slotBg.fillStyle(COLORS.PANEL_BG, 0.5)
      slotBg.fillRoundedRect(10, y, PANEL_WIDTH - 20, SLOT_HEIGHT, 6)
      container.add(slotBg)

      const displayName = monster.nickname ?? species?.name ?? 'Unknown'
      const name = this.add.text(20, y + 8, displayName, {
        ...TEXT_STYLES.SMALL,
        fontSize: '13px',
      })
      container.add(name)

      const level = this.add.text(20, y + 28, `Lv. ${monster.level}`, {
        ...TEXT_STYLES.SMALL,
        fontSize: '11px',
        color: '#b0bec5',
      })
      container.add(level)

      const element = this.add.text(PANEL_WIDTH - 25, y + 8, species?.element ?? '', {
        ...TEXT_STYLES.SMALL,
        fontSize: '10px',
        color: this.getElementColor(species?.element ?? 'neutral'),
      })
      element.setOrigin(1, 0)
      container.add(element)

      const bondLabel = this.add.text(PANEL_WIDTH - 25, y + 28, `♥${monster.bondLevel}`, {
        ...TEXT_STYLES.SMALL,
        fontSize: '10px',
        color: '#ef5350',
      })
      bondLabel.setOrigin(1, 0)
      container.add(bondLabel)

      const hitArea = this.add.rectangle(PANEL_WIDTH / 2, y + SLOT_HEIGHT / 2, PANEL_WIDTH - 20, SLOT_HEIGHT)
      hitArea.setInteractive({ useHandCursor: true })
      hitArea.on('pointerover', () => {
        slotBg.clear()
        slotBg.fillStyle(COLORS.PRIMARY, 0.4)
        slotBg.fillRoundedRect(10, y, PANEL_WIDTH - 20, SLOT_HEIGHT, 6)
      })
      hitArea.on('pointerout', () => {
        slotBg.clear()
        slotBg.fillStyle(COLORS.PANEL_BG, 0.5)
        slotBg.fillRoundedRect(10, y, PANEL_WIDTH - 20, SLOT_HEIGHT, 6)
      })
      hitArea.on('pointerdown', () => onSelect(monster))
      container.add(hitArea)
    })

    if (monsters.length > maxVisible) {
      const moreText = this.add.text(PANEL_WIDTH / 2, startY + maxVisible * (SLOT_HEIGHT + 5) + 10, `+${monsters.length - maxVisible} more...`, {
        ...TEXT_STYLES.SMALL,
        fontSize: '11px',
        color: '#888888',
      })
      moreText.setOrigin(0.5)
      container.add(moreText)
    }
  }

  private renderSelectedMonster(
    container: Phaser.GameObjects.Container,
    monster: MonsterInstance,
    startY: number,
    onDeselect: () => void,
  ): void {
    const species = getSpecies(monster.speciesId)

    const selectedBg = this.add.graphics()
    selectedBg.fillStyle(COLORS.SUCCESS, 0.3)
    selectedBg.fillRoundedRect(10, startY, PANEL_WIDTH - 20, 100, 8)
    container.add(selectedBg)

    const displayName = monster.nickname ?? species?.name ?? 'Unknown'
    const name = this.add.text(PANEL_WIDTH / 2, startY + 15, displayName, {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
    })
    name.setOrigin(0.5)
    container.add(name)

    const level = this.add.text(PANEL_WIDTH / 2, startY + 40, `Level ${monster.level}  |  ${species?.element ?? 'neutral'}`, {
      ...TEXT_STYLES.SMALL,
      fontSize: '12px',
      color: '#b0bec5',
    })
    level.setOrigin(0.5)
    container.add(level)

    const traits = species?.breedingTraits ?? []
    if (traits.length > 0) {
      const traitText = this.add.text(PANEL_WIDTH / 2, startY + 60, `Traits: ${traits.slice(0, 2).join(', ')}`, {
        ...TEXT_STYLES.SMALL,
        fontSize: '11px',
        color: '#ffd54f',
      })
      traitText.setOrigin(0.5)
      container.add(traitText)
    }

    const changeBtn = this.add.text(PANEL_WIDTH / 2, startY + 85, '[ Change ]', {
      ...TEXT_STYLES.SMALL,
      fontSize: '11px',
      color: '#ef5350',
    })
    changeBtn.setOrigin(0.5)
    changeBtn.setInteractive({ useHandCursor: true })
    changeBtn.on('pointerdown', onDeselect)
    container.add(changeBtn)
  }

  private performBreeding(): void {
    if (!this.breedingPair) return

    this.phase = 'breeding'
    this.showMessage('Breeding in progress...', '#ffd54f')

    // Breeding animation
    this.cameras.main.flash(500, 255, 255, 255)

    this.time.delayedCall(800, () => {
      const result = executeBreeding(this.breedingPair!, this.selectedItems)

      if (!result) {
        this.showMessage('Breeding failed!', '#ef5350')
        this.phase = 'preview'
        return
      }

      this.breedingResult = result

      // Consume used items
      let state = getGameState(this)
      let inventory = state.inventory
      for (const item of this.selectedItems) {
        const updated = removeItem(inventory, item.itemId, 1)
        if (updated) {
          inventory = updated
        }
      }
      setGameState(this, updateInventory(state, inventory))

      // Add offspring to storage
      state = getGameState(this)
      const newStorage = [...state.monsterStorage, result.offspring]
      setGameState(this, updateMonsterStorage(state, newStorage))

      this.phase = 'result'
      this.showResultPanel()
    })
  }

  private showResultPanel(): void {
    if (!this.breedingResult) return

    this.resultPanel.removeAll(true)
    this.resultPanel.setVisible(true)

    const backdrop = this.add.graphics()
    backdrop.fillStyle(0x000000, 0.6)
    backdrop.fillRect(-GAME_WIDTH / 2, -GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT)
    this.resultPanel.add(backdrop)

    const panel = this.add.graphics()
    panel.fillStyle(COLORS.DARK_BG, 0.98)
    panel.fillRoundedRect(-200, -180, 400, 360, 16)
    panel.lineStyle(3, COLORS.GOLD)
    panel.strokeRoundedRect(-200, -180, 400, 360, 16)
    this.resultPanel.add(panel)

    const title = this.add.text(0, -150, 'Breeding Success!', {
      ...TEXT_STYLES.HEADING,
      fontSize: '24px',
      color: '#ffd54f',
    })
    title.setOrigin(0.5)
    this.resultPanel.add(title)

    const offspring = this.breedingResult.offspring
    const species = getSpecies(offspring.speciesId)

    const offspringName = this.add.text(0, -100, species?.name ?? 'Unknown', {
      ...TEXT_STYLES.BODY,
      fontSize: '22px',
    })
    offspringName.setOrigin(0.5)
    this.resultPanel.add(offspringName)

    const offspringInfo = this.add.text(0, -70, `Level 1  |  ${species?.element ?? 'neutral'}  |  ${species?.rarity ?? 'common'}`, {
      ...TEXT_STYLES.SMALL,
      fontSize: '14px',
      color: '#b0bec5',
    })
    offspringInfo.setOrigin(0.5)
    this.resultPanel.add(offspringInfo)

    // Inherited traits
    const inheritedTraits = [
      ...this.breedingResult.inheritedTraitsFromParent1,
      ...this.breedingResult.inheritedTraitsFromParent2,
    ]

    if (inheritedTraits.length > 0) {
      const traitsLabel = this.add.text(0, -30, 'Inherited Traits:', {
        ...TEXT_STYLES.SMALL,
        fontSize: '13px',
        color: '#b0bec5',
      })
      traitsLabel.setOrigin(0.5)
      this.resultPanel.add(traitsLabel)

      const traitsText = this.add.text(0, -5, inheritedTraits.slice(0, 4).join(', '), {
        ...TEXT_STYLES.BODY,
        fontSize: '14px',
        color: '#66bb6a',
      })
      traitsText.setOrigin(0.5)
      this.resultPanel.add(traitsText)
    }

    // Mutation
    if (this.breedingResult.mutationOccurred && this.breedingResult.mutationTrait) {
      const mutationLabel = this.add.text(0, 40, '✨ MUTATION! ✨', {
        ...TEXT_STYLES.BODY,
        fontSize: '16px',
        color: '#e040fb',
      })
      mutationLabel.setOrigin(0.5)
      this.resultPanel.add(mutationLabel)

      const mutationTrait = this.add.text(0, 65, this.breedingResult.mutationTrait, {
        ...TEXT_STYLES.BODY,
        fontSize: '14px',
        color: '#e040fb',
      })
      mutationTrait.setOrigin(0.5)
      this.resultPanel.add(mutationTrait)
    }

    // Close button
    const closeBtn = this.add.graphics()
    closeBtn.fillStyle(COLORS.PRIMARY, 0.8)
    closeBtn.fillRoundedRect(-80, 120, 160, 40, 8)
    this.resultPanel.add(closeBtn)

    const closeText = this.add.text(0, 140, 'Continue', {
      ...TEXT_STYLES.BUTTON,
      fontSize: '16px',
    })
    closeText.setOrigin(0.5)
    this.resultPanel.add(closeText)

    const closeHit = this.add.rectangle(0, 140, 160, 40)
    closeHit.setInteractive({ useHandCursor: true })
    closeHit.on('pointerdown', () => {
      this.resultPanel.setVisible(false)
      this.parent1 = null
      this.parent2 = null
      this.breedingPair = null
      this.breedingResult = null
      this.selectedItems = []
      this.phase = 'select_parent1'
      this.refreshUI()
    })
    this.resultPanel.add(closeHit)
  }

  private getAvailableMonsters(): ReadonlyArray<MonsterInstance> {
    const state = getGameState(this)
    return [...state.squad, ...state.monsterStorage]
  }

  private getBreedingItems(): ReadonlyArray<{ item: Item; quantity: number }> {
    const state = getGameState(this)
    return state.inventory.items
      .filter((slot) => slot.item.category === 'breeding_item')
      .map((slot) => ({ item: slot.item, quantity: slot.quantity }))
  }

  private updateMessage(): void {
    switch (this.phase) {
      case 'select_parent1':
        this.showMessage('Select the first parent monster', '#4fc3f7')
        break
      case 'select_parent2':
        this.showMessage('Select the second parent monster', '#7e57c2')
        break
      case 'preview':
        this.showMessage('Review compatibility and press Breed!', '#ffd54f')
        break
      case 'breeding':
        this.showMessage('Breeding in progress...', '#ffd54f')
        break
      case 'result':
        this.showMessage('', '#ffffff')
        break
    }
  }

  private showMessage(text: string, color: string): void {
    this.messageText.setText(text)
    this.messageText.setColor(color)
  }

  private getElementColor(element: string): string {
    const colors: Record<string, string> = {
      fire: '#ef5350',
      water: '#42a5f5',
      earth: '#8d6e63',
      wind: '#66bb6a',
      light: '#ffd54f',
      dark: '#7e57c2',
      neutral: '#bdbdbd',
    }
    return colors[element] ?? '#bdbdbd'
  }

  private closeBreeding(): void {
    const worldScene = this.scene.get(SCENE_KEYS.WORLD)
    if (worldScene) {
      this.scene.resume(SCENE_KEYS.WORLD)
    }
    this.scene.stop()
  }
}
