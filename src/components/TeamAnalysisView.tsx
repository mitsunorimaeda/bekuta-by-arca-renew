import React from 'react';
import { TeamRadarChart } from './TeamRadarChart';
import { TeamPercentileMatrix } from './TeamPercentileMatrix';

interface TeamAnalysisViewProps {
  teamId: string;
}

export function TeamAnalysisView({ teamId }: TeamAnalysisViewProps) {
  return (
    <div className="space-y-8">
      <TeamRadarChart teamId={teamId} />
      <TeamPercentileMatrix teamId={teamId} />
    </div>
  );
}

export default TeamAnalysisView;
