import Phaser from 'phaser'
import type { GameSettings } from '../../models/types'

type TextSpeed = 'slow' | 'normal' | 'fast'
import { COLORS, TEXT_STYLES, DEPTH, CLOUD_SAVE_ENABLED } from '../../config'
import { Slider } from '../components/Slider'
import {
  loadSettings,
  saveSettings,
  applyAudioSettings,
  updateMusicVolume,
  updateSfxVolume,
  updateTextSpeed,
  toggleScreenShake,
  getDefaultSettings,
} from '../../systems/SettingsManager'
import { playSfx, SFX_KEYS } from '../../systems/AudioSystem'
import {
  downloadSave,
  readFileAsText,
  importSaveFromJson,
  importSaveToSlot,
  getAllSaveSlotInfo,
} from '../../systems/SaveSystem'
import {
  isAuthenticated,
  getUserDisplayName,
  getUser,
  signOut,
} from '../../systems/AuthSystem'

const PANEL_WIDTH = 560
const PANEL_HEIGHT = 600

export class SettingsPanel {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private musicSlider: Slider | null = null
  private sfxSlider: Slider | null = null
  private settings: GameSettings
  private textSpeedButtons: Phaser.GameObjects.Container[] = []
  private toggleContainer: Phaser.GameObjects.Container | null = null
  private toggleStatusText: Phaser.GameObjects.Text | null = null

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene
    this.settings = loadSettings()

    this.container = scene.add.container(x, y)
    this.container.setDepth(DEPTH.OVERLAY + 2)

    this.createBackground()
    this.createAudioSection()
    this.createGameplaySection()
    this.createDataSection()
    if (CLOUD_SAVE_ENABLED) {
      this.createAccountSection()
    }
    this.createFooter()
  }

  private createBackground(): void {
    const bg = this.scene.add.graphics()
    bg.fillStyle(COLORS.PANEL_BG, 0.6)
    bg.fillRoundedRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 12)
    bg.lineStyle(1, COLORS.PRIMARY, 0.3)
    bg.strokeRoundedRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 12)
    this.container.add(bg)

    const title = this.scene.add.text(PANEL_WIDTH / 2, 20, 'Settings', {
      ...TEXT_STYLES.HEADING,
      fontSize: '22px',
    })
    title.setOrigin(0.5, 0)
    this.container.add(title)
  }

  private createSectionHeader(y: number, label: string): void {
    // Section background
    const sectionBg = this.scene.add.graphics()
    sectionBg.fillStyle(COLORS.PRIMARY, 0.15)
    sectionBg.fillRoundedRect(15, y, PANEL_WIDTH - 30, 28, 6)
    this.container.add(sectionBg)

    const text = this.scene.add.text(25, y + 6, label, {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#4fc3f7',
    })
    this.container.add(text)
  }

  private createAudioSection(): void {
    this.createSectionHeader(55, '🔊 Audio')

    // Music Volume with icon
    const musicIcon = this.scene.add.text(25, 100, '🎵', {
      fontSize: '18px',
    })
    this.container.add(musicIcon)

    this.musicSlider = new Slider(this.scene, {
      x: this.container.x + 50,
      y: this.container.y + 100,
      width: 220,
      value: this.settings.musicVolume,
      label: 'Music Volume',
      onValueChange: (value) => {
        this.settings = updateMusicVolume(this.settings, value)
        applyAudioSettings(this.settings)
      },
    })

    // SFX Volume with icon
    const sfxIcon = this.scene.add.text(25, 160, '🔔', {
      fontSize: '18px',
    })
    this.container.add(sfxIcon)

    this.sfxSlider = new Slider(this.scene, {
      x: this.container.x + 50,
      y: this.container.y + 160,
      width: 220,
      value: this.settings.sfxVolume,
      label: 'Sound Effects',
      onValueChange: (value) => {
        this.settings = updateSfxVolume(this.settings, value)
        applyAudioSettings(this.settings)
        playSfx(SFX_KEYS.MENU_SELECT, 0.5)
      },
    })
  }

  private createGameplaySection(): void {
    this.createSectionHeader(210, '🎮 Gameplay')

    // Text Speed
    const textLabel = this.scene.add.text(25, 250, 'Text Speed', {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
    })
    this.container.add(textLabel)

    const speeds: ReadonlyArray<{ label: string; value: TextSpeed }> = [
      { label: 'Slow', value: 'slow' },
      { label: 'Normal', value: 'normal' },
      { label: 'Fast', value: 'fast' },
    ]

    this.textSpeedButtons = []
    speeds.forEach((speed, index) => {
      const x = 25 + index * 95
      const y = 275

      const btnContainer = this.scene.add.container(x, y)
      this.container.add(btnContainer)

      const bg = this.scene.add.graphics()
      btnContainer.add(bg)
      btnContainer.setData('bg', bg)
      btnContainer.setData('speed', speed.value)

      const text = this.scene.add.text(42, 17, speed.label, {
        ...TEXT_STYLES.BODY,
        fontSize: '13px',
      })
      text.setOrigin(0.5)
      btnContainer.add(text)
      btnContainer.setData('text', text)

      this.drawTextSpeedButton(btnContainer, this.settings.textSpeed === speed.value)

      const hitArea = this.scene.add.rectangle(42, 17, 85, 34)
      hitArea.setInteractive({ useHandCursor: true })
      hitArea.on('pointerdown', () => {
        this.settings = updateTextSpeed(this.settings, speed.value)
        this.updateTextSpeedButtons()
        playSfx(SFX_KEYS.MENU_SELECT)
      })
      hitArea.on('pointerover', () => {
        if (this.settings.textSpeed !== speed.value) {
          const bgGraphics = btnContainer.getData('bg') as Phaser.GameObjects.Graphics
          bgGraphics.clear()
          bgGraphics.fillStyle(COLORS.PANEL_BG, 0.8)
          bgGraphics.fillRoundedRect(0, 0, 85, 34, 8)
          bgGraphics.lineStyle(1, COLORS.PRIMARY, 0.5)
          bgGraphics.strokeRoundedRect(0, 0, 85, 34, 8)
        }
      })
      hitArea.on('pointerout', () => {
        this.drawTextSpeedButton(btnContainer, this.settings.textSpeed === speed.value)
      })
      btnContainer.add(hitArea)

      this.textSpeedButtons.push(btnContainer)
    })

    // Screen Shake Toggle
    const shakeLabel = this.scene.add.text(25, 330, 'Screen Shake', {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
    })
    this.container.add(shakeLabel)

    this.toggleContainer = this.scene.add.container(25, 355)
    this.container.add(this.toggleContainer)

    const toggleBg = this.scene.add.graphics()
    this.toggleContainer.add(toggleBg)
    this.toggleContainer.setData('toggleBg', toggleBg)

    const toggleHandle = this.scene.add.ellipse(0, 12, 20, 20, COLORS.WHITE)
    this.toggleContainer.add(toggleHandle)
    this.toggleContainer.setData('toggleHandle', toggleHandle)

    // On/Off label
    this.toggleStatusText = this.scene.add.text(65, 6, '', {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
    })
    this.toggleContainer.add(this.toggleStatusText)

    this.updateToggleVisual()

    const hitArea = this.scene.add.rectangle(25, 12, 50, 28)
    hitArea.setInteractive({ useHandCursor: true })
    hitArea.on('pointerdown', () => {
      this.settings = toggleScreenShake(this.settings)
      this.updateToggleVisual()
      playSfx(SFX_KEYS.MENU_SELECT)
    })
    this.toggleContainer.add(hitArea)
  }

  private createDataSection(): void {
    this.createSectionHeader(400, '💾 Save Data')

    // Export Save button
    const exportBtnX = 25
    const exportBtnY = 440

    const exportBg = this.scene.add.graphics()
    exportBg.fillStyle(COLORS.PRIMARY, 0.4)
    exportBg.fillRoundedRect(exportBtnX, exportBtnY, 160, 36, 8)
    this.container.add(exportBg)

    const exportText = this.scene.add.text(exportBtnX + 80, exportBtnY + 18, '📥 Export Save', {
      ...TEXT_STYLES.BODY,
      fontSize: '13px',
    })
    exportText.setOrigin(0.5)
    this.container.add(exportText)

    const exportHitArea = this.scene.add.rectangle(exportBtnX + 80, exportBtnY + 18, 160, 36)
    exportHitArea.setInteractive({ useHandCursor: true })
    exportHitArea.on('pointerover', () => {
      exportBg.clear()
      exportBg.fillStyle(COLORS.PRIMARY, 0.7)
      exportBg.fillRoundedRect(exportBtnX, exportBtnY, 160, 36, 8)
    })
    exportHitArea.on('pointerout', () => {
      exportBg.clear()
      exportBg.fillStyle(COLORS.PRIMARY, 0.4)
      exportBg.fillRoundedRect(exportBtnX, exportBtnY, 160, 36, 8)
    })
    exportHitArea.on('pointerdown', () => {
      this.showExportDialog()
    })
    this.container.add(exportHitArea)

    // Import Save button
    const importBtnX = 200
    const importBtnY = 440

    const importBg = this.scene.add.graphics()
    importBg.fillStyle(COLORS.SECONDARY, 0.4)
    importBg.fillRoundedRect(importBtnX, importBtnY, 160, 36, 8)
    this.container.add(importBg)

    const importText = this.scene.add.text(importBtnX + 80, importBtnY + 18, '📤 Import Save', {
      ...TEXT_STYLES.BODY,
      fontSize: '13px',
    })
    importText.setOrigin(0.5)
    this.container.add(importText)

    const importHitArea = this.scene.add.rectangle(importBtnX + 80, importBtnY + 18, 160, 36)
    importHitArea.setInteractive({ useHandCursor: true })
    importHitArea.on('pointerover', () => {
      importBg.clear()
      importBg.fillStyle(COLORS.SECONDARY, 0.7)
      importBg.fillRoundedRect(importBtnX, importBtnY, 160, 36, 8)
    })
    importHitArea.on('pointerout', () => {
      importBg.clear()
      importBg.fillStyle(COLORS.SECONDARY, 0.4)
      importBg.fillRoundedRect(importBtnX, importBtnY, 160, 36, 8)
    })
    importHitArea.on('pointerdown', () => {
      this.triggerFileImport()
    })
    this.container.add(importHitArea)

    // Hidden file input
    this.createFileInput()
  }

  private createAccountSection(): void {
    this.createSectionHeader(490, '👤 Account')

    if (isAuthenticated()) {
      const user = getUser()
      const displayName = getUserDisplayName()

      // User info
      const userText = this.scene.add.text(25, 530, `Signed in as: ${displayName}`, {
        ...TEXT_STYLES.BODY,
        fontSize: '14px',
        color: '#66bb6a',
      })
      this.container.add(userText)

      // Email (if available)
      if (user?.email) {
        const emailText = this.scene.add.text(25, 550, user.email, {
          ...TEXT_STYLES.SMALL,
          fontSize: '12px',
          color: '#888888',
        })
        this.container.add(emailText)
      }

      // Sign out button
      const signOutBtnX = PANEL_WIDTH - 130
      const signOutBtnY = 530

      const signOutBg = this.scene.add.graphics()
      signOutBg.fillStyle(COLORS.DANGER, 0.5)
      signOutBg.fillRoundedRect(signOutBtnX, signOutBtnY, 100, 34, 8)
      this.container.add(signOutBg)

      const signOutText = this.scene.add.text(signOutBtnX + 50, signOutBtnY + 17, 'Sign Out', {
        ...TEXT_STYLES.BODY,
        fontSize: '13px',
      })
      signOutText.setOrigin(0.5)
      this.container.add(signOutText)

      const signOutHitArea = this.scene.add.rectangle(signOutBtnX + 50, signOutBtnY + 17, 100, 34)
      signOutHitArea.setInteractive({ useHandCursor: true })
      signOutHitArea.on('pointerover', () => {
        signOutBg.clear()
        signOutBg.fillStyle(COLORS.DANGER, 0.8)
        signOutBg.fillRoundedRect(signOutBtnX, signOutBtnY, 100, 34, 8)
      })
      signOutHitArea.on('pointerout', () => {
        signOutBg.clear()
        signOutBg.fillStyle(COLORS.DANGER, 0.5)
        signOutBg.fillRoundedRect(signOutBtnX, signOutBtnY, 100, 34, 8)
      })
      signOutHitArea.on('pointerdown', async () => {
        playSfx(SFX_KEYS.MENU_CONFIRM)
        const success = await signOut()
        if (success) {
          this.showNotification('Signed out', '#66bb6a')
          // Refresh would need a full panel rebuild
        }
      })
      this.container.add(signOutHitArea)
    } else {
      // Not signed in message
      const guestText = this.scene.add.text(25, 530, 'Playing as guest', {
        ...TEXT_STYLES.BODY,
        fontSize: '14px',
        color: '#888888',
      })
      this.container.add(guestText)

      const hintText = this.scene.add.text(25, 550, 'Sign in from the title screen to enable cloud saves', {
        ...TEXT_STYLES.SMALL,
        fontSize: '12px',
        color: '#666666',
      })
      this.container.add(hintText)
    }
  }

  private createFileInput(): void {
    // Create a hidden file input element for importing saves
    const existingInput = document.getElementById('save-import-input')
    if (existingInput) {
      existingInput.remove()
    }

    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.id = 'save-import-input'
    fileInput.accept = '.json'
    fileInput.style.display = 'none'

    fileInput.addEventListener('change', async (event) => {
      const target = event.target as HTMLInputElement
      const file = target.files?.[0]
      if (!file) return

      try {
        const json = await readFileAsText(file)
        const result = importSaveFromJson(json)

        if (!result.success || !result.save) {
          this.showNotification(result.error ?? 'Import failed', '#ef5350')
          return
        }

        // Show slot selection for import
        this.showImportSlotDialog(result.save)
      } catch {
        this.showNotification('Failed to read file', '#ef5350')
      }

      // Reset input for next use
      target.value = ''
    })

    document.body.appendChild(fileInput)
  }

  private triggerFileImport(): void {
    playSfx(SFX_KEYS.MENU_SELECT)
    const fileInput = document.getElementById('save-import-input') as HTMLInputElement
    if (fileInput) {
      fileInput.click()
    }
  }

  private showExportDialog(): void {
    playSfx(SFX_KEYS.MENU_SELECT)

    const slots = getAllSaveSlotInfo()
    const occupiedSlots = slots
      .map((s, i) => ({ info: s, index: i }))
      .filter((s) => s.info.exists)

    if (occupiedSlots.length === 0) {
      this.showNotification('No saves to export', '#ffa726')
      return
    }

    // Create slot selection overlay
    const overlay = this.scene.add.container(PANEL_WIDTH / 2 - 150, 150)
    overlay.setDepth(DEPTH.OVERLAY + 10)
    this.container.add(overlay)

    // Background
    const bg = this.scene.add.graphics()
    bg.fillStyle(COLORS.DARK_BG, 0.98)
    bg.fillRoundedRect(0, 0, 300, 200, 12)
    bg.lineStyle(2, COLORS.PRIMARY)
    bg.strokeRoundedRect(0, 0, 300, 200, 12)
    overlay.add(bg)

    // Title
    const title = this.scene.add.text(150, 20, 'Export Save', {
      ...TEXT_STYLES.HEADING,
      fontSize: '18px',
    })
    title.setOrigin(0.5)
    overlay.add(title)

    // Slot buttons
    occupiedSlots.forEach((slot, idx) => {
      const btnY = 55 + idx * 45
      const btnBg = this.scene.add.graphics()
      btnBg.fillStyle(COLORS.PRIMARY, 0.3)
      btnBg.fillRoundedRect(20, btnY, 260, 38, 8)
      overlay.add(btnBg)

      const slotText = this.scene.add.text(
        30,
        btnY + 10,
        `Slot ${slot.index + 1}: ${slot.info.playerName} (Lv.${slot.info.level})`,
        {
          ...TEXT_STYLES.BODY,
          fontSize: '14px',
        },
      )
      overlay.add(slotText)

      const hitArea = this.scene.add.rectangle(150, btnY + 19, 260, 38)
      hitArea.setInteractive({ useHandCursor: true })
      hitArea.on('pointerover', () => {
        btnBg.clear()
        btnBg.fillStyle(COLORS.PRIMARY, 0.6)
        btnBg.fillRoundedRect(20, btnY, 260, 38, 8)
      })
      hitArea.on('pointerout', () => {
        btnBg.clear()
        btnBg.fillStyle(COLORS.PRIMARY, 0.3)
        btnBg.fillRoundedRect(20, btnY, 260, 38, 8)
      })
      hitArea.on('pointerdown', () => {
        playSfx(SFX_KEYS.MENU_CONFIRM)
        const success = downloadSave(slot.index)
        overlay.destroy()
        if (success) {
          this.showNotification('Save exported!', '#66bb6a')
        } else {
          this.showNotification('Export failed', '#ef5350')
        }
      })
      overlay.add(hitArea)
    })

    // Cancel button
    const cancelBtn = this.scene.add.text(150, 170, 'Cancel', {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
      color: '#b0bec5',
    })
    cancelBtn.setOrigin(0.5)
    cancelBtn.setInteractive({ useHandCursor: true })
    cancelBtn.on('pointerover', () => cancelBtn.setColor('#ffffff'))
    cancelBtn.on('pointerout', () => cancelBtn.setColor('#b0bec5'))
    cancelBtn.on('pointerdown', () => {
      playSfx(SFX_KEYS.MENU_SELECT)
      overlay.destroy()
    })
    overlay.add(cancelBtn)
  }

  private showImportSlotDialog(save: import('../../models/types').SaveGame): void {
    const slots = getAllSaveSlotInfo()

    // Create slot selection overlay
    const overlay = this.scene.add.container(PANEL_WIDTH / 2 - 150, 120)
    overlay.setDepth(DEPTH.OVERLAY + 10)
    this.container.add(overlay)

    // Background
    const bg = this.scene.add.graphics()
    bg.fillStyle(COLORS.DARK_BG, 0.98)
    bg.fillRoundedRect(0, 0, 300, 260, 12)
    bg.lineStyle(2, COLORS.SECONDARY)
    bg.strokeRoundedRect(0, 0, 300, 260, 12)
    overlay.add(bg)

    // Title
    const title = this.scene.add.text(150, 20, 'Import to Slot', {
      ...TEXT_STYLES.HEADING,
      fontSize: '18px',
    })
    title.setOrigin(0.5)
    overlay.add(title)

    // Import info
    const infoText = this.scene.add.text(
      150,
      50,
      `${save.player.name} (Lv.${save.player.level})`,
      {
        ...TEXT_STYLES.BODY,
        fontSize: '13px',
        color: '#ffd54f',
      },
    )
    infoText.setOrigin(0.5)
    overlay.add(infoText)

    // Slot buttons
    slots.forEach((slotInfo, idx) => {
      const btnY = 80 + idx * 50
      const btnBg = this.scene.add.graphics()
      btnBg.fillStyle(slotInfo.exists ? COLORS.WARNING : COLORS.SECONDARY, 0.3)
      btnBg.fillRoundedRect(20, btnY, 260, 42, 8)
      overlay.add(btnBg)

      const label = slotInfo.exists
        ? `Slot ${idx + 1}: ${slotInfo.playerName} (Overwrite)`
        : `Slot ${idx + 1}: Empty`

      const slotText = this.scene.add.text(30, btnY + 12, label, {
        ...TEXT_STYLES.BODY,
        fontSize: '14px',
        color: slotInfo.exists ? '#ffa726' : '#ffffff',
      })
      overlay.add(slotText)

      const hitArea = this.scene.add.rectangle(150, btnY + 21, 260, 42)
      hitArea.setInteractive({ useHandCursor: true })
      hitArea.on('pointerover', () => {
        btnBg.clear()
        btnBg.fillStyle(slotInfo.exists ? COLORS.WARNING : COLORS.SECONDARY, 0.6)
        btnBg.fillRoundedRect(20, btnY, 260, 42, 8)
      })
      hitArea.on('pointerout', () => {
        btnBg.clear()
        btnBg.fillStyle(slotInfo.exists ? COLORS.WARNING : COLORS.SECONDARY, 0.3)
        btnBg.fillRoundedRect(20, btnY, 260, 42, 8)
      })
      hitArea.on('pointerdown', () => {
        playSfx(SFX_KEYS.MENU_CONFIRM)
        const success = importSaveToSlot(idx, save)
        overlay.destroy()
        if (success) {
          this.showNotification('Save imported!', '#66bb6a')
        } else {
          this.showNotification('Import failed', '#ef5350')
        }
      })
      overlay.add(hitArea)
    })

    // Cancel button
    const cancelBtn = this.scene.add.text(150, 235, 'Cancel', {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
      color: '#b0bec5',
    })
    cancelBtn.setOrigin(0.5)
    cancelBtn.setInteractive({ useHandCursor: true })
    cancelBtn.on('pointerover', () => cancelBtn.setColor('#ffffff'))
    cancelBtn.on('pointerout', () => cancelBtn.setColor('#b0bec5'))
    cancelBtn.on('pointerdown', () => {
      playSfx(SFX_KEYS.MENU_SELECT)
      overlay.destroy()
    })
    overlay.add(cancelBtn)
  }

  private drawTextSpeedButton(container: Phaser.GameObjects.Container, isActive: boolean): void {
    const bg = container.getData('bg') as Phaser.GameObjects.Graphics
    const text = container.getData('text') as Phaser.GameObjects.Text

    bg.clear()
    if (isActive) {
      bg.fillStyle(COLORS.PRIMARY, 0.6)
      bg.fillRoundedRect(0, 0, 85, 34, 8)
      bg.lineStyle(2, COLORS.PRIMARY)
      bg.strokeRoundedRect(0, 0, 85, 34, 8)
      text.setColor('#ffffff')
      text.setFontStyle('bold')
    } else {
      bg.fillStyle(COLORS.PANEL_BG, 0.5)
      bg.fillRoundedRect(0, 0, 85, 34, 8)
      text.setColor('#b0bec5')
      text.setFontStyle('normal')
    }
  }

  private updateTextSpeedButtons(): void {
    for (const container of this.textSpeedButtons) {
      const speed = container.getData('speed') as TextSpeed
      this.drawTextSpeedButton(container, this.settings.textSpeed === speed)
    }
  }

  private updateToggleVisual(): void {
    if (!this.toggleContainer) return

    const toggleBg = this.toggleContainer.getData('toggleBg') as Phaser.GameObjects.Graphics
    const toggleHandle = this.toggleContainer.getData('toggleHandle') as Phaser.GameObjects.Ellipse

    toggleBg.clear()
    if (this.settings.screenShake) {
      toggleBg.fillStyle(COLORS.SUCCESS, 1)
    } else {
      toggleBg.fillStyle(0x555555, 1)
    }
    toggleBg.fillRoundedRect(0, 0, 50, 24, 12)

    toggleHandle.setX(this.settings.screenShake ? 38 : 12)

    if (this.toggleStatusText) {
      this.toggleStatusText.setText(this.settings.screenShake ? 'On' : 'Off')
      this.toggleStatusText.setColor(this.settings.screenShake ? '#66bb6a' : '#888888')
    }
  }

  private createFooter(): void {
    // Reset to Defaults button
    const resetBtnX = 25
    const resetBtnY = PANEL_HEIGHT - 50

    const resetBg = this.scene.add.graphics()
    resetBg.fillStyle(COLORS.WARNING, 0.3)
    resetBg.fillRoundedRect(resetBtnX, resetBtnY, 130, 36, 8)
    this.container.add(resetBg)

    const resetText = this.scene.add.text(resetBtnX + 65, resetBtnY + 18, 'Reset Defaults', {
      ...TEXT_STYLES.BODY,
      fontSize: '13px',
      color: '#ffa726',
    })
    resetText.setOrigin(0.5)
    this.container.add(resetText)

    const resetHitArea = this.scene.add.rectangle(resetBtnX + 65, resetBtnY + 18, 130, 36)
    resetHitArea.setInteractive({ useHandCursor: true })
    resetHitArea.on('pointerover', () => {
      resetBg.clear()
      resetBg.fillStyle(COLORS.WARNING, 0.5)
      resetBg.fillRoundedRect(resetBtnX, resetBtnY, 130, 36, 8)
    })
    resetHitArea.on('pointerout', () => {
      resetBg.clear()
      resetBg.fillStyle(COLORS.WARNING, 0.3)
      resetBg.fillRoundedRect(resetBtnX, resetBtnY, 130, 36, 8)
    })
    resetHitArea.on('pointerdown', () => {
      this.resetToDefaults()
    })
    this.container.add(resetHitArea)

    // Save button
    const saveBtnX = PANEL_WIDTH - 125
    const saveBtnY = PANEL_HEIGHT - 50

    const saveBg = this.scene.add.graphics()
    saveBg.fillStyle(COLORS.SUCCESS, 0.8)
    saveBg.fillRoundedRect(saveBtnX, saveBtnY, 100, 36, 8)
    this.container.add(saveBg)

    const saveText = this.scene.add.text(saveBtnX + 50, saveBtnY + 18, 'Save', {
      ...TEXT_STYLES.BUTTON,
      fontSize: '15px',
    })
    saveText.setOrigin(0.5)
    this.container.add(saveText)

    const saveHitArea = this.scene.add.rectangle(saveBtnX + 50, saveBtnY + 18, 100, 36)
    saveHitArea.setInteractive({ useHandCursor: true })
    saveHitArea.on('pointerover', () => {
      saveBg.clear()
      saveBg.fillStyle(COLORS.SUCCESS, 1)
      saveBg.fillRoundedRect(saveBtnX, saveBtnY, 100, 36, 8)
    })
    saveHitArea.on('pointerout', () => {
      saveBg.clear()
      saveBg.fillStyle(COLORS.SUCCESS, 0.8)
      saveBg.fillRoundedRect(saveBtnX, saveBtnY, 100, 36, 8)
    })
    saveHitArea.on('pointerdown', () => {
      this.saveAndApply()
    })
    this.container.add(saveHitArea)
  }

  private resetToDefaults(): void {
    this.settings = getDefaultSettings()

    // Update sliders
    this.musicSlider?.setValue(this.settings.musicVolume)
    this.sfxSlider?.setValue(this.settings.sfxVolume)

    // Update text speed buttons
    this.updateTextSpeedButtons()

    // Update toggle
    this.updateToggleVisual()

    applyAudioSettings(this.settings)
    playSfx(SFX_KEYS.MENU_SELECT)

    this.showNotification('Settings reset to defaults', '#ffa726')
  }

  private saveAndApply(): void {
    const success = saveSettings(this.settings)
    applyAudioSettings(this.settings)

    if (success) {
      playSfx(SFX_KEYS.MENU_CONFIRM)
      this.showNotification('Settings saved!', '#66bb6a')
    }
  }

  private showNotification(message: string, color: string): void {
    const text = this.scene.add.text(PANEL_WIDTH / 2, PANEL_HEIGHT - 70, message, {
      ...TEXT_STYLES.BODY,
      fontSize: '15px',
      color,
    })
    text.setOrigin(0.5)
    this.container.add(text)

    this.scene.tweens.add({
      targets: text,
      alpha: 0,
      y: text.y - 20,
      duration: 1500,
      delay: 500,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    })
  }

  getSettings(): GameSettings {
    return this.settings
  }

  destroy(): void {
    this.musicSlider?.destroy()
    this.sfxSlider?.destroy()
    this.container.destroy()

    // Clean up file input
    const fileInput = document.getElementById('save-import-input')
    if (fileInput) {
      fileInput.remove()
    }
  }
}
