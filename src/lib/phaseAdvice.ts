// src/lib/phaseAdvice.ts

export type PhaseType = 'off' | 'pre' | 'in' | 'peak' | 'transition' | 'unknown';

type AdviceOptions = {
  /** DBの note を優先して表示する（コーチの言葉を最優先） */
  preferNote?: boolean;
  /** note がある場合でも、タグ由来の一言を後ろに足す */
  appendTagHintsWhenNote?: boolean;
  /** note の最大文字数（長すぎるときはカット） */
  maxNoteChars?: number;
  /** タグ由来の一言の最大数（モバイルでは 1 推奨） */
  maxTagHints?: number;
};

const DEFAULT_OPTS: Required<AdviceOptions> = {
  preferNote: true,
  appendTagHintsWhenNote: false,
  maxNoteChars: 80,
  maxTagHints: 1,
};

/**
 * フェーズ（期間）に応じた短いアドバイス文
 * - 「週」など固定期間を匂わせない表現に統一
 */
const BASE: Record<PhaseType, string> = {
  off: '回復フェーズ。睡眠と疲労抜きを最優先に。',
  pre: '土台づくりフェーズ。フォーム・基礎を優先、上げすぎ注意。',
  in: '積み上げフェーズ。強度の波を整え、継続できる負荷で。',
  peak: '仕上げフェーズ。質を最大化しつつ、睡眠とコンディションを最優先に。',
  transition: '切り替えフェーズ。疲労管理と次の準備を丁寧に。',
  unknown: 'フェーズ未設定。今の狙いを確認して、無理のない計画で進めよう。',
};

/**
 * タグ -> ひと言補完（共通）
 * - ここを増やすほど note が無い時に文章が育つ
 * - maxTagHints=1 で “うるささ” を抑えるのがおすすめ
 */
const TAG_HINTS: Array<{ match: (t: string) => boolean; text: string }> = [
  // 基礎・フォーム
  { match: (t) => /フォーム|姿勢|基礎|基本|動作|テクニック|技術/i.test(t), text: '「速さ」より「形」。直す点は1つに絞ろう。' },
  { match: (t) => /可動域|モビリティ|柔軟|ストレッチ|関節/i.test(t), text: '可動域は“毎日少し”。痛みゼロで積む。' },
  { match: (t) => /体幹|コア|腹圧|スタビリティ|安定/i.test(t), text: '体幹は“固める”より“支える”。呼吸もセットで。' },
  { match: (t) => /呼吸|ブレス|横隔膜/i.test(t), text: '呼吸を整えると動きも整う。最初の1分でリセット。' },

  // 筋力・パワー
  { match: (t) => /筋力|筋肥大|ウエイト|ウェイト|strength|S&C/i.test(t), text: '量より質。フォームと可動域が崩れたら止める。' },
  { match: (t) => /パワー|爆発|瞬発|パワー系|power/i.test(t), text: '出力は“短く濃く”。回復まで含めて1セット。' },
  { match: (t) => /プライオ|プライオメトリクス|plyo|ジャンプ/i.test(t), text: '跳ぶ前に着地。静かな着地ができたら強度UP。' },

  // スピード・スプリント
  { match: (t) => /スプリント|スピード|speed|加速|トップスピード/i.test(t), text: '出力日は回復とセット。次の日に疲労を残さない。' },
  { match: (t) => /減速|ブレーキ|停止|decel/i.test(t), text: '減速はケガ予防の要。小さく止まれる強さを。' },
  { match: (t) => /切り返し|方向転換|アジリティ|agility|ターン/i.test(t), text: '曲がる前に減速。姿勢が高いなら一段下げる。' },
  { match: (t) => /反応|リアクション|判断|reaction/i.test(t), text: '反応は“先に見る”。視線と準備姿勢をそろえる。' },
  { match: (t) => /リズム|テンポ|ピッチ/i.test(t), text: 'リズムが崩れたら一度止める。整えてから再開。' },

  // 持久・コンディショニング
  { match: (t) => /持久|スタミナ|aerobic|endurance|有酸素/i.test(t), text: '疲労の溜めすぎに注意。翌日に走れる強度で。' },
  { match: (t) => /無酸素|インターバル|乳酸|anaerobic/i.test(t), text: '追い込みすぎ注意。質の落ち始めが“終了サイン”。' },
  { match: (t) => /回復|リカバリー|疲労抜き|休養|レスト/i.test(t), text: '回復はトレーニング。睡眠・栄養・水分を先に整える。' },

  // 体の部位・ケア
  { match: (t) => /股関節|ヒップ|骨盤/i.test(t), text: '股関節が動くと全身が軽い。詰まり感は要調整。' },
  { match: (t) => /足首|アンクル|ふくらはぎ|アキレス/i.test(t), text: '足首が硬い日は無理に上げない。接地の質を優先。' },
  { match: (t) => /膝|ニー|膝痛/i.test(t), text: '膝は結果。股関節と足部の位置を先に整える。' },
  { match: (t) => /ハム|ハムストリング|肉離れ/i.test(t), text: 'ハムは“張り始め”で止める。早めのケアが勝ち。' },
  { match: (t) => /肩|肩甲骨|スキャプラ|胸郭|T-spine|胸椎/i.test(t), text: '肩は胸郭から。上げる前に回す・広げる。' },

  // 計測・質の担保
  { match: (t) => /RPE|主観|きつさ/i.test(t), text: '主観は正解。いつもより重いなら負荷を下げる判断も◎。' },
  { match: (t) => /FTT|ニューロ|反応テスト/i.test(t), text: '反応が鈍い日は“量より質”。神経の回復を優先。' },
  { match: (t) => /睡眠|寝不足|眠い/i.test(t), text: '寝不足の日は上げすぎ注意。精度と回復を最優先。' },
  { match: (t) => /栄養|補食|タンパク|炭水化物|水分/i.test(t), text: '迷ったら「主食＋たんぱく質」。まず回復の土台から。' },

  // メンタル・戦略
  { match: (t) => /集中|メンタル|気持ち|モチベ/i.test(t), text: '集中が切れる前に区切る。短くても高品質が勝ち。' },
  { match: (t) => /試合|ゲーム|大会|本番/i.test(t), text: '本番は“仕上がり”が全て。疲労を残さない調整へ。' },
  { match: (t) => /調整|テーパリング|軽め/i.test(t), text: '軽くてもOK。キレを出す動きだけ残す。' },

  // 仕上げ：汎用タグ
  { match: (t) => /確認|復習|見直し/i.test(t), text: '“できた/できない”より“気づけたか”。それが成長。' },
  { match: (t) => /積み上げ|継続|習慣/i.test(t), text: '続ける設計が最強。明日もできる余白を残そう。' },
];

const normalizeOneLine = (s: string) => {
  return s
    .replace(/\s+/g, ' ')
    .replace(/　+/g, ' ')
    .trim();
};

const clampText = (s: string, max: number) => {
  const t = normalizeOneLine(s);
  if (t.length <= max) return t;
  return t.slice(0, Math.max(0, max - 1)) + '…';
};

const buildTagHint = (focusTags?: string[] | null, maxHints: number = 1) => {
  const tags = Array.isArray(focusTags) ? focusTags : [];
  const extra: string[] = [];

  for (const tag of tags) {
    const hit = TAG_HINTS.find((r) => r.match(tag));
    if (hit && !extra.includes(hit.text)) extra.push(hit.text);
    if (extra.length >= Math.max(0, maxHints)) break;
  }

  return extra.length ? extra.join(' ') : '';
};

/**
 * note を優先して返すアドバイス生成
 *
 * 仕様：
 * - preferNote=true かつ note が空でなければ「note（整形&短縮）」を基本表示
 * - appendTagHintsWhenNote=true のときのみ、note の後ろにタグの一言を足す
 * - note が無ければ BASE（+タグ一言）で返す
 */
export function getPhaseAdvice(
  phaseType: PhaseType,
  focusTags?: string[] | null,
  note?: string | null,
  options?: AdviceOptions
): string {
  const opts = { ...DEFAULT_OPTS, ...(options ?? {}) };

  const base = BASE[phaseType] ?? BASE.unknown;
  const tagHint = buildTagHint(focusTags, opts.maxTagHints);

  const hasNote = typeof note === 'string' && note.trim().length > 0;

  // ✅ note 優先
  if (opts.preferNote && hasNote) {
    const clipped = clampText(note as string, opts.maxNoteChars);
    if (opts.appendTagHintsWhenNote && tagHint) {
      return `${clipped} ${tagHint}`;
    }
    return clipped;
  }

  // ✅ note がない時は BASE（+タグ）
  if (tagHint) return `${base} ${tagHint}`;
  return base;
}

export default getPhaseAdvice;