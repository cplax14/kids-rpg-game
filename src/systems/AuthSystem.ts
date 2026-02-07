import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'
import type { AuthUser, AuthState, AuthStateChangeCallback } from '../models/auth-types'
import { logger } from '../utils/logger'

let currentUser: AuthUser | null = null
let authState: AuthState = 'loading'
let authListeners: AuthStateChangeCallback[] = []
let initialized = false

function mapSupabaseUser(user: User | null): AuthUser | null {
  if (!user) {
    return null
  }

  const provider = user.app_metadata?.provider
  const isGoogle = provider === 'google'

  return {
    id: user.id,
    email: user.email ?? null,
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    provider: isGoogle ? 'google' : 'anonymous',
    createdAt: user.created_at,
  }
}

export async function initAuth(): Promise<void> {
  if (initialized) {
    return
  }

  if (!isSupabaseConfigured()) {
    authState = 'unauthenticated'
    initialized = true
    logger.info('AuthSystem: Cloud saves not configured, running in offline mode')
    return
  }

  const client = getSupabaseClient()
  if (!client) {
    authState = 'unauthenticated'
    initialized = true
    return
  }

  try {
    // Check for existing session
    const {
      data: { session },
      error,
    } = await client.auth.getSession()

    if (error) {
      logger.warn('AuthSystem: Failed to get session', { error: error.message })
      authState = 'unauthenticated'
    } else if (session?.user) {
      currentUser = mapSupabaseUser(session.user)
      authState = 'authenticated'
      logger.info('AuthSystem: Restored session', { userId: session.user.id })
    } else {
      authState = 'unauthenticated'
    }

    // Listen for auth changes
    client.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      handleAuthChange(event, session)
    })

    initialized = true
  } catch (error) {
    logger.error('AuthSystem: Initialization failed', { error })
    authState = 'unauthenticated'
    initialized = true
  }
}

function handleAuthChange(event: AuthChangeEvent, session: Session | null): void {
  const previousUser = currentUser

  if (event === 'SIGNED_IN' && session?.user) {
    currentUser = mapSupabaseUser(session.user)
    authState = 'authenticated'
    logger.info('AuthSystem: User signed in', { userId: session.user.id })
  } else if (event === 'SIGNED_OUT') {
    currentUser = null
    authState = 'unauthenticated'
    logger.info('AuthSystem: User signed out')
  } else if (event === 'TOKEN_REFRESHED' && session?.user) {
    currentUser = mapSupabaseUser(session.user)
    logger.info('AuthSystem: Token refreshed')
  } else if (event === 'USER_UPDATED' && session?.user) {
    currentUser = mapSupabaseUser(session.user)
    logger.info('AuthSystem: User updated')
  }

  // Notify listeners if user changed
  if (previousUser?.id !== currentUser?.id || previousUser === null !== (currentUser === null)) {
    notifyListeners()
  }
}

function notifyListeners(): void {
  for (const callback of authListeners) {
    try {
      callback(currentUser)
    } catch (error) {
      logger.error('AuthSystem: Listener callback failed', { error })
    }
  }
}

export async function signInWithGoogle(): Promise<boolean> {
  const client = getSupabaseClient()
  if (!client) {
    logger.warn('AuthSystem: Cannot sign in, Supabase not configured')
    return false
  }

  try {
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })

    if (error) {
      logger.error('AuthSystem: Google sign-in failed', { error: error.message })
      return false
    }

    return true
  } catch (error) {
    logger.error('AuthSystem: Google sign-in failed', { error })
    return false
  }
}

export async function signOut(): Promise<boolean> {
  const client = getSupabaseClient()
  if (!client) {
    return true
  }

  try {
    const { error } = await client.auth.signOut()

    if (error) {
      logger.error('AuthSystem: Sign out failed', { error: error.message })
      return false
    }

    currentUser = null
    authState = 'unauthenticated'
    notifyListeners()

    return true
  } catch (error) {
    logger.error('AuthSystem: Sign out failed', { error })
    return false
  }
}

export function getUser(): AuthUser | null {
  return currentUser
}

export function isAuthenticated(): boolean {
  return authState === 'authenticated' && currentUser !== null
}

export function getAuthState(): AuthState {
  return authState
}

export function onAuthStateChange(callback: AuthStateChangeCallback): () => void {
  authListeners.push(callback)

  // Return unsubscribe function
  return () => {
    authListeners = authListeners.filter((cb) => cb !== callback)
  }
}

export function getUserDisplayName(): string {
  if (!currentUser) {
    return 'Guest'
  }
  return currentUser.name ?? currentUser.email ?? 'User'
}

export function getUserAvatar(): string | null {
  return currentUser?.avatarUrl ?? null
}
