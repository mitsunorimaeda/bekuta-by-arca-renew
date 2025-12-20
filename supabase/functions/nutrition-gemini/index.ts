import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type NutritionRequest =
  | {
      type: "analyze_meal";
      imageBase64: string;
      context?: string;
    }
  | {
      type: "generate_plan";
      profile: {
        sex?: "male" | "female";
        age?: number;
        height?: number;
        weight?: number;
        bodyFatPercent?: number;
        activityLevel?: string;
        goal?: "gain" | "maintain" | "loss";
      };
    };

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL");

  if (!GEMINI_API_KEY || !GEMINI_MODEL) {
    return new Response("Gemini config missing", { status: 500 });
  }

  const body: NutritionRequest = await req.json();

  let prompt = "";

  // ------------------------
  // 食事画像解析
  // ------------------------
  if (body.type === "analyze_meal") {
    prompt = `
あなたはスポーツ栄養の専門家です。
以下の食事画像を解析し、概算で構いませんので
- 総カロリー
- たんぱく質(P)
- 脂質(F)
- 炭水化物(C)
を推定してください。

出力は必ずJSONで：
{
  "calories": number,
  "protein": number,
  "fat": number,
  "carbs": number,
  "comment": string
}

注意：
- 過度に断定しない
- 不明な点は「推定」と明記
`;
  }

  // ------------------------
  // 栄養プラン生成
  // ------------------------
  if (body.type === "generate_plan") {
    const p = body.profile;

    prompt = `
あなたは成長期アスリートを支援するスポーツ栄養士です。

以下のプロフィールから、
- 推定BMR
- 推定TDEE
- 目標に応じたPFCバランス
- 注意点（1〜2行）
を日本語で提案してください。

プロフィール：
${JSON.stringify(p, null, 2)}

出力形式：
{
  "bmr": number,
  "tdee": number,
  "target": {
    "protein": number,
    "fat": number,
    "carbs": number
  },
  "advice": string
}
`;
  }

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              ...(body.type === "analyze_meal"
                ? [
                    {
                      inlineData: {
                        mimeType: "image/jpeg",
                        data: body.imageBase64,
                      },
                    },
                  ]
                : []),
              { text: prompt },
            ],
          },
        ],
      }),
    }
  );

  const result = await geminiRes.json();

  return new Response(
    JSON.stringify({
      raw: result,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});