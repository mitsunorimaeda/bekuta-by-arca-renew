// src/pages/MaintenancePage.tsx
import React, { useMemo } from "react";
import { Sparkles, ShieldAlert, RefreshCcw, ExternalLink } from "lucide-react";

type Props = {
  title?: string;
  message?: string;
  etaText?: string; // 目安があるなら
  showRetry?: boolean;
};

function getJSTNowLabel() {
  const now = new Date();
  // 端末ローカルがJST想定だけど、表示だけならこれで十分
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
    now.getHours()
  )}:${pad(now.getMinutes())}`;
}

export default function MaintenancePage({
  title = "メンテナンス中",
  message = "現在、システムの安定化対応を行っています。ご不便をおかけしますが、しばらくしてから再度お試しください。",
  etaText = "",
  showRetry = true,
}: Props) {
  const nowLabel = useMemo(() => getJSTNowLabel(), []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 text-slate-900">
      {/* subtle background blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-blue-200/35 blur-3xl" />
        <div className="absolute -bottom-28 -left-28 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute top-1/3 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-200/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-2xl px-5 py-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-slate-700" />
            </div>
            <div>
              <div className="text-xl font-extrabold tracking-tight">
                Bekuta
                <span className="ml-2 text-xs font-semibold text-slate-500 align-middle">
                  maintenance
                </span>
              </div>
              <div className="text-sm text-slate-500">strength for the future</div>
            </div>
          </div>

          <div className="text-xs text-slate-400">
            JST {nowLabel}
          </div>
        </div>

        {/* Card */}
        <div className="mt-8 rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <ShieldAlert className="h-4 w-4 text-rose-500" />
              {title}
            </div>
            <div className="text-xs text-slate-400">System Status</div>
          </div>

          <div className="px-6 py-6">
            <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-5">
              <p className="text-slate-700 leading-relaxed">
                {message}
              </p>

              {etaText ? (
                <div className="mt-3 text-sm text-slate-600">
                  <span className="font-semibold">目安：</span>{etaText}
                </div>
              ) : null}

              <div className="mt-4 text-xs text-slate-500 leading-relaxed">
                ※ ログイン処理の停止・DB負荷の軽減のため、メンテナンス画面を表示しています。
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 flex flex-col sm:flex-row gap-3">
              {showRetry && (
                <button
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 text-white px-5 py-3 font-extrabold tracking-wide shadow-sm hover:bg-slate-800 active:scale-[0.99] transition"
                >
                  <RefreshCcw className="h-4 w-4" />
                  再読み込み
                </button>
              )}

              <a
                href="https://bekuta.netlify.app/"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white ring-1 ring-slate-200 px-5 py-3 font-bold text-slate-700 hover:bg-slate-50 active:scale-[0.99] transition"
              >
                <ExternalLink className="h-4 w-4" />
                トップへ
              </a>
            </div>

            {/* Footer note */}
            <div className="mt-6 text-center text-xs text-slate-400">
              “Small steps, big futures.” — Bekuta
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-8 text-center text-xs text-slate-400">
          お急ぎの場合は、スタッフへご連絡ください。
        </div>
      </div>
    </div>
  );
}