// src/types/athlete.ts
import type { Database } from '../lib/database.types';

// ── re-exports ──
export type UserProfile = Database['public']['Tables']['users']['Row'];
export type DailyEnergySnapshotRow = Database['public']['Tables']['daily_energy_snapshots']['Row'];

// ── Team Season Phase ──
export type TeamPhaseRow = {
  phase_type: 'off' | 'pre' | 'in' | 'peak' | 'transition' | 'unknown';
  focus_tags: string[];
  note: string | null;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
};

// ── Active Tab union ──
export type ActiveTab =
  | 'unified'
  | 'overview'
  | 'weight'
  | 'insights'
  | 'nutrition'
  | 'ftt'
  | 'performance'
  | 'conditioning'
  | 'cycle'
  | 'gamification'
  | 'settings'
  | 'messages'
  | 'rehab'
  | 'profile';

// ── AthleteView props ──
export type AthleteViewProps = {
  user: UserProfile;
  alerts: any[];
  onLogout: () => void;
  onHome: () => void;
  onNavigateToPrivacy: () => void;
  onNavigateToTerms: () => void;
  onNavigateToCommercial: () => void;
  onNavigateToHelp: () => void;
  onUserUpdated?: () => Promise<void> | void;
  readOnly?: boolean;
};
