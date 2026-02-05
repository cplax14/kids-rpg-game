import Phaser from 'phaser'
import type { BattleCombatant, Ability, InventorySlot, MonsterElement } from '../../models/types'
import { GAME_WIDTH, GAME_HEIGHT, COLORS, TEXT_STYLES, DEPTH } from '../../config'
import { drawElementIndicator, ELEMENT_INDICATORS } from '../../utils/accessibility'

export type CommandChoice = 'attack' | 'ability' | 'defend' | 'item' | 'capture' | 'flee'

interface HudElements {
  readonly commandMenu: Phaser.GameObjects.Container
  readonly playerPanel: Phaser.GameObjects.Container
  readonly enemyPanel: Phaser.GameObjects.Container
  readonly messageBox: Phaser.GameObjects.Container
  readonly abilityMenu: Phaser.GameObjects.Container | null
}

export class BattleHUD {
  private scene: Phaser.Scene
  private elements: HudElements
  private onCommand: ((choice: CommandChoice, targetId?: string, abilityId?: string) => void) | null = null
  private messageText!: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.elements = {
      commandMenu: this.createCommandMenu(),
      playerPanel: this.createPlayerPanel(),
      enemyPanel: this.createEnemyPanel(),
      messageBox: this.createMessageBox(),
      abilityMenu: null,
    }
    this.hideAll()
  }

  setCommandCallback(
    callback: (choice: CommandChoice, targetId?: string, abilityId?: string) => void,
  ): void {
    this.onCommand = callback
  }

  showCommandMenu(): void {
    this.elements.commandMenu.setVisible(true)
    this.hideAbilityMenu()
  }

  hideCommandMenu(): void {
    this.elements.commandMenu.setVisible(false)
  }

  showAbilityMenu(abilities: ReadonlyArray<Ability>, actorMp: number): void {
    this.hideAbilityMenu()

    const container = this.scene.add.container(GAME_WIDTH / 2 - 200, GAME_HEIGHT - 220)
    container.setDepth(DEPTH.UI + 1)

    // Background
    const bg = this.scene.add.graphics()
    bg.fillStyle(0x16213e, 0.95)
    bg.fillRoundedRect(0, 0, 400, abilities.length * 45 + 20, 12)
    bg.lineStyle(2, COLORS.SECONDARY)
    bg.strokeRoundedRect(0, 0, 400, abilities.length * 45 + 20, 12)
    container.add(bg)

    abilities.forEach((ability, index) => {
      const y = 10 + index * 45
      const canUse = actorMp >= ability.mpCost
      const alpha = canUse ? 1.0 : 0.4

      const btn = this.scene.add.graphics()
      btn.fillStyle(COLORS.SECONDARY, 0.3)
      btn.fillRoundedRect(10, y, 380, 38, 8)
      container.add(btn)

      const nameText = this.scene.add.text(20, y + 8, ability.name, {
        ...TEXT_STYLES.BODY,
        fontSize: '16px',
      })
      nameText.setAlpha(alpha)
      container.add(nameText)

      const mpText = this.scene.add.text(280, y + 8, `MP: ${ability.mpCost}`, {
        ...TEXT_STYLES.SMALL,
        color: canUse ? '#42a5f5' : '#ef5350',
      })
      container.add(mpText)

      // Element indicator with shape for accessibility
      const elemIndicator = this.scene.add.graphics()
      drawElementIndicator(elemIndicator, 360, y + 19, ability.element as MonsterElement, 14)
      container.add(elemIndicator)

      if (canUse) {
        const hitArea = this.scene.add.rectangle(200, y + 19, 380, 38)
        hitArea.setInteractive({ useHandCursor: true })
        hitArea.on('pointerdown', () => {
          this.onCommand?.('ability', undefined, ability.abilityId)
        })
        hitArea.on('pointerover', () => btn.clear().fillStyle(COLORS.SECONDARY, 0.6).fillRoundedRect(10, y, 380, 38, 8))
        hitArea.on('pointerout', () => btn.clear().fillStyle(COLORS.SECONDARY, 0.3).fillRoundedRect(10, y, 380, 38, 8))
        container.add(hitArea)
      }
    })

    // Back button
    const backY = abilities.length * 45 + 10
    // Extend background to fit back button is handled by initial size calculation
    const backText = this.scene.add.text(200, backY - 15, '< Back', {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
      color: '#b0bec5',
    })
    backText.setOrigin(0.5)
    backText.setInteractive({ useHandCursor: true })
    backText.on('pointerdown', () => {
      this.hideAbilityMenu()
      this.showCommandMenu()
    })
    container.add(backText)

    this.elements = { ...this.elements, abilityMenu: container }
  }

  hideAbilityMenu(): void {
    if (this.elements.abilityMenu) {
      this.elements.abilityMenu.destroy()
      this.elements = { ...this.elements, abilityMenu: null }
    }
  }

  showCaptureDeviceMenu(devices: ReadonlyArray<InventorySlot>): void {
    this.hideAbilityMenu()

    const container = this.scene.add.container(GAME_WIDTH / 2 - 200, GAME_HEIGHT - 220)
    container.setDepth(DEPTH.UI + 1)

    const menuHeight = Math.max(devices.length, 1) * 45 + 20
    const bg = this.scene.add.graphics()
    bg.fillStyle(0x16213e, 0.95)
    bg.fillRoundedRect(0, 0, 400, menuHeight, 12)
    bg.lineStyle(2, COLORS.WARNING)
    bg.strokeRoundedRect(0, 0, 400, menuHeight, 12)
    container.add(bg)

    if (devices.length === 0) {
      const emptyText = this.scene.add.text(200, menuHeight / 2, 'No capture devices!', {
        ...TEXT_STYLES.BODY,
        fontSize: '16px',
        color: '#666666',
      })
      emptyText.setOrigin(0.5)
      container.add(emptyText)
    } else {
      devices.forEach((slot, index) => {
        const y = 10 + index * 45
        const hasQty = slot.quantity > 0

        const btn = this.scene.add.graphics()
        btn.fillStyle(COLORS.WARNING, 0.3)
        btn.fillRoundedRect(10, y, 380, 38, 8)
        container.add(btn)

        const nameText = this.scene.add.text(20, y + 8, slot.item.name, {
          ...TEXT_STYLES.BODY,
          fontSize: '16px',
        })
        nameText.setAlpha(hasQty ? 1.0 : 0.4)
        container.add(nameText)

        // Show capture rate modifier
        const multiplier = slot.item.useEffect?.magnitude ?? 1.0
        const modText = this.scene.add.text(240, y + 8, `${multiplier}x`, {
          ...TEXT_STYLES.SMALL,
          color: '#ffa726',
        })
        container.add(modText)

        const qtyText = this.scene.add.text(320, y + 8, `x${slot.quantity}`, {
          ...TEXT_STYLES.SMALL,
          color: hasQty ? '#ffa726' : '#ef5350',
        })
        container.add(qtyText)

        if (hasQty) {
          const hitArea = this.scene.add.rectangle(200, y + 19, 380, 38)
          hitArea.setInteractive({ useHandCursor: true })
          hitArea.on('pointerdown', () => {
            this.onCommand?.('capture', undefined, slot.item.itemId)
          })
          hitArea.on('pointerover', () => btn.clear().fillStyle(COLORS.WARNING, 0.6).fillRoundedRect(10, y, 380, 38, 8))
          hitArea.on('pointerout', () => btn.clear().fillStyle(COLORS.WARNING, 0.3).fillRoundedRect(10, y, 380, 38, 8))
          container.add(hitArea)
        }
      })
    }

    // Back button
    const backY = Math.max(devices.length, 1) * 45 + 10
    const backText = this.scene.add.text(200, backY - 15, '< Back', {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
      color: '#b0bec5',
    })
    backText.setOrigin(0.5)
    backText.setInteractive({ useHandCursor: true })
    backText.on('pointerdown', () => {
      this.hideAbilityMenu()
      this.showCommandMenu()
    })
    container.add(backText)

    this.elements = { ...this.elements, abilityMenu: container }
  }

  showItemMenu(items: ReadonlyArray<InventorySlot>): void {
    this.hideAbilityMenu()

    const container = this.scene.add.container(GAME_WIDTH / 2 - 200, GAME_HEIGHT - 220)
    container.setDepth(DEPTH.UI + 1)

    const menuHeight = items.length * 45 + 20
    const bg = this.scene.add.graphics()
    bg.fillStyle(0x16213e, 0.95)
    bg.fillRoundedRect(0, 0, 400, menuHeight, 12)
    bg.lineStyle(2, COLORS.SUCCESS)
    bg.strokeRoundedRect(0, 0, 400, menuHeight, 12)
    container.add(bg)

    if (items.length === 0) {
      const emptyText = this.scene.add.text(200, menuHeight / 2, 'No items to use', {
        ...TEXT_STYLES.BODY,
        fontSize: '16px',
        color: '#666666',
      })
      emptyText.setOrigin(0.5)
      container.add(emptyText)
    } else {
      items.forEach((slot, index) => {
        const y = 10 + index * 45
        const hasQty = slot.quantity > 0

        const btn = this.scene.add.graphics()
        btn.fillStyle(COLORS.SUCCESS, 0.3)
        btn.fillRoundedRect(10, y, 380, 38, 8)
        container.add(btn)

        const nameText = this.scene.add.text(20, y + 8, slot.item.name, {
          ...TEXT_STYLES.BODY,
          fontSize: '16px',
        })
        nameText.setAlpha(hasQty ? 1.0 : 0.4)
        container.add(nameText)

        const qtyText = this.scene.add.text(300, y + 8, `x${slot.quantity}`, {
          ...TEXT_STYLES.SMALL,
          color: hasQty ? '#66bb6a' : '#ef5350',
        })
        container.add(qtyText)

        if (hasQty) {
          const hitArea = this.scene.add.rectangle(200, y + 19, 380, 38)
          hitArea.setInteractive({ useHandCursor: true })
          hitArea.on('pointerdown', () => {
            this.onCommand?.('item', undefined, slot.item.itemId)
          })
          hitArea.on('pointerover', () => btn.clear().fillStyle(COLORS.SUCCESS, 0.6).fillRoundedRect(10, y, 380, 38, 8))
          hitArea.on('pointerout', () => btn.clear().fillStyle(COLORS.SUCCESS, 0.3).fillRoundedRect(10, y, 380, 38, 8))
          container.add(hitArea)
        }
      })
    }

    // Back button
    const backY = Math.max(items.length, 1) * 45 + 10
    const backText = this.scene.add.text(200, backY - 15, '< Back', {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
      color: '#b0bec5',
    })
    backText.setOrigin(0.5)
    backText.setInteractive({ useHandCursor: true })
    backText.on('pointerdown', () => {
      this.hideAbilityMenu()
      this.showCommandMenu()
    })
    container.add(backText)

    this.elements = { ...this.elements, abilityMenu: container }
  }

  updatePlayerStats(combatants: ReadonlyArray<BattleCombatant>): void {
    this.elements.playerPanel.removeAll(true)
    this.buildStatPanel(this.elements.playerPanel, combatants, GAME_WIDTH - 320, GAME_HEIGHT - 160)
  }

  updateEnemyStats(combatants: ReadonlyArray<BattleCombatant>): void {
    this.elements.enemyPanel.removeAll(true)
    this.buildEnemyStatPanel(this.elements.enemyPanel, combatants, 20, 20)
  }

  showMessage(text: string): Promise<void> {
    this.elements.messageBox.setVisible(true)
    this.messageText.setText(text)

    return new Promise((resolve) => {
      this.scene.time.delayedCall(1500, () => {
        resolve()
      })
    })
  }

  hideMessage(): void {
    this.elements.messageBox.setVisible(false)
  }

  showDamageNumber(x: number, y: number, amount: number, isCritical: boolean): void {
    const color = isCritical ? '#ffd54f' : '#ffffff'
    const size = isCritical ? '28px' : '22px'
    const text = this.scene.add.text(x, y, `-${amount}`, {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: size,
      color,
      stroke: '#000000',
      strokeThickness: 3,
    })
    text.setOrigin(0.5)
    text.setDepth(DEPTH.UI + 5)

    this.scene.tweens.add({
      targets: text,
      y: y - 60,
      alpha: 0,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    })
  }

  showHealNumber(x: number, y: number, amount: number): void {
    const text = this.scene.add.text(x, y, `+${amount}`, {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '22px',
      color: '#66bb6a',
      stroke: '#000000',
      strokeThickness: 3,
    })
    text.setOrigin(0.5)
    text.setDepth(DEPTH.UI + 5)

    this.scene.tweens.add({
      targets: text,
      y: y - 50,
      alpha: 0,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    })
  }

  destroy(): void {
    this.elements.commandMenu.destroy()
    this.elements.playerPanel.destroy()
    this.elements.enemyPanel.destroy()
    this.elements.messageBox.destroy()
    this.hideAbilityMenu()
  }

  private hideAll(): void {
    this.elements.commandMenu.setVisible(false)
    this.elements.messageBox.setVisible(false)
  }

  private createCommandMenu(): Phaser.GameObjects.Container {
    const container = this.scene.add.container(20, GAME_HEIGHT - 180)
    container.setDepth(DEPTH.UI)

    const bg = this.scene.add.graphics()
    bg.fillStyle(0x16213e, 0.95)
    bg.fillRoundedRect(0, 0, 250, 170, 12)
    bg.lineStyle(2, COLORS.PRIMARY)
    bg.strokeRoundedRect(0, 0, 250, 170, 12)
    container.add(bg)

    const commands: ReadonlyArray<{ label: string; command: CommandChoice }> = [
      { label: 'Attack', command: 'attack' },
      { label: 'Ability', command: 'ability' },
      { label: 'Item', command: 'item' },
      { label: 'Capture', command: 'capture' },
      { label: 'Defend', command: 'defend' },
      { label: 'Flee', command: 'flee' },
    ]

    commands.forEach((cmd, index) => {
      const col = index % 2
      const row = Math.floor(index / 2)
      const x = 15 + col * 118
      const y = 10 + row * 52

      const btnBg = this.scene.add.graphics()
      btnBg.fillStyle(COLORS.SECONDARY, 0.4)
      btnBg.fillRoundedRect(x, y, 110, 44, 8)
      container.add(btnBg)

      const text = this.scene.add.text(x + 55, y + 22, cmd.label, {
        ...TEXT_STYLES.BUTTON,
        fontSize: '16px',
      })
      text.setOrigin(0.5)
      container.add(text)

      const hitArea = this.scene.add.rectangle(x + 55, y + 22, 110, 44)
      hitArea.setInteractive({ useHandCursor: true })

      hitArea.on('pointerover', () => {
        btnBg.clear()
        btnBg.fillStyle(COLORS.SECONDARY, 0.7)
        btnBg.fillRoundedRect(x, y, 110, 44, 8)
      })
      hitArea.on('pointerout', () => {
        btnBg.clear()
        btnBg.fillStyle(COLORS.SECONDARY, 0.4)
        btnBg.fillRoundedRect(x, y, 110, 44, 8)
      })
      hitArea.on('pointerdown', () => {
        this.onCommand?.(cmd.command)
      })

      container.add(hitArea)
    })

    return container
  }

  private createPlayerPanel(): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, 0)
    container.setDepth(DEPTH.UI)
    return container
  }

  private createEnemyPanel(): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, 0)
    container.setDepth(DEPTH.UI)
    return container
  }

  private createMessageBox(): Phaser.GameObjects.Container {
    const container = this.scene.add.container(GAME_WIDTH / 2 - 300, GAME_HEIGHT / 2 - 30)
    container.setDepth(DEPTH.UI + 10)

    const bg = this.scene.add.graphics()
    bg.fillStyle(0x16213e, 0.95)
    bg.fillRoundedRect(0, 0, 600, 60, 12)
    bg.lineStyle(2, COLORS.PRIMARY)
    bg.strokeRoundedRect(0, 0, 600, 60, 12)
    container.add(bg)

    this.messageText = this.scene.add.text(300, 30, '', {
      ...TEXT_STYLES.BODY,
      fontSize: '18px',
      wordWrap: { width: 580 },
    })
    this.messageText.setOrigin(0.5)
    container.add(this.messageText)

    return container
  }

  private buildStatPanel(
    container: Phaser.GameObjects.Container,
    combatants: ReadonlyArray<BattleCombatant>,
    startX: number,
    startY: number,
  ): void {
    const bg = this.scene.add.graphics()
    bg.fillStyle(0x16213e, 0.9)
    bg.fillRoundedRect(startX, startY, 300, combatants.length * 50 + 10, 10)
    bg.lineStyle(1, COLORS.PRIMARY, 0.5)
    bg.strokeRoundedRect(startX, startY, 300, combatants.length * 50 + 10, 10)
    container.add(bg)

    combatants.forEach((c, i) => {
      const y = startY + 10 + i * 50
      const isDead = c.stats.currentHp <= 0

      // Name
      const name = this.scene.add.text(startX + 10, y, c.name, {
        ...TEXT_STYLES.BODY,
        fontSize: '14px',
        color: isDead ? '#ef5350' : '#ffffff',
      })
      container.add(name)

      // HP bar
      const hpRatio = c.stats.maxHp > 0 ? c.stats.currentHp / c.stats.maxHp : 0
      const hpColor = hpRatio > 0.5 ? COLORS.HP_GREEN : hpRatio > 0.25 ? COLORS.HP_YELLOW : COLORS.HP_RED

      const hpBg = this.scene.add.graphics()
      hpBg.fillStyle(0x333333, 1)
      hpBg.fillRoundedRect(startX + 10, y + 20, 180, 10, 3)
      container.add(hpBg)

      if (hpRatio > 0) {
        const hpFill = this.scene.add.graphics()
        hpFill.fillStyle(hpColor, 1)
        hpFill.fillRoundedRect(startX + 10, y + 20, 180 * hpRatio, 10, 3)
        container.add(hpFill)
      }

      const hpText = this.scene.add.text(
        startX + 200,
        y + 18,
        `${c.stats.currentHp}/${c.stats.maxHp}`,
        { ...TEXT_STYLES.SMALL, fontSize: '12px' },
      )
      container.add(hpText)

      // MP bar
      const mpRatio = c.stats.maxMp > 0 ? c.stats.currentMp / c.stats.maxMp : 0
      const mpBg = this.scene.add.graphics()
      mpBg.fillStyle(0x333333, 1)
      mpBg.fillRoundedRect(startX + 10, y + 33, 180, 6, 2)
      container.add(mpBg)

      if (mpRatio > 0) {
        const mpFill = this.scene.add.graphics()
        mpFill.fillStyle(COLORS.MP_BLUE, 1)
        mpFill.fillRoundedRect(startX + 10, y + 33, 180 * mpRatio, 6, 2)
        container.add(mpFill)
      }
    })
  }

  private buildEnemyStatPanel(
    container: Phaser.GameObjects.Container,
    combatants: ReadonlyArray<BattleCombatant>,
    startX: number,
    startY: number,
  ): void {
    combatants.forEach((c, i) => {
      if (c.stats.currentHp <= 0) return

      const y = startY + i * 40

      const name = this.scene.add.text(startX, y, c.name, {
        ...TEXT_STYLES.BODY,
        fontSize: '14px',
      })
      container.add(name)

      const hpRatio = c.stats.maxHp > 0 ? c.stats.currentHp / c.stats.maxHp : 0
      const hpColor = hpRatio > 0.5 ? COLORS.HP_GREEN : hpRatio > 0.25 ? COLORS.HP_YELLOW : COLORS.HP_RED

      const hpBg = this.scene.add.graphics()
      hpBg.fillStyle(0x333333, 1)
      hpBg.fillRoundedRect(startX, y + 20, 150, 8, 3)
      container.add(hpBg)

      if (hpRatio > 0) {
        const hpFill = this.scene.add.graphics()
        hpFill.fillStyle(hpColor, 1)
        hpFill.fillRoundedRect(startX, y + 20, 150 * hpRatio, 8, 3)
        container.add(hpFill)
      }
    })
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
}
