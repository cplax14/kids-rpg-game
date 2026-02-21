import Phaser from 'phaser'
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, COLORS, DEPTH, TEXT_STYLES } from '../config'
import { getGameState, setGameState, updatePlayer, updateSquad, updateMonsterStorage } from '../systems/GameStateManager'
import { updatePlayerStardust } from '../systems/CharacterSystem'
import { getSpecies, transformMonster } from '../systems/MonsterSystem'
import { canEvolve, executeEvolution, getEvolutionPreview, getChainForSpecies } from '../systems/EvolutionSystem'
import { getMonsterIconKey, getMonsterBattleKey } from '../config/spriteMapping'
import { EventBus } from '../events/EventBus'
import { GAME_EVENTS } from '../events/GameEvents'
import type { MonsterInstance, CharacterStats } from '../models/types'
import { initAudioSystem, playSfx, SFX_KEYS } from '../systems/AudioSystem'

const PANEL_X = 80
const PANEL_Y = 40
const PANEL_W = GAME_WIDTH - 160
const PANEL_H = GAME_HEIGHT - 80
const LIST_W = 320
const DETAIL_X = PANEL_X + LIST_W + 20

export class EvolutionScene extends Phaser.Scene {
  private selectedIndex: number = 0
  private eligibleMonsters: ReadonlyArray<MonsterInstance> = []
  private listContainer!: Phaser.GameObjects.Container
  private detailContainer!: Phaser.GameObjects.Container
  private stardustText!: Phaser.GameObjects.Text
  private messageText!: Phaser.GameObjects.Text
  private evolveButton!: Phaser.GameObjects.Container
  private isEvolving: boolean = false

  constructor() {
    super({ key: SCENE_KEYS.EVOLUTION })
  }

  create(): void {
    this.selectedIndex = 0
    this.isEvolving = false

    initAudioSystem(this)
    this.createBackground()
    this.createHeader()
    this.createMonsterList()
    this.createDetailPanel()
    this.createMessageBar()
    this.loadAllMonsters()
    this.setupInput()
  }

  private createBackground(): void {
    const bg = this.add.graphics()
    bg.fillStyle(0x000000, 0.7)
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    bg.setDepth(DEPTH.OVERLAY)

    const panel = this.add.graphics()
    panel.fillStyle(COLORS.DARK_BG, 0.95)
    panel.fillRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 16)
    panel.lineStyle(2, COLORS.SECONDARY)
    panel.strokeRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 16)
    panel.setDepth(DEPTH.OVERLAY)
  }

  private createHeader(): void {
    const container = this.add.container(PANEL_X + 15, PANEL_Y + 12)
    container.setDepth(DEPTH.OVERLAY + 1)

    const title = this.add.text(0, 0, 'Evolution Chamber', {
      ...TEXT_STYLES.HEADING,
      fontSize: '24px',
      color: '#ce93d8',
    })
    container.add(title)

    const state = getGameState(this)
    this.stardustText = this.add.text(PANEL_W - 180, 4, `Stardust: ${state.player.stardust}`, {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      color: '#ce93d8',
    })
    container.add(this.stardustText)

    const closeHint = this.add.text(PANEL_W - 40, 4, 'ESC', {
      ...TEXT_STYLES.SMALL,
      fontSize: '12px',
      color: '#888888',
    })
    container.add(closeHint)
  }

  private createMonsterList(): void {
    this.listContainer = this.add.container(PANEL_X + 10, PANEL_Y + 50)
    this.listContainer.setDepth(DEPTH.OVERLAY + 1)

    const listBg = this.add.graphics()
    listBg.fillStyle(COLORS.PANEL_BG, 0.8)
    listBg.fillRoundedRect(0, 0, LIST_W, PANEL_H - 100, 8)
    this.listContainer.add(listBg)

    const listTitle = this.add.text(10, 8, 'Your Monsters', {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
      color: '#b0bec5',
    })
    this.listContainer.add(listTitle)
  }

  private createDetailPanel(): void {
    this.detailContainer = this.add.container(DETAIL_X, PANEL_Y + 50)
    this.detailContainer.setDepth(DEPTH.OVERLAY + 1)
  }

  private createMessageBar(): void {
    this.messageText = this.add.text(
      GAME_WIDTH / 2,
      PANEL_Y + PANEL_H - 25,
      '',
      { ...TEXT_STYLES.SMALL, fontSize: '13px', color: '#b0bec5' },
    )
    this.messageText.setOrigin(0.5)
    this.messageText.setDepth(DEPTH.OVERLAY + 1)
  }

  private loadAllMonsters(): void {
    const state = getGameState(this)
    this.eligibleMonsters = [...state.squad, ...state.monsterStorage]
    this.refreshList()
    this.refreshDetail()
  }

  private refreshList(): void {
    // Remove old list items (keep background and title)
    const toRemove = this.listContainer.list.filter(
      (_: Phaser.GameObjects.GameObject, i: number) => i > 1,
    ) as Phaser.GameObjects.GameObject[]
    toRemove.forEach((obj) => {
      this.listContainer.remove(obj, true)
    })

    const startY = 32
    const rowHeight = 52

    if (this.eligibleMonsters.length === 0) {
      const emptyText = this.add.text(LIST_W / 2, startY + 40, 'No monsters available', {
        ...TEXT_STYLES.BODY,
        fontSize: '14px',
        color: '#666666',
      })
      emptyText.setOrigin(0.5, 0)
      this.listContainer.add(emptyText)
      return
    }

    this.eligibleMonsters.forEach((monster, index) => {
      const y = startY + index * rowHeight
      const isSelected = index === this.selectedIndex
      const species = getSpecies(monster.speciesId)
      const evolutionCheck = canEvolve(monster, getGameState(this).player.stardust)

      // Row background
      const rowBg = this.add.graphics()
      if (isSelected) {
        rowBg.fillStyle(COLORS.SECONDARY, 0.3)
        rowBg.fillRoundedRect(5, y, LIST_W - 10, rowHeight - 4, 6)
      }
      this.listContainer.add(rowBg)

      // Monster icon
      const iconKey = getMonsterIconKey(monster.speciesId)
      if (this.textures.exists(iconKey)) {
        const icon = this.add.image(30, y + (rowHeight - 4) / 2, iconKey)
        icon.setDisplaySize(32, 32)
        this.listContainer.add(icon)
      }

      // Monster name and level
      const name = monster.nickname ?? species?.name ?? 'Unknown'
      const nameText = this.add.text(55, y + 6, name, {
        ...TEXT_STYLES.BODY,
        fontSize: '14px',
        color: isSelected ? '#ffffff' : '#e0e0e0',
      })
      this.listContainer.add(nameText)

      const state = getGameState(this)
      const isInSquad = state.squad.some((m) => m.instanceId === monster.instanceId)
      const sourceLabel = isInSquad ? 'Squad' : 'Storage'
      const sourceColor = isInSquad ? '#90caf9' : '#a5d6a7'

      const levelText = this.add.text(55, y + 24, `Lv. ${monster.level}`, {
        ...TEXT_STYLES.SMALL,
        fontSize: '11px',
        color: '#b0bec5',
      })
      this.listContainer.add(levelText)

      const srcText = this.add.text(110, y + 24, sourceLabel, {
        ...TEXT_STYLES.SMALL,
        fontSize: '10px',
        color: sourceColor,
      })
      this.listContainer.add(srcText)

      // Evolution status indicator
      let statusText = ''
      let statusColor = '#666666'
      if (evolutionCheck.canEvolve) {
        statusText = 'READY'
        statusColor = '#66bb6a'
      } else if (evolutionCheck.reason === 'already_max') {
        statusText = 'MAX'
        statusColor = '#ffd54f'
      } else if (evolutionCheck.reason === 'level_too_low') {
        statusText = `Lv.${evolutionCheck.requiredLevel}`
        statusColor = '#ef5350'
      } else if (evolutionCheck.reason === 'not_enough_stardust') {
        statusText = `${evolutionCheck.stardustCost} SD`
        statusColor = '#ce93d8'
      } else {
        statusText = 'N/A'
      }

      const status = this.add.text(LIST_W - 20, y + 14, statusText, {
        ...TEXT_STYLES.SMALL,
        fontSize: '12px',
        color: statusColor,
        fontStyle: 'bold',
      })
      status.setOrigin(1, 0.5)
      this.listContainer.add(status)

      // Click handler
      const hitArea = this.add.rectangle(LIST_W / 2, y + (rowHeight - 4) / 2, LIST_W - 10, rowHeight - 4)
      hitArea.setOrigin(0.5)
      hitArea.setInteractive({ useHandCursor: true })
      hitArea.setAlpha(0.01)
      hitArea.on('pointerdown', () => {
        if (this.isEvolving) return
        playSfx(SFX_KEYS.MENU_SELECT)
        this.selectedIndex = index
        this.refreshList()
        this.refreshDetail()
      })
      this.listContainer.add(hitArea)
    })
  }

  private refreshDetail(): void {
    // Clear detail panel
    this.detailContainer.removeAll(true)

    if (this.eligibleMonsters.length === 0 || this.selectedIndex >= this.eligibleMonsters.length) {
      const noSelect = this.add.text(200, 100, 'Select a monster to evolve', {
        ...TEXT_STYLES.BODY,
        fontSize: '16px',
        color: '#666666',
      })
      noSelect.setOrigin(0.5, 0)
      this.detailContainer.add(noSelect)
      return
    }

    const state = getGameState(this)
    const monster = this.eligibleMonsters[this.selectedIndex]
    const species = getSpecies(monster.speciesId)
    if (!species) return

    const evolutionCheck = canEvolve(monster, state.player.stardust)
    const detailW = PANEL_W - LIST_W - 40

    // Current monster display
    const currentLabel = this.add.text(detailW / 2, 0, species.name, {
      ...TEXT_STYLES.HEADING,
      fontSize: '20px',
    })
    currentLabel.setOrigin(0.5, 0)
    this.detailContainer.add(currentLabel)

    // Monster sprite (use battle sprite if available, else icon)
    const battleKey = getMonsterBattleKey(monster.speciesId)
    const spriteKey = battleKey && this.textures.exists(battleKey) ? battleKey : getMonsterIconKey(monster.speciesId)
    if (this.textures.exists(spriteKey)) {
      const sprite = this.add.image(detailW / 4, 90, spriteKey)
      const maxSize = 80
      const ratio = Math.min(maxSize / sprite.width, maxSize / sprite.height)
      sprite.setScale(ratio)
      this.detailContainer.add(sprite)
    }

    // Level and element
    const info = this.add.text(detailW / 4, 140, `Level ${monster.level}  |  ${species.element}`, {
      ...TEXT_STYLES.SMALL,
      fontSize: '12px',
      color: '#b0bec5',
    })
    info.setOrigin(0.5, 0)
    this.detailContainer.add(info)

    // Evolution arrow and target
    if (evolutionCheck.nextStage) {
      const nextSpecies = getSpecies(evolutionCheck.nextStage.speciesId)
      if (nextSpecies) {
        // Arrow
        const arrow = this.add.text(detailW / 2, 85, '>>>',  {
          ...TEXT_STYLES.HEADING,
          fontSize: '24px',
          color: '#ce93d8',
        })
        arrow.setOrigin(0.5)
        this.detailContainer.add(arrow)

        // Target monster sprite
        const targetBattleKey = getMonsterBattleKey(nextSpecies.speciesId)
        const targetSpriteKey = targetBattleKey && this.textures.exists(targetBattleKey)
          ? targetBattleKey
          : getMonsterIconKey(nextSpecies.speciesId)
        if (this.textures.exists(targetSpriteKey)) {
          const targetSprite = this.add.image((detailW * 3) / 4, 90, targetSpriteKey)
          const maxSize = 80
          const ratio = Math.min(maxSize / targetSprite.width, maxSize / targetSprite.height)
          targetSprite.setScale(ratio)
          this.detailContainer.add(targetSprite)
        }

        // Target name
        const targetLabel = this.add.text((detailW * 3) / 4, 140, nextSpecies.name, {
          ...TEXT_STYLES.SMALL,
          fontSize: '12px',
          color: '#ce93d8',
        })
        targetLabel.setOrigin(0.5, 0)
        this.detailContainer.add(targetLabel)

        // Stats comparison
        const preview = getEvolutionPreview(monster, nextSpecies)
        this.renderStatsComparison(preview.currentStats, preview.projectedStats, 0, 170, detailW)

        // Stardust cost
        const costY = 400
        const costText = this.add.text(detailW / 2, costY, `Cost: ${evolutionCheck.stardustCost} Stardust`, {
          ...TEXT_STYLES.BODY,
          fontSize: '16px',
          color: '#ce93d8',
        })
        costText.setOrigin(0.5, 0)
        this.detailContainer.add(costText)

        const reqText = this.add.text(detailW / 2, costY + 22, `Required Level: ${evolutionCheck.requiredLevel}`, {
          ...TEXT_STYLES.SMALL,
          fontSize: '12px',
          color: '#b0bec5',
        })
        reqText.setOrigin(0.5, 0)
        this.detailContainer.add(reqText)

        // Evolve button
        this.createEvolveButton(detailW / 2, costY + 55, evolutionCheck.canEvolve)
      }
    } else {
      // No evolution available
      const chain = getChainForSpecies(monster.speciesId)
      const noEvoMsg = chain
        ? 'This monster has reached its final form!'
        : 'No evolution chain exists for this monster.'
      const noEvo = this.add.text(detailW / 2, 180, noEvoMsg, {
        ...TEXT_STYLES.BODY,
        fontSize: '14px',
        color: '#ffd54f',
        wordWrap: { width: detailW - 40 },
        align: 'center',
      })
      noEvo.setOrigin(0.5, 0)
      this.detailContainer.add(noEvo)

      // Show current stats only
      this.renderCurrentStats(monster.stats, 0, 220, detailW)
    }

    // Update message bar
    if (!evolutionCheck.canEvolve && evolutionCheck.reason) {
      const messages: Record<string, string> = {
        level_too_low: `Monster needs to reach level ${evolutionCheck.requiredLevel} first.`,
        not_enough_stardust: `Need ${evolutionCheck.stardustCost} stardust. You have ${state.player.stardust}.`,
        no_evolution: 'This monster cannot evolve.',
        already_max: 'This monster has reached its final evolution!',
      }
      this.messageText.setText(messages[evolutionCheck.reason] ?? '')
    } else if (evolutionCheck.canEvolve) {
      this.messageText.setText('Press ENTER or click Evolve to transform this monster!')
    } else {
      this.messageText.setText('')
    }
  }

  private renderStatsComparison(
    current: CharacterStats,
    projected: CharacterStats,
    x: number,
    y: number,
    width: number,
  ): void {
    const stats: Array<{ label: string; key: keyof CharacterStats }> = [
      { label: 'HP', key: 'maxHp' },
      { label: 'MP', key: 'maxMp' },
      { label: 'ATK', key: 'attack' },
      { label: 'DEF', key: 'defense' },
      { label: 'M.ATK', key: 'magicAttack' },
      { label: 'M.DEF', key: 'magicDefense' },
      { label: 'SPD', key: 'speed' },
    ]

    const headerY = y
    const colLabel = x + 10
    const colCurrent = x + width / 2 - 30
    const colArrow = x + width / 2 + 10
    const colNew = x + width / 2 + 40

    // Headers
    const hCurrent = this.add.text(colCurrent, headerY, 'Now', {
      ...TEXT_STYLES.SMALL, fontSize: '11px', color: '#b0bec5',
    })
    hCurrent.setOrigin(0.5, 0)
    this.detailContainer.add(hCurrent)

    const hNew = this.add.text(colNew, headerY, 'After', {
      ...TEXT_STYLES.SMALL, fontSize: '11px', color: '#ce93d8',
    })
    hNew.setOrigin(0, 0)
    this.detailContainer.add(hNew)

    stats.forEach((stat, i) => {
      const rowY = headerY + 18 + i * 26

      // Stat label
      const label = this.add.text(colLabel, rowY, stat.label, {
        ...TEXT_STYLES.SMALL, fontSize: '12px', color: '#e0e0e0',
      })
      this.detailContainer.add(label)

      // Current value
      const curVal = current[stat.key]
      const curText = this.add.text(colCurrent, rowY, `${curVal}`, {
        ...TEXT_STYLES.SMALL, fontSize: '12px', color: '#ffffff',
      })
      curText.setOrigin(0.5, 0)
      this.detailContainer.add(curText)

      // Arrow
      const arrowText = this.add.text(colArrow, rowY, '>', {
        ...TEXT_STYLES.SMALL, fontSize: '12px', color: '#888888',
      })
      arrowText.setOrigin(0.5, 0)
      this.detailContainer.add(arrowText)

      // Projected value with color coding
      const newVal = projected[stat.key]
      const diff = newVal - curVal
      let color = '#ffffff'
      if (diff > 0) color = '#66bb6a'
      else if (diff < 0) color = '#ef5350'

      const newText = this.add.text(colNew, rowY, `${newVal}`, {
        ...TEXT_STYLES.SMALL, fontSize: '12px', color,
      })
      this.detailContainer.add(newText)

      // Diff indicator
      if (diff !== 0) {
        const diffStr = diff > 0 ? `+${diff}` : `${diff}`
        const diffText = this.add.text(colNew + 50, rowY, diffStr, {
          ...TEXT_STYLES.SMALL, fontSize: '10px', color,
        })
        this.detailContainer.add(diffText)
      }
    })
  }

  private renderCurrentStats(stats: CharacterStats, x: number, y: number, width: number): void {
    const statEntries: Array<{ label: string; key: keyof CharacterStats }> = [
      { label: 'HP', key: 'maxHp' },
      { label: 'MP', key: 'maxMp' },
      { label: 'ATK', key: 'attack' },
      { label: 'DEF', key: 'defense' },
      { label: 'M.ATK', key: 'magicAttack' },
      { label: 'M.DEF', key: 'magicDefense' },
      { label: 'SPD', key: 'speed' },
    ]

    statEntries.forEach((stat, i) => {
      const rowY = y + i * 22
      const label = this.add.text(x + 10, rowY, stat.label, {
        ...TEXT_STYLES.SMALL, fontSize: '12px', color: '#b0bec5',
      })
      this.detailContainer.add(label)

      const val = this.add.text(x + width / 2, rowY, `${stats[stat.key]}`, {
        ...TEXT_STYLES.SMALL, fontSize: '12px', color: '#ffffff',
      })
      val.setOrigin(0.5, 0)
      this.detailContainer.add(val)
    })
  }

  private createEvolveButton(x: number, y: number, enabled: boolean): void {
    const btn = this.add.container(x, y)

    const bg = this.add.graphics()
    const btnColor = enabled ? COLORS.SECONDARY : 0x555555
    bg.fillStyle(btnColor, enabled ? 1 : 0.5)
    bg.fillRoundedRect(-70, -16, 140, 32, 8)
    if (enabled) {
      bg.lineStyle(2, 0xce93d8, 0.6)
      bg.strokeRoundedRect(-70, -16, 140, 32, 8)
    }
    btn.add(bg)

    const label = this.add.text(0, 0, 'Evolve!', {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      fontStyle: 'bold',
      color: enabled ? '#ffffff' : '#888888',
    })
    label.setOrigin(0.5)
    btn.add(label)

    if (enabled) {
      const hitArea = this.add.rectangle(0, 0, 140, 32)
      hitArea.setInteractive({ useHandCursor: true })
      hitArea.setAlpha(0.01)
      hitArea.on('pointerdown', () => this.performEvolution())
      btn.add(hitArea)
    }

    this.evolveButton = btn
    this.detailContainer.add(btn)
  }

  private performEvolution(): void {
    if (this.isEvolving) return
    if (this.selectedIndex >= this.eligibleMonsters.length) return

    const state = getGameState(this)
    const monster = this.eligibleMonsters[this.selectedIndex]
    const evolutionCheck = canEvolve(monster, state.player.stardust)
    if (!evolutionCheck.canEvolve || !evolutionCheck.nextStage) return

    const nextSpecies = getSpecies(evolutionCheck.nextStage.speciesId)
    if (!nextSpecies) return

    this.isEvolving = true
    playSfx(SFX_KEYS.EVOLUTION_START)
    this.messageText.setText('Evolving...')

    // Execute evolution logic
    const result = executeEvolution(monster, evolutionCheck.nextStage, nextSpecies)

    // Build the transform result
    const transformResult = transformMonster(
      monster,
      result.newSpeciesId,
      (monster.evolutionStage ?? 0) + 1,
    )

    // Deduct stardust
    const updatedPlayer = updatePlayerStardust(state.player, -result.stardustSpent)

    // Update the correct list (squad or storage) with evolved monster
    const isInSquad = state.squad.some((m) => m.instanceId === monster.instanceId)
    let newState = updatePlayer(state, updatedPlayer)

    if (isInSquad) {
      const updatedSquad = state.squad.map((m) =>
        m.instanceId === monster.instanceId ? transformResult.monster : m,
      )
      newState = updateSquad(newState, updatedSquad)
    } else {
      const updatedStorage = state.monsterStorage.map((m) =>
        m.instanceId === monster.instanceId ? transformResult.monster : m,
      )
      newState = updateMonsterStorage(newState, updatedStorage)
    }

    setGameState(this, newState)

    // Emit events
    EventBus.emit(GAME_EVENTS.EVOLUTION_COMPLETE, { result })

    // Play evolution animation
    this.playEvolutionAnimation(monster.speciesId, result.newSpeciesId, result.bonusTrait, () => {
      playSfx(SFX_KEYS.EVOLUTION_COMPLETE)
      this.isEvolving = false
      this.loadAllMonsters()
      this.stardustText.setText(`Stardust: ${getGameState(this).player.stardust}`)

      const bonusMsg = result.bonusTrait ? ` Bonus trait: ${result.bonusTrait}!` : ''
      this.messageText.setText(`Evolution complete! ${nextSpecies.name} emerged!${bonusMsg}`)
    })
  }

  private playEvolutionAnimation(
    _oldSpeciesId: string,
    _newSpeciesId: string,
    bonusTrait: string | null,
    onComplete: () => void,
  ): void {
    // Flash white overlay
    const flash = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0)
    flash.setOrigin(0)
    flash.setDepth(DEPTH.OVERLAY + 10)

    // Sparkle particles around the detail area
    const centerX = DETAIL_X + (PANEL_W - LIST_W - 40) / 2
    const centerY = PANEL_Y + 140

    this.tweens.add({
      targets: flash,
      alpha: { from: 0, to: 0.8 },
      duration: 400,
      yoyo: true,
      hold: 300,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        flash.destroy()

        // Show sparkle effects
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2
          const dist = 60 + Math.random() * 40
          const sparkle = this.add.circle(
            centerX + Math.cos(angle) * dist,
            centerY + Math.sin(angle) * dist,
            3 + Math.random() * 3,
            0xce93d8,
            0.9,
          )
          sparkle.setDepth(DEPTH.OVERLAY + 5)

          this.tweens.add({
            targets: sparkle,
            alpha: 0,
            scaleX: 0,
            scaleY: 0,
            x: centerX + Math.cos(angle) * (dist + 50),
            y: centerY + Math.sin(angle) * (dist + 50),
            duration: 600 + Math.random() * 400,
            ease: 'Power2',
            onComplete: () => sparkle.destroy(),
          })
        }

        // Show bonus trait text if applicable
        if (bonusTrait) {
          const traitText = this.add.text(centerX, centerY - 30, `+ ${bonusTrait}!`, {
            ...TEXT_STYLES.BODY,
            fontSize: '18px',
            color: '#ffd54f',
            stroke: '#000000',
            strokeThickness: 3,
          })
          traitText.setOrigin(0.5)
          traitText.setDepth(DEPTH.OVERLAY + 6)

          this.tweens.add({
            targets: traitText,
            alpha: 0,
            y: centerY - 80,
            duration: 1500,
            ease: 'Power2',
            onComplete: () => traitText.destroy(),
          })
        }

        this.time.delayedCall(800, onComplete)
      },
    })
  }

  private setupInput(): void {
    this.input.keyboard?.on('keydown-ESC', () => {
      if (!this.isEvolving) {
        this.scene.stop()
      }
    })

    this.input.keyboard?.on('keydown-UP', () => {
      if (this.isEvolving || this.eligibleMonsters.length === 0) return
      this.selectedIndex = Math.max(0, this.selectedIndex - 1)
      this.refreshList()
      this.refreshDetail()
    })

    this.input.keyboard?.on('keydown-DOWN', () => {
      if (this.isEvolving || this.eligibleMonsters.length === 0) return
      this.selectedIndex = Math.min(this.eligibleMonsters.length - 1, this.selectedIndex + 1)
      this.refreshList()
      this.refreshDetail()
    })

    this.input.keyboard?.on('keydown-ENTER', () => {
      if (this.isEvolving) return
      this.performEvolution()
    })
  }
}
