// src/components/NutritionEditModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { X, Save, Trash2, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";

type MealType = "朝食" | "昼食" | "夕食" | "補食";

function toNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function formatMealLabel(mealType: string, mealSlot: any) {
  if (mealType === "補食") return `補食${Number(mealSlot ?? 1)}`;
  return mealType;
}

export type NutritionLog = {
  id: string;
  user_id: string;
  record_date: string; // yyyy-mm-dd
  meal_type: MealType | string;
  meal_slot: number;

  total_calories: number;
  p: number;
  f: number;
  c: number;

  menu_items: any[]; // jsonb
  advice_markdown: string | null;

  image_url?: string | null;
  image_path?: string | null;

  analysis_status?: string | null;
  analysis_error?: string | null;

  is_edited?: boolean;
  edit_meta?: any;

  created_at?: string;
  updated_at?: string;
};

type Props = {
  open: boolean;
  log: NutritionLog | null;

  onClose: () => void;

  // 成功したら NutritionCard 側の local state を更新するために返す
  onSaved: (updated: NutritionLog) => void;

  onDeleted: (deletedId: string) => void;
};

export default function NutritionEditModal({ open, log, onClose, onSaved, onDeleted }: Props) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [cal, setCal] = useState<string>("0");
  const [p, setP] = useState<string>("0");
  const [f, setF] = useState<string>("0");
  const [c, setC] = useState<string>("0");
  const [menuText, setMenuText] = useState<string>("");
  const [advice, setAdvice] = useState<string>("");

  const title = useMemo(() => {
    if (!log) return "";
    return `${formatMealLabel(String(log.meal_type), log.meal_slot)} の編集`;
  }, [log]);

  useEffect(() => {
    if (!open || !log) return;

    setErr(null);
    setCal(String(toNum(log.total_calories, 0)));
    setP(String(toNum(log.p, 0)));
    setF(String(toNum(log.f, 0)));
    setC(String(toNum(log.c, 0)));

    const items = Array.isArray(log.menu_items) ? log.menu_items : [];
    const names = items
      .map((x: any) => (typeof x === "string" ? x : x?.name ?? x?.label ?? ""))
      .filter(Boolean);
    setMenuText(names.join("\n"));

    setAdvice(String(log.advice_markdown ?? ""));
  }, [open, log]);

  if (!open || !log) return null;

  const handleSave = async () => {
    setSaving(true);
    setErr(null);

    try {
      const updatedPayload = {
        total_calories: Math.max(0, Math.round(toNum(cal, 0))),
        p: Math.max(0, Number(toNum(p, 0).toFixed(1))),
        f: Math.max(0, Number(toNum(f, 0).toFixed(1))),
        c: Math.max(0, Number(toNum(c, 0).toFixed(1))),
        menu_items: (menuText || "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        advice_markdown: advice?.trim() ? advice.trim() : null,

        is_edited: true,
        edit_meta: {
          updated_at: new Date().toISOString(),
          source: "nutrition_edit_modal",
        },
      };

      const { data, error } = await supabase
        .from("nutrition_logs")
        .update(updatedPayload)
        .eq("id", log.id)
        .select("*")
        .single();

      if (error) throw error;

      onSaved(data as NutritionLog);
      onClose();
    } catch (e: any) {
      console.error("[NutritionEditModal] save error:", e);
      setErr(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = window.confirm("この栄養記録を削除します。よろしいですか？");
    if (!ok) return;

    setDeleting(true);
    setErr(null);

    try {
      const { error } = await supabase.from("nutrition_logs").delete().eq("id", log.id);
      if (error) throw error;

      onDeleted(log.id);
      onClose();
    } catch (e: any) {
      console.error("[NutritionEditModal] delete error:", e);
      setErr(String(e?.message ?? e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* modal */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{title}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {log.record_date} / status: {log.analysis_status ?? "-"}
              {log.is_edited ? "（編集済）" : ""}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="close"
            disabled={saving || deleting}
          >
            <X className="w-5 h-5 text-gray-700 dark:text-gray-200" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {err && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-700 dark:text-red-300">{err}</p>
            </div>
          )}

          {log.image_url && (
            <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={log.image_url} alt="meal" className="w-full max-h-[320px] object-cover" />
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="space-y-1">
              <p className="text-xs text-gray-600 dark:text-gray-400">kcal</p>
              <input
                value={cal}
                onChange={(e) => setCal(e.target.value)}
                inputMode="numeric"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                disabled={saving || deleting}
              />
            </label>

            <label className="space-y-1">
              <p className="text-xs text-gray-600 dark:text-gray-400">P (g)</p>
              <input
                value={p}
                onChange={(e) => setP(e.target.value)}
                inputMode="decimal"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                disabled={saving || deleting}
              />
            </label>

            <label className="space-y-1">
              <p className="text-xs text-gray-600 dark:text-gray-400">F (g)</p>
              <input
                value={f}
                onChange={(e) => setF(e.target.value)}
                inputMode="decimal"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                disabled={saving || deleting}
              />
            </label>

            <label className="space-y-1">
              <p className="text-xs text-gray-600 dark:text-gray-400">C (g)</p>
              <input
                value={c}
                onChange={(e) => setC(e.target.value)}
                inputMode="decimal"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                disabled={saving || deleting}
              />
            </label>
          </div>

          <label className="space-y-1 block">
            <p className="text-xs text-gray-600 dark:text-gray-400">推定メニュー（1行=1品）</p>
            <textarea
              value={menuText}
              onChange={(e) => setMenuText(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
              disabled={saving || deleting}
            />
          </label>

          <label className="space-y-1 block">
            <p className="text-xs text-gray-600 dark:text-gray-400">メモ / AIコメント（編集OK）</p>
            <textarea
              value={advice}
              onChange={(e) => setAdvice(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
              disabled={saving || deleting}
            />
          </label>

          {log.analysis_status === "failed" && log.analysis_error && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-xs text-amber-800 dark:text-amber-200 whitespace-pre-wrap">
                解析失敗: {String(log.analysis_error)}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-800">
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving || deleting}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            削除
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || deleting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}