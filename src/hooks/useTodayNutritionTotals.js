import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * 今日の nutrition_logs を取得し、合計(kcal/P/F/C)を返す
 * UX方針:
 * - loading中に totals を 0 に戻さない（チラつき防止）
 * - 「未入力」「未解析」を区別できるメタ情報を返す
 */
export function useTodayNutritionTotals(userId, dateStr) {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const [error, setError] = useState(null);

  // 前回の totals を保持（loading中に0に戻さない）
  const lastTotalsRef = useRef({ cal: 0, p: 0, f: 0, c: 0 });

  useEffect(() => {
    if (!userId || !dateStr) return;

    let cancelled = false;

    async function fetchLogs() {
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
          .order("meal_type", { ascending: true })
          .order("meal_slot", { ascending: true })
          .order("created_at", { ascending: true });

        if (error) throw error;
        if (!cancelled) {
          setLogs(data ?? []);
          setStatus("ready");
        }
      } catch (e) {
        console.error("[useTodayNutritionTotals] fetch error:", e);
        if (!cancelled) {
          setLogs([]);
          setStatus("error");
          setError(String(e?.message ?? e));
        }
      }
    }

    fetchLogs();
    return () => {
      cancelled = true;
    };
  }, [userId, dateStr]);

  const totals = useMemo(() => {
    if (status === "loading") {
      // loading中は前回値を返す（UX安定）
      return lastTotalsRef.current;
    }

    const sum = { cal: 0, p: 0, f: 0, c: 0 };
    let hasUnparsed = false;

    for (const row of logs) {
      if (
        row.total_calories == null ||
        row.p == null ||
        row.f == null ||
        row.c == null
      ) {
        hasUnparsed = true;
      }

      sum.cal += Number(row.total_calories ?? 0);
      sum.p += Number(row.p ?? 0);
      sum.f += Number(row.f ?? 0);
      sum.c += Number(row.c ?? 0);
    }

    sum.p = Math.round(sum.p * 10) / 10;
    sum.f = Math.round(sum.f * 10) / 10;
    sum.c = Math.round(sum.c * 10) / 10;

    const result = {
      ...sum,
      hasAnyLog: logs.length > 0,
      hasUnparsed
    };

    lastTotalsRef.current = result;
    return result;
  }, [logs, status]);

  return {
    logs,
    totals,
    status, // UI分岐用
    error
  };
}