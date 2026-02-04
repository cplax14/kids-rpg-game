export function generateId(): string {
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 10)
  return `${timestamp}-${randomPart}`
}

export function generateMonsterId(): string {
  return `mon-${generateId()}`
}

export function generateSaveId(slot: number): string {
  return `save-slot-${slot}`
}
