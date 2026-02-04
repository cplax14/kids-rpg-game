import Phaser from 'phaser'

const eventBus = new Phaser.Events.EventEmitter()

export function emit(event: string, payload?: unknown): void {
  eventBus.emit(event, payload)
}

export function on(event: string, callback: (payload?: unknown) => void, context?: unknown): void {
  eventBus.on(event, callback, context)
}

export function once(
  event: string,
  callback: (payload?: unknown) => void,
  context?: unknown,
): void {
  eventBus.once(event, callback, context)
}

export function off(
  event: string,
  callback?: (payload?: unknown) => void,
  context?: unknown,
): void {
  eventBus.off(event, callback, context)
}

export function removeAllListeners(event?: string): void {
  eventBus.removeAllListeners(event)
}

export const EventBus = {
  emit,
  on,
  once,
  off,
  removeAllListeners,
} as const
