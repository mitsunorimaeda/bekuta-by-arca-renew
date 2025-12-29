import React, { useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type MealType = "朝食" | "昼食" | "夕食" | "補食";

function formatTokyoDate(d = new Date()) {
  const parts = d
    .toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })
    .split("/");
  return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      resolve(res.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function NutritionPage() {
  const [mealType, setMealType] = useState<MealType>("補食");
  const [mealSlot, setMealSlot] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [msg, setMsg] = useState("");

  const recordDate = formatTokyoDate();
  const bucket = "nutrition-images";

  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : ""),
    [file]
  );

  const handleUploadAndAnalyze = async () => {
    if (!file) return setMsg("写真を選んでください");

    setUploading(true);
    setMsg("");
    setResult(null);

    try {
      /** 1️⃣ auth */
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      if (!userId) throw new Error("ログインが必要です");

      /** 2️⃣ storage upload */
      const ext = file.name.split(".").pop() || "jpg";
      const path = `nutrition/${userId}/${recordDate}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, { contentType: file.type });

      if (upErr) throw upErr;

      const { data: pub } = supabase.storage
        .from(bucket)
        .getPublicUrl(path);

      /** 3️⃣ DB insert（空で） */
      const { data: log, error: insErr } = await supabase
        .from("nutrition_logs")
        .insert({
          user_id: userId,
          record_date: recordDate,
          meal_type: mealType,
          meal_slot: mealType === "補食" ? mealSlot : 1,
          image_path: path,
          image_url: pub.publicUrl,
        })
        .select()
        .single();

      if (insErr) throw insErr;

      /** 4️⃣ AI analyze */
      const base64 = await fileToBase64(file);
      const { data: session } = await supabase.auth.getSession();

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nutrition-analyze`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.session?.access_token}`,
          },
          body: JSON.stringify({
            meal_type: mealType,
            image_base64: base64,
            mime_type: file.type,
            user_name: "athlete",
          }),
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      /** 5️⃣ DB update */
      await supabase
        .from("nutrition_logs")
        .update({
          total_calories: json.result.total_calories,
          p: json.result.nutrients.p,
          f: json.result.nutrients.f,
          c: json.result.nutrients.c,
          menu_items: json.result.menu_items,
          advice_markdown: json.result.advice_markdown,
        })
        .eq("id", log.id);

      setResult(json.result);
      setMsg("この食事を見てもらいました");
      setFile(null);
    } catch (e: any) {
      console.error(e);
      setMsg(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <div className="text-lg font-semibold">
        今日の食事を、写真1枚で振り返ってみよう
      </div>
      <div className="text-sm text-gray-500">
        ※ 正解・不正解はありません
      </div>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />

      {previewUrl && (
        <img src={previewUrl} className="rounded-lg max-h-60" />
      )}

      <select
        className="w-full border rounded px-3 py-2"
        value={mealType}
        onChange={(e) => setMealType(e.target.value as MealType)}
      >
        <option value="朝食">朝食</option>
        <option value="昼食">昼食</option>
        <option value="夕食">夕食</option>
        <option value="補食">補食</option>
      </select>

      {mealType === "補食" && (
        <select
          className="w-full border rounded px-3 py-2"
          value={mealSlot}
          onChange={(e) => setMealSlot(Number(e.target.value))}
        >
          <option value={1}>補食①</option>
          <option value={2}>補食②</option>
        </select>
      )}

      <button
        onClick={handleUploadAndAnalyze}
        disabled={uploading || !file}
        className="w-full bg-indigo-600 text-white rounded py-2"
      >
        {uploading ? "見てもらっています…" : "この食事を見てもらう"}
      </button>

      {msg && <div className="text-sm">{msg}</div>}

      {result && (
        <div className="border rounded-lg p-3 space-y-2">
          <div className="text-lg font-bold">
            約 {result.total_calories} kcal（推定）
          </div>

          <div className="text-sm whitespace-pre-line">
            {result.advice_markdown}
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer">くわしく見る</summary>
            <div className="mt-2">
              P:{result.nutrients.p} / F:{result.nutrients.f} / C:{result.nutrients.c}
            </div>
          </details>

          <div className="text-xs text-gray-500 mt-2">
            ※ 写真からの推定です
          </div>
        </div>
      )}
    </div>
  );
}