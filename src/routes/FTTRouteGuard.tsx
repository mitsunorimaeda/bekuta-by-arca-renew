import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFeatureFlags } from "../hooks/useFeatureFlags";

export function FTTRouteGuard({ children }: { children: React.ReactNode }) {
  const nav = useNavigate();
  const { loading, fttEnabled } = useFeatureFlags();

  useEffect(() => {
    if (!loading && !fttEnabled) {
      // 404風にしたいなら /not-found に飛ばす
      nav("/", { replace: true });
    }
  }, [loading, fttEnabled, nav]);

  if (loading) return null; // ローディング画面にしたければ差し替えOK
  if (!fttEnabled) return null;

  return <>{children}</>;
}