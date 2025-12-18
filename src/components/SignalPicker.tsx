import React, { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  value: number; // 0..100（保存用）
  onChange: (v: number) => void;
  label?: string;
  hint?: string;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function SignalPicker({
  value,
  onChange,
  label = '理解度',
  hint = 'バーをドラッグして直感で選ぶ',
}: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const v = clamp(Math.round(value), 0, 100);

  const level = useMemo(() => {
    if (v === 0) return 0;
    if (v <= 20) return 1;
    if (v <= 40) return 2;
    if (v <= 60) return 3;
    if (v <= 80) return 4;
    return 5;
  }, [v]);

  const levelLabel = useMemo(() => {
    switch (level) {
      case 0: return '分からん';
      case 1: return 'うっすら';
      case 2: return '少し';
      case 3: return 'だいたい';
      case 4: return 'かなり';
      case 5: return '腹落ち';
      default: return '';
    }
  }, [level]);

  const bars = useMemo(() => {
    const baseHeights = [18, 30, 44, 60, 78];
    const scale = 1 + (v / 100) * 0.18;
    const cont = (v / 100) * 5;

    return baseHeights.map((h, i) => {
      const lit = clamp(cont - i, 0, 1);
      return {
        height: Math.round(h * scale),
        lit,
      };
    });
  }, [v]);

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
      {/* ✅ ラベル + ヒント + 右側に段階 */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900 dark:text-white">
            {label}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-300 mt-1">
            {hint}
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm font-semibold text-gray-900 dark:text-white">
            {levelLabel}
          </div>
        </div>
      </div>

      <div
        ref={boxRef}
        className={`mt-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-3 select-none ${
          isDragging ? 'ring-2 ring-blue-500' : ''
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        style={{ touchAction: 'none', WebkitTapHighlightColor: 'transparent' }}
      >
        <div className="flex items-end justify-center gap-3 h-24">
          {bars.map((b, i) => {
            const opacity = 0.25 + b.lit * 0.75;
            const width = 10 + b.lit * 8;
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
              </div>
            );
          })}
        </div>

       
      </div>
    </div>
  );
}