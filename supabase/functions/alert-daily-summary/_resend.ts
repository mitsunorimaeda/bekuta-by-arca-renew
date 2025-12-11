// 先頭付近
declare const Deno: any;
// supabase/functions/alert-daily-summary/_resend.ts
const RESEND_API_URL = "https://api.resend.com/emails";

interface DailySummaryEmailParams {
  to: string;
  coachName: string;
  teamName: string;
  dateLabel: string; // 例: '2025-12-11 時点'
  highRisk: { name: string; acwr: number }[];
  caution: { name: string; acwr: number }[];
  lowLoad: { name: string; acwr: number }[];
  noData: { name: string; days: number; lastDate: string | null }[];
}

export async function sendDailySummaryEmail(params: DailySummaryEmailParams) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("[sendDailySummaryEmail] RESEND_API_KEY is not set");
    return;
  }

  const {
    to,
    coachName,
    teamName,
    dateLabel,
    highRisk,
    caution,
    lowLoad,
    noData,
  } = params;

  // 件名
  const subject = `【${teamName}】前日までの負荷アラートまとめ（${dateLabel}）`;

  // 本文（シンプルなテキスト＋HTML両方でもOK）
  const htmlParts: string[] = [];

  htmlParts.push(`<p>${coachName} コーチ</p>`);
  htmlParts.push(
    `<p>いつも選手のサポートありがとうございます。<br/>前日までの負荷状況をお送りします。</p>`
  );
  htmlParts.push(`<hr/>`);
  htmlParts.push(`<h3>■ 高リスク（ACWR &gt; 1.5）</h3>`);
  if (highRisk.length === 0) {
    htmlParts.push(`<p>該当者なし</p>`);
  } else {
    htmlParts.push(`<ul>`);
    for (const p of highRisk) {
      htmlParts.push(
        `<li>${p.name}：ACWR <strong>${p.acwr.toFixed(2)}</strong></li>`
      );
    }
    htmlParts.push(`</ul>`);
  }

  htmlParts.push(`<h3>■ 注意（1.3 ≦ ACWR ≦ 1.5）</h3>`);
  if (caution.length === 0) {
    htmlParts.push(`<p>該当者なし</p>`);
  } else {
    htmlParts.push(`<ul>`);
    for (const p of caution) {
      htmlParts.push(
        `<li>${p.name}：ACWR <strong>${p.acwr.toFixed(2)}</strong></li>`
      );
    }
    htmlParts.push(`</ul>`);
  }

  htmlParts.push(`<h3>■ 低負荷（ACWR &lt; 0.8）</h3>`);
  if (lowLoad.length === 0) {
    htmlParts.push(`<p>該当者なし</p>`);
  } else {
    htmlParts.push(`<ul>`);
    for (const p of lowLoad) {
      htmlParts.push(
        `<li>${p.name}：ACWR <strong>${p.acwr.toFixed(2)}</strong></li>`
      );
    }
    htmlParts.push(`</ul>`);
  }

  htmlParts.push(`<h3>■ 練習記録なし（連続 N 日）</h3>`);
  if (noData.length === 0) {
    htmlParts.push(`<p>該当者なし</p>`);
  } else {
    htmlParts.push(`<ul>`);
    for (const p of noData) {
      const last = p.lastDate ? `（最終記録 ${p.lastDate}）` : "";
      htmlParts.push(
        `<li>${p.name}：<strong>${p.days}日</strong> 記録なし ${last}</li>`
      );
    }
    htmlParts.push(`</ul>`);
  }

  htmlParts.push(`<hr/>`);
  htmlParts.push(
    `<p>※本メールは ARCA/Bekuta の自動通知です。<br/>今日の練習運営の参考にしてください。</p>`
  );

  const html = htmlParts.join("\n");

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Bekuta Alerts <noreply@arca.fit>", // Resend で認証したドメイン
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(
      "[sendDailySummaryEmail] Resend error:",
      res.status,
      res.statusText,
      text,
    );
  } else {
    console.log(`[sendDailySummaryEmail] sent to ${to}`);
  }
}