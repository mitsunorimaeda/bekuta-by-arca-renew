// src/components/NutritionPhotoUploader.tsx
import React, { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

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
      resolve(res.split(",")[1]); // base64のみ
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function NutritionPhotoUploader() {
  const [mealType, setMealType] = useState<MealType>("朝食");
  const [mealSlot, setMealSlot] = useState(1);
  const [recordDate, setRecordDate] = useState(formatTokyoDate());
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");

  const bucket = "nutrition-images";

  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : ""),
    [file]
  );

  const handleUploadAndAnalyze = async () => {
    if (!file) return setMsg("画像を選択してください");

    setUploading(true);
    setMsg("");

    try {
      /** 1️⃣ user */
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      if (!userId) throw new Error("未ログイン");

      /** 2️⃣ Storage upload */
      const ext = file.name.split(".").pop() || "jpg";
      const uuid = crypto.randomUUID();
      const path = `nutrition/${userId}/${recordDate}/${uuid}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, { contentType: file.type });

      if (uploadErr) throw uploadErr;

      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);

      /** 3️⃣ nutrition_logs INSERT（まず空で） */
      const { data: log, error: insErr } = await supabase
        .from("nutrition_logs")
        .insert({
          user_id: userId,
          record_date: recordDate,
          meal_type: mealType,
          meal_slot: mealSlot,
          image_path: path,
          image_url: pub.publicUrl,
        })
        .select()
        .single();

      if (insErr) throw insErr;

      /** 4️⃣ base64化 → nutrition-analyze */
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
            user_name: "user",
          }),
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      /** 5️⃣ AI結果で UPDATE */
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

      setMsg("✅ アップロード＆AI解析 完了！");
      setFile(null);
    } catch (e: any) {
      console.error(e);
      setMsg(`❌ ${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white border rounded-xl p-4 space-y-4">
      <div className="text-lg font-semibold">📸 食事写真アップロード</div>
  
      {/* 日付 */}
      <div>
        <div className="text-xs text-gray-500 mb-1">日付</div>
        <input
          className="w-full border rounded-lg px-3 py-2 text-sm"
          value={recordDate}
          onChange={(e) => setRecordDate(e.target.value)}
        />
      </div>
  
      {/* 食事タイプ */}
      <div>
        <div className="text-xs text-gray-500 mb-1">食事タイプ</div>
        <select
          className="w-full border rounded-lg px-3 py-2 text-sm"
          value={mealType}
          onChange={(e) => {
            const v = e.target.value as MealType;
            setMealType(v);
            // 朝昼夕は slot=1 固定
            if (v !== "補食") setMealSlot(1);
          }}
        >
          <option value="朝食">朝食</option>
          <option value="昼食">昼食</option>
          <option value="夕食">夕食</option>
          <option value="補食">補食</option>
        </select>
      </div>
  
      {/* スロット（補食のみ有効） */}
      <div>
        <div className="text-xs text-gray-500 mb-1">スロット</div>
        <select
          className="w-full border rounded-lg px-3 py-2 text-sm"
          value={mealSlot}
          disabled={mealType !== "補食"}
          onChange={(e) => setMealSlot(Number(e.target.value))}
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
        </select>
        <div className="text-[11px] text-gray-500 mt-1">
          ※ 補食のみ 1 / 2、朝昼夕は 1 固定
        </div>
      </div>
  
      {/* ファイル */}
      <div className="space-y-2">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {previewUrl && (
          <img src={previewUrl} className="max-h-60 rounded border" />
        )}
      </div>
  
      {/* 実行 */}
      <button
        onClick={handleUploadAndAnalyze}
        disabled={uploading || !file}
        className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
      >
        {uploading ? "解析中..." : "アップロード＆解析"}
      </button>
  
      {msg && <div className="text-sm">{msg}</div>}
    </div>
  );
}