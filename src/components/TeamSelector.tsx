import React from 'react';
import { Team } from '../lib/supabase';
import { ChevronDown } from 'lucide-react';

interface TeamSelectorProps {
  teams: Team[];
  selectedTeam: Team | null;
  onTeamSelect: (team: Team) => void;
}

export function TeamSelector({ teams, selectedTeam, onTeamSelect }: TeamSelectorProps) {
  if (teams.length === 1) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="font-medium text-blue-900">{teams[0].name}</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <select
        value={selectedTeam?.id || ''}
        onChange={(e) => {
          const team = teams.find(t => t.id === e.target.value);
          if (team) onTeamSelect(team);
        }}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white cursor-pointer"
      >
        <option value="">チームを選択してください</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
    </div>
  );
}