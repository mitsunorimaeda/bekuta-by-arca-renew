import { useState, lazy, Suspense } from 'react';

const ProgramDashboard = lazy(() => import('./ProgramDashboard').then(m => ({ default: m.ProgramDashboard })));
const AthleteKarte = lazy(() => import('./AthleteKarte').then(m => ({ default: m.AthleteKarte })));

const Spinner = () => (
  <div className="flex items-center justify-center py-16">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 dark:border-blue-400" />
  </div>
);

interface ProgramManagementPageProps {
  teamId: string;
  teamName: string;
  athletes: { id: string; name: string }[];
  initialAthleteId?: string | null;
  onBack: () => void;
  onOpenAssign: (athleteId: string, injuryId?: string, purpose?: string) => void;
  onOpenPrescription?: (prescriptionId: string, athleteId: string) => void;
}

export function ProgramManagementPage({
  teamId,
  teamName,
  athletes,
  initialAthleteId,
  onBack,
  onOpenAssign,
  onOpenPrescription,
}: ProgramManagementPageProps) {
  const [view, setView] = useState<'dashboard' | 'karte'>(initialAthleteId ? 'karte' : 'dashboard');
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(initialAthleteId || null);

  const selectedAthlete = athletes.find(a => a.id === selectedAthleteId);

  const handleOpenKarte = (athleteId: string) => {
    setSelectedAthleteId(athleteId);
    setView('karte');
  };

  const handleBackToDashboard = () => {
    setView('dashboard');
    setSelectedAthleteId(null);
  };

  return (
    <Suspense fallback={<Spinner />}>
      {view === 'dashboard' ? (
        <ProgramDashboard
          teamId={teamId}
          teamName={teamName}
          onOpenKarte={handleOpenKarte}
          onCreateProgram={(athleteId) => {
            if (athleteId) {
              onOpenAssign(athleteId);
            } else {
              // TODO: show athlete picker then call onOpenAssign
              onOpenAssign(athletes[0]?.id || '');
            }
          }}
          onBack={onBack}
        />
      ) : selectedAthlete ? (
        <AthleteKarte
          athleteId={selectedAthlete.id}
          athleteName={selectedAthlete.name}
          onBack={handleBackToDashboard}
          onOpenAssign={onOpenAssign}
          onOpenPrescription={onOpenPrescription}
        />
      ) : (
        <Spinner />
      )}
    </Suspense>
  );
}

export default ProgramManagementPage;
