import Phaser from 'phaser'
import { VirtualDPad, type DPadState } from '../ui/controls/VirtualDPad'
import { ActionButton } from '../ui/controls/ActionButton'
import { shouldShowTouchControls } from '../utils/mobile'

export interface InputState {
  readonly up: boolean
  readonly down: boolean
  readonly left: boolean
  readonly right: boolean
  readonly interact: boolean
  readonly menu: boolean
  readonly cancel: boolean
}

const EMPTY_INPUT: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  interact: false,
  menu: false,
  cancel: false,
}

// Key codes for movement and actions
const KEY_BINDINGS = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  interact: ['KeyE', 'Space'],
  menu: ['Escape'],
  cancel: ['KeyX'],
} as const

export class InputSystem {
  private readonly pressedKeys: Set<string> = new Set()
  private readonly justPressedKeys: Set<string> = new Set()
  private enabled: boolean = true

  // Touch controls
  private dpad: VirtualDPad | null = null
  private actionButton: ActionButton | null = null
  private menuButton: ActionButton | null = null
  private cancelButton: ActionButton | null = null
  private touchEnabled: boolean = false

  private readonly keydownHandler: (e: KeyboardEvent) => void
  private readonly keyupHandler: (e: KeyboardEvent) => void
  private readonly blurHandler: () => void
  private readonly visibilityHandler: () => void

  constructor(scene: Phaser.Scene) {
    // Use raw DOM events instead of Phaser's keyboard system for reliability
    this.keydownHandler = (e: KeyboardEvent) => {
      // Prevent default for game keys to avoid scrolling
      if (this.isGameKey(e.code)) {
        e.preventDefault()
      }

      if (!this.pressedKeys.has(e.code)) {
        this.pressedKeys.add(e.code)
        this.justPressedKeys.add(e.code)
      }
    }

    this.keyupHandler = (e: KeyboardEvent) => {
      this.pressedKeys.delete(e.code)
    }

    this.blurHandler = () => {
      this.pressedKeys.clear()
      this.justPressedKeys.clear()
    }

    this.visibilityHandler = () => {
      if (document.hidden) {
        this.pressedKeys.clear()
        this.justPressedKeys.clear()
      }
    }

    window.addEventListener('keydown', this.keydownHandler)
    window.addEventListener('keyup', this.keyupHandler)
    window.addEventListener('blur', this.blurHandler)
    document.addEventListener('visibilitychange', this.visibilityHandler)

    // Initialize touch controls if on a touch device
    this.touchEnabled = shouldShowTouchControls()
    console.log('[InputSystem] Touch controls enabled:', this.touchEnabled)
    console.log('[InputSystem] Scene dimensions:', scene.scale.width, 'x', scene.scale.height)
    if (this.touchEnabled) {
      this.initTouchControls(scene)
      console.log('[InputSystem] Touch controls initialized')
    }
  }

  private initTouchControls(scene: Phaser.Scene): void {
    console.log('[InputSystem] Initializing touch controls')
    console.log('[InputSystem] Camera dimensions:', scene.cameras.main.width, 'x', scene.cameras.main.height)

    // D-pad in bottom-left (handles its own responsive positioning)
    this.dpad = new VirtualDPad(scene)

    // Action button (A) in bottom-right - primary position
    this.actionButton = new ActionButton(scene, { label: 'A', position: 'primary' })

    // Menu button (☰) above action button - secondary position
    this.menuButton = new ActionButton(scene, { label: '☰', position: 'secondary' })

    // Cancel button (X) left of action button - tertiary position
    this.cancelButton = new ActionButton(scene, { label: 'X', position: 'tertiary' })
  }

  private isGameKey(code: string): boolean {
    return Object.values(KEY_BINDINGS).some(keys =>
      (keys as readonly string[]).includes(code)
    )
  }

  private isKeyDown(keys: readonly string[]): boolean {
    return keys.some(key => this.pressedKeys.has(key))
  }

  private isKeyJustPressed(keys: readonly string[]): boolean {
    return keys.some(key => this.justPressedKeys.has(key))
  }

  getState(): InputState {
    if (!this.enabled) return EMPTY_INPUT

    // Get keyboard state
    const keyboardUp = this.isKeyDown(KEY_BINDINGS.up)
    const keyboardDown = this.isKeyDown(KEY_BINDINGS.down)
    const keyboardLeft = this.isKeyDown(KEY_BINDINGS.left)
    const keyboardRight = this.isKeyDown(KEY_BINDINGS.right)
    const keyboardInteract = this.isKeyJustPressed(KEY_BINDINGS.interact)
    const keyboardMenu = this.isKeyJustPressed(KEY_BINDINGS.menu)
    const keyboardCancel = this.isKeyJustPressed(KEY_BINDINGS.cancel)

    // Get touch state
    const dpadState: DPadState = this.dpad?.getState() ?? { up: false, down: false, left: false, right: false }
    const touchInteract = this.actionButton?.consumePress() ?? false
    const touchMenu = this.menuButton?.consumePress() ?? false
    const touchCancel = this.cancelButton?.consumePress() ?? false

    // Combine keyboard and touch inputs (OR logic)
    const state: InputState = {
      up: keyboardUp || dpadState.up,
      down: keyboardDown || dpadState.down,
      left: keyboardLeft || dpadState.left,
      right: keyboardRight || dpadState.right,
      interact: keyboardInteract || touchInteract,
      menu: keyboardMenu || touchMenu,
      cancel: keyboardCancel || touchCancel,
    }

    // Clear just-pressed keys after reading (they only fire once per press)
    this.justPressedKeys.clear()

    return state
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (enabled) {
      // Clear any stale key states when re-enabling
      this.pressedKeys.clear()
      this.justPressedKeys.clear()
    }
  }

  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Show or hide touch controls
   */
  setTouchControlsVisible(visible: boolean): void {
    this.dpad?.setVisible(visible)
    this.actionButton?.setVisible(visible)
    this.menuButton?.setVisible(visible)
    this.cancelButton?.setVisible(visible)
  }

  /**
   * Check if touch controls are active
   */
  hasTouchControls(): boolean {
    return this.touchEnabled
  }

  destroy(): void {
    window.removeEventListener('keydown', this.keydownHandler)
    window.removeEventListener('keyup', this.keyupHandler)
    window.removeEventListener('blur', this.blurHandler)
    document.removeEventListener('visibilitychange', this.visibilityHandler)

    // Clean up touch controls
    this.dpad?.destroy()
    this.actionButton?.destroy()
    this.menuButton?.destroy()
    this.cancelButton?.destroy()
  }
}
