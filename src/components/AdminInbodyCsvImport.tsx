import React, { useMemo, useState } from "react";
import { Upload, FileText, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";

type ParsedRow = {
  rowIndex: number;
  phone_number: string;
  measured_at: string; // YYYY-MM-DD
  height: number | null;
  weight: number | null;
  body_fat_percent: number | null;
  raw: Record<string, string>;
};

type RowError = {
  rowIndex: number;
  message: string;
  raw: Record<string, string>;
};

const MAX_ROWS = 2000;
const UPSERT_CHUNK = 200; // UI用（Edgeに投げるなら主に表示/分割用）

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && (c === "," || c === "\t")) {
      row.push(field);
      field = "";
      continue;
    }

    if (!inQuotes && (c === "\n" || c === "\r")) {
      if (c === "\r" && next === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      continue;
    }

    field += c;
  }

  row.push(field);
  rows.push(row);

  while (rows.length && rows[rows.length - 1].every((x) => (x ?? "").trim() === "")) {
    rows.pop();
  }
  return rows;
}

// ✅ ここが今回の肝：番号付きヘッダを吸収
function normalizeHeader(h: string) {
  const s = (h ?? "")
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ");

  // 例: "1. Mobile Number" / "2) Height" / "3 - Test Date / Time"
  const withoutPrefix = s.replace(/^\s*\d+\s*[\.\)\-:]\s*/g, "");

  return withoutPrefix
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9faf %/_-]/g, "");
}

function digitsOnlyPhone(v: string) {
  return (v ?? "").toString().replace(/\D/g, "");
}

function parseNumberOrNull(v: string): number | null {
  const s = (v ?? "").toString().trim();
  if (!s) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

// Test Date / Time → YYYY-MM-DD（プレビュー/簡易バリデーション用）
function parseToISODateOnly(v: string): string | null {
  const s = (v ?? "").toString().trim();
  if (!s) return null;

  const m = s.match(/(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})/);
  if (m) {
    const y = m[1];
    const mm = String(Number(m[2])).padStart(2, "0");
    const dd = String(Number(m[3])).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }

  return null;
}

function buildObjectsFromCSV(table: string[][]) {
  if (!table.length) return { rows: [] as Record<string, string>[], headers: [] as string[] };

  const headers = table[0].map((h) => (h ?? "").trim());
  const rows = table.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]] = (r[i] ?? "").toString();
    }
    return obj;
  });

  return { headers, rows };
}

function findFieldKey(headers: string[], candidates: string[]) {
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  const found = normalized.find((h) => candidates.includes(h.norm));
  return found?.raw ?? null;
}

export default function AdminInbodyCsvImport() {
  const [fileName, setFileName] = useState<string>("");
  const [csvText, setCsvText] = useState<string>(""); // ✅ Edgeに投げる用
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);

  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [info, setInfo] = useState<string>("");

  const validCount = parsed.length;
  const errorCount = errors.length;

  const canImport = useMemo(() => validCount > 0 && !importing, [validCount, importing]);

  const handleFile = async (f: File) => {
    setFileName(f.name);
    setInfo("");
    setParsed([]);
    setErrors([]);
    setParsing(true);

    try {
      const text = await f.text();
      setCsvText(text); // ✅ 保存
      const table = parseCSV(text);

      const { headers, rows } = buildObjectsFromCSV(table);
      if (!headers.length) {
        setInfo("CSVのヘッダーが見つかりませんでした。");
        return;
      }

      // ✅ 番号付きも normalizeHeader が剥がすので、候補は素の名前でOK
      const keyPhone = findFieldKey(headers, [
        "mobile number",
        "mobile",
        "phone",
        "phone number",
        "phone_number",
        "tel",
        "telephone",
        "携帯",
        "携帯番号",
        "電話",
        "電話番号",
      ]);

      const keyTest = findFieldKey(headers, [
        "test date / time",
        "test date/time",
        "test date time",
        "test date",
        "measured_at",
        "date",
        "測定日",
        "測定日時",
        "inbody測定日",
        "inbody 測定日",
      ]);

      const keyHeight = findFieldKey(headers, ["height", "height_cm", "身長"]);
      const keyWeight = findFieldKey(headers, ["weight", "体重"]);
      const keyPbf = findFieldKey(headers, [
        "pbf (percent body fat)",
        "pbf",
        "percent body fat",
        "percent_body_fat",
        "body fat percent",
        "body_fat_percent",
        "体脂肪率"
      ]);

      const missing = [
        !keyPhone ? "Mobile Number(電話番号)" : null,
        !keyTest ? "Test Date / Time(測定日)" : null,
        !keyHeight ? "Height(身長)" : null,
        !keyWeight ? "Weight(体重)" : null,
        !keyPbf ? "PBF(体脂肪率)" : null,
      ].filter(Boolean);

      if (missing.length) {
        setInfo(`CSVヘッダーに必須カラムが不足しています: ${missing.join(", ")}`);
        return;
      }

      if (rows.length > MAX_ROWS) {
        setInfo(`行数が多すぎます（上限 ${MAX_ROWS} 行）。CSVを分割してください。`);
        return;
      }

      const ok: ParsedRow[] = [];
      const ng: RowError[] = [];

      rows.forEach((r, idx) => {
        const rowIndex = idx + 1;
        const phone = digitsOnlyPhone(r[keyPhone!]);
        const measured = parseToISODateOnly(r[keyTest!]);

        const height = parseNumberOrNull(r[keyHeight!]);
        const weight = parseNumberOrNull(r[keyWeight!]);
        const pbf = parseNumberOrNull(r[keyPbf!]);

        if (!phone) {
          ng.push({ rowIndex, message: "電話番号が空 or 不正です（数字のみ抽出できません）", raw: r });
          return;
        }
        if (!measured) {
          ng.push({ rowIndex, message: "測定日(Test Date / Time)が解釈できません（例: 2025-12-21）", raw: r });
          return;
        }
        if (height == null || height <= 0 || height > 250) {
          ng.push({ rowIndex, message: "身長が不正です（0〜250cmの範囲で）", raw: r });
          return;
        }
        if (weight == null || weight <= 0 || weight > 300) {
          ng.push({ rowIndex, message: "体重が不正です（0〜300kgの範囲で）", raw: r });
          return;
        }
        if (pbf == null || pbf < 0 || pbf > 80) {
          ng.push({ rowIndex, message: "体脂肪率(PBF)が不正です（0〜80%の範囲で）", raw: r });
          return;
        }

        ok.push({
          rowIndex,
          phone_number: phone,
          measured_at: measured,
          height,
          weight,
          body_fat_percent: pbf,
          raw: r,
        });
      });

      setParsed(ok);
      setErrors(ng);
      setInfo(`解析完了：有効 ${ok.length} 行 / エラー ${ng.length} 行`);
    } catch (e: any) {
      console.error(e);
      setInfo(`CSVの読み込みに失敗しました: ${String(e?.message ?? e)}`);
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!canImport) return;
    setImporting(true);
    setInfo("");

    try {
      // ✅ Edge Function に “元CSV” を投げる（Edge側で measured_at_ts / phone_norm / upsert）
      const { data, error } = await supabase.functions.invoke("import-inbody-csv", {
        body: {
          csv: csvText,
          source: "csv",
          note: null,
        },
      });

      if (error) throw error;

      const inserted = (data as any)?.inserted_or_updated ?? 0;
      const rejected = (data as any)?.rejected ?? 0;

      setInfo(`✅ 取り込み成功：${inserted} 行を upsert（rejected: ${rejected}）`);
    } catch (e: any) {
      console.error(e);
      setInfo(`❌ 取り込み失敗: ${String(e?.message ?? e)}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">InBody CSV 一括取り込み</h3>
        </div>

        <div className="text-sm text-gray-600 mb-4">
          <div className="font-medium text-gray-800 mb-1">必須カラム</div>
          <ul className="list-disc pl-5 space-y-1">
            <li>Mobile Number（電話番号）※「1. Mobile Number」でもOK</li>
            <li>Test Date / Time（※時刻込みOK / プレビューは日付だけ表示）</li>
            <li>Height（身長）</li>
            <li>Weight（体重）</li>
            <li>PBF（Percent Body Fat / 体脂肪率）</li>
          </ul>
          <div className="mt-2 text-xs text-gray-500">
            ※番号付きヘッダ（例: 1. Mobile Number）も自動で吸収します。
          </div>
        </div>

        <label className="block">
          <div className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-6 hover:border-blue-400 transition-colors cursor-pointer bg-gray-50">
            <div className="text-center">
              <Upload className="w-7 h-7 mx-auto text-gray-500 mb-2" />
              <div className="text-sm font-medium text-gray-800">
                CSVファイルを選択（ドラッグ&ドロップでもOK）
              </div>
              <div className="text-xs text-gray-500 mt-1">上限 {MAX_ROWS} 行</div>
              {fileName && <div className="text-xs text-gray-700 mt-2">選択中: {fileName}</div>}
            </div>
          </div>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </label>

        {info && (
          <div className="mt-4 flex items-start gap-2 text-sm">
            {info.startsWith("✅") ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
            ) : info.startsWith("❌") ? (
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
            )}
            <div className="text-gray-700 whitespace-pre-wrap">{info}</div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleImport}
            disabled={!canImport}
            className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors ${
              canImport ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            {importing ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                取り込み中...
              </span>
            ) : (
              "DBへ一括取り込み（Edge）"
            )}
          </button>

          {parsing && (
            <span className="text-sm text-gray-600 inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              解析中...
            </span>
          )}

          <div className="text-sm text-gray-600">
            有効 <span className="font-semibold text-gray-900">{validCount}</span> 行 / エラー{" "}
            <span className="font-semibold text-gray-900">{errorCount}</span> 行
          </div>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h4 className="text-md font-semibold text-gray-900">エラー行（取り込み対象外）</h4>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-3">行</th>
                  <th className="py-2 pr-3">理由</th>
                  <th className="py-2 pr-3">データ（抜粋）</th>
                </tr>
              </thead>
              <tbody>
                {errors.slice(0, 50).map((e) => (
                  <tr key={`${e.rowIndex}-${e.message}`} className="border-t">
                    <td className="py-2 pr-3 font-mono">{e.rowIndex}</td>
                    <td className="py-2 pr-3 text-red-700">{e.message}</td>
                    <td className="py-2 pr-3 text-gray-600">
                      {JSON.stringify(e.raw).slice(0, 140)}
                      {JSON.stringify(e.raw).length > 140 ? "..." : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {errors.length > 50 && <div className="text-xs text-gray-500 mt-2">※表示は最初の50行のみ</div>}
        </div>
      )}

      {parsed.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h4 className="text-md font-semibold text-gray-900 mb-3">プレビュー（先頭10行）</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-3">行</th>
                  <th className="py-2 pr-3">電話</th>
                  <th className="py-2 pr-3">測定日</th>
                  <th className="py-2 pr-3">身長</th>
                  <th className="py-2 pr-3">体重</th>
                  <th className="py-2 pr-3">体脂肪率</th>
                </tr>
              </thead>
              <tbody>
                {parsed.slice(0, 10).map((r) => (
                  <tr key={r.rowIndex} className="border-t">
                    <td className="py-2 pr-3 font-mono">{r.rowIndex}</td>
                    <td className="py-2 pr-3 font-mono">{r.phone_number}</td>
                    <td className="py-2 pr-3 font-mono">{r.measured_at}</td>
                    <td className="py-2 pr-3">{r.height}</td>
                    <td className="py-2 pr-3">{r.weight}</td>
                    <td className="py-2 pr-3">{r.body_fat_percent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-xs text-gray-500 mt-2">※実際の保存は Edge 側が日時（measured_at_ts）も扱います</div>
        </div>
      )}
    </div>
  );
}