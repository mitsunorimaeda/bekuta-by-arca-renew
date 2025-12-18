import React, { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  value: number; // 0..100
  onChange: (v: number) => void;
  label?: string;
  hint?: string;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function VectorArrowPicker({
  value,
  onChange,
  label = '成長実感（ベクトル）',
  hint = '矢尻をドラッグして強さを決める（0〜100）',
}: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const v = clamp(Math.round(value), 0, 100);

  // 表現：長さ＋太さ（0..100）
  const geom = useMemo(() => {
    const minLen = 18;   // 最短
    const maxLen = 220;  // 最長
    const minW = 2.5;    // 最細
    const maxW = 14;     // 最太

    const len = minLen + (maxLen - minLen) * (v / 100);
    const stroke = minW + (maxW - minW) * (v / 100);

    // SVG上の座標（左→右）
    const x0 = 24;
    const y = 70;
    const x1 = x0 + len;

    // 矢尻サイズ（太さに連動）
    const head = 10 + stroke * 1.2;

    return { x0, y, x1, len, stroke, head };
  }, [v]);

  const setFromPointer = (clientX: number) => {
    const el = boxRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();

    // スライド範囲（左右パディング分を除く）
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
    // iOS/Androidのスクロール干渉を減らす
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
        <div className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{v}</div>
      </div>

      <div
        ref={boxRef}
        className={`mt-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-3 select-none ${
          isDragging ? 'ring-2 ring-blue-500' : ''
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        style={{
          touchAction: 'none', // ドラッグ優先
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <svg viewBox="0 0 300 140" className="w-full h-20">
          {/* ガイドライン */}
          <line x1="24" y1="70" x2="276" y2="70" stroke="currentColor" opacity="0.12" strokeWidth="2" />

          {/* 矢印本体（長さ＋太さ） */}
          <line
            x1={geom.x0}
            y1={geom.y}
            x2={geom.x1}
            y2={geom.y}
            stroke="currentColor"
            className="text-blue-600 dark:text-blue-400"
            strokeWidth={geom.stroke}
            strokeLinecap="round"
          />

          {/* 矢尻 */}
          <polygon
            points={`
              ${geom.x1},${geom.y}
              ${geom.x1 - geom.head},${geom.y - geom.head * 0.6}
              ${geom.x1 - geom.head},${geom.y + geom.head * 0.6}
            `}
            fill="currentColor"
            className="text-blue-600 dark:text-blue-400"
          />

          {/* つまみ（矢尻を“引っ張れる”感） */}
          <circle
            cx={geom.x1}
            cy={geom.y}
            r={10}
            fill="white"
            className="dark:fill-gray-800"
            stroke="currentColor"
            strokeWidth="2"
            opacity="0.95"
          />
          <circle
            cx={geom.x1}
            cy={geom.y}
            r={4}
            fill="currentColor"
            className="text-blue-600 dark:text-blue-400"
            opacity="0.9"
          />
        </svg>

        <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-300">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>

        {/* 微調整ボタン（ドラッグが苦手な子向け） */}
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
            0（無し）
          </button>
        </div>
      </div>
    </div>
  );
}