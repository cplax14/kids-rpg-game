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

export class InputSystem {
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys
  private readonly wasd: {
    readonly W: Phaser.Input.Keyboard.Key
    readonly A: Phaser.Input.Keyboard.Key
    readonly S: Phaser.Input.Keyboard.Key
    readonly D: Phaser.Input.Keyboard.Key
  }
  private readonly interactKey: Phaser.Input.Keyboard.Key
  private readonly menuKey: Phaser.Input.Keyboard.Key
  private readonly cancelKey: Phaser.Input.Keyboard.Key
  private enabled: boolean = true

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard

    if (!keyboard) {
      throw new Error('Keyboard input not available')
    }

    this.cursors = keyboard.createCursorKeys()
    this.wasd = {
      W: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    }
    this.interactKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E)
    this.menuKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    this.cancelKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X)
  }

  getState(): InputState {
    if (!this.enabled) return EMPTY_INPUT

    return {
      up: this.cursors.up.isDown || this.wasd.W.isDown,
      down: this.cursors.down.isDown || this.wasd.S.isDown,
      left: this.cursors.left.isDown || this.wasd.A.isDown,
      right: this.cursors.right.isDown || this.wasd.D.isDown,
      interact: Phaser.Input.Keyboard.JustDown(this.interactKey) ||
        Phaser.Input.Keyboard.JustDown(this.cursors.space),
      menu: Phaser.Input.Keyboard.JustDown(this.menuKey),
      cancel: Phaser.Input.Keyboard.JustDown(this.cancelKey),
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  isEnabled(): boolean {
    return this.enabled
  }
}
