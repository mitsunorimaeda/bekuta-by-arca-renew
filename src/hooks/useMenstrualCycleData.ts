import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type MenstrualCycle = Database['public']['Tables']['menstrual_cycles']['Row'];
type MenstrualCycleInsert = Database['public']['Tables']['menstrual_cycles']['Insert'];
type MenstrualCycleUpdate = Database['public']['Tables']['menstrual_cycles']['Update'];

export function useMenstrualCycleData(userId: string) {
  const [cycles, setCycles] = useState<MenstrualCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCycles();
  }, [userId]);

  const fetchCycles = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('menstrual_cycles')
        .select('*')
        .eq('user_id', userId)
        .order('cycle_start_date', { ascending: false });

      if (fetchError) throw fetchError;
      setCycles(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch menstrual cycles');
    } finally {
      setLoading(false);
    }
  };

  const addCycle = async (cycle: Omit<MenstrualCycleInsert, 'user_id'>) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      const { data: userProfile } = await supabase
        .from('users')
        .select('team_id')
        .eq('user_id', userData.user.id)
        .maybeSingle();

      let organizationId = null;
      if (userProfile?.team_id) {
        const { data: team } = await supabase
          .from('teams')
          .select('organization_id')
          .eq('id', userProfile.team_id)
          .maybeSingle();

        organizationId = team?.organization_id || null;
      }

      const { data, error: insertError } = await supabase
        .from('menstrual_cycles')
        .insert({
          ...cycle,
          user_id: userId,
          organization_id: organizationId,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      if (data) {
        setCycles((prev) => [data, ...prev]);
      }
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add menstrual cycle');
      throw err;
    }
  };

  const updateCycle = async (id: string, updates: MenstrualCycleUpdate) => {
    try {
      const { data, error: updateError } = await supabase
        .from('menstrual_cycles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;
      if (data) {
        setCycles((prev) =>
          prev.map((cycle) => (cycle.id === id ? data : cycle))
        );
      }
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update menstrual cycle');
      throw err;
    }
  };

  const deleteCycle = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('menstrual_cycles')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      setCycles((prev) => prev.filter((cycle) => cycle.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete menstrual cycle');
      throw err;
    }
  };

  const getCyclePhase = (cycle: MenstrualCycle, targetDate: Date): string | null => {
    const startDate = new Date(cycle.cycle_start_date);
    const daysSinceStart = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceStart < 0) return null;

    if (cycle.period_duration_days && daysSinceStart < cycle.period_duration_days) {
      return 'menstrual';
    }

    if (cycle.cycle_length_days) {
      const follicularEnd = Math.floor(cycle.cycle_length_days / 2);
      if (daysSinceStart < follicularEnd) {
        return 'follicular';
      }
      const lutealStart = follicularEnd + 2;
      if (daysSinceStart < lutealStart) {
        return 'ovulatory';
      }
      if (daysSinceStart < cycle.cycle_length_days) {
        return 'luteal';
      }
    }

    return null;
  };

  const getCurrentCyclePhase = (): { cycle: MenstrualCycle; phase: string } | null => {
    const today = new Date();
    for (const cycle of cycles) {
      const phase = getCyclePhase(cycle, today);
      if (phase) {
        return { cycle, phase };
      }
    }
    return null;
  };

  return {
    cycles,
    loading,
    error,
    addCycle,
    updateCycle,
    deleteCycle,
    getCyclePhase,
    getCurrentCyclePhase,
    refetch: fetchCycles,
  };
}
