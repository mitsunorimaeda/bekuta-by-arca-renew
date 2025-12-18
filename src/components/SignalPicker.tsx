import React, { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  value: number; // 0..100
  onChange: (v: number) => void;
  label?: string;
  hint?: string;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function SignalPicker({
  value,
  onChange,
  label = 'コーチ意図の理解（電波）',
  hint = 'バーをドラッグして強さを決める（0〜100）',
}: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const v = clamp(Math.round(value), 0, 100);

  // 0..100 → 1..5段階（UI表示）
  const level = useMemo(() => {
    if (v === 0) return 0;
    if (v <= 20) return 1;
    if (v <= 40) return 2;
    if (v <= 60) return 3;
    if (v <= 80) return 4;
    return 5;
  }, [v]);

  // バーの“なめらかさ”（段階＋連続値）
  const bars = useMemo(() => {
    // 5本の基準高さ
    const baseHeights = [18, 30, 44, 60, 78];
    // 強さで全体が少し伸びる（最大+18%）
    const scale = 1 + (v / 100) * 0.18;

    // 「今どこまで光ってるか」を連続で扱う
    // 0..5 の浮動（例: 2.6本目まで）
    const cont = (v / 100) * 5;

    return baseHeights.map((h, i) => {
      const idx = i + 1; // 1..5
      // そのバーがどれだけ“点灯”しているか 0..1
      // cont=2.6なら、1,2は1.0、3は0.6、4,5は0
      const lit = clamp(cont - i, 0, 1);
      return {
        height: Math.round(h * scale),
        lit, // 0..1
        active: idx <= level, // 段階表示
      };
    });
  }, [v, level]);

  const setFromPointer = (clientX: number) => {
    const el = boxRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const leftPad = 16;
    const rightPad = 16;

    const x = clamp(clientX - rect.left, leftPad, rect.width - rightPad);
    const usable = rect.width - leftPad - rightPad;

    const next = Math.round(((x - leftPad) / usable) * 100);
    onChange(clamp(next, 0, 100));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    setIsDragging(true);
    (e.currentTarget as any).setPointerCapture?.(e.pointerId);
    setFromPointer(e.clientX);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    setFromPointer(e.clientX);
  };

  const stop = () => {
    draggingRef.current = false;
    setIsDragging(false);
  };

  useEffect(() => {
    const onUp = () => stop();
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{label}</div>
          <div className="text-xs text-gray-500 dark:text-gray-300 mt-1">{hint}</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{v}</div>
          <div className="text-xs text-gray-500 dark:text-gray-300">レベル {level}/5</div>
        </div>
      </div>

      <div
        ref={boxRef}
        className={`mt-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-3 select-none ${
          isDragging ? 'ring-2 ring-blue-500' : ''
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        style={{
          touchAction: 'none',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <div className="flex items-end justify-center gap-3 h-24">
          {bars.map((b, i) => {
            // lit=0..1 を “明るさ” に反映（薄→濃）
            // ※tailwindで段階的にやるため、opacityで表現
            const opacity = 0.25 + b.lit * 0.75; // 0.25..1.0
            const width = 10 + b.lit * 8; // 点灯ほど太い（10..18）
            return (
              <div key={i} className="flex flex-col items-center gap-2">
                <div
                  className="rounded-full bg-blue-600 dark:bg-blue-400"
                  style={{
                    height: b.height,
                    width,
                    opacity,
                    transition: 'height 120ms ease, width 120ms ease, opacity 120ms ease',
                  }}
                />
                <div className="text-[10px] text-gray-500 dark:text-gray-300">{i + 1}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-300">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => onChange(clamp(v - 5, 0, 100))}
            className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-white"
          >
            -5
          </button>
          <button
            type="button"
            onClick={() => onChange(clamp(v + 5, 0, 100))}
            className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-white"
          >
            +5
          </button>
          <button
            type="button"
            onClick={() => onChange(0)}
            className="ml-auto px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-white"
          >
            0（分からん）
          </button>
        </div>
      </div>

      <div className="mt-3 text-xs text-gray-500 dark:text-gray-300">
        目安：0=理解できてない / 50=だいたい分かる / 100=めちゃくちゃ腹落ち
      </div>
    </div>
  );
}