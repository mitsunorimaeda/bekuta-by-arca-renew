const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const MODEL = Deno.env.get("GEMINI_MODEL") ??
  "gemini-2.5-flash-preview-09-2025";

type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

export async function geminiGenerateJson(parts: GeminiPart[]) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        response_mime_type: "application/json",
        temperature: 0.2,
      },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini error: ${res.status} ${t}`);
  }

  const data = await res.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ??
    "";

  // 余計な ```json ``` を剥がしてJSON化
  const cleaned = String(text).replace(/```json/g, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned);
}