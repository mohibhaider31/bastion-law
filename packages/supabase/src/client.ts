import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = 'https://pqqusreplevsdmntvzww.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxcXVzcmVwbGV2c2RtbnR2end3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMDEyNjcsImV4cCI6MjA5Njc3NjI2N30.k7heulCxVYiA9jCq1bscsR9nBGnEJ0VD3Yb4-l-h5F8';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export { SUPABASE_URL, SUPABASE_ANON_KEY };
