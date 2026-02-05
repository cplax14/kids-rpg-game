import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  loadTutorialData,
  getTutorialByTrigger,
  shouldShowTutorial,
  markTutorialComplete,
  isTutorialComplete,
  resetAllTutorials,
  getCompletedTutorials,
} from '../../../src/systems/TutorialSystem'
import type { TutorialStep } from '../../../src/models/types'

// Mock localStorage
const mockStorage: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockStorage[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorage[key]
  }),
  clear: vi.fn(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key])
  }),
})

const mockTutorials: TutorialStep[] = [
  {
    id: 'tutorial-first-battle',
    trigger: 'first_battle',
    title: 'Battle Basics',
    message: 'Learn to fight!',
    position: 'top',
  },
  {
    id: 'tutorial-first-capture',
    trigger: 'first_capture',
    title: 'Capturing Monsters',
    message: 'Learn to capture!',
    position: 'center',
  },
  {
    id: 'tutorial-first-menu',
    trigger: 'first_menu',
    title: 'Game Menu',
    message: 'Learn to navigate!',
    position: 'bottom',
  },
]

describe('TutorialSystem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key])
    resetAllTutorials()
    loadTutorialData(mockTutorials)
  })

  describe('loadTutorialData', () => {
    it('should load tutorial data', () => {
      loadTutorialData(mockTutorials)

      const tutorial = getTutorialByTrigger('first_battle')
      expect(tutorial).toBeDefined()
      expect(tutorial?.id).toBe('tutorial-first-battle')
    })
  })

  describe('getTutorialByTrigger', () => {
    it('should return tutorial for valid trigger', () => {
      const tutorial = getTutorialByTrigger('first_capture')
      expect(tutorial).toBeDefined()
      expect(tutorial?.title).toBe('Capturing Monsters')
    })

    it('should return undefined for invalid trigger', () => {
      const tutorial = getTutorialByTrigger('first_breeding')
      expect(tutorial).toBeUndefined()
    })
  })

  describe('shouldShowTutorial', () => {
    it('should return tutorial if not completed', () => {
      const tutorial = shouldShowTutorial('first_battle')
      expect(tutorial).not.toBeNull()
      expect(tutorial?.id).toBe('tutorial-first-battle')
    })

    it('should return null if tutorial is completed', () => {
      markTutorialComplete('tutorial-first-battle')

      const tutorial = shouldShowTutorial('first_battle')
      expect(tutorial).toBeNull()
    })

    it('should return null for non-existent trigger', () => {
      const tutorial = shouldShowTutorial('first_breeding')
      expect(tutorial).toBeNull()
    })
  })

  describe('markTutorialComplete', () => {
    it('should mark tutorial as complete', () => {
      expect(isTutorialComplete('tutorial-first-battle')).toBe(false)

      markTutorialComplete('tutorial-first-battle')

      expect(isTutorialComplete('tutorial-first-battle')).toBe(true)
    })

    it('should persist completion to storage', () => {
      markTutorialComplete('tutorial-first-battle')

      expect(mockStorage['kids-rpg:completed-tutorials']).toBeDefined()
      const saved = JSON.parse(mockStorage['kids-rpg:completed-tutorials'])
      expect(saved).toContain('tutorial-first-battle')
    })
  })

  describe('getCompletedTutorials', () => {
    it('should return all completed tutorials', () => {
      markTutorialComplete('tutorial-first-battle')
      markTutorialComplete('tutorial-first-capture')

      const completed = getCompletedTutorials()
      expect(completed).toContain('tutorial-first-battle')
      expect(completed).toContain('tutorial-first-capture')
      expect(completed.length).toBe(2)
    })
  })

  describe('resetAllTutorials', () => {
    it('should clear all completed tutorials', () => {
      markTutorialComplete('tutorial-first-battle')
      markTutorialComplete('tutorial-first-capture')

      resetAllTutorials()

      expect(getCompletedTutorials().length).toBe(0)
      expect(isTutorialComplete('tutorial-first-battle')).toBe(false)
    })
  })
})
