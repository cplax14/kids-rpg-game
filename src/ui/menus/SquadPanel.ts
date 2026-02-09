import Phaser from 'phaser'
import type { MonsterInstance, MonsterSpecies } from '../../models/types'
import { COLORS, TEXT_STYLES, DEPTH, MAX_SQUAD_SIZE } from '../../config'
import {
  getGameState,
  setGameState,
  updateSquad,
  updateMonsterStorage,
} from '../../systems/GameStateManager'
import { getSpecies } from '../../systems/MonsterSystem'
import { getXpToNextLevel } from '../../systems/CharacterSystem'
import {
  removeFromSquad,
  moveToStorage,
  moveToSquad,
  swapSquadPositions,
  setMonsterNickname,
  setStorageMonsterNickname,
  applyBondBonus,
} from '../../systems/SquadSystem'

const SQUAD_SLOT_WIDTH = 200
const SQUAD_SLOT_HEIGHT = 70
const DETAIL_WIDTH = 380
const STORAGE_PANEL_WIDTH = 400

export class SquadPanel {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private detailContainer: Phaser.GameObjects.Container
  private storageContainer: Phaser.GameObjects.Container
  private selectedMonster: MonsterInstance | null = null
  private selectedFromStorage: boolean = false
  private storageScrollOffset: number = 0

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene
    this.container = scene.add.container(x, y)
    this.container.setDepth(DEPTH.OVERLAY + 2)

    this.detailContainer = scene.add.container(x + SQUAD_SLOT_WIDTH + 20, y)
    this.detailContainer.setDepth(DEPTH.OVERLAY + 2)

    this.storageContainer = scene.add.container(x + SQUAD_SLOT_WIDTH + DETAIL_WIDTH + 40, y)
    this.storageContainer.setDepth(DEPTH.OVERLAY + 2)

    this.createHeaders()
    this.refreshSquadList()
    this.refreshDetail()
    this.refreshStorageList()
  }

  private createHeaders(): void {
    // Squad header
    const squadHeader = this.scene.add.text(0, 0, 'Squad', {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      color: COLORS.PRIMARY.toString(16).padStart(6, '0'),
    })
    squadHeader.setTint(COLORS.PRIMARY)
    this.container.add(squadHeader)

    // Storage header
    const storageHeader = this.scene.add.text(0, 0, 'Storage', {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
    })
    storageHeader.setTint(COLORS.SECONDARY)
    this.storageContainer.add(storageHeader)
  }

  refresh(): void {
    this.refreshSquadList()
    this.refreshDetail()
    this.refreshStorageList()
  }

  private refreshSquadList(): void {
    // Clear previous elements (keep header at index 0)
    const children = this.container.getAll()
    for (let i = children.length - 1; i >= 1; i--) {
      (children[i] as Phaser.GameObjects.GameObject).destroy()
    }

    const state = getGameState(this.scene)
    const squad = state.squad

    // Squad slots
    for (let i = 0; i < MAX_SQUAD_SIZE; i++) {
      const y = 30 + i * (SQUAD_SLOT_HEIGHT + 8)
      const monster = squad[i]
      const isSelected = monster && this.selectedMonster?.instanceId === monster.instanceId && !this.selectedFromStorage

      const bg = this.scene.add.graphics()
      bg.fillStyle(isSelected ? COLORS.PRIMARY : COLORS.PANEL_BG, isSelected ? 0.6 : 0.4)
      bg.fillRoundedRect(0, y, SQUAD_SLOT_WIDTH, SQUAD_SLOT_HEIGHT, 8)
      bg.lineStyle(1, isSelected ? COLORS.PRIMARY : 0x555555)
      bg.strokeRoundedRect(0, y, SQUAD_SLOT_WIDTH, SQUAD_SLOT_HEIGHT, 8)
      this.container.add(bg)

      if (monster) {
        const species = getSpecies(monster.speciesId)
        const displayName = monster.nickname ?? species?.name ?? 'Unknown'

        // Name
        const name = this.scene.add.text(10, y + 8, displayName, {
          ...TEXT_STYLES.BODY,
          fontSize: '14px',
        })
        this.container.add(name)

        // Level
        const level = this.scene.add.text(10, y + 28, `Lv. ${monster.level}`, {
          ...TEXT_STYLES.SMALL,
          fontSize: '12px',
          color: '#b0bec5',
        })
        this.container.add(level)

        // Element dot
        const elemColor = this.getElementColor(species?.element ?? 'neutral')
        const dot = this.scene.add.graphics()
        dot.fillStyle(elemColor, 1)
        dot.fillCircle(SQUAD_SLOT_WIDTH - 15, y + 18, 6)
        this.container.add(dot)

        // HP bar
        const hpRatio = monster.stats.maxHp > 0 ? monster.stats.currentHp / monster.stats.maxHp : 0
        const hpColor = hpRatio > 0.5 ? COLORS.HP_GREEN : hpRatio > 0.25 ? COLORS.HP_YELLOW : COLORS.HP_RED

        const hpBg = this.scene.add.graphics()
        hpBg.fillStyle(0x333333, 1)
        hpBg.fillRoundedRect(10, y + 48, 140, 8, 3)
        this.container.add(hpBg)

        const hpFill = this.scene.add.graphics()
        hpFill.fillStyle(hpColor, 1)
        hpFill.fillRoundedRect(10, y + 48, 140 * hpRatio, 8, 3)
        this.container.add(hpFill)

        // Bond heart indicator
        const bondPercent = monster.bondLevel / 100
        const heartColor = bondPercent > 0.7 ? COLORS.DANGER : bondPercent > 0.3 ? COLORS.WARNING : 0x666666
        const heart = this.scene.add.text(SQUAD_SLOT_WIDTH - 15, y + 45, '♥', {
          fontSize: '14px',
          color: '#' + heartColor.toString(16).padStart(6, '0'),
        })
        heart.setOrigin(0.5)
        this.container.add(heart)

        // Click handler
        const hitArea = this.scene.add.rectangle(SQUAD_SLOT_WIDTH / 2, y + SQUAD_SLOT_HEIGHT / 2, SQUAD_SLOT_WIDTH, SQUAD_SLOT_HEIGHT)
        hitArea.setInteractive({ useHandCursor: true })
        hitArea.on('pointerdown', () => {
          this.selectedMonster = monster
          this.selectedFromStorage = false
          this.refresh()
        })
        this.container.add(hitArea)
      } else {
        // Empty slot
        const empty = this.scene.add.text(SQUAD_SLOT_WIDTH / 2, y + SQUAD_SLOT_HEIGHT / 2, '- Empty -', {
          ...TEXT_STYLES.SMALL,
          fontSize: '12px',
          color: '#666666',
        })
        empty.setOrigin(0.5)
        this.container.add(empty)
      }
    }
  }

  private refreshDetail(): void {
    this.detailContainer.removeAll(true)

    if (!this.selectedMonster) {
      const hint = this.scene.add.text(0, 30, 'Select a monster\nto see details', {
        ...TEXT_STYLES.BODY,
        fontSize: '16px',
        color: '#666666',
      })
      this.detailContainer.add(hint)
      return
    }

    const monster = this.selectedMonster
    const species = getSpecies(monster.speciesId)
    const bondedStats = applyBondBonus(monster)

    // Background
    const bg = this.scene.add.graphics()
    bg.fillStyle(COLORS.PANEL_BG, 0.6)
    bg.fillRoundedRect(0, 0, DETAIL_WIDTH, 380, 10)
    this.detailContainer.add(bg)

    // Name and level
    const displayName = monster.nickname ?? species?.name ?? 'Unknown'
    const name = this.scene.add.text(15, 15, displayName, {
      ...TEXT_STYLES.BODY,
      fontSize: '20px',
    })
    this.detailContainer.add(name)

    const levelText = this.scene.add.text(15, 40, `Level ${monster.level}  |  ${species?.element ?? 'neutral'}`, {
      ...TEXT_STYLES.SMALL,
      fontSize: '12px',
      color: '#b0bec5',
    })
    this.detailContainer.add(levelText)

    // XP progress bar
    const xpY = 58
    const xpLabel = this.scene.add.text(15, xpY, 'XP:', {
      ...TEXT_STYLES.SMALL,
      fontSize: '11px',
      color: '#90caf9',
    })
    this.detailContainer.add(xpLabel)

    const xpToNext = getXpToNextLevel(monster.level) || 1
    const xpRatio = Math.min(monster.experience / xpToNext, 1)

    const xpBg = this.scene.add.graphics()
    xpBg.fillStyle(0x333333, 1)
    xpBg.fillRoundedRect(45, xpY + 2, 180, 10, 4)
    this.detailContainer.add(xpBg)

    const xpFill = this.scene.add.graphics()
    xpFill.fillStyle(0x64b5f6, 1)
    xpFill.fillRoundedRect(45, xpY + 2, 180 * xpRatio, 10, 4)
    this.detailContainer.add(xpFill)

    const xpPercent = Math.floor(xpRatio * 100)
    const xpText = this.scene.add.text(235, xpY, `${monster.experience}/${xpToNext} (${xpPercent}%)`, {
      ...TEXT_STYLES.SMALL,
      fontSize: '11px',
      color: '#90caf9',
    })
    this.detailContainer.add(xpText)

    // Stats with bond bonus shown in green
    const statsY = 85
    const stats = [
      { label: 'HP', base: monster.stats.maxHp, bonded: bondedStats.maxHp },
      { label: 'MP', base: monster.stats.maxMp, bonded: bondedStats.maxMp },
      { label: 'ATK', base: monster.stats.attack, bonded: bondedStats.attack },
      { label: 'DEF', base: monster.stats.defense, bonded: bondedStats.defense },
      { label: 'M.ATK', base: monster.stats.magicAttack, bonded: bondedStats.magicAttack },
      { label: 'M.DEF', base: monster.stats.magicDefense, bonded: bondedStats.magicDefense },
      { label: 'SPD', base: monster.stats.speed, bonded: bondedStats.speed },
    ]

    stats.forEach((stat, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const x = 15 + col * 170
      const y = statsY + row * 25

      const hasBonus = stat.bonded > stat.base
      const text = this.scene.add.text(x, y, `${stat.label}: ${stat.bonded}`, {
        ...TEXT_STYLES.SMALL,
        fontSize: '13px',
        color: hasBonus ? '#66bb6a' : '#ffffff',
      })
      this.detailContainer.add(text)
    })

    // Bond bar
    const bondY = statsY + 110
    const bondLabel = this.scene.add.text(15, bondY, 'Bond:', {
      ...TEXT_STYLES.SMALL,
      fontSize: '13px',
    })
    this.detailContainer.add(bondLabel)

    const bondBg = this.scene.add.graphics()
    bondBg.fillStyle(0x333333, 1)
    bondBg.fillRoundedRect(70, bondY + 2, 150, 12, 4)
    this.detailContainer.add(bondBg)

    const bondFill = this.scene.add.graphics()
    bondFill.fillStyle(COLORS.DANGER, 1)
    bondFill.fillRoundedRect(70, bondY + 2, 150 * (monster.bondLevel / 100), 12, 4)
    this.detailContainer.add(bondFill)

    const bondText = this.scene.add.text(230, bondY, `${monster.bondLevel}%`, {
      ...TEXT_STYLES.SMALL,
      fontSize: '12px',
    })
    this.detailContainer.add(bondText)

    // Abilities
    const abilitiesY = bondY + 35
    const abilitiesLabel = this.scene.add.text(15, abilitiesY, 'Abilities:', {
      ...TEXT_STYLES.SMALL,
      fontSize: '13px',
      color: '#b0bec5',
    })
    this.detailContainer.add(abilitiesLabel)

    monster.learnedAbilities.slice(0, 4).forEach((ability, i) => {
      const abilityText = this.scene.add.text(15, abilitiesY + 20 + i * 18, `• ${ability.name}`, {
        ...TEXT_STYLES.SMALL,
        fontSize: '12px',
      })
      this.detailContainer.add(abilityText)
    })

    // Action buttons
    const buttonsY = 330

    if (this.selectedFromStorage) {
      // Add to squad button (only if squad not full)
      const state = getGameState(this.scene)
      if (state.squad.length < MAX_SQUAD_SIZE) {
        const addBtn = this.createActionButton(15, buttonsY, 'Add to Squad', COLORS.SUCCESS, () => {
          this.handleAddToSquad()
        })
        this.detailContainer.add(addBtn)
      }
    } else {
      // Remove from squad button
      const removeBtn = this.createActionButton(15, buttonsY, 'Remove', COLORS.DANGER, () => {
        this.handleRemoveFromSquad()
      })
      this.detailContainer.add(removeBtn)
    }

    // Nickname button
    const nicknameBtn = this.createActionButton(130, buttonsY, 'Nickname', COLORS.PRIMARY, () => {
      this.handleSetNickname()
    })
    this.detailContainer.add(nicknameBtn)
  }

  private refreshStorageList(): void {
    // Clear previous elements (keep header at index 0)
    const children = this.storageContainer.getAll()
    for (let i = children.length - 1; i >= 1; i--) {
      (children[i] as Phaser.GameObjects.GameObject).destroy()
    }

    const state = getGameState(this.scene)
    const storage = state.monsterStorage

    // Storage count
    const countText = this.scene.add.text(0, 22, `${storage.length} monsters`, {
      ...TEXT_STYLES.SMALL,
      fontSize: '12px',
      color: '#b0bec5',
    })
    this.storageContainer.add(countText)

    // Storage list (scrollable)
    const visibleCount = 5
    const slotHeight = 50

    storage.slice(this.storageScrollOffset, this.storageScrollOffset + visibleCount).forEach((monster, i) => {
      const y = 45 + i * (slotHeight + 5)
      const isSelected = this.selectedMonster?.instanceId === monster.instanceId && this.selectedFromStorage

      const bg = this.scene.add.graphics()
      bg.fillStyle(isSelected ? COLORS.SECONDARY : COLORS.PANEL_BG, isSelected ? 0.6 : 0.4)
      bg.fillRoundedRect(0, y, STORAGE_PANEL_WIDTH - 50, slotHeight, 6)
      this.storageContainer.add(bg)

      const species = getSpecies(monster.speciesId)
      const displayName = monster.nickname ?? species?.name ?? 'Unknown'

      const name = this.scene.add.text(10, y + 8, displayName, {
        ...TEXT_STYLES.SMALL,
        fontSize: '13px',
      })
      this.storageContainer.add(name)

      const level = this.scene.add.text(10, y + 28, `Lv. ${monster.level}`, {
        ...TEXT_STYLES.SMALL,
        fontSize: '11px',
        color: '#b0bec5',
      })
      this.storageContainer.add(level)

      // Element dot
      const elemColor = this.getElementColor(species?.element ?? 'neutral')
      const dot = this.scene.add.graphics()
      dot.fillStyle(elemColor, 1)
      dot.fillCircle(STORAGE_PANEL_WIDTH - 70, y + slotHeight / 2, 5)
      this.storageContainer.add(dot)

      // Click handler
      const hitArea = this.scene.add.rectangle(
        (STORAGE_PANEL_WIDTH - 50) / 2,
        y + slotHeight / 2,
        STORAGE_PANEL_WIDTH - 50,
        slotHeight,
      )
      hitArea.setInteractive({ useHandCursor: true })
      hitArea.on('pointerdown', () => {
        this.selectedMonster = monster
        this.selectedFromStorage = true
        this.refresh()
      })
      this.storageContainer.add(hitArea)
    })

    // Scroll buttons if needed
    if (storage.length > visibleCount) {
      if (this.storageScrollOffset > 0) {
        const upBtn = this.scene.add.text(STORAGE_PANEL_WIDTH / 2 - 25, 45, '▲', {
          fontSize: '16px',
          color: '#ffffff',
        })
        upBtn.setInteractive({ useHandCursor: true })
        upBtn.on('pointerdown', () => {
          this.storageScrollOffset = Math.max(0, this.storageScrollOffset - 1)
          this.refreshStorageList()
        })
        this.storageContainer.add(upBtn)
      }

      if (this.storageScrollOffset + visibleCount < storage.length) {
        const downBtn = this.scene.add.text(STORAGE_PANEL_WIDTH / 2 - 25, 45 + visibleCount * (slotHeight + 5), '▼', {
          fontSize: '16px',
          color: '#ffffff',
        })
        downBtn.setInteractive({ useHandCursor: true })
        downBtn.on('pointerdown', () => {
          this.storageScrollOffset++
          this.refreshStorageList()
        })
        this.storageContainer.add(downBtn)
      }
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
    bg.fillRoundedRect(0, 0, 100, 32, 6)
    container.add(bg)

    const text = this.scene.add.text(50, 16, label, {
      ...TEXT_STYLES.SMALL,
      fontSize: '12px',
    })
    text.setOrigin(0.5)
    container.add(text)

    const hitArea = this.scene.add.rectangle(50, 16, 100, 32)
    hitArea.setInteractive({ useHandCursor: true })
    hitArea.on('pointerdown', onClick)
    container.add(hitArea)

    return container
  }

  private handleRemoveFromSquad(): void {
    if (!this.selectedMonster || this.selectedFromStorage) return

    const state = getGameState(this.scene)
    const result = moveToStorage(state.squad, state.monsterStorage, this.selectedMonster.instanceId)

    if (result) {
      setGameState(this.scene, {
        ...state,
        squad: result.squad,
        monsterStorage: result.storage,
      })
      this.selectedMonster = null
      this.refresh()
    }
  }

  private handleAddToSquad(): void {
    if (!this.selectedMonster || !this.selectedFromStorage) return

    const state = getGameState(this.scene)
    const result = moveToSquad(state.squad, state.monsterStorage, this.selectedMonster.instanceId)

    if (result) {
      setGameState(this.scene, {
        ...state,
        squad: result.squad,
        monsterStorage: result.storage,
      })
      this.selectedMonster = null
      this.refresh()
    }
  }

  private handleSetNickname(): void {
    if (!this.selectedMonster) return

    // For simplicity, just toggle between nickname and null
    // A full implementation would show a text input dialog
    const newNickname = this.selectedMonster.nickname ? null : 'Fluffy'

    const state = getGameState(this.scene)
    if (this.selectedFromStorage) {
      const updated = setStorageMonsterNickname(state.monsterStorage, this.selectedMonster.instanceId, newNickname)
      setGameState(this.scene, updateMonsterStorage(state, updated))
      this.selectedMonster = updated.find((m) => m.instanceId === this.selectedMonster?.instanceId) ?? null
    } else {
      const updated = setMonsterNickname(state.squad, this.selectedMonster.instanceId, newNickname)
      setGameState(this.scene, updateSquad(state, updated))
      this.selectedMonster = updated.find((m) => m.instanceId === this.selectedMonster?.instanceId) ?? null
    }

    this.refresh()
  }

  private getElementColor(element: string): number {
    const colors: Record<string, number> = {
      fire: 0xef5350,
      water: 0x42a5f5,
      earth: 0x8d6e63,
      wind: 0x66bb6a,
      light: 0xffd54f,
      dark: 0x7e57c2,
      neutral: 0xbdbdbd,
    }
    return colors[element] ?? 0xbdbdbd
  }

  destroy(): void {
    this.container.destroy()
    this.detailContainer.destroy()
    this.storageContainer.destroy()
  }
}
