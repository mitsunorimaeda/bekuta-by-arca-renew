const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const MODEL =
  Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash-preview-09-2025";

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export async function geminiGenerateJson(parts: GeminiPart[]) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini error: ${res.status} ${t}`);
  }

  const data = await res.json();

  // responseMimeType が効けば、parts[0].text が JSON文字列として返ることが多い
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ??
    "";

  const cleaned = String(text)
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // デバッグしやすいように raw を返す（本番ならログだけでもOK）
    throw new Error(
      `Failed to parse Gemini JSON. cleaned="${cleaned.slice(0, 300)}..." raw=${JSON.stringify(data).slice(0, 300)}...`
    );
  }
}