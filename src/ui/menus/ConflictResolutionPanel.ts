import Phaser from 'phaser'
import { COLORS, TEXT_STYLES, DEPTH } from '../../config'
import type { ConflictInfo, ConflictResolution } from '../../models/auth-types'
import { formatPlayTime, formatTimestamp } from '../../systems/SaveSystem'
import { playSfx, SFX_KEYS } from '../../systems/AudioSystem'

interface ConflictResolutionPanelOptions {
  readonly conflict: ConflictInfo
  readonly onResolve: (resolution: ConflictResolution) => void
}

const PANEL_WIDTH = 500
const PANEL_HEIGHT = 360

export class ConflictResolutionPanel {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private conflict: ConflictInfo
  private onResolve: (resolution: ConflictResolution) => void

  constructor(scene: Phaser.Scene, x: number, y: number, options: ConflictResolutionPanelOptions) {
    this.scene = scene
    this.conflict = options.conflict
    this.onResolve = options.onResolve

    this.container = scene.add.container(x, y)
    this.container.setDepth(DEPTH.OVERLAY + 10)

    this.createBackground()
    this.createContent()
  }

  private createBackground(): void {
    // Dim overlay
    const overlay = this.scene.add.graphics()
    overlay.fillStyle(0x000000, 0.8)
    overlay.fillRect(-1000, -1000, 3000, 3000)
    this.container.add(overlay)

    // Panel background
    const bg = this.scene.add.graphics()
    bg.fillStyle(COLORS.DARK_BG, 0.98)
    bg.fillRoundedRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 12)
    bg.lineStyle(2, COLORS.WARNING)
    bg.strokeRoundedRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 12)
    this.container.add(bg)
  }

  private createContent(): void {
    // Warning icon and title
    const warningIcon = this.scene.add.text(PANEL_WIDTH / 2 - 80, 25, '⚠️', {
      fontSize: '24px',
    })
    this.container.add(warningIcon)

    const title = this.scene.add.text(PANEL_WIDTH / 2 - 45, 25, 'Save Conflict', {
      ...TEXT_STYLES.HEADING,
      fontSize: '22px',
      color: '#ffa726',
    })
    this.container.add(title)

    // Description
    const desc = this.scene.add.text(
      PANEL_WIDTH / 2,
      60,
      `Slot ${this.conflict.slotNumber + 1} has different saves locally and in the cloud.`,
      {
        ...TEXT_STYLES.BODY,
        fontSize: '14px',
        color: '#b0bec5',
      },
    )
    desc.setOrigin(0.5)
    this.container.add(desc)

    // Comparison containers
    this.createSaveComparison('Local Save', true, 100)
    this.createSaveComparison('Cloud Save', false, 195)

    // Action buttons
    this.createActionButtons()
  }

  private createSaveComparison(label: string, isLocal: boolean, y: number): void {
    const boxWidth = 220
    const boxHeight = 80
    const x = isLocal ? 25 : PANEL_WIDTH - boxWidth - 25

    // Box background
    const bg = this.scene.add.graphics()
    const bgColor = isLocal ? COLORS.PRIMARY : COLORS.SECONDARY
    bg.fillStyle(bgColor, 0.2)
    bg.fillRoundedRect(x, y, boxWidth, boxHeight, 8)
    bg.lineStyle(1, bgColor, 0.5)
    bg.strokeRoundedRect(x, y, boxWidth, boxHeight, 8)
    this.container.add(bg)

    // Label
    const labelText = this.scene.add.text(x + boxWidth / 2, y + 15, label, {
      ...TEXT_STYLES.BODY,
      fontSize: '13px',
      fontStyle: 'bold',
      color: isLocal ? '#4fc3f7' : '#7e57c2',
    })
    labelText.setOrigin(0.5)
    this.container.add(labelText)

    // Save info
    const playerName = isLocal ? this.conflict.localPlayerName : this.conflict.cloudPlayerName
    const playTime = isLocal ? this.conflict.localPlayTime : this.conflict.cloudPlayTime
    const timestamp = isLocal ? this.conflict.localTimestamp : this.conflict.cloudTimestamp

    const nameText = this.scene.add.text(x + 10, y + 35, playerName, {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
      color: '#ffd54f',
    })
    this.container.add(nameText)

    const timeText = this.scene.add.text(x + 10, y + 55, formatPlayTime(playTime), {
      ...TEXT_STYLES.SMALL,
      fontSize: '12px',
      color: '#888888',
    })
    this.container.add(timeText)

    const dateText = this.scene.add.text(x + boxWidth - 10, y + 55, formatTimestamp(timestamp), {
      ...TEXT_STYLES.SMALL,
      fontSize: '11px',
      color: '#666666',
    })
    dateText.setOrigin(1, 0)
    this.container.add(dateText)

    // Newer/Older indicator
    const localTime = new Date(this.conflict.localTimestamp).getTime()
    const cloudTime = new Date(this.conflict.cloudTimestamp).getTime()
    const isNewer = isLocal ? localTime > cloudTime : cloudTime > localTime

    if (isNewer) {
      const newerBadge = this.scene.add.text(x + boxWidth - 10, y + 12, 'NEWER', {
        fontFamily: 'Arial',
        fontSize: '10px',
        color: '#66bb6a',
        fontStyle: 'bold',
      })
      newerBadge.setOrigin(1, 0)
      this.container.add(newerBadge)
    }
  }

  private createActionButtons(): void {
    const btnY = 300
    const btnWidth = 130
    const btnHeight = 40

    // Use Local button
    this.createButton(80, btnY, 'Use Local', COLORS.PRIMARY, () => {
      playSfx(SFX_KEYS.MENU_CONFIRM)
      this.onResolve('use_local')
    })

    // Cancel button
    this.createButton(PANEL_WIDTH / 2, btnY, 'Cancel', COLORS.SECONDARY, () => {
      playSfx(SFX_KEYS.MENU_SELECT)
      this.onResolve('cancel')
    })

    // Use Cloud button
    this.createButton(PANEL_WIDTH - 80, btnY, 'Use Cloud', COLORS.SUCCESS, () => {
      playSfx(SFX_KEYS.MENU_CONFIRM)
      this.onResolve('use_cloud')
    })
  }

  private createButton(
    x: number,
    y: number,
    label: string,
    color: number,
    onClick: () => void,
  ): void {
    const btnWidth = 120
    const btnHeight = 36

    const bg = this.scene.add.graphics()
    bg.fillStyle(color, 0.7)
    bg.fillRoundedRect(x - btnWidth / 2, y - btnHeight / 2, btnWidth, btnHeight, 8)
    this.container.add(bg)

    const text = this.scene.add.text(x, y, label, {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
    })
    text.setOrigin(0.5)
    this.container.add(text)

    const hitArea = this.scene.add.rectangle(x, y, btnWidth, btnHeight)
    hitArea.setInteractive({ useHandCursor: true })

    hitArea.on('pointerover', () => {
      bg.clear()
      bg.fillStyle(color, 1)
      bg.fillRoundedRect(x - btnWidth / 2, y - btnHeight / 2, btnWidth, btnHeight, 8)
    })

    hitArea.on('pointerout', () => {
      bg.clear()
      bg.fillStyle(color, 0.7)
      bg.fillRoundedRect(x - btnWidth / 2, y - btnHeight / 2, btnWidth, btnHeight, 8)
    })

    hitArea.on('pointerdown', onClick)

    this.container.add(hitArea)
  }

  destroy(): void {
    this.container.destroy()
  }
}
