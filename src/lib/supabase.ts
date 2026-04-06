import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL?.trim().replace(/\/$/, '');
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'https://placeholder.supabase.co') {
  console.warn('Supabase credentials missing or invalid. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables via the Settings menu.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      headers: { 'x-application-name': 'cricoverlay' },
      fetch: (url, options) => window.fetch(url, options),
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
      timeout: 20000, // 20 seconds timeout instead of default 30
      heartbeatIntervalMs: 2500, // Heartbeat every 2.5 seconds
    }
  }
);
