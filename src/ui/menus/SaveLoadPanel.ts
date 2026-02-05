import Phaser from 'phaser'
import { COLORS, TEXT_STYLES, DEPTH, SAVE_SLOTS } from '../../config'
import {
  getAllSaveSlotInfo,
  loadSaveGame,
  saveGame,
  deleteSave,
  createSaveGame,
  formatPlayTime,
  formatTimestamp,
  type SaveSlotInfo,
} from '../../systems/SaveSystem'
import { getGameState } from '../../systems/GameStateManager'
import { loadSettings } from '../../systems/SettingsManager'
import { playSfx, SFX_KEYS } from '../../systems/AudioSystem'

export type SaveLoadMode = 'save' | 'load'

interface SaveLoadPanelOptions {
  readonly mode: SaveLoadMode
  readonly onSelect?: (slot: number) => void
  readonly onCancel?: () => void
  readonly playTime?: number
}

const PANEL_WIDTH = 600
const PANEL_HEIGHT = 380
const SLOT_HEIGHT = 90

export class SaveLoadPanel {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private mode: SaveLoadMode
  private onSelect?: (slot: number) => void
  private onCancel?: () => void
  private playTime: number
  private selectedSlot: number = -1
  private confirmDialog: Phaser.GameObjects.Container | null = null

  constructor(scene: Phaser.Scene, x: number, y: number, options: SaveLoadPanelOptions) {
    this.scene = scene
    this.mode = options.mode
    this.onSelect = options.onSelect
    this.onCancel = options.onCancel
    this.playTime = options.playTime ?? 0

    this.container = scene.add.container(x, y)
    this.container.setDepth(DEPTH.OVERLAY + 2)

    this.createBackground()
    this.createSlots()
    this.createCancelButton()
  }

  private createBackground(): void {
    const bg = this.scene.add.graphics()
    bg.fillStyle(COLORS.PANEL_BG, 0.95)
    bg.fillRoundedRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 12)
    bg.lineStyle(2, COLORS.PRIMARY)
    bg.strokeRoundedRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 12)
    this.container.add(bg)

    const title = this.scene.add.text(
      PANEL_WIDTH / 2,
      20,
      this.mode === 'save' ? 'Save Game' : 'Load Game',
      {
        ...TEXT_STYLES.HEADING,
        fontSize: '24px',
      },
    )
    title.setOrigin(0.5, 0)
    this.container.add(title)
  }

  private createSlots(): void {
    const slots = getAllSaveSlotInfo()

    for (let i = 0; i < SAVE_SLOTS; i++) {
      const slotY = 60 + i * (SLOT_HEIGHT + 10)
      this.createSlot(i, slotY, slots[i])
    }
  }

  private createSlot(slotIndex: number, y: number, info: SaveSlotInfo): void {
    const slotContainer = this.scene.add.container(20, y)
    this.container.add(slotContainer)

    // Background
    const bg = this.scene.add.graphics()
    bg.fillStyle(info.exists ? COLORS.SECONDARY : 0x333333, info.exists ? 0.3 : 0.2)
    bg.fillRoundedRect(0, 0, PANEL_WIDTH - 40, SLOT_HEIGHT, 10)
    slotContainer.add(bg)
    slotContainer.setData('bg', bg)

    // Slot label
    const slotLabel = this.scene.add.text(15, 10, `Slot ${slotIndex + 1}`, {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      color: info.exists ? '#ffffff' : '#888888',
    })
    slotContainer.add(slotLabel)

    if (info.exists) {
      // Player name and level
      const playerInfo = this.scene.add.text(15, 35, `${info.playerName} - Lv.${info.level}`, {
        ...TEXT_STYLES.BODY,
        fontSize: '18px',
        color: '#ffd54f',
      })
      slotContainer.add(playerInfo)

      // Play time
      const playTimeText = this.scene.add.text(
        15,
        60,
        `Play time: ${formatPlayTime(info.playTime ?? 0)}`,
        {
          ...TEXT_STYLES.SMALL,
          fontSize: '13px',
          color: '#b0bec5',
        },
      )
      slotContainer.add(playTimeText)

      // Timestamp
      const timestampText = this.scene.add.text(
        PANEL_WIDTH - 60,
        35,
        formatTimestamp(info.timestamp ?? ''),
        {
          ...TEXT_STYLES.SMALL,
          fontSize: '12px',
          color: '#888888',
        },
      )
      timestampText.setOrigin(1, 0)
      slotContainer.add(timestampText)

      // Area
      if (info.areaId) {
        const areaText = this.scene.add.text(PANEL_WIDTH - 60, 55, info.areaId.replace(/-/g, ' '), {
          ...TEXT_STYLES.SMALL,
          fontSize: '12px',
          color: '#666666',
        })
        areaText.setOrigin(1, 0)
        slotContainer.add(areaText)
      }

      // Delete button (only in save mode or if slot exists)
      if (this.mode === 'save') {
        const deleteBtn = this.scene.add.text(PANEL_WIDTH - 60, 10, 'Delete', {
          ...TEXT_STYLES.SMALL,
          fontSize: '12px',
          color: '#ef5350',
        })
        deleteBtn.setOrigin(1, 0)
        deleteBtn.setInteractive({ useHandCursor: true })
        deleteBtn.on('pointerdown', () => {
          this.confirmDelete(slotIndex)
        })
        deleteBtn.on('pointerover', () => deleteBtn.setColor('#ff7043'))
        deleteBtn.on('pointerout', () => deleteBtn.setColor('#ef5350'))
        slotContainer.add(deleteBtn)
      }
    } else {
      // Empty slot message
      const emptyText = this.scene.add.text(15, 40, 'Empty Slot', {
        ...TEXT_STYLES.BODY,
        fontSize: '16px',
        color: '#666666',
      })
      slotContainer.add(emptyText)
    }

    // Click handler
    const hitArea = this.scene.add.rectangle(
      (PANEL_WIDTH - 40) / 2,
      SLOT_HEIGHT / 2,
      PANEL_WIDTH - 40,
      SLOT_HEIGHT,
    )
    hitArea.setInteractive({ useHandCursor: true })

    hitArea.on('pointerover', () => {
      bg.clear()
      bg.fillStyle(COLORS.PRIMARY, 0.4)
      bg.fillRoundedRect(0, 0, PANEL_WIDTH - 40, SLOT_HEIGHT, 10)
    })

    hitArea.on('pointerout', () => {
      bg.clear()
      bg.fillStyle(info.exists ? COLORS.SECONDARY : 0x333333, info.exists ? 0.3 : 0.2)
      bg.fillRoundedRect(0, 0, PANEL_WIDTH - 40, SLOT_HEIGHT, 10)
    })

    hitArea.on('pointerdown', () => {
      playSfx(SFX_KEYS.MENU_SELECT)

      if (this.mode === 'load') {
        if (info.exists) {
          this.onSelect?.(slotIndex)
        }
      } else {
        // Save mode
        if (info.exists) {
          this.confirmOverwrite(slotIndex)
        } else {
          this.saveToSlot(slotIndex)
        }
      }
    })

    slotContainer.add(hitArea)
  }

  private confirmOverwrite(slot: number): void {
    this.showConfirmDialog('Overwrite existing save?', () => {
      this.saveToSlot(slot)
    })
  }

  private confirmDelete(slot: number): void {
    this.showConfirmDialog('Delete this save?', () => {
      deleteSave(slot)
      this.refresh()
    })
  }

  private showConfirmDialog(message: string, onConfirm: () => void): void {
    if (this.confirmDialog) {
      this.confirmDialog.destroy()
    }

    this.confirmDialog = this.scene.add.container(PANEL_WIDTH / 2 - 150, PANEL_HEIGHT / 2 - 60)
    this.confirmDialog.setDepth(DEPTH.OVERLAY + 10)
    this.container.add(this.confirmDialog)

    // Dim background
    const dimBg = this.scene.add.graphics()
    dimBg.fillStyle(0x000000, 0.6)
    dimBg.fillRect(-PANEL_WIDTH / 2 + 150, -PANEL_HEIGHT / 2 + 60, PANEL_WIDTH, PANEL_HEIGHT)
    this.confirmDialog.add(dimBg)

    // Dialog background
    const dialogBg = this.scene.add.graphics()
    dialogBg.fillStyle(COLORS.DARK_BG, 1)
    dialogBg.fillRoundedRect(0, 0, 300, 120, 12)
    dialogBg.lineStyle(2, COLORS.WARNING)
    dialogBg.strokeRoundedRect(0, 0, 300, 120, 12)
    this.confirmDialog.add(dialogBg)

    // Message
    const text = this.scene.add.text(150, 30, message, {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
    })
    text.setOrigin(0.5)
    this.confirmDialog.add(text)

    // Cancel button
    const cancelBtn = this.createDialogButton(50, 75, 'Cancel', COLORS.DANGER, () => {
      this.confirmDialog?.destroy()
      this.confirmDialog = null
    })
    this.confirmDialog.add(cancelBtn)

    // Confirm button
    const confirmBtn = this.createDialogButton(170, 75, 'Confirm', COLORS.SUCCESS, () => {
      this.confirmDialog?.destroy()
      this.confirmDialog = null
      onConfirm()
    })
    this.confirmDialog.add(confirmBtn)
  }

  private createDialogButton(
    x: number,
    y: number,
    label: string,
    color: number,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y)

    const bg = this.scene.add.graphics()
    bg.fillStyle(color, 0.8)
    bg.fillRoundedRect(0, 0, 80, 30, 6)
    container.add(bg)

    const text = this.scene.add.text(40, 15, label, {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
    })
    text.setOrigin(0.5)
    container.add(text)

    const hitArea = this.scene.add.rectangle(40, 15, 80, 30)
    hitArea.setInteractive({ useHandCursor: true })
    hitArea.on('pointerdown', () => {
      playSfx(SFX_KEYS.MENU_CONFIRM)
      onClick()
    })
    hitArea.on('pointerover', () => {
      bg.clear()
      bg.fillStyle(color, 1)
      bg.fillRoundedRect(0, 0, 80, 30, 6)
    })
    hitArea.on('pointerout', () => {
      bg.clear()
      bg.fillStyle(color, 0.8)
      bg.fillRoundedRect(0, 0, 80, 30, 6)
    })
    container.add(hitArea)

    return container
  }

  private saveToSlot(slot: number): void {
    try {
      const state = getGameState(this.scene)
      const settings = loadSettings()
      const save = createSaveGame(state, settings, this.playTime)
      const success = saveGame(slot, save)

      if (success) {
        playSfx(SFX_KEYS.MENU_CONFIRM)
        this.showSaveSuccess()
        this.refresh()
      }
    } catch (error) {
      // Game state not available
    }
  }

  private showSaveSuccess(): void {
    const text = this.scene.add.text(PANEL_WIDTH / 2, PANEL_HEIGHT - 30, 'Game saved!', {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      color: '#66bb6a',
    })
    text.setOrigin(0.5)
    this.container.add(text)

    this.scene.tweens.add({
      targets: text,
      alpha: 0,
      duration: 2000,
      delay: 500,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    })
  }

  private createCancelButton(): void {
    const btnX = 20
    const btnY = PANEL_HEIGHT - 45

    const btnBg = this.scene.add.graphics()
    btnBg.fillStyle(COLORS.DANGER, 0.6)
    btnBg.fillRoundedRect(btnX, btnY, 90, 32, 8)
    this.container.add(btnBg)

    const btnText = this.scene.add.text(btnX + 45, btnY + 16, 'Cancel', {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
    })
    btnText.setOrigin(0.5)
    this.container.add(btnText)

    const hitArea = this.scene.add.rectangle(btnX + 45, btnY + 16, 90, 32)
    hitArea.setInteractive({ useHandCursor: true })
    hitArea.on('pointerover', () => {
      btnBg.clear()
      btnBg.fillStyle(COLORS.DANGER, 0.9)
      btnBg.fillRoundedRect(btnX, btnY, 90, 32, 8)
    })
    hitArea.on('pointerout', () => {
      btnBg.clear()
      btnBg.fillStyle(COLORS.DANGER, 0.6)
      btnBg.fillRoundedRect(btnX, btnY, 90, 32, 8)
    })
    hitArea.on('pointerdown', () => {
      playSfx(SFX_KEYS.MENU_SELECT)
      this.onCancel?.()
    })
    this.container.add(hitArea)
  }

  private refresh(): void {
    // Remove old content except background
    const children = this.container.getAll()
    for (let i = children.length - 1; i >= 2; i--) {
      ;(children[i] as Phaser.GameObjects.GameObject).destroy()
    }

    this.createSlots()
    this.createCancelButton()
  }

  destroy(): void {
    if (this.confirmDialog) {
      this.confirmDialog.destroy()
    }
    this.container.destroy()
  }
}
