import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_CONFIG, CLOUD_SAVE_ENABLED } from '../config'
import { logger } from '../utils/logger'

let supabaseClient: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient | null {
  if (!CLOUD_SAVE_ENABLED) {
    return null
  }

  if (supabaseClient) {
    return supabaseClient
  }

  const { url, anonKey } = SUPABASE_CONFIG

  if (!url || !anonKey) {
    logger.warn('Supabase: Missing configuration, cloud saves disabled')
    return null
  }

  try {
    supabaseClient = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        storageKey: 'kids-rpg-auth',
      },
    })

    logger.info('Supabase: Client initialized successfully')
    return supabaseClient
  } catch (error) {
    logger.error('Supabase: Failed to initialize client', { error })
    return null
  }
}

export function isSupabaseConfigured(): boolean {
  return CLOUD_SAVE_ENABLED && Boolean(SUPABASE_CONFIG.url) && Boolean(SUPABASE_CONFIG.anonKey)
}
