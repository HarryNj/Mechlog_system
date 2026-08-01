import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 
  (typeof process !== 'undefined' && process.env && process.env.VITE_SUPABASE_URL) || 
  (typeof process !== 'undefined' && process.env && process.env.SUPABASE_URL) || 
  (import.meta.env && import.meta.env.VITE_SUPABASE_URL) || 
  "";
  
const supabaseAnonKey = 
  (typeof process !== 'undefined' && process.env && process.env.VITE_SUPABASE_ANON_KEY) || 
  (typeof process !== 'undefined' && process.env && process.env.VITE_SUPABASE_PUBLISHABLE_KEY) || 
  (typeof process !== 'undefined' && process.env && process.env.SUPABASE_PUBLISHABLE_KEY) || 
  (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || 
  (import.meta.env && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) || 
  "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Client features like Auth or Realtime will not work.');
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
);
