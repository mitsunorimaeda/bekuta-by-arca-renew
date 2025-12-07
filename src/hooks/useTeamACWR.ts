import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { calculateACWR } from '../lib/acwr';

interface TeamACWRData {
  date: string;
  averageACWR: number;
  athleteCount: number;
  riskLevel: string;
}

export function useTeamACWR(teamId: string | null) {
  const [teamACWRData, setTeamACWRData] = useState<TeamACWRData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (teamId) {
      fetchTeamACWR(teamId);
    } else {
      setTeamACWRData([]);
    }
  }, [teamId]);

  const fetchTeamACWR = async (teamId: string) => {
    setLoading(true);
    try {
      // Get all athletes in the team
      const { data: athletes, error: athletesError } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'athlete')
        .eq('team_id', teamId);

      if (athletesError) throw athletesError;

      if (!athletes || athletes.length === 0) {
        setTeamACWRData([]);
        return;
      }

      const athleteIds = athletes.map(athlete => athlete.id);

      // Get all training records for these athletes
      const { data: records, error: recordsError } = await supabase
        .from('training_records')
        .select('*')
        .in('user_id', athleteIds)
        .order('date', { ascending: true });

      if (recordsError) throw recordsError;

      // Calculate ACWR for each athlete
      const athleteACWRData: { [athleteId: string]: any[] } = {};
      
      for (const athleteId of athleteIds) {
        const athleteRecords = records?.filter(r => r.user_id === athleteId) || [];
        if (athleteRecords.length > 0) {
          athleteACWRData[athleteId] = calculateACWR(athleteRecords);
        }
      }

      // Calculate team average ACWR for each date
      const teamAverages: TeamACWRData[] = [];
      
      // Get all unique dates from training records (only dates with actual RPE data)
      const allDates = new Set<string>();
      if (records) {
        records.forEach(record => {
          allDates.add(record.date);
        });
      }
      
      // Sort dates
      const sortedDates = Array.from(allDates).sort();
      
      // Calculate team average for each date that has actual training data
      sortedDates.forEach(dateStr => {
        const dailyACWRs: number[] = [];
        
        // Collect ACWR values for this date from all athletes
        for (const athleteId of athleteIds) {
          const athleteData = athleteACWRData[athleteId];
          if (athleteData) {
            const dayData = athleteData.find(d => d.date === dateStr);
            if (dayData && dayData.acwr > 0) {
              dailyACWRs.push(dayData.acwr);
            }
          }
        }
        
        if (dailyACWRs.length > 0) {
          const averageACWR = dailyACWRs.reduce((sum, acwr) => sum + acwr, 0) / dailyACWRs.length;
          
          // Determine risk level based on average - Updated evaluation criteria
          let riskLevel: string;
          if (averageACWR > 1.5) riskLevel = 'high';
          else if (averageACWR >= 1.3) riskLevel = 'caution';
          else if (averageACWR >= 0.8) riskLevel = 'good';  // Changed from 1.0 to 0.8
          else riskLevel = 'low';
          
          teamAverages.push({
            date: dateStr,
            averageACWR: Number(averageACWR.toFixed(2)),
            athleteCount: dailyACWRs.length, // 実際にその日にACWRデータがある選手数
            riskLevel
          });
        }
      });
      
      setTeamACWRData(teamAverages);
    } catch (error) {
      console.error('Error fetching team ACWR data:', error);
      setTeamACWRData([]);
    } finally {
      setLoading(false);
    }
  };

  return {
    teamACWRData,
    loading
  };
}