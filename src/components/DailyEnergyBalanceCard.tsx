import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

function formatTokyoDate(d = new Date()) {
  const parts = d
    .toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })
    .split("/");
  return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
}

type Mode = "感覚" | "数値" | "食品";

type Props = {
  date?: string; // yyyy-mm-dd
};

type Snapshot = {
  bmr: number;
  srpe: number;
  activity_factor: number;
  tdee: number;
};

export default function DailyEnergyBalanceCard({ date }: Props) {
  const targetDate = date ?? formatTokyoDate();

  const [mode, setMode] = useState<Mode>("感覚");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [tdee, setTdee] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [intake, setIntake] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      setMsg("");

      try {
        const { data: auth, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;
        const userId = auth.user?.id;
        if (!userId) throw new Error("未ログイン");

        // 1) 今日の摂取（nutrition_logs 合計）
        const { data: intakeRows, error: intakeErr } = await supabase
          .from("nutrition_logs")
          .select("total_calories")
          .eq("user_id", userId)
          .eq("record_date", targetDate);

        if (intakeErr) throw intakeErr;

        const intakeSum =
          (intakeRows ?? []).reduce((sum: number, r: any) => sum + (r.total_calories ?? 0), 0);

        // 2) 今日の消費（daily_energy_snapshots）
        const { data: snap, error: snapErr } = await supabase
          .from("daily_energy_snapshots")
          .select("bmr, srpe, activity_factor, tdee")
          .eq("user_id", userId)
          .eq("date", targetDate)
          .maybeSingle();

        if (snapErr) throw snapErr;

        if (!mounted) return;

        setIntake(intakeSum);
        setSnapshot(snap ?? null);
        setTdee(snap?.tdee ?? null);
      } catch (e: any) {
        console.error(e);
        if (!mounted) return;
        setMsg(`❌ ${e?.message ?? String(e)}`);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [targetDate]);

  const diff = useMemo(() => {
    if (tdee == null || intake == null) return null;
    return intake - tdee; // 摂取 - 消費（プラス＝食べ過ぎ、マイナス＝不足）
  }, [tdee, intake]);

  const status = useMemo(() => {
    if (diff == null) return { label: "未計算", tone: "bg-gray-100 text-gray-700" };

    // ざっくりの帯（好みで調整）
    if (diff <= -400) return { label: "不足（大）", tone: "bg-blue-50 text-blue-700" };
    if (diff <= -150) return { label: "不足（中）", tone: "bg-blue-50 text-blue-700" };
    if (diff < 150) return { label: "ちょうど良い", tone: "bg-green-50 text-green-700" };
    if (diff < 400) return { label: "オーバー（中）", tone: "bg-yellow-50 text-yellow-700" };
    return { label: "オーバー（大）", tone: "bg-red-50 text-red-700" };
  }, [diff]);

  const foodTranslation = useMemo(() => {
    if (diff == null) return null;

    // diffがマイナスなら「足す」、プラスなら「減らす」の例
    const abs = Math.abs(diff);

    // 超ざっくり換算（後であなたの運用に合わせて洗練）
    const riceBowl = 250; // 茶碗1杯 ≒ 250kcal くらいとして仮
    const onigiri = 180;  // おにぎり1個 ≒ 180kcal 仮
    const banana = 90;    // バナナ1本 ≒ 90kcal 仮
    const milk = 140;     // 牛乳200ml ≒ 140kcal 仮
    const yogurt = 150;   // ヨーグルト1個 ≒ 150kcal 仮

    const items = [
      { name: "おにぎり", cal: onigiri },
      { name: "バナナ", cal: banana },
      { name: "牛乳200ml", cal: milk },
      { name: "ヨーグルト", cal: yogurt },
      { name: "ご飯（茶碗1杯）", cal: riceBowl },
    ];

    // 近い組み合わせを2〜3個出す簡易版（貪欲）
    let remain = abs;
    const picks: { name: string; count: number; cal: number }[] = [];

    for (const it of items) {
      if (remain <= 0) break;
      const cnt = Math.floor(remain / it.cal);
      if (cnt > 0) {
        picks.push({ name: it.name, count: cnt, cal: it.cal });
        remain -= cnt * it.cal;
      }
    }

    // 端数が残るなら、近いものを1つ追加
    if (remain > 60) {
      const nearest = items.reduce((best, cur) => {
        const dBest = Math.abs(remain - best.cal);
        const dCur = Math.abs(remain - cur.cal);
        return dCur < dBest ? cur : best;
      }, items[0]);
      picks.push({ name: nearest.name, count: 1, cal: nearest.cal });
    }

    const direction = diff < 0 ? "足す（補食）" : "減らす（調整）";
    return { direction, picks, abs };
  }, [diff]);

  return (
    <div className="bg-white border rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm text-gray-500">今日のエネルギーバランス</div>
          <div className="text-lg font-semibold">{targetDate}</div>
        </div>

        <div className={`px-3 py-1 rounded-full text-sm font-medium ${status.tone}`}>
          {status.label}
        </div>
      </div>

      <div className="flex gap-2">
        {(["感覚", "数値", "食品"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1 rounded-lg text-sm border ${
              mode === m ? "bg-gray-900 text-white" : "bg-white"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">読み込み中...</div>
      ) : msg ? (
        <div className="text-sm">{msg}</div>
      ) : (
        <>
          {/* サマリー行 */}
          <div className="grid grid-cols-3 gap-2">
            <div className="border rounded-xl p-3">
              <div className="text-xs text-gray-500">消費（TDEE）</div>
              <div className="text-xl font-semibold">
                {tdee == null ? "—" : `${tdee}`}
                <span className="text-sm text-gray-500 ml-1">kcal</span>
              </div>
            </div>
            <div className="border rounded-xl p-3">
              <div className="text-xs text-gray-500">摂取（合計）</div>
              <div className="text-xl font-semibold">
                {intake == null ? "—" : `${intake}`}
                <span className="text-sm text-gray-500 ml-1">kcal</span>
              </div>
            </div>
            <div className="border rounded-xl p-3">
              <div className="text-xs text-gray-500">差分（摂取−消費）</div>
              <div className="text-xl font-semibold">
                {diff == null ? "—" : `${diff > 0 ? "+" : ""}${diff}`}
                <span className="text-sm text-gray-500 ml-1">kcal</span>
              </div>
            </div>
          </div>

          {/* モード別の詳細 */}
          {mode === "感覚" && (
            <div className="rounded-xl border p-3 text-sm leading-relaxed">
              {diff == null ? (
                "消費量（TDEE）または摂取量がまだ揃っていません。"
              ) : diff < -150 ? (
                "今日はエネルギーが足りていない可能性が高い。補食で少し足すのが安全。"
              ) : diff > 150 ? (
                "今日は摂取が多め。夜で少し整えると体重調整が楽。"
              ) : (
                "今日はバランス良い。今の食事の形を続けるのが強い。"
              )}
            </div>
          )}

          {mode === "数値" && (
            <div className="rounded-xl border p-3 text-sm space-y-2">
              <div className="font-medium">内訳</div>
              {snapshot ? (
                <ul className="list-disc pl-5 space-y-1">
                  <li>基礎代謝（BMR）：{snapshot.bmr} kcal</li>
                  <li>sRPE：{snapshot.srpe}</li>
                  <li>活動レベル（係数）：{Number(snapshot.activity_factor).toFixed(2)}</li>
                  <li>消費（TDEE）：{snapshot.tdee} kcal</li>
                </ul>
              ) : (
                <div className="text-gray-500">
                  今日の消費スナップショットが未作成です（daily_energy_snapshots）。
                </div>
              )}
            </div>
          )}

          {mode === "食品" && (
            <div className="rounded-xl border p-3 text-sm space-y-2">
              {!foodTranslation ? (
                <div className="text-gray-500">差分が未計算です。</div>
              ) : (
                <>
                  <div className="font-medium">
                    {foodTranslation.direction}：目安 {foodTranslation.abs} kcal
                  </div>
                  <div className="text-gray-600">
                    例（ざっくり）：下のどれかで調整
                  </div>
                  <ul className="list-disc pl-5 space-y-1">
                    {foodTranslation.picks.map((p, i) => (
                      <li key={i}>
                        {p.name} × {p.count}（{p.cal * p.count} kcal）
                      </li>
                    ))}
                  </ul>
                  <div className="text-xs text-gray-500">
                    ※換算は仮。あなたの運用（学校・部活・コンビニ現実）に合わせて最適化しよう。
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}