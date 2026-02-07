import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock dependencies before imports
vi.mock('../../../src/lib/supabase', () => ({
  getSupabaseClient: vi.fn(),
  isSupabaseConfigured: vi.fn(() => false),
}))

vi.mock('../../../src/config', () => ({
  CLOUD_SAVE_ENABLED: false,
  SUPABASE_CONFIG: {
    url: '',
    anonKey: '',
  },
}))

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('AuthSystem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('when cloud saves disabled', () => {
    it('should initialize with unauthenticated state', async () => {
      const { initAuth, getAuthState, isAuthenticated } = await import(
        '../../../src/systems/AuthSystem'
      )

      await initAuth()

      expect(getAuthState()).toBe('unauthenticated')
      expect(isAuthenticated()).toBe(false)
    })

    it('should return Guest for display name', async () => {
      const { getUserDisplayName } = await import('../../../src/systems/AuthSystem')

      expect(getUserDisplayName()).toBe('Guest')
    })

    it('should return null for avatar', async () => {
      const { getUserAvatar } = await import('../../../src/systems/AuthSystem')

      expect(getUserAvatar()).toBeNull()
    })

    it('should return null for user', async () => {
      const { getUser } = await import('../../../src/systems/AuthSystem')

      expect(getUser()).toBeNull()
    })
  })

  describe('onAuthStateChange', () => {
    it('should register and return unsubscribe function', async () => {
      const { onAuthStateChange } = await import('../../../src/systems/AuthSystem')

      const callback = vi.fn()
      const unsubscribe = onAuthStateChange(callback)

      expect(typeof unsubscribe).toBe('function')

      // Unsubscribe should work without error
      unsubscribe()
    })
  })

  describe('signInWithGoogle', () => {
    it('should return false when supabase not configured', async () => {
      const { signInWithGoogle } = await import('../../../src/systems/AuthSystem')

      const result = await signInWithGoogle()

      expect(result).toBe(false)
    })
  })

  describe('signOut', () => {
    it('should return true when no client available', async () => {
      const { signOut } = await import('../../../src/systems/AuthSystem')

      const result = await signOut()

      expect(result).toBe(true)
    })
  })
})
