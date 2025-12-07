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


// .env からそのまま読むだけのシンプル構成
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[supabase] URL or ANON KEY is missing');
}

export const supabase = createClient<Database>(
  supabaseUrl!,
  supabaseAnonKey!
);

// ここで型もいっしょに再エクスポートしておく
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