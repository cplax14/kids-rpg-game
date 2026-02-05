import Phaser from 'phaser'
import type { MonsterSpecies } from '../../models/types'
import { COLORS, TEXT_STYLES, DEPTH } from '../../config'
import { getGameState } from '../../systems/GameStateManager'
import { getAllSpecies, getSpecies } from '../../systems/MonsterSystem'
import {
  isSpeciesDiscovered,
  getDiscoveryProgress,
  sortDiscoveredByElement,
} from '../../systems/BestiarySystem'

const GRID_COLS = 5
const CELL_SIZE = 70
const DETAIL_WIDTH = 400

export class BestiaryPanel {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private detailContainer: Phaser.GameObjects.Container
  private selectedSpecies: MonsterSpecies | null = null
  private scrollOffset: number = 0

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene
    this.container = scene.add.container(x, y)
    this.container.setDepth(DEPTH.OVERLAY + 2)

    this.detailContainer = scene.add.container(x + GRID_COLS * (CELL_SIZE + 8) + 30, y)
    this.detailContainer.setDepth(DEPTH.OVERLAY + 2)

    this.createHeader()
    this.refreshGrid()
    this.refreshDetail()
  }

  private createHeader(): void {
    const state = getGameState(this.scene)
    const progress = getDiscoveryProgress(state.discoveredSpecies)

    const progressText = this.scene.add.text(0, 0, `Discovered: ${progress.discovered}/${progress.total} (${progress.percentage}%)`, {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      color: '#ffd54f',
    })
    this.container.add(progressText)
  }

  refresh(): void {
    this.refreshGrid()
    this.refreshDetail()
  }

  private refreshGrid(): void {
    // Clear previous grid elements (keep header at index 0)
    const children = this.container.getAll()
    for (let i = children.length - 1; i >= 1; i--) {
      (children[i] as Phaser.GameObjects.GameObject).destroy()
    }

    const state = getGameState(this.scene)
    const allSpecies = getAllSpecies()

    // Calculate visible rows
    const visibleRows = 5
    const startIndex = this.scrollOffset * GRID_COLS
    const endIndex = Math.min(startIndex + visibleRows * GRID_COLS, allSpecies.length)

    for (let i = startIndex; i < endIndex; i++) {
      const species = allSpecies[i]
      const localIndex = i - startIndex
      const col = localIndex % GRID_COLS
      const row = Math.floor(localIndex / GRID_COLS)
      const cellX = col * (CELL_SIZE + 8)
      const cellY = 30 + row * (CELL_SIZE + 8)

      const discovered = isSpeciesDiscovered(state.discoveredSpecies, species.speciesId)
      const isSelected = this.selectedSpecies?.speciesId === species.speciesId

      const bg = this.scene.add.graphics()
      if (discovered) {
        bg.fillStyle(isSelected ? COLORS.PRIMARY : this.getElementColor(species.element), isSelected ? 0.7 : 0.4)
      } else {
        bg.fillStyle(0x333333, 0.4)
      }
      bg.fillRoundedRect(cellX, cellY, CELL_SIZE, CELL_SIZE, 8)
      bg.lineStyle(1, isSelected ? COLORS.PRIMARY : 0x555555)
      bg.strokeRoundedRect(cellX, cellY, CELL_SIZE, CELL_SIZE, 8)
      this.container.add(bg)

      if (discovered) {
        // Show species name
        const shortName = species.name.length > 8 ? species.name.substring(0, 7) + '...' : species.name
        const name = this.scene.add.text(cellX + CELL_SIZE / 2, cellY + CELL_SIZE / 2, shortName, {
          ...TEXT_STYLES.SMALL,
          fontSize: '11px',
        })
        name.setOrigin(0.5)
        this.container.add(name)

        // Rarity indicator
        const rarityColor = this.getRarityColor(species.rarity)
        const dot = this.scene.add.graphics()
        dot.fillStyle(rarityColor, 1)
        dot.fillCircle(cellX + CELL_SIZE - 10, cellY + 10, 4)
        this.container.add(dot)
      } else {
        // Show ??? for undiscovered
        const unknown = this.scene.add.text(cellX + CELL_SIZE / 2, cellY + CELL_SIZE / 2, '???', {
          ...TEXT_STYLES.SMALL,
          fontSize: '14px',
          color: '#555555',
        })
        unknown.setOrigin(0.5)
        this.container.add(unknown)
      }

      // Click handler (only for discovered)
      if (discovered) {
        const hitArea = this.scene.add.rectangle(cellX + CELL_SIZE / 2, cellY + CELL_SIZE / 2, CELL_SIZE, CELL_SIZE)
        hitArea.setInteractive({ useHandCursor: true })
        hitArea.on('pointerdown', () => {
          this.selectedSpecies = species
          this.refresh()
        })
        this.container.add(hitArea)
      }
    }

    // Scroll buttons if needed
    const totalRows = Math.ceil(allSpecies.length / GRID_COLS)
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

    if (!this.selectedSpecies) {
      const hint = this.scene.add.text(0, 30, 'Select a discovered\nspecies to see details', {
        ...TEXT_STYLES.BODY,
        fontSize: '16px',
        color: '#666666',
      })
      this.detailContainer.add(hint)
      return
    }

    const species = this.selectedSpecies

    // Background
    const bg = this.scene.add.graphics()
    bg.fillStyle(COLORS.PANEL_BG, 0.6)
    bg.fillRoundedRect(0, 0, DETAIL_WIDTH, 420, 10)
    this.detailContainer.add(bg)

    // Element color bar at top
    const elemBar = this.scene.add.graphics()
    elemBar.fillStyle(this.getElementColor(species.element), 0.8)
    elemBar.fillRoundedRect(0, 0, DETAIL_WIDTH, 8, { tl: 10, tr: 10, bl: 0, br: 0 })
    this.detailContainer.add(elemBar)

    // Name
    const name = this.scene.add.text(15, 20, species.name, {
      ...TEXT_STYLES.BODY,
      fontSize: '22px',
    })
    this.detailContainer.add(name)

    // Element and rarity
    const infoText = this.scene.add.text(15, 50, `${species.element.charAt(0).toUpperCase() + species.element.slice(1)}  |  ${species.rarity}`, {
      ...TEXT_STYLES.SMALL,
      fontSize: '13px',
      color: '#b0bec5',
    })
    this.detailContainer.add(infoText)

    // Description
    const desc = this.scene.add.text(15, 80, species.description, {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
      wordWrap: { width: DETAIL_WIDTH - 30 },
      color: '#cccccc',
    })
    this.detailContainer.add(desc)

    // Base Stats section
    const statsY = 140
    const statsLabel = this.scene.add.text(15, statsY, 'Base Stats', {
      ...TEXT_STYLES.SMALL,
      fontSize: '14px',
      color: '#ffd54f',
    })
    this.detailContainer.add(statsLabel)

    const stats = [
      { label: 'HP', value: species.baseStats.maxHp },
      { label: 'MP', value: species.baseStats.maxMp },
      { label: 'ATK', value: species.baseStats.attack },
      { label: 'DEF', value: species.baseStats.defense },
      { label: 'M.ATK', value: species.baseStats.magicAttack },
      { label: 'M.DEF', value: species.baseStats.magicDefense },
      { label: 'SPD', value: species.baseStats.speed },
      { label: 'LCK', value: species.baseStats.luck },
    ]

    stats.forEach((stat, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const x = 15 + col * 180
      const y = statsY + 25 + row * 22

      const text = this.scene.add.text(x, y, `${stat.label}: ${stat.value}`, {
        ...TEXT_STYLES.SMALL,
        fontSize: '13px',
      })
      this.detailContainer.add(text)
    })

    // Abilities section
    const abilitiesY = statsY + 120
    const abilitiesLabel = this.scene.add.text(15, abilitiesY, 'Learnable Abilities', {
      ...TEXT_STYLES.SMALL,
      fontSize: '14px',
      color: '#ffd54f',
    })
    this.detailContainer.add(abilitiesLabel)

    species.abilities.slice(0, 5).forEach((learnableAbility, i) => {
      const abilityText = this.scene.add.text(15, abilitiesY + 22 + i * 18, `Lv.${learnableAbility.learnAtLevel}: ${learnableAbility.abilityId}`, {
        ...TEXT_STYLES.SMALL,
        fontSize: '12px',
      })
      this.detailContainer.add(abilityText)
    })

    // Capture difficulty
    const captureY = abilitiesY + 120
    const difficultyText = species.captureBaseDifficulty > 0.7
      ? 'Very Hard'
      : species.captureBaseDifficulty > 0.5
        ? 'Hard'
        : species.captureBaseDifficulty > 0.3
          ? 'Medium'
          : 'Easy'
    const captureLabel = this.scene.add.text(15, captureY, `Capture Difficulty: ${difficultyText}`, {
      ...TEXT_STYLES.SMALL,
      fontSize: '13px',
      color: species.captureBaseDifficulty > 0.5 ? '#ef5350' : '#66bb6a',
    })
    this.detailContainer.add(captureLabel)

    // Evolution info
    if (species.evolutionChain) {
      const evoText = this.scene.add.text(15, captureY + 22, `Evolves to: ${species.evolutionChain.evolvesTo} at Lv.${species.evolutionChain.levelRequired}`, {
        ...TEXT_STYLES.SMALL,
        fontSize: '12px',
        color: '#42a5f5',
      })
      this.detailContainer.add(evoText)
    }
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

  private getRarityColor(rarity: string): number {
    const colors: Record<string, number> = {
      common: 0xbdbdbd,
      uncommon: 0x66bb6a,
      rare: 0x42a5f5,
      legendary: 0xffd54f,
    }
    return colors[rarity] ?? 0xbdbdbd
  }

  destroy(): void {
    this.container.destroy()
    this.detailContainer.destroy()
  }
}
