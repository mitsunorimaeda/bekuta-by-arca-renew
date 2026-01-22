// src/hooks/useTrainingData.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type TrainingRecordRow = {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  rpe: number | null;
  duration_min: number | null;
  arrow_score?: number | null;
  signal_score?: number | null;
  created_at?: string | null;
};

export type ACWRPoint = {
  date: string;
  acwr: number | null;
  acuteLoad: number | null;
  chronicLoad: number | null;
  dailyLoad: number | null;
  daysOfData: number | null;
  riskLevel: "high" | "caution" | "good" | "low" | "unknown";
};

const toNum = (v: any) => {
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : null;
};

const calcRiskLevel = (acwr: number | null): ACWRPoint["riskLevel"] => {
  if (acwr == null) return "unknown";
  // 例：一般的な目安（必要ならあなたの基準に合わせて調整）
  if (acwr >= 1.5) return "high";
  if (acwr >= 1.3) return "caution";
  if (acwr >= 0.8) return "good";
  return "low";
};

// ✅ フォールバック用：training_records から簡易ACWRを作る
// dailyLoad = rpe * duration_min（= sRPE）
// acuteLoad = 直近7日合計
// chronicLoad = 過去28日合計 / 4（= 週平均）
// acwr = acute / chronic
function buildAcwrFromTrainingRecords(records: TrainingRecordRow[]): ACWRPoint[] {
  // 日付昇順
  const sorted = [...records].sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

  const loadsByDate = new Map<string, number>();
  for (const r of sorted) {
    const rpe = toNum(r.rpe) ?? 0;
    const dur = toNum(r.duration_min) ?? 0;
    const load = rpe * dur;
    loadsByDate.set(r.date, load);
  }

  const dates = sorted.map((r) => r.date);

  const parse = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1).getTime();
  };

  const points: ACWRPoint[] = [];

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const t = parse(date);

    // 直近7日（当日含む）
    let acute = 0;
    let acuteDays = 0;

    // 過去28日（当日含む）
    let chronicSum = 0;
    let chronicDays = 0;

    for (let j = 0; j <= i; j++) {
      const d = dates[j];
      const dt = parse(d);
      const diffDays = Math.floor((t - dt) / (1000 * 60 * 60 * 24));

      const load = loadsByDate.get(d) ?? 0;

      if (diffDays >= 0 && diffDays < 7) {
        acute += load;
        acuteDays++;
      }
      if (diffDays >= 0 && diffDays < 28) {
        chronicSum += load;
        chronicDays++;
      }
    }

    // chronic は「28日合計 / 4」で週平均に
    const chronic = chronicSum / 4;

    const acwr =
      chronic > 0 ? acute / chronic : null;

    points.push({
      date,
      dailyLoad: loadsByDate.get(date) ?? 0,
      acuteLoad: acute,
      chronicLoad: chronic > 0 ? chronic : null,
      acwr,
      daysOfData: chronicDays,
      riskLevel: calcRiskLevel(acwr),
    });
  }

  return points;
}

export function useTrainingData(userId: string) {
  const [records, setRecords] = useState<TrainingRecordRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [acwrData, setAcwrData] = useState<ACWRPoint[]>([]);

  // ✅ training_records 取得
  const fetchTrainingRecords = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("training_records")
      .select("id,user_id,date,rpe,duration_min,arrow_score,signal_score,created_at")
      .eq("user_id", userId)
      .order("date", { ascending: true });

    if (error) throw error;

    setRecords((data ?? []) as TrainingRecordRow[]);
    return (data ?? []) as TrainingRecordRow[];
  }, [userId]);

  // ✅ athlete_acwr_daily 取得（athlete側もここをメインにする）
  const fetchAcwrDaily = useCallback(async () => {
    if (!userId) return [] as ACWRPoint[];

    // 直近120日くらい（必要なら調整）
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 120);

    const toISO = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };

    const dateFrom = toISO(from);
    const dateTo = toISO(to);

    const { data, error, status } = await supabase
      .from("athlete_acwr_daily")
      .select("user_id,date,acwr,days_of_data,acute_7d,chronic_load,daily_load")
      .eq("user_id", userId)
      .gte("date", dateFrom)
      .lte("date", dateTo)
      .order("date", { ascending: true });

    if (error) {
      console.warn("[useTrainingData] athlete_acwr_daily failed", { status, error });
      return [];
    }

    const rows = (data ?? []) as any[];

    const mapped: ACWRPoint[] = rows.map((r) => {
      const acwr = toNum(r.acwr);
      return {
        date: String(r.date),
        acwr,
        daysOfData: toNum(r.days_of_data),
        acuteLoad: toNum(r.acute_7d),
        chronicLoad: toNum(r.chronic_load),
        dailyLoad: toNum(r.daily_load),
        riskLevel: calcRiskLevel(acwr),
      };
    });

    return mapped;
  }, [userId]);

  // ✅ 初期ロード：ACWRは daily を優先、取れなければ training_records から生成
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!userId) return;
      setLoading(true);

      try {
        const training = await fetchTrainingRecords();

        // ① まず daily を読む
        const daily = await fetchAcwrDaily();

        if (cancelled) return;

        if (daily.length > 0) {
          setAcwrData(daily);
        } else {
          // ② daily が空ならフォールバック計算
          const fallback = buildAcwrFromTrainingRecords(training ?? []);
          setAcwrData(fallback);
        }
      } catch (e) {
        if (cancelled) return;
        console.error("[useTrainingData] load error", e);
        setRecords([]);
        setAcwrData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, fetchTrainingRecords, fetchAcwrDaily]);

  // =========================
  // ✅ CRUD
  // =========================
  const checkExistingRecord = useCallback(
    async (date: string) => {
      const { data, error } = await supabase
        .from("training_records")
        .select("id,user_id,date,rpe,duration_min,arrow_score,signal_score,created_at")
        .eq("user_id", userId)
        .eq("date", date)
        .maybeSingle();

      if (error) throw error;
      return (data as TrainingRecordRow) ?? null;
    },
    [userId]
  );

  const addTrainingRecord = useCallback(
    async (payload: Omit<TrainingRecordRow, "id" | "user_id"> & { rpe: number; duration_min: number; date: string }) => {
      const { error } = await supabase.from("training_records").insert({
        user_id: userId,
        date: payload.date,
        rpe: payload.rpe,
        duration_min: payload.duration_min,
        arrow_score: (payload as any).arrow_score ?? null,
        signal_score: (payload as any).signal_score ?? null,
      });

      if (error) throw error;

      // 再ロード（ACWRも再計算/再取得）
      const training = await fetchTrainingRecords();
      const daily = await fetchAcwrDaily();
      setAcwrData(daily.length > 0 ? daily : buildAcwrFromTrainingRecords(training ?? []));
    },
    [userId, fetchTrainingRecords, fetchAcwrDaily]
  );

  const updateTrainingRecord = useCallback(
    async (id: string, payload: Partial<TrainingRecordRow>) => {
      const { error } = await supabase
        .from("training_records")
        .update({
          rpe: payload.rpe ?? undefined,
          duration_min: payload.duration_min ?? undefined,
          date: payload.date ?? undefined,
          arrow_score: (payload as any).arrow_score ?? undefined,
          signal_score: (payload as any).signal_score ?? undefined,
        })
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;

      const training = await fetchTrainingRecords();
      const daily = await fetchAcwrDaily();
      setAcwrData(daily.length > 0 ? daily : buildAcwrFromTrainingRecords(training ?? []));
    },
    [userId, fetchTrainingRecords, fetchAcwrDaily]
  );

  const deleteTrainingRecord = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("training_records")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;

      const training = await fetchTrainingRecords();
      const daily = await fetchAcwrDaily();
      setAcwrData(daily.length > 0 ? daily : buildAcwrFromTrainingRecords(training ?? []));
    },
    [userId, fetchTrainingRecords, fetchAcwrDaily]
  );

  return {
    records,
    loading,
    acwrData,
    checkExistingRecord,
    addTrainingRecord,
    updateTrainingRecord,
    deleteTrainingRecord,
  };
}