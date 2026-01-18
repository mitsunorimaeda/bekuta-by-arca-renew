// src/lib/phaseAdvice.ts

export type PhaseType = 'off' | 'pre' | 'in' | 'peak' | 'transition' | 'unknown';

type AdviceOptions = {
  /** DBの note を優先して表示する（コーチの言葉を最優先） */
  preferNote?: boolean;
  /** note がある場合でも、タグ由来の一言を後ろに足す */
  appendTagHintsWhenNote?: boolean;
  /** note の最大文字数（長すぎるときはカット） */
  maxNoteChars?: number;
};

const DEFAULT_OPTS: Required<AdviceOptions> = {
  preferNote: true,
  appendTagHintsWhenNote: false,
  maxNoteChars: 80,
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

const TAG_HINTS: Array<{ match: (t: string) => boolean; text: string }> = [
  { match: (t) => /フォーム|姿勢|基礎|基本/.test(t), text: '動きの質を丁寧に。' },
  { match: (t) => /筋力|筋肥大|ウエイト|strength/i.test(t), text: '量より質、フォーム最優先。' },
  { match: (t) => /スプリント|スピード|speed/i.test(t), text: '出力日は回復とセットで。' },
  { match: (t) => /持久|スタミナ|aerobic|endurance/i.test(t), text: '疲労の溜めすぎに注意。' },
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

const buildTagHint = (focusTags?: string[] | null) => {
  const tags = Array.isArray(focusTags) ? focusTags : [];
  const extra: string[] = [];
  for (const tag of tags) {
    const hit = TAG_HINTS.find((r) => r.match(tag));
    if (hit && !extra.includes(hit.text)) extra.push(hit.text);
    if (extra.length >= 2) break;
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
  const tagHint = buildTagHint(focusTags);

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