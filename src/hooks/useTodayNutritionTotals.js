// src/hooks/useTodayNutritionTotals.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * 今日の nutrition_logs を取得し、合計(kcal/P/F/C)を返す
 * UX方針:
 * - loading中に totals を 0 に戻さない（チラつき防止）
 * - エラーでも logs を空にしない（見えてたものが消えない）
 * - refetch を返す（保存後に即反映できる）
 */
export function useTodayNutritionTotals(userId: string | null | undefined, dateStr: string | null | undefined) {
  const [logs, setLogs] = useState<any[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // 前回の totals を保持（loading中に0に戻さない）
  const lastTotalsRef = useRef({
    cal: 0,
    p: 0,
    f: 0,
    c: 0,
    hasAnyLog: false,
    hasUnparsed: false,
  });

  const cancelledRef = useRef(false);

  const fetchLogs = useCallback(async () => {
    if (!userId || !dateStr) return;

    setStatus("loading");
    setError(null);

    try {
      const { data, error } = await supabase
        .from("nutrition_logs")
        .select(
          "id, record_date, meal_type, meal_slot, total_calories, p, f, c, is_edited, advice_markdown, image_url, image_path, created_at"
        )
        .eq("user_id", userId)
        .eq("record_date", dateStr)
        // meal_type は文字列ソートだと順番が崩れることがあるので created_at を最後に効かせる
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (!cancelledRef.current) {
        setLogs(data ?? []);
        setStatus("ready");
      }
    } catch (e: any) {
      console.error("[useTodayNutritionTotals] fetch error:", e);
      if (!cancelledRef.current) {
        // ✅ logs を消さない（UX安定）
        setStatus("error");
        setError(String(e?.message ?? e));
      }
    }
  }, [userId, dateStr]);

  useEffect(() => {
    if (!userId || !dateStr) return;

    cancelledRef.current = false;
    fetchLogs();

    return () => {
      cancelledRef.current = true;
    };
  }, [userId, dateStr, fetchLogs]);

  const totals = useMemo(() => {
    if (status === "loading") {
      return lastTotalsRef.current;
    }

    const sum = { cal: 0, p: 0, f: 0, c: 0 };
    let hasUnparsed = false;

    for (const row of logs) {
      if (row?.total_calories == null || row?.p == null || row?.f == null || row?.c == null) {
        hasUnparsed = true;
      }
      sum.cal += Number(row?.total_calories ?? 0);
      sum.p += Number(row?.p ?? 0);
      sum.f += Number(row?.f ?? 0);
      sum.c += Number(row?.c ?? 0);
    }

    sum.p = Math.round(sum.p * 10) / 10;
    sum.f = Math.round(sum.f * 10) / 10;
    sum.c = Math.round(sum.c * 10) / 10;

    const result = {
      ...sum,
      hasAnyLog: logs.length > 0,
      hasUnparsed,
    };

    lastTotalsRef.current = result;
    return result;
  }, [logs, status]);

  return {
    logs,
    totals,
    status,
    loading: status === "loading", // ✅ AthleteView互換
    error,
    refetch: fetchLogs, // ✅ 保存後に呼べる
  };
}