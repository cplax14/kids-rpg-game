import Phaser from 'phaser'
import {
  SCENE_KEYS,
  GAME_WIDTH,
  GAME_HEIGHT,
  COLORS,
  TEXT_STYLES,
  DEPTH,
  CLOUD_SAVE_ENABLED,
} from '../config'
import { hasSaveData } from '../utils/storage'
import { SaveLoadPanel } from '../ui/menus/SaveLoadPanel'
import { SettingsPanel } from '../ui/menus/SettingsPanel'
import { AuthPanel } from '../ui/menus/AuthPanel'
import { loadSaveGame, gameStateFromSave } from '../systems/SaveSystem'
import { loadSettings, applyAudioSettings } from '../systems/SettingsManager'
import { initAudioSystem, playMusic, playSfx, MUSIC_KEYS, SFX_KEYS } from '../systems/AudioSystem'
import {
  initAuth,
  isAuthenticated,
  getUser,
  getUserDisplayName,
  onAuthStateChange,
} from '../systems/AuthSystem'
import { hasLocalSavesToMigrate } from '../systems/CloudSaveSystem'

export class TitleScene extends Phaser.Scene {
  private saveLoadPanel: SaveLoadPanel | null = null
  private settingsPanel: SettingsPanel | null = null
  private authPanel: AuthPanel | null = null
  private mainMenuContainer: Phaser.GameObjects.Container | null = null
  private userInfoContainer: Phaser.GameObjects.Container | null = null
  private loginButton: Phaser.GameObjects.Container | null = null
  private audioUnlocked = false
  private authUnsubscribe: (() => void) | null = null

  constructor() {
    super({ key: SCENE_KEYS.TITLE })
  }

  async create(): Promise<void> {
    // Initialize audio system
    initAudioSystem(this)

    // Apply saved audio settings
    const settings = loadSettings()
    applyAudioSettings(settings)

    // Initialize auth system
    if (CLOUD_SAVE_ENABLED) {
      await initAuth()
    }

    this.createBackground()
    this.createTitle()
    this.createMainMenu()
    this.createFooter()
    this.createAuthArea()
    this.createAudioPrompt()

    // Listen for auth state changes
    if (CLOUD_SAVE_ENABLED) {
      this.authUnsubscribe = onAuthStateChange(() => {
        this.updateAuthArea()
        this.checkMigration()
      })
    }
  }

  shutdown(): void {
    if (this.authUnsubscribe) {
      this.authUnsubscribe()
      this.authUnsubscribe = null
    }
  }

  private createBackground(): void {
    // Battle background as base
    if (this.textures.exists('battle-bg-forest')) {
      const bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'battle-bg-forest')
      bg.setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      bg.setTint(0x666688)
    } else {
      const fallback = this.add.graphics()
      fallback.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e)
      fallback.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    }

    this.createMonsterCollage()

    // Dark center overlay so title + buttons stay readable
    const overlay = this.add.graphics()
    overlay.fillStyle(0x0a0a1a, 0.65)
    overlay.fillRect(GAME_WIDTH / 2 - 250, 0, 500, GAME_HEIGHT)

    // Soft edge fade: two gradient strips alongside the center band
    const edgeWidth = 120
    for (let i = 0; i < edgeWidth; i++) {
      const alpha = 0.65 * (1 - i / edgeWidth)
      overlay.fillStyle(0x0a0a1a, alpha)
      overlay.fillRect(GAME_WIDTH / 2 - 250 - edgeWidth + i, 0, 1, GAME_HEIGHT)
      overlay.fillRect(GAME_WIDTH / 2 + 250 + (edgeWidth - i), 0, 1, GAME_HEIGHT)
    }
  }

  private createMonsterCollage(): void {
    // Curated monster positions: placed around edges, avoiding center button column
    const monsterLayout: ReadonlyArray<{
      icon: number
      x: number
      y: number
      scale: number
      angle: number
    }> = [
      // Left side cluster
      { icon: 1, x: 100, y: 160, scale: 1.1, angle: -5 },
      { icon: 54, x: 80, y: 370, scale: 1.2, angle: 8 },
      { icon: 61, x: 130, y: 560, scale: 1.0, angle: -3 },

      // Far left
      { icon: 27, x: 260, y: 80, scale: 0.9, angle: 4 },
      { icon: 51, x: 250, y: 620, scale: 0.85, angle: -6 },

      // Right side cluster
      { icon: 4, x: 1180, y: 140, scale: 1.1, angle: 5 },
      { icon: 58, x: 1160, y: 360, scale: 1.2, angle: -8 },
      { icon: 8, x: 1150, y: 560, scale: 1.0, angle: 3 },

      // Far right
      { icon: 19, x: 1020, y: 80, scale: 0.9, angle: -4 },
      { icon: 55, x: 1030, y: 630, scale: 0.85, angle: 6 },

      // Top/bottom accent
      { icon: 56, x: 50, y: 50, scale: 0.7, angle: 12 },
      { icon: 52, x: 1230, y: 670, scale: 0.7, angle: -10 },
    ]

    monsterLayout.forEach(({ icon, x, y, scale, angle }, index) => {
      const key = `monster-battle-${icon}`
      if (!this.textures.exists(key)) return

      const sprite = this.add.image(x, y, key)
      sprite.setScale(scale)
      sprite.setOrigin(0.5)
      sprite.setAngle(angle)
      sprite.setAlpha(0.85)

      // Gentle floating bob
      this.tweens.add({
        targets: sprite,
        y: y + (index % 2 === 0 ? 6 : -6),
        duration: 2500 + index * 300,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    })
  }

  private createTitle(): void {
    const centerX = GAME_WIDTH / 2

    // Main title with shadow
    const shadow = this.add.text(centerX + 3, 103, 'Monster Quest', {
      ...TEXT_STYLES.HEADING,
      fontSize: '64px',
      color: '#000000',
    })
    shadow.setOrigin(0.5)
    shadow.setAlpha(0.4)

    const title = this.add.text(centerX, 100, 'Monster Quest', {
      ...TEXT_STYLES.HEADING,
      fontSize: '64px',
      color: '#ffd54f',
    })
    title.setOrigin(0.5)

    // Subtitle
    const subtitle = this.add.text(centerX, 170, 'Capture  \u2022  Breed  \u2022  Battle', {
      ...TEXT_STYLES.BODY,
      fontSize: '22px',
      color: '#b0bec5',
    })
    subtitle.setOrigin(0.5)

    // Animate title
    this.tweens.add({
      targets: [title, shadow],
      y: '+=8',
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  private createMainMenu(): void {
    this.mainMenuContainer = this.add.container(0, 0)

    const centerX = GAME_WIDTH / 2
    const startY = 300

    this.createButton(centerX, startY, 'New Game', () => {
      playSfx(SFX_KEYS.MENU_CONFIRM)
      this.startNewGame()
    })

    const hasSave = hasSaveData(0) || hasSaveData(1) || hasSaveData(2)
    const continueButton = this.createButton(centerX, startY + 70, 'Continue', () => {
      if (hasSave) {
        playSfx(SFX_KEYS.MENU_SELECT)
        this.showSaveLoadPanel()
      }
    })

    if (!hasSave) {
      continueButton.forEach((obj) => {
        if ('setAlpha' in obj) {
          ;(obj as Phaser.GameObjects.Image | Phaser.GameObjects.Text).setAlpha(0.4)
        }
      })
    }

    this.createButton(centerX, startY + 140, 'Settings', () => {
      playSfx(SFX_KEYS.MENU_SELECT)
      this.showSettingsPanel()
    })
  }

  private createButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
  ): Phaser.GameObjects.GameObject[] {
    const bg = this.add.image(x, y, 'button')
    bg.setOrigin(0.5)
    bg.setInteractive({ useHandCursor: true })

    const text = this.add.text(x, y, label, TEXT_STYLES.BUTTON)
    text.setOrigin(0.5)

    if (this.mainMenuContainer) {
      this.mainMenuContainer.add([bg, text])
    }

    bg.on('pointerover', () => {
      bg.setTexture('button-hover')
      this.tweens.add({
        targets: [bg, text],
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100,
        ease: 'Power1',
      })
    })

    bg.on('pointerout', () => {
      bg.setTexture('button')
      this.tweens.add({
        targets: [bg, text],
        scaleX: 1.0,
        scaleY: 1.0,
        duration: 100,
        ease: 'Power1',
      })
    })

    bg.on('pointerdown', () => {
      this.tweens.add({
        targets: [bg, text],
        scaleX: 0.95,
        scaleY: 0.95,
        duration: 50,
        ease: 'Power1',
        yoyo: true,
        onComplete: onClick,
      })
    })

    return [bg, text]
  }

  private createFooter(): void {
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, 'v0.8.0 - Phase 8', {
      ...TEXT_STYLES.SMALL,
      color: '#546e7a',
    })
    text.setOrigin(0.5)
  }

  private createAuthArea(): void {
    if (!CLOUD_SAVE_ENABLED) {
      return
    }

    this.updateAuthArea()
  }

  private updateAuthArea(): void {
    // Clean up existing auth UI
    if (this.userInfoContainer) {
      this.userInfoContainer.destroy()
      this.userInfoContainer = null
    }
    if (this.loginButton) {
      this.loginButton.destroy()
      this.loginButton = null
    }

    if (isAuthenticated()) {
      this.createUserInfo()
    } else {
      this.createLoginButton()
    }
  }

  private createLoginButton(): void {
    this.loginButton = this.add.container(GAME_WIDTH - 100, 25)

    const bg = this.add.graphics()
    bg.fillStyle(COLORS.PRIMARY, 0.6)
    bg.fillRoundedRect(0, 0, 90, 30, 6)
    this.loginButton.add(bg)

    const icon = this.add.text(12, 15, '☁️', { fontSize: '14px' })
    icon.setOrigin(0, 0.5)
    this.loginButton.add(icon)

    const text = this.add.text(55, 15, 'Sign In', {
      ...TEXT_STYLES.SMALL,
      fontSize: '12px',
    })
    text.setOrigin(0.5)
    this.loginButton.add(text)

    const hitArea = this.add.rectangle(45, 15, 90, 30)
    hitArea.setInteractive({ useHandCursor: true })

    hitArea.on('pointerover', () => {
      bg.clear()
      bg.fillStyle(COLORS.PRIMARY, 0.9)
      bg.fillRoundedRect(0, 0, 90, 30, 6)
    })

    hitArea.on('pointerout', () => {
      bg.clear()
      bg.fillStyle(COLORS.PRIMARY, 0.6)
      bg.fillRoundedRect(0, 0, 90, 30, 6)
    })

    hitArea.on('pointerdown', () => {
      playSfx(SFX_KEYS.MENU_SELECT)
      this.showAuthPanel()
    })

    this.loginButton.add(hitArea)
  }

  private createUserInfo(): void {
    const user = getUser()
    const displayName = getUserDisplayName()

    this.userInfoContainer = this.add.container(GAME_WIDTH - 130, 25)

    // Avatar circle with initial
    const avatarBg = this.add.graphics()
    avatarBg.fillStyle(COLORS.SUCCESS, 1)
    avatarBg.fillCircle(15, 15, 15)
    this.userInfoContainer.add(avatarBg)

    const initial = displayName.charAt(0).toUpperCase()
    const initialText = this.add.text(15, 15, initial, {
      fontFamily: 'Arial Black',
      fontSize: '14px',
      color: '#ffffff',
    })
    initialText.setOrigin(0.5)
    this.userInfoContainer.add(initialText)

    // User name (truncated if needed)
    const shortName = displayName.length > 12 ? displayName.substring(0, 12) + '...' : displayName
    const nameText = this.add.text(38, 15, shortName, {
      ...TEXT_STYLES.SMALL,
      fontSize: '12px',
      color: '#ffffff',
    })
    nameText.setOrigin(0, 0.5)
    this.userInfoContainer.add(nameText)

    // Cloud sync indicator
    const cloudIcon = this.add.text(GAME_WIDTH - 30 - this.userInfoContainer.x, 15, '☁️', {
      fontSize: '14px',
    })
    cloudIcon.setOrigin(0.5)
    this.userInfoContainer.add(cloudIcon)

    // Make clickable to show auth panel
    const hitArea = this.add.rectangle(70, 15, 140, 30)
    hitArea.setInteractive({ useHandCursor: true })
    hitArea.on('pointerdown', () => {
      playSfx(SFX_KEYS.MENU_SELECT)
      this.showAuthPanel()
    })
    this.userInfoContainer.add(hitArea)
  }

  private showAuthPanel(): void {
    if (this.mainMenuContainer) {
      this.mainMenuContainer.setVisible(false)
    }

    this.authPanel = new AuthPanel(this, GAME_WIDTH / 2 - 200, GAME_HEIGHT / 2 - 160, {
      onClose: () => {
        this.hideAuthPanel()
      },
      onAuthChange: () => {
        this.updateAuthArea()
      },
    })
  }

  private hideAuthPanel(): void {
    if (this.authPanel) {
      this.authPanel.destroy()
      this.authPanel = null
    }
    if (this.mainMenuContainer) {
      this.mainMenuContainer.setVisible(true)
    }
  }

  private checkMigration(): void {
    if (isAuthenticated() && hasLocalSavesToMigrate()) {
      // Count local saves
      let localSaveCount = 0
      for (let i = 0; i < 3; i++) {
        if (hasSaveData(i)) {
          localSaveCount++
        }
      }

      if (localSaveCount > 0 && this.authPanel) {
        this.authPanel.showMigrationPrompt(localSaveCount)
      }
    }
  }

  private createAudioPrompt(): void {
    const promptContainer = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT - 80)
    promptContainer.setDepth(DEPTH.UI)

    const promptText = this.add.text(0, 0, 'Click anywhere to enable audio', {
      ...TEXT_STYLES.SMALL,
      fontSize: '14px',
      color: '#888888',
    })
    promptText.setOrigin(0.5)
    promptContainer.add(promptText)

    // Blink animation
    this.tweens.add({
      targets: promptText,
      alpha: 0.4,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Click anywhere to unlock audio
    this.input.once('pointerdown', () => {
      if (!this.audioUnlocked) {
        this.audioUnlocked = true
        promptContainer.destroy()

        // Play title music
        playMusic(MUSIC_KEYS.TITLE_THEME, { fadeIn: 1000 })
      }
    })
  }

  private showSaveLoadPanel(): void {
    if (this.mainMenuContainer) {
      this.mainMenuContainer.setVisible(false)
    }

    this.saveLoadPanel = new SaveLoadPanel(this, GAME_WIDTH / 2 - 300, GAME_HEIGHT / 2 - 200, {
      mode: 'load',
      onSelect: (slot) => {
        this.loadFromSlot(slot)
      },
      onCancel: () => {
        this.hideSaveLoadPanel()
      },
    })
  }

  private hideSaveLoadPanel(): void {
    if (this.saveLoadPanel) {
      this.saveLoadPanel.destroy()
      this.saveLoadPanel = null
    }
    if (this.mainMenuContainer) {
      this.mainMenuContainer.setVisible(true)
    }
  }

  private showSettingsPanel(): void {
    if (this.mainMenuContainer) {
      this.mainMenuContainer.setVisible(false)
    }

    // Create a container for settings panel with close button
    const settingsContainer = this.add.container(GAME_WIDTH / 2 - 300, GAME_HEIGHT / 2 - 220)
    settingsContainer.setDepth(DEPTH.OVERLAY)

    // Background overlay
    const overlay = this.add.graphics()
    overlay.fillStyle(0x000000, 0.7)
    overlay.fillRect(-GAME_WIDTH, -GAME_HEIGHT, GAME_WIDTH * 3, GAME_HEIGHT * 3)
    settingsContainer.add(overlay)

    this.settingsPanel = new SettingsPanel(this, GAME_WIDTH / 2 - 300, GAME_HEIGHT / 2 - 200)

    // Close button - red rectangle with "Close" text
    const closeBtnX = GAME_WIDTH / 2 + 220
    const closeBtnY = GAME_HEIGHT / 2 - 195
    const closeBtnWidth = 80
    const closeBtnHeight = 36

    const closeBtnBg = this.add.graphics()
    closeBtnBg.fillStyle(COLORS.DANGER, 0.9)
    closeBtnBg.fillRoundedRect(closeBtnX, closeBtnY, closeBtnWidth, closeBtnHeight, 8)
    closeBtnBg.lineStyle(2, 0xffffff, 0.3)
    closeBtnBg.strokeRoundedRect(closeBtnX, closeBtnY, closeBtnWidth, closeBtnHeight, 8)

    const closeBtnText = this.add.text(
      closeBtnX + closeBtnWidth / 2,
      closeBtnY + closeBtnHeight / 2,
      'Close',
      {
        ...TEXT_STYLES.BUTTON,
        fontSize: '16px',
        color: '#ffffff',
      },
    )
    closeBtnText.setOrigin(0.5)

    const closeBtnHitArea = this.add.rectangle(
      closeBtnX + closeBtnWidth / 2,
      closeBtnY + closeBtnHeight / 2,
      closeBtnWidth,
      closeBtnHeight,
    )
    closeBtnHitArea.setInteractive({ useHandCursor: true })
    closeBtnHitArea.on('pointerover', () => {
      closeBtnBg.clear()
      closeBtnBg.fillStyle(COLORS.DANGER, 1)
      closeBtnBg.fillRoundedRect(closeBtnX, closeBtnY, closeBtnWidth, closeBtnHeight, 8)
      closeBtnBg.lineStyle(2, 0xffffff, 0.5)
      closeBtnBg.strokeRoundedRect(closeBtnX, closeBtnY, closeBtnWidth, closeBtnHeight, 8)
    })
    closeBtnHitArea.on('pointerout', () => {
      closeBtnBg.clear()
      closeBtnBg.fillStyle(COLORS.DANGER, 0.9)
      closeBtnBg.fillRoundedRect(closeBtnX, closeBtnY, closeBtnWidth, closeBtnHeight, 8)
      closeBtnBg.lineStyle(2, 0xffffff, 0.3)
      closeBtnBg.strokeRoundedRect(closeBtnX, closeBtnY, closeBtnWidth, closeBtnHeight, 8)
    })
    closeBtnHitArea.on('pointerdown', () => {
      playSfx(SFX_KEYS.MENU_SELECT)
      settingsContainer.destroy()
      closeBtnBg.destroy()
      closeBtnText.destroy()
      closeBtnHitArea.destroy()
      this.settingsPanel?.destroy()
      this.settingsPanel = null
      if (this.mainMenuContainer) {
        this.mainMenuContainer.setVisible(true)
      }
    })
  }

  private loadFromSlot(slot: number): void {
    const save = loadSaveGame(slot)
    if (!save) return

    playSfx(SFX_KEYS.MENU_CONFIRM)

    this.cameras.main.fadeOut(500, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      // Set game state from save before starting world scene
      const gameState = gameStateFromSave(save)

      this.scene.start(SCENE_KEYS.WORLD, {
        newGame: false,
        saveSlot: slot,
        savedState: gameState,
        playTime: save.playTime,
        areaId: save.currentAreaId,
      })
    })
  }

  private startNewGame(): void {
    this.cameras.main.fadeOut(500, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENE_KEYS.WORLD, { newGame: true })
    })
  }
}
