// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type {
  Database,
  TrainingRecord,
  WeightRecord,
  SleepRecord,
  MotivationRecord,
  Team,
  User,
  Organization,
} from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[supabase] URL or ANON KEY is missing');
}

// ✅ ブラウザ global にキャッシュして「必ず1インスタンス」
const g = globalThis as any;

export const supabase =
  g.__bekuta_supabase ??
  (g.__bekuta_supabase = createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      // ここは今の運用に合わせて。通常はtrueでOK
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }));

export type {
  Database,
  TrainingRecord,
  WeightRecord,
  SleepRecord,
  MotivationRecord,
  Team,
  User,
  Organization,
} from './database.types';