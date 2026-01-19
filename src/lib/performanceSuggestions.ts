// src/lib/performanceSuggestions.ts

export type SuggestCategory = '筋力' | 'スプリント' | 'ジャンプ' | '敏捷' | '持久' | 'その他';

export type SuggestInput = {
  testTypeDisplayName: string;
  categoryLabel: SuggestCategory;
  unitLabel: string;
  lowerIsBetter: boolean;

  latestValue: number | null;
  latestDate?: string | null;
  bestValue: number | null;
  bestDate?: string | null;

  // 直近の推移（最新が先頭でも末尾でもOK。内部でソート）
  history?: { date: string; value: number }[];

  // 比較母集団（チーム/学校/競技など）
  benchmarkScope?: string | null; // 'team' | 'org_sport' | 'sport'
  benchmarkN?: number | null;
  minN?: number | null;
};

export type SuggestOutput = {
  statusLabel: string; // PB更新 / PBまで / PBより など
  statusTone: 'good' | 'caution' | 'bad' | 'neutral';
  gapText: string; // “PBまで +0.20” “PBより +0.15” など
  gapValueAbs: number | null;

  // 2週間の目標値（目安）
  goalText: string;
  goalValue: number | null;

  // 提案メッセージ
  bullets: string[];
};

const digitsForByUnit = (unit?: string) => {
  const u = (unit || '').trim();
  const intUnits = new Set(['回', '点', 'm']);
  if (intUnits.has(u)) return 0;
  return 2;
};

const fmt = (n: number | null | undefined, unit?: string) => {
  if (n == null || Number.isNaN(Number(n))) return '-';
  const d = digitsForByUnit(unit);
  const x = Number(n);
  if (d === 0) return String(Math.round(x));
  return x.toFixed(d);
};

const safeSortHistory = (h?: { date: string; value: number }[]) => {
  if (!h || h.length === 0) return [];
  return [...h]
    .filter((x) => x?.date && x?.value != null && !Number.isNaN(Number(x.value)))
    .sort((a, b) => String(a.date).localeCompare(String(b.date))); // 昇順
};

const calcRecentTrendPct = (historyAsc: { date: string; value: number }[], lowerIsBetter: boolean) => {
  // 直近3点で「改善率」(+) / 悪化(-) を返す（方向補正済み）
  const h = historyAsc.slice(-3);
  if (h.length < 2) return null;

  const first = h[0].value;
  const last = h[h.length - 1].value;
  if (first === 0) return null;

  // higher better: (last-first)/abs(first)
  // lower better : (first-last)/abs(first)  ← 小さいほど良いので符号反転
  const raw = (last - first) / Math.abs(first);
  const dir = lowerIsBetter ? -1 : 1;
  return raw * dir * 100; // 改善が +%
};

const buildGoalValue = (latest: number, best: number, lowerIsBetter: boolean, unitLabel: string) => {
  // 2週間目標の“目安”
  const d = digitsForByUnit(unitLabel);

  // PB更新済み：さらに 0.5〜1.5% だけ上を狙う（過剰にしない）
  const pbMargin = Math.abs(best) * 0.01; // 1%
  const goalWhenPb = lowerIsBetter ? best - pbMargin : best + pbMargin;

  // PB未達：PBまでの差の「50%」をまず取りに行く（現実的）
  const gapToBest = lowerIsBetter ? latest - best : best - latest; // 常に >=0 が理想
  const step = Math.max(0, gapToBest * 0.5);

  const goalWhenNotPb = lowerIsBetter ? latest - step : latest + step;

  const isPb = lowerIsBetter ? latest <= best : latest >= best;
  const goal = isPb ? goalWhenPb : goalWhenNotPb;

  // 表示桁に丸め
  const pow = d === 0 ? 1 : Math.pow(10, d);
  const rounded = d === 0 ? Math.round(goal) : Math.round(goal * pow) / pow;
  return { goal: rounded, isPb, gapToBest };
};

const scopeJa = (s?: string | null) => {
  if (s === 'team') return 'チーム内';
  if (s === 'org_sport') return '同校×同競技';
  if (s === 'sport') return '競技全体';
  return null;
};

export function buildPerformanceSuggestion(input: SuggestInput): SuggestOutput {
  const {
    testTypeDisplayName,
    categoryLabel,
    unitLabel,
    lowerIsBetter,
    latestValue,
    latestDate,
    bestValue,
    bestDate,
    history,
    benchmarkScope,
    benchmarkN,
    minN,
  } = input;

  if (latestValue == null || bestValue == null) {
    return {
      statusLabel: 'データ不足',
      statusTone: 'neutral',
      gapText: 'PB差を計算できません',
      gapValueAbs: null,
      goalText: 'まずは測定データを増やそう',
      goalValue: null,
      bullets: [
        '最新値またはPB値が不足しています（入力/同期を確認）',
        '最低でも2回以上の記録があると「伸び/落ち」も判定できます',
      ],
    };
  }

  const isPb = lowerIsBetter ? latestValue <= bestValue : latestValue >= bestValue;

  // 表示用の差
  // higher better: latest-best（PBより上なら +）
  // lower better : best-latest（速いほど +）
  const delta = lowerIsBetter ? bestValue - latestValue : latestValue - bestValue;
  const toBest = lowerIsBetter ? latestValue - bestValue : bestValue - latestValue; // PBまで（>=0）

  let statusLabel: string;
  let statusTone: 'good' | 'caution' | 'bad' | 'neutral';
  let gapText: string;

  if (isPb) {
    statusLabel = 'PB更新';
    statusTone = 'good';
    gapText = `PB更新！（+${fmt(Math.max(0, delta), unitLabel)}）`;
  } else {
    // PBから離れてる（悪化してる）/ 近づいてる を区別
    const worse = lowerIsBetter ? latestValue > bestValue : latestValue < bestValue;
    statusLabel = worse ? 'PBから離れてる' : 'PBまであと少し';
    statusTone = worse ? 'bad' : 'caution';
    gapText = worse
      ? `PBより +${fmt(Math.abs(toBest), unitLabel)}`
      : `PBまで +${fmt(Math.abs(toBest), unitLabel)}`;
  }

  const historyAsc = safeSortHistory(history);
  const trendPct = calcRecentTrendPct(historyAsc, lowerIsBetter);

  const { goal, gapToBest } = buildGoalValue(latestValue, bestValue, lowerIsBetter, unitLabel);

  const scope = scopeJa(benchmarkScope);
  const scopeLine =
    scope && typeof benchmarkN === 'number'
      ? `比較母集団：${scope}（n=${benchmarkN}${typeof minN === 'number' ? ` / 閾値=${minN}` : ''}）`
      : scope
        ? `比較母集団：${scope}`
        : null;

  const bullets: string[] = [];

  // 1) 状況整理
  bullets.push(
    `最新：${fmt(latestValue, unitLabel)}（${latestDate || '-'}） / PB：${fmt(bestValue, unitLabel)}（${bestDate || '-'}）`
  );
  if (scopeLine) bullets.push(scopeLine);

  // 2) 推移
  if (trendPct != null) {
    const t = Math.round(trendPct * 10) / 10;
    if (t >= 2) bullets.push(`直近の流れ：改善傾向（+${t}%）`);
    else if (t <= -2) bullets.push(`直近の流れ：悪化傾向（${t}%）`);
    else bullets.push(`直近の流れ：横ばい（${t}%）`);
  } else {
    bullets.push('直近の流れ：判定にはデータがもう少し必要');
  }

  // 3) カテゴリ別：次の2週間の打ち手（“提案先は選手”なので短く具体）
  const goalText = `次の2週間目標：${fmt(goal, unitLabel)} ${unitLabel ? unitLabel : ''}`.trim();

  const common = [
    '週2回「フォーム/質の日」を作る（疲労が高い日は記録狙いに行かない）',
    '記録を狙う日は“前日睡眠 + 食事”を整える（ここが一番効く）',
  ];

  if (categoryLabel === '筋力') {
    bullets.push(
      `狙い：PBまでの差 ${fmt(gapToBest, unitLabel)} を “半分” 取りにいく（やり過ぎない）`
    );
    bullets.push('メニュー案：高強度（3〜5回×3〜5set）＋補助（8〜12回）を週2回');
    bullets.push('コツ：バーの軌道/深さ/ブレーシングを動画で確認（1つだけ修正）');
    bullets.push(...common);
  } else if (categoryLabel === 'スプリント' || categoryLabel === '敏捷') {
    bullets.push('メニュー案：加速（10〜20m）×6〜10本＋休息長め（質優先）');
    bullets.push('メニュー案：切り返しは「減速→切替→再加速」を分解して練習');
    bullets.push('コツ：接地を短くしようとし過ぎない（まずは姿勢と腕振り）');
    bullets.push(...common);
  } else if (categoryLabel === 'ジャンプ') {
    bullets.push('メニュー案：低回数の高品質ジャンプ（3〜5回×4〜6set）＋着地の安定');
    bullets.push('メニュー案：ジャンプ前に足首/股関節の可動性を3分だけ確保');
    bullets.push('コツ：反動を増やす前に“止める力”を上げる（接地で潰れない）');
    bullets.push(...common);
  } else if (categoryLabel === '持久') {
    bullets.push('メニュー案：20〜30分のテンポ + 週1の短いインターバル（やり過ぎない）');
    bullets.push('コツ：疲労が溜まってる週は“量”より“継続”を優先');
    bullets.push(...common);
  } else {
    bullets.push('メニュー案：弱点を1つに絞って週2回だけ対策（やり過ぎない）');
    bullets.push(...common);
  }

  return {
    statusLabel,
    statusTone,
    gapText,
    gapValueAbs: Math.abs(isPb ? delta : toBest),
    goalText,
    goalValue: goal,
    bullets,
  };
}