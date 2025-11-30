import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type BasalBodyTemperature = Database['public']['Tables']['basal_body_temperature']['Row'];
type BasalBodyTemperatureInsert = Database['public']['Tables']['basal_body_temperature']['Insert'];
type BasalBodyTemperatureUpdate = Database['public']['Tables']['basal_body_temperature']['Update'];

export function useBasalBodyTemperature(userId: string) {
  const [temperatures, setTemperatures] = useState<BasalBodyTemperature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTemperatures();
  }, [userId]);

  const fetchTemperatures = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('basal_body_temperature')
        .select('*')
        .eq('user_id', userId)
        .order('measurement_date', { ascending: false });

      if (fetchError) throw fetchError;
      setTemperatures(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch basal body temperature');
    } finally {
      setLoading(false);
    }
  };

  const addTemperature = async (temperature: Omit<BasalBodyTemperatureInsert, 'user_id'>) => {
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
        .from('basal_body_temperature')
        .insert({
          ...temperature,
          user_id: userId,
          organization_id: organizationId,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      if (data) {
        setTemperatures((prev) => [data, ...prev]);
      }
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add basal body temperature');
      throw err;
    }
  };

  const updateTemperature = async (id: string, updates: BasalBodyTemperatureUpdate) => {
    try {
      const { data, error: updateError } = await supabase
        .from('basal_body_temperature')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;
      if (data) {
        setTemperatures((prev) =>
          prev.map((temp) => (temp.id === id ? data : temp))
        );
      }
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update basal body temperature');
      throw err;
    }
  };

  const deleteTemperature = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('basal_body_temperature')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      setTemperatures((prev) => prev.filter((temp) => temp.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete basal body temperature');
      throw err;
    }
  };

  const getTemperatureTrend = (days: number = 7): 'rising' | 'falling' | 'stable' => {
    const recentTemps = temperatures
      .slice(0, days)
      .sort((a, b) => new Date(a.measurement_date).getTime() - new Date(b.measurement_date).getTime());

    if (recentTemps.length < 3) return 'stable';

    const firstHalf = recentTemps.slice(0, Math.floor(recentTemps.length / 2));
    const secondHalf = recentTemps.slice(Math.floor(recentTemps.length / 2));

    const firstAvg = firstHalf.reduce((sum, t) => sum + Number(t.temperature_celsius), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, t) => sum + Number(t.temperature_celsius), 0) / secondHalf.length;

    const diff = secondAvg - firstAvg;
    if (diff > 0.1) return 'rising';
    if (diff < -0.1) return 'falling';
    return 'stable';
  };

  const getAverageTemperature = (days: number = 7): number | null => {
    const recentTemps = temperatures.slice(0, days);
    if (recentTemps.length === 0) return null;

    const sum = recentTemps.reduce((acc, temp) => acc + Number(temp.temperature_celsius), 0);
    return sum / recentTemps.length;
  };

  return {
    temperatures,
    loading,
    error,
    addTemperature,
    updateTemperature,
    deleteTemperature,
    getTemperatureTrend,
    getAverageTemperature,
    refetch: fetchTemperatures,
  };
}
