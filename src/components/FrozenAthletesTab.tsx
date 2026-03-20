// src/components/FrozenAthletesTab.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { Snowflake, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { User } from '../types/supabase';

type FrozenAthletesTabProps = {
  teamId: string;
  onAthleteSelect: (athlete: User) => void;
};

export function FrozenAthletesTab({ teamId, onAthleteSelect }: FrozenAthletesTabProps) {
  const [athletes, setAthletes] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFrozen = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('team_id', teamId)
      .eq('role', 'athlete')
      .eq('status', 'frozen')
      .order('name');
    setAthletes((data as User[]) ?? []);
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetchFrozen();
  }, [fetchFrozen]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 dark:border-blue-400" />
      </div>
    );
  }

  if (athletes.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
          <Snowflake className="w-6 h-6 text-gray-400" />
        </div>
        <div className="font-semibold text-gray-900 dark:text-white mb-1">凍結中の選手はいません</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          卒業・退会した選手はここに表示されます
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
        <Snowflake className="w-3.5 h-3.5" />
        凍結中の選手（{athletes.length}人）— クリックで詳細・凍結解除
      </div>
      <div className="space-y-2">
        {athletes.map((a) => (
          <button
            key={a.id}
            onClick={() => onAthleteSelect(a)}
            className="w-full text-left bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700
              px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors opacity-70"
          >
            <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <Snowflake className="w-4 h-4 text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{a.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {a.frozen_at ? `凍結日: ${a.frozen_at.slice(0, 10)}` : '凍結中'}
              </div>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              凍結中
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
