// src/lib/dailyOneWord.ts
import { getPhaseAdvice } from "./phaseAdvice";

export type PhaseType = "off" | "pre" | "in" | "peak" | "transition" | "unknown";

export type TeamPhaseLike = {
  phase_type: PhaseType;
  focus_tags?: string[] | null;
  note?: string | null;
  start_date?: string | null; // YYYY-MM-DD
  end_date?: string | null;   // YYYY-MM-DD
};

export type PoorSleepFlag = {
  isPoor: boolean;
  hours: number | null;
  quality: number | null;
};

export type RiskLevel = "high" | "caution" | "good" | "low" | "unknown";

export type RiskContext = {
  // ACWRなどの判定（無ければunknown）
  riskLevel?: RiskLevel | null;
  // “緊急注意”など、優先的に出したい状態
  hasHighPriorityAlert?: boolean;
};

export type DailyAssistReason = "poor_sleep" | "high_risk" | "phase" | "default";

export type DailyAssistTexts = {
  oneWord: string;
  trainingHint: string;
  sleepHint: string;
  nutritionHint: string;
  popHint: string;
  reason: DailyAssistReason;
};

/** フェーズ表示（日本語） */
export function phaseLabel(t: PhaseType): string {
  switch (t) {
    case "off": return "オフ";
    case "pre": return "土台";
    case "in": return "積み上げ";
    case "peak": return "仕上げ";
    case "transition": return "切り替え";
    default: return "未設定";
  }
}

/** 「週」っぽい言い回しを、フェーズ/期間に寄せる（最低限） */
function normalizePhaseWording(s: string): string {
  if (!s) return s;
  return s
    .replace(/土台づくりの週/g, "土台づくりの期間")
    .replace(/積み上げの週/g, "積み上げの期間")
    .replace(/仕上げの週/g, "仕上げの期間")
    .replace(/切り替えの週/g, "切り替えの期間")
    .replace(/今週/g, "この期間")
    .replace(/週/g, "期間");
}

function clampText(s: string, max: number): string {
  if (!s) return s;
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)) + "…";
}

function getSleepBadge(poor: PoorSleepFlag): string {
  if (poor.hours && poor.hours > 0) return `（睡眠${poor.hours.toFixed(1)}h）`;
  if (poor.quality && poor.quality > 0) return `（睡眠の質${poor.quality}/5）`;
  return "（睡眠不足）";
}

/**
 * フェーズ×タグ辞書（まずは10個くらいの初期セット）
 * key = `${phase_type}:${tag}`
 */
const TAG_HINTS: Record<string, { oneWord: string; training?: string; sleep?: string; nutrition?: string }> = {
  "pre:基礎": {
    oneWord: "🧱 土台づくりの期間。基本を丁寧に、上げすぎ注意。",
    training: "土台づくり：フォーム・基礎を優先。上げすぎ注意。",
  },
  "pre:フォーム": {
    oneWord: "🧱 フォーム最優先。速さより“質”で積む。",
    training: "フォーム優先。速さより“再現性”で積もう。",
  },
  "pre:筋力": {
    oneWord: "🧱 筋力は積み上げ。追い込みすぎず継続で勝つ。",
    training: "筋力は“続けて伸ばす”。やり切るより継続。",
  },
  "in:積み上げ": {
    oneWord: "📈 積み上げ期。狙いを決めて記録しよう。",
    training: "積み上げ：狙いを決めて、やった内容を残そう。",
  },
  "in:強度": {
    oneWord: "📈 強度を使う期間。回復もセットで設計。",
    training: "強度を使う日。回復（睡眠/栄養）もセットで。",
  },
  "peak:キレ": {
    oneWord: "⚡ 仕上げ期。疲労を残さずキレ重視。",
    training: "仕上げ：量よりキレ。疲労を残さない。",
  },
  "peak:試合": {
    oneWord: "⚡ 試合モード。軽く鋭く、コンディション最優先。",
    training: "試合優先：軽く鋭く。やり過ぎない。",
    sleep: "睡眠は最優先（量と質どちらも）。",
    nutrition: "胃腸に優しく、当日のパフォーマンス優先。",
  },
  "transition:回復": {
    oneWord: "🔄 切り替え期。整えて次の伸びに繋げる。",
    training: "整える日。軽めでOK、可動域と安定性。",
  },
  "off:休養": {
    oneWord: "🌿 回復が仕事。睡眠と栄養で満タンに。",
    training: "回復優先。強度は控えめでOK。",
    sleep: "睡眠で回復を作る。早寝も検討。",
    nutrition: "迷ったら「主食＋たんぱく質＋野菜」から。",
  },
  "unknown:": {
    oneWord: "✅ 今日の感覚を正直に記録しよう。",
  },
};

/**
 * 優先順位（確定）
 * 1) 睡眠不足 → 2) 高リスク → 3) フェーズ → 4) 通常
 */
export function buildDailyAssistTexts(args: {
  phase: TeamPhaseLike | null;
  poorSleep: PoorSleepFlag | null;
  risk?: RiskContext | null;
}): DailyAssistTexts {
  const phase = args.phase;
  const poorSleep = args.poorSleep;
  const risk = args.risk ?? null;

  const phaseType: PhaseType = (phase?.phase_type ?? "unknown") as PhaseType;
  const tags = (phase?.focus_tags ?? [])?.filter(Boolean) as string[];
  const note = phase?.note ?? null;

  const hasHighAlert = !!risk?.hasHighPriorityAlert;
  const riskLevel = (risk?.riskLevel ?? "unknown") as RiskLevel;
  const isHighRisk = hasHighAlert || riskLevel === "high";

  // ---------- 1) 睡眠不足 ----------
  if (poorSleep?.isPoor) {
    const badge = getSleepBadge(poorSleep);
    return {
      oneWord: `⚠️ ${badge} 今日は上げすぎ注意。強度を抑えて精度重視。`,
      trainingHint: `⚠️ ${badge} 今日は上げすぎ注意。強度を抑えて精度重視で。`,
      sleepHint: `⚠️ ${badge} 今日は回復が最優先。昼寝や早寝も検討。`,
      nutritionHint: `⚠️ ${badge} 回復優先：水分＋炭水化物＋たんぱく質を確実に。`,
      popHint: `${badge} まず記録。今日は強度を抑える日に。`,
      reason: "poor_sleep",
    };
  }

  // ---------- 2) 高リスク ----------
  if (isHighRisk) {
    return {
      oneWord: "⚠️ ケガリスク高め。負荷を落として回復/可動域を優先。",
      trainingHint: "⚠️ リスク高め。今日は強度を落として精度・回復優先で。",
      sleepHint: "睡眠で回復を最大化。入眠/起床リズムを整えよう。",
      nutritionHint: "回復優先：水分＋炭水化物＋たんぱく質を先に確保。",
      popHint: "まず記録。今日は“回復寄り”で整えよう。",
      reason: "high_risk",
    };
  }

  // ---------- 3) フェーズ（タグ辞書 → note → phaseAdvice → デフォ） ----------
  if (phase) {
    // 3-1) タグ辞書優先（最初に刺さるタグがあれば採用）
    const hitTag = tags.find((t) => TAG_HINTS[`${phaseType}:${t}`]);
    if (hitTag) {
      const pack = TAG_HINTS[`${phaseType}:${hitTag}`];
      return {
        oneWord: clampText(pack.oneWord, 80),
        trainingHint: clampText(pack.training ?? pack.oneWord, 80),
        sleepHint: clampText(
          pack.sleep ??
            (phaseType === "peak"
              ? "睡眠は最優先（量と質どちらも）。"
              : phaseType === "in"
              ? "睡眠で回復を積む。短くても質を確保。"
              : "睡眠は回復の土台。起床時の感覚も大事。"),
          80
        ),
        nutritionHint: clampText(
          pack.nutrition ??
            (phaseType === "pre"
              ? "土台づくり：まずは「主食＋たんぱく質」から。"
              : phaseType === "in"
              ? "積み上げ期：練習量に合わせて炭水化物を確保。"
              : phaseType === "peak"
              ? "仕上げ期：胃腸に優しく、当日のパフォーマンス優先。"
              : "迷ったら「主食＋たんぱく質＋野菜」から。"),
          80
        ),
        popHint: "まず記録。今日の狙いを明確にしよう。",
        reason: "phase",
      };
    }

    // 3-2) note があれば優先（表現をフェーズ/期間寄せ）
    if (note && note.trim().length > 0) {
      const normalized = clampText(normalizePhaseWording(note.trim()), 80);
      return {
        oneWord: normalized,
        trainingHint:
          phaseType === "pre"
            ? "土台づくり：フォーム優先、上げすぎ注意。"
            : phaseType === "in"
            ? "積み上げ期：狙いを決めて記録しよう。"
            : phaseType === "peak"
            ? "仕上げ期：疲労を溜めずにキレ重視。"
            : phaseType === "transition"
            ? "切り替え期：整える・軽めでOK。"
            : "今日は回復優先。強度は控えめでOK。",
        sleepHint:
          phaseType === "peak"
            ? "睡眠は最優先（量と質どちらも）。"
            : phaseType === "in"
            ? "睡眠で回復を積む。短くても質を確保。"
            : "睡眠は回復の土台。起床時の感覚も大事。",
        nutritionHint:
          phaseType === "pre"
            ? "土台づくり：まずは「主食＋たんぱく質」から。"
            : phaseType === "in"
            ? "積み上げ期：練習量に合わせて炭水化物を確保。"
            : phaseType === "peak"
            ? "仕上げ期：胃腸に優しく、当日のパフォーマンス優先。"
            : "迷ったら「主食＋たんぱく質＋野菜」から。",
        popHint: "まず記録。今日の狙いを明確にしよう。",
        reason: "phase",
      };
    }

    // 3-3) getPhaseAdvice を使用（短め）
    const base = getPhaseAdvice(phaseType, tags, note, {
      preferNote: true,
      appendTagHintsWhenNote: false,
      maxNoteChars: 80,
    });

    const baseNormalized = clampText(normalizePhaseWording(base), 80);

    return {
      oneWord: baseNormalized,
      trainingHint:
        phaseType === "pre"
          ? "土台づくり：フォーム優先、上げすぎ注意。"
          : phaseType === "in"
          ? "積み上げ期：狙いを決めて記録しよう。"
          : phaseType === "peak"
          ? "仕上げ期：疲労を溜めずにキレ重視。"
          : phaseType === "transition"
          ? "切り替え期：整える・軽めでOK。"
          : "今日は回復優先。強度は控えめでOK。",
      sleepHint:
        phaseType === "peak"
          ? "睡眠は最優先（量と質どちらも）。"
          : phaseType === "in"
          ? "睡眠で回復を積む。短くても質を確保。"
          : "睡眠は回復の土台。起床時の感覚も大事。",
      nutritionHint:
        phaseType === "pre"
          ? "土台づくり：まずは「主食＋たんぱく質」から。"
          : phaseType === "in"
          ? "積み上げ期：練習量に合わせて炭水化物を確保。"
          : phaseType === "peak"
          ? "仕上げ期：胃腸に優しく、当日のパフォーマンス優先。"
          : "迷ったら「主食＋たんぱく質＋野菜」から。",
      popHint: "まず記録。今日の狙いを明確にしよう。",
      reason: "phase",
    };
  }

  // ---------- 4) 通常 ----------
  return {
    oneWord: "✅ 今日は“1つだけ”やる。まず記録から。",
    trainingHint: "今日の練習を正直に記録しよう。",
    sleepHint: "睡眠は回復の土台。起床時の感覚も大事。",
    nutritionHint: "迷ったら「主食＋たんぱく質＋野菜」から。",
    popHint: "まず1分で入力しよう。",
    reason: "default",
  };
}