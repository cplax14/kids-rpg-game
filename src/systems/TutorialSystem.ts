import Phaser from 'phaser'
import type { TutorialTrigger, TutorialStep } from '../models/types'
import { saveToStorage, loadFromStorage } from '../utils/storage'
import { logger } from '../utils/logger'

const TUTORIAL_STORAGE_KEY = 'completed-tutorials'

let tutorialData: ReadonlyArray<TutorialStep> = []
let completedTutorials: Set<string> = new Set()

export function loadTutorialData(data: ReadonlyArray<TutorialStep>): void {
  tutorialData = data

  // Load completed tutorials from storage
  const saved = loadFromStorage<string[]>(TUTORIAL_STORAGE_KEY)
  completedTutorials = new Set(saved ?? [])
}

export function getTutorialByTrigger(trigger: TutorialTrigger): TutorialStep | undefined {
  return tutorialData.find((t) => t.trigger === trigger)
}

export function shouldShowTutorial(trigger: TutorialTrigger): TutorialStep | null {
  const tutorial = getTutorialByTrigger(trigger)

  if (!tutorial) {
    return null
  }

  if (completedTutorials.has(tutorial.id)) {
    return null
  }

  return tutorial
}

export function markTutorialComplete(id: string): void {
  completedTutorials.add(id)

  // Persist to storage
  const completedArray = Array.from(completedTutorials)
  saveToStorage(TUTORIAL_STORAGE_KEY, completedArray)
}

export function isTutorialComplete(id: string): boolean {
  return completedTutorials.has(id)
}

export function resetAllTutorials(): void {
  completedTutorials.clear()
  saveToStorage(TUTORIAL_STORAGE_KEY, [])
}

export function getCompletedTutorials(): ReadonlyArray<string> {
  return Array.from(completedTutorials)
}

export async function showTutorial(scene: Phaser.Scene, step: TutorialStep): Promise<void> {
  const { TutorialOverlay } = await import('../ui/components/TutorialOverlay')

  return new Promise((resolve) => {
    const overlay = new TutorialOverlay(scene, step, () => {
      markTutorialComplete(step.id)
      overlay.destroy()
      resolve()
    })
  })
}

export async function checkAndShowTutorial(
  scene: Phaser.Scene,
  trigger: TutorialTrigger,
): Promise<boolean> {
  const tutorial = shouldShowTutorial(trigger)

  if (!tutorial) {
    return false
  }

  await showTutorial(scene, tutorial)
  return true
}

// Helper to check multiple tutorials in sequence
export async function checkTutorials(
  scene: Phaser.Scene,
  triggers: ReadonlyArray<TutorialTrigger>,
): Promise<void> {
  for (const trigger of triggers) {
    const shown = await checkAndShowTutorial(scene, trigger)
    if (shown) {
      // Only show one tutorial at a time
      break
    }
  }
}
