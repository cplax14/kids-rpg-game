import Phaser from 'phaser'

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

  private readonly keydownHandler: (e: KeyboardEvent) => void
  private readonly keyupHandler: (e: KeyboardEvent) => void
  private readonly blurHandler: () => void
  private readonly visibilityHandler: () => void

  constructor(_scene: Phaser.Scene) {
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

    const state: InputState = {
      up: this.isKeyDown(KEY_BINDINGS.up),
      down: this.isKeyDown(KEY_BINDINGS.down),
      left: this.isKeyDown(KEY_BINDINGS.left),
      right: this.isKeyDown(KEY_BINDINGS.right),
      interact: this.isKeyJustPressed(KEY_BINDINGS.interact),
      menu: this.isKeyJustPressed(KEY_BINDINGS.menu),
      cancel: this.isKeyJustPressed(KEY_BINDINGS.cancel),
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

  destroy(): void {
    window.removeEventListener('keydown', this.keydownHandler)
    window.removeEventListener('keyup', this.keyupHandler)
    window.removeEventListener('blur', this.blurHandler)
    document.removeEventListener('visibilitychange', this.visibilityHandler)
  }
}
