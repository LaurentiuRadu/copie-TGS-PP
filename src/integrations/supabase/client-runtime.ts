// Runtime-safe Supabase client with URL fallback
// Do NOT edit the auto-generated client.ts — this file is used via Vite alias to provide fallbacks.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { logger } from '@/lib/logger';

// Fallback builder for URL using project id
function buildSupabaseUrl(): string | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (url && url.trim().length > 0) return url;
  const pid = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;
  if (pid && pid.trim().length > 0) return `https://${pid}.supabase.co`;
  return null;
}

const SUPABASE_URL = buildSupabaseUrl();
const SUPABASE_PUBLISHABLE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  // Surface a clear error in console to avoid a cryptic crash
  logger?.error?.('[Supabase] Missing configuration', {
    hasUrl: !!SUPABASE_URL,
    hasKey: !!SUPABASE_PUBLISHABLE_KEY,
    projectId: import.meta.env.VITE_SUPABASE_PROJECT_ID,
  });
  throw new Error('[Supabase] Missing configuration. Ensure VITE_SUPABASE_URL or VITE_SUPABASE_PROJECT_ID and VITE_SUPABASE_PUBLISHABLE_KEY are set.');
}

// Enhanced storage adapter that works reliably across all platforms (copied from generated client)
const reliableStorageAdapter = {
  getItem: (key: string) => {
    try {
      const value = localStorage.getItem(key);
      if (import.meta.env.DEV && key.includes('auth-token')) {
        console.debug(`[Storage] getItem: ${key} -> ${value ? 'found' : 'not found'}`);
      }
      return value;
    } catch (error) {
      console.error('[Storage] getItem error:', error);
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
      if (import.meta.env.DEV && key.includes('auth-token')) {
        console.debug(`[Storage] setItem: ${key} -> saved`);
      }
    } catch (error) {
      console.error('[Storage] setItem error:', error);
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
      if (import.meta.env.DEV && key.includes('auth-token')) {
        console.debug(`[Storage] removeItem: ${key}`);
      }
    } catch (error) {
      console.error('[Storage] removeItem error:', error);
    }
  },
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: reliableStorageAdapter,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storageKey: `sb-${import.meta.env.VITE_SUPABASE_PROJECT_ID}-auth-token`,
  },
});
