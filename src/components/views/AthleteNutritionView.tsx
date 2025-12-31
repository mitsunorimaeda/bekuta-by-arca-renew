import React from "react";
import type { Database } from "../../lib/database.types";
import AthleteNutritionDashboardView from "./AthleteNutritionDashboardView";

// DB users row
type UserProfile = Database["public"]["Tables"]["users"]["Row"];

type Props = {
  user: UserProfile;
  date: string;

  // nutrition系はプロジェクト差が出やすいので any で受ける（今の実装に合わせて安全）
  nutritionLogs: any[];
  nutritionTotals: any | null;

  nutritionLoading: boolean;
  nutritionError: string | null;

  onBackHome: () => void;
};

export function AthleteNutritionView({
  user,
  date,
  nutritionLogs,
  nutritionTotals,
  nutritionLoading,
  nutritionError,
  onBackHome,
}: Props) {
  return (
    <AthleteNutritionDashboardView
      user={user}
      date={date}
      nutritionLogs={nutritionLogs}
      nutritionTotals={nutritionTotals}
      nutritionLoading={nutritionLoading}
      nutritionError={nutritionError}
      onBackHome={onBackHome}
    />
  );
}