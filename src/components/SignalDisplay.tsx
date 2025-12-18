import React, { useMemo } from 'react';

type Props = {
  value: number | null | undefined; // 0..100
  label?: string;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function SignalDisplay({
  value,
  label = 'コーチ意図の理解（電波）',
}: Props) {
  const v = value == null ? null : clamp(Math.round(value), 0, 100);

  const level = useMemo(() => {
    if (v == null) return null;
    if (v === 0) return 0;
    if (v <= 20) return 1;
    if (v <= 40) return 2;
    if (v <= 60) return 3;
    if (v <= 80) return 4;
    return 5;
  }, [v]);

  const bars = useMemo(() => {
    const baseHeights = [18, 30, 44, 60, 78];
    const vv = v ?? 0;
    const scale = 1 + (vv / 100) * 0.18;
    const cont = (vv / 100) * 5;

    return baseHeights.map((h, i) => {
      const lit = clamp(cont - i, 0, 1);
      return {
        height: Math.round(h * scale),
        lit,
      };
    });
  }, [v]);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{label}</div>
        <div className="text-right">
          <div className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
            {v == null ? '—' : v}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-300">
            {level == null ? '' : `レベル ${level}/5`}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-3">
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
                  }}
                />
                <div className="text-[10px] text-gray-500 dark:text-gray-300">{i + 1}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}