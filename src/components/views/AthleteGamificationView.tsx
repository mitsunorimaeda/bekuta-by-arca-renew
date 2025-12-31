// src/components/views/AthleteGamificationView.tsx
import React, { Suspense, lazy } from "react";
import type { Database } from "../../lib/database.types";

const GamificationView = lazy(() =>
  import("../../components/GamificationView").then((m) => ({
    default: m.GamificationView,
  }))
);

type UserProfile = Database["public"]["Tables"]["users"]["Row"];

type Props = {
  user: UserProfile;
  onBackHome?: () => void;
};

export function AthleteGamificationView({ user }: Props) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      }
    >
      <GamificationView
        userId={user.id}
        userTeamId={user.team_id}
      />
    </Suspense>
  );
}