import React, { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  value: number; // 0..100（保存用）
  onChange: (v: number) => void;
  label?: string;
  hint?: string;
};

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

export function VectorArrowPicker({
  value,
  onChange,
  label = '成長実感',
  hint = '矢尻をドラッグして直感で選ぶ',
}: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const v = clamp(Math.round(value), 0, 100);

  // 数値は内部だけ、表示は段階
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
      case 0: return 'なし';
      case 1: return 'ちょい';
      case 2: return '少し';
      case 3: return 'そこそこ';
      case 4: return 'かなり';
      case 5: return 'めちゃ';
      default: return '';
    }
  }, [level]);

  const geom = useMemo(() => {
    const minLen = 18;
    const maxLen = 220;
    const minW = 2.5;
    const maxW = 14;

    const len = minLen + (maxLen - minLen) * (v / 100);
    const stroke = minW + (maxW - minW) * (v / 100);

    const x0 = 24;
    const y = 70;
    const x1 = x0 + len;
    const head = 10 + stroke * 1.2;

    return { x0, y, x1, stroke, head };
  }, [v]);

  const setFromPointer = (clientX: number) => {
    const el = boxRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const leftPad = 24;
    const rightPad = 24;

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
      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs text-gray-500 dark:text-gray-300 mt-1">
          {hint}
        </div>
        <div className="text-sm font-semibold text-gray-900 dark:text-white">
          {levelLabel}
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
      <svg viewBox="0 0 300 140" className="w-full h-20">
        <line x1="24" y1="70" x2="276" y2="70" stroke="currentColor" opacity="0.10" strokeWidth="2" />

        {/* 先端位置（矢先） */}
        {(() => {
          const xTip = geom.x1;
          const y = geom.y;

          // 矢尻サイズ（太さに応じて拡大）
          const headLen = Math.max(14, geom.stroke * 2.2);
          const headHalfH = Math.max(10, geom.stroke * 1.2);

          // 棒の終点は矢尻の付け根へ
          const xShaftEnd = xTip - headLen;

          return (
            <>
              {/* シャフト（棒） */}
              <line
                x1={geom.x0}
                y1={y}
                x2={xShaftEnd}
                y2={y}
                stroke="currentColor"
                className="text-blue-600 dark:text-blue-400"
                strokeWidth={geom.stroke}
                strokeLinecap="butt"          // ✅ 丸みを消す
              />

              {/* 矢尻（先端） */}
              <polygon
                points={`
                  ${xTip},${y}
                  ${xShaftEnd},${y - headHalfH}
                  ${xShaftEnd},${y + headHalfH}
                `}
                fill="currentColor"
                className="text-blue-600 dark:text-blue-400"
              />

              {/* ✅ 透明ヒットエリア（見えないが掴める） */}
              <circle
                cx={xTip}
                cy={y}
                r={18}
                fill="transparent"
                pointerEvents="all"
              />
            </>
          );
        })()}
      </svg>
      </div>
    </div>
  );
}