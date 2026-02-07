import Phaser from 'phaser'
import { COLORS, TEXT_STYLES, DEPTH } from '../../config'
import {
  signInWithGoogle,
  signOut,
  getUser,
  isAuthenticated,
  getUserDisplayName,
  getUserAvatar,
} from '../../systems/AuthSystem'
import { hasLocalSavesToMigrate, migrateLocalSavesToCloud } from '../../systems/CloudSaveSystem'
import { playSfx, SFX_KEYS } from '../../systems/AudioSystem'

interface AuthPanelOptions {
  readonly onClose?: () => void
  readonly onAuthChange?: (isAuthenticated: boolean) => void
}

const PANEL_WIDTH = 400
const PANEL_HEIGHT = 320

export class AuthPanel {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private onClose?: () => void
  private onAuthChange?: (isAuthenticated: boolean) => void
  private migrationDialog: Phaser.GameObjects.Container | null = null

  constructor(scene: Phaser.Scene, x: number, y: number, options: AuthPanelOptions = {}) {
    this.scene = scene
    this.onClose = options.onClose
    this.onAuthChange = options.onAuthChange

    this.container = scene.add.container(x, y)
    this.container.setDepth(DEPTH.OVERLAY + 5)

    this.createBackground()
    this.createContent()
  }

  private createBackground(): void {
    // Dim overlay
    const overlay = this.scene.add.graphics()
    overlay.fillStyle(0x000000, 0.7)
    overlay.fillRect(-1000, -1000, 3000, 3000)
    this.container.add(overlay)

    // Panel background
    const bg = this.scene.add.graphics()
    bg.fillStyle(COLORS.PANEL_BG, 0.98)
    bg.fillRoundedRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 12)
    bg.lineStyle(2, COLORS.PRIMARY)
    bg.strokeRoundedRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 12)
    this.container.add(bg)

    // Close button
    const closeBtn = this.scene.add.text(PANEL_WIDTH - 30, 15, 'X', {
      ...TEXT_STYLES.HEADING,
      fontSize: '20px',
      color: '#888888',
    })
    closeBtn.setInteractive({ useHandCursor: true })
    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'))
    closeBtn.on('pointerout', () => closeBtn.setColor('#888888'))
    closeBtn.on('pointerdown', () => {
      playSfx(SFX_KEYS.MENU_SELECT)
      this.onClose?.()
    })
    this.container.add(closeBtn)
  }

  private createContent(): void {
    if (isAuthenticated()) {
      this.createLoggedInView()
    } else {
      this.createLoginView()
    }
  }

  private createLoginView(): void {
    // Title
    const title = this.scene.add.text(PANEL_WIDTH / 2, 30, 'Sign In', {
      ...TEXT_STYLES.HEADING,
      fontSize: '24px',
    })
    title.setOrigin(0.5)
    this.container.add(title)

    // Description
    const desc = this.scene.add.text(
      PANEL_WIDTH / 2,
      75,
      'Sign in to sync your saves\nacross devices',
      {
        ...TEXT_STYLES.BODY,
        fontSize: '15px',
        color: '#b0bec5',
        align: 'center',
      },
    )
    desc.setOrigin(0.5)
    this.container.add(desc)

    // Cloud icon
    const cloudIcon = this.scene.add.text(PANEL_WIDTH / 2, 130, '☁️', {
      fontSize: '48px',
    })
    cloudIcon.setOrigin(0.5)
    this.container.add(cloudIcon)

    // Google sign-in button
    this.createGoogleButton(PANEL_WIDTH / 2, 200)

    // Guest info
    const guestInfo = this.scene.add.text(
      PANEL_WIDTH / 2,
      270,
      'Playing as guest? Your saves are stored locally.',
      {
        ...TEXT_STYLES.SMALL,
        fontSize: '12px',
        color: '#666666',
        align: 'center',
      },
    )
    guestInfo.setOrigin(0.5)
    this.container.add(guestInfo)
  }

  private createGoogleButton(x: number, y: number): void {
    const btnWidth = 280
    const btnHeight = 48

    const btnContainer = this.scene.add.container(x - btnWidth / 2, y - btnHeight / 2)
    this.container.add(btnContainer)

    // Button background
    const bg = this.scene.add.graphics()
    bg.fillStyle(0xffffff, 1)
    bg.fillRoundedRect(0, 0, btnWidth, btnHeight, 8)
    btnContainer.add(bg)

    // Google "G" logo placeholder
    const gLogo = this.scene.add.text(20, btnHeight / 2, 'G', {
      fontFamily: 'Arial Black',
      fontSize: '22px',
      color: '#4285f4',
    })
    gLogo.setOrigin(0, 0.5)
    btnContainer.add(gLogo)

    // Button text
    const text = this.scene.add.text(btnWidth / 2 + 10, btnHeight / 2, 'Sign in with Google', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#333333',
    })
    text.setOrigin(0.5)
    btnContainer.add(text)

    // Hit area
    const hitArea = this.scene.add.rectangle(btnWidth / 2, btnHeight / 2, btnWidth, btnHeight)
    hitArea.setInteractive({ useHandCursor: true })

    hitArea.on('pointerover', () => {
      bg.clear()
      bg.fillStyle(0xf5f5f5, 1)
      bg.fillRoundedRect(0, 0, btnWidth, btnHeight, 8)
      bg.lineStyle(1, 0xdddddd)
      bg.strokeRoundedRect(0, 0, btnWidth, btnHeight, 8)
    })

    hitArea.on('pointerout', () => {
      bg.clear()
      bg.fillStyle(0xffffff, 1)
      bg.fillRoundedRect(0, 0, btnWidth, btnHeight, 8)
    })

    hitArea.on('pointerdown', () => {
      playSfx(SFX_KEYS.MENU_CONFIRM)
      this.handleGoogleSignIn()
    })

    btnContainer.add(hitArea)
  }

  private async handleGoogleSignIn(): Promise<void> {
    const success = await signInWithGoogle()
    if (success) {
      // OAuth will redirect, so this might not execute
      this.onAuthChange?.(true)
    }
  }

  private createLoggedInView(): void {
    const user = getUser()
    const displayName = getUserDisplayName()
    const avatarUrl = getUserAvatar()

    // Title
    const title = this.scene.add.text(PANEL_WIDTH / 2, 25, 'Account', {
      ...TEXT_STYLES.HEADING,
      fontSize: '22px',
    })
    title.setOrigin(0.5)
    this.container.add(title)

    // Avatar placeholder (circle with initial)
    const avatarY = 90
    const avatarBg = this.scene.add.graphics()
    avatarBg.fillStyle(COLORS.PRIMARY, 1)
    avatarBg.fillCircle(PANEL_WIDTH / 2, avatarY, 40)
    this.container.add(avatarBg)

    const initial = displayName.charAt(0).toUpperCase()
    const initialText = this.scene.add.text(PANEL_WIDTH / 2, avatarY, initial, {
      ...TEXT_STYLES.HEADING,
      fontSize: '32px',
    })
    initialText.setOrigin(0.5)
    this.container.add(initialText)

    // If we have an avatar URL, try to load it
    if (avatarUrl) {
      this.loadAvatar(avatarUrl, PANEL_WIDTH / 2, avatarY)
    }

    // User name
    const nameText = this.scene.add.text(PANEL_WIDTH / 2, 150, displayName, {
      ...TEXT_STYLES.BODY,
      fontSize: '18px',
      color: '#ffffff',
    })
    nameText.setOrigin(0.5)
    this.container.add(nameText)

    // Email
    if (user?.email) {
      const emailText = this.scene.add.text(PANEL_WIDTH / 2, 175, user.email, {
        ...TEXT_STYLES.SMALL,
        fontSize: '13px',
        color: '#888888',
      })
      emailText.setOrigin(0.5)
      this.container.add(emailText)
    }

    // Cloud sync status
    const syncStatus = this.scene.add.text(PANEL_WIDTH / 2, 210, '☁️ Cloud saves enabled', {
      ...TEXT_STYLES.BODY,
      fontSize: '14px',
      color: '#66bb6a',
    })
    syncStatus.setOrigin(0.5)
    this.container.add(syncStatus)

    // Sign out button
    this.createSignOutButton(PANEL_WIDTH / 2, 270)
  }

  private loadAvatar(url: string, x: number, y: number): void {
    const key = `avatar-${Date.now()}`

    this.scene.load.image(key, url)
    this.scene.load.once('complete', () => {
      if (this.container.active) {
        const avatar = this.scene.add.image(x, y, key)
        avatar.setDisplaySize(80, 80)

        // Create circular mask
        const mask = this.scene.make.graphics({})
        mask.fillCircle(x, y, 40)
        avatar.setMask(mask.createGeometryMask())

        this.container.add(avatar)
      }
    })
    this.scene.load.start()
  }

  private createSignOutButton(x: number, y: number): void {
    const btnWidth = 140
    const btnHeight = 40

    const bg = this.scene.add.graphics()
    bg.fillStyle(COLORS.DANGER, 0.6)
    bg.fillRoundedRect(x - btnWidth / 2, y - btnHeight / 2, btnWidth, btnHeight, 8)
    this.container.add(bg)

    const text = this.scene.add.text(x, y, 'Sign Out', {
      ...TEXT_STYLES.BODY,
      fontSize: '15px',
    })
    text.setOrigin(0.5)
    this.container.add(text)

    const hitArea = this.scene.add.rectangle(x, y, btnWidth, btnHeight)
    hitArea.setInteractive({ useHandCursor: true })

    hitArea.on('pointerover', () => {
      bg.clear()
      bg.fillStyle(COLORS.DANGER, 0.9)
      bg.fillRoundedRect(x - btnWidth / 2, y - btnHeight / 2, btnWidth, btnHeight, 8)
    })

    hitArea.on('pointerout', () => {
      bg.clear()
      bg.fillStyle(COLORS.DANGER, 0.6)
      bg.fillRoundedRect(x - btnWidth / 2, y - btnHeight / 2, btnWidth, btnHeight, 8)
    })

    hitArea.on('pointerdown', () => {
      playSfx(SFX_KEYS.MENU_SELECT)
      this.handleSignOut()
    })

    this.container.add(hitArea)
  }

  private async handleSignOut(): Promise<void> {
    const success = await signOut()
    if (success) {
      this.onAuthChange?.(false)
      this.refresh()
    }
  }

  showMigrationPrompt(localSaveCount: number): void {
    if (this.migrationDialog) {
      this.migrationDialog.destroy()
    }

    this.migrationDialog = this.scene.add.container(PANEL_WIDTH / 2 - 140, 100)
    this.migrationDialog.setDepth(DEPTH.OVERLAY + 10)
    this.container.add(this.migrationDialog)

    // Background
    const bg = this.scene.add.graphics()
    bg.fillStyle(COLORS.DARK_BG, 0.98)
    bg.fillRoundedRect(0, 0, 280, 150, 10)
    bg.lineStyle(2, COLORS.SUCCESS)
    bg.strokeRoundedRect(0, 0, 280, 150, 10)
    this.migrationDialog.add(bg)

    // Title
    const title = this.scene.add.text(140, 20, 'Upload Local Saves?', {
      ...TEXT_STYLES.BODY,
      fontSize: '15px',
      fontStyle: 'bold',
    })
    title.setOrigin(0.5)
    this.migrationDialog.add(title)

    // Message
    const msg = this.scene.add.text(
      140,
      55,
      `You have ${localSaveCount} local save${localSaveCount > 1 ? 's' : ''}.\nUpload to cloud for sync?`,
      {
        ...TEXT_STYLES.SMALL,
        fontSize: '13px',
        color: '#b0bec5',
        align: 'center',
      },
    )
    msg.setOrigin(0.5)
    this.migrationDialog.add(msg)

    // No button
    const noBtn = this.createMigrationButton(50, 110, 'Skip', COLORS.SECONDARY, () => {
      this.migrationDialog?.destroy()
      this.migrationDialog = null
    })
    this.migrationDialog.add(noBtn)

    // Yes button
    const yesBtn = this.createMigrationButton(160, 110, 'Upload', COLORS.SUCCESS, async () => {
      playSfx(SFX_KEYS.MENU_CONFIRM)
      await migrateLocalSavesToCloud()
      this.migrationDialog?.destroy()
      this.migrationDialog = null
    })
    this.migrationDialog.add(yesBtn)
  }

  private createMigrationButton(
    x: number,
    y: number,
    label: string,
    color: number,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y)

    const bg = this.scene.add.graphics()
    bg.fillStyle(color, 0.7)
    bg.fillRoundedRect(0, 0, 70, 30, 6)
    container.add(bg)

    const text = this.scene.add.text(35, 15, label, {
      ...TEXT_STYLES.BODY,
      fontSize: '13px',
    })
    text.setOrigin(0.5)
    container.add(text)

    const hitArea = this.scene.add.rectangle(35, 15, 70, 30)
    hitArea.setInteractive({ useHandCursor: true })
    hitArea.on('pointerdown', onClick)
    hitArea.on('pointerover', () => {
      bg.clear()
      bg.fillStyle(color, 1)
      bg.fillRoundedRect(0, 0, 70, 30, 6)
    })
    hitArea.on('pointerout', () => {
      bg.clear()
      bg.fillStyle(color, 0.7)
      bg.fillRoundedRect(0, 0, 70, 30, 6)
    })
    container.add(hitArea)

    return container
  }

  refresh(): void {
    // Clear content (except background overlay and panel)
    const children = this.container.getAll()
    for (let i = children.length - 1; i >= 3; i--) {
      ;(children[i] as Phaser.GameObjects.GameObject).destroy()
    }

    this.createContent()
  }

  destroy(): void {
    if (this.migrationDialog) {
      this.migrationDialog.destroy()
    }
    this.container.destroy()
  }
}
