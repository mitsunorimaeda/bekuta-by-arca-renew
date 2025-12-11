// supabase/functions/alert-daily-summary/_alerts.ts

export type RiskLevel = "high" | "caution" | "good" | "low";

export type AthleteRiskSummary = {
  athleteName: string;
  teamName: string;
  latestAcwr: number;
  riskLevel: RiskLevel;
  lastTrainingDate: string;
  daysSinceLastTraining: number;
};

type BuildEmailParams = {
  staffName: string;
  date: string; // YYYY-MM-DD (JST)
  highRiskAthletes: AthleteRiskSummary[];
  cautionAthletes: AthleteRiskSummary[];
};

export function buildDailySummaryEmail(params: BuildEmailParams) {
  const {
    staffName,
    date,
    highRiskAthletes,
    cautionAthletes,
  } = params;

  const subject = `【Bekuta】高リスクアラートサマリー（${date}）`;

  const hasHigh = highRiskAthletes.length > 0;
  const hasCaution = cautionAthletes.length > 0;

  const makeTable = (
    title: string,
    rows: AthleteRiskSummary[],
  ): string => {
    if (rows.length === 0) return "";

    const trs = rows
      .map((a) =>
        `<tr>
          <td style="padding:4px 8px;border:1px solid #e5e7eb;">${a.teamName}</td>
          <td style="padding:4px 8px;border:1px solid #e5e7eb;">${a.athleteName}</td>
          <td style="padding:4px 8px;border:1px solid #e5e7eb;text-align:right;">${a.latestAcwr.toFixed(2)}</td>
          <td style="padding:4px 8px;border:1px solid #e5e7eb;">${a.lastTrainingDate}（${a.daysSinceLastTraining}日前）</td>
        </tr>`
      )
      .join("\n");

    return `
      <h3 style="margin:16px 0 8px;font-size:14px;color:#111827;">${title}</h3>
      <table style="border-collapse:collapse;width:100%;font-size:13px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:4px 8px;border:1px solid #e5e7eb;text-align:left;">チーム</th>
            <th style="padding:4px 8px;border:1px solid #e5e7eb;text-align:left;">選手</th>
            <th style="padding:4px 8px;border:1px solid #e5e7eb;text-align:right;">最新ACWR</th>
            <th style="padding:4px 8px;border:1px solid #e5e7eb;text-align:left;">最終練習日</th>
          </tr>
        </thead>
        <tbody>
          ${trs}
        </tbody>
      </table>
    `;
  };

  const html = `
    <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size:14px; color:#111827; line-height:1.6;">
      <p>${staffName} さん</p>
      <p>Bekutaより、${date} 時点のACWRリスクサマリーをお送りします。</p>

      ${
        hasHigh
          ? makeTable("🚨 高リスク（ACWR > 1.5）", highRiskAthletes)
          : "<p>高リスクの選手はいません。</p>"
      }

      ${
        hasCaution
          ? makeTable("⚠️ 注意レベル（1.3 ≦ ACWR ≦ 1.5）", cautionAthletes)
          : ""
      }

      <p style="margin-top:16px;font-size:12px;color:#6b7280;">
        ※本メールは自動配信です。内容に基づき、トレーニング計画や出場可否の判断にご活用ください。<br/>
        ※最終的な判断は必ず現場の状況と本人の状態を踏まえて行ってください。
      </p>
    </div>
  `;

  const textLines: string[] = [];
  textLines.push(`${staffName} さんへ`);
  textLines.push(`Bekutaより、${date} 時点のACWRリスクサマリーです。`);
  textLines.push("");

  if (hasHigh) {
    textLines.push("【高リスク（ACWR > 1.5）】");
    for (const a of highRiskAthletes) {
      textLines.push(
        `- ${a.teamName} / ${a.athleteName} : ACWR ${a.latestAcwr.toFixed(
          2,
        )}, 最終練習日 ${a.lastTrainingDate}（${a.daysSinceLastTraining}日前）`,
      );
    }
    textLines.push("");
  } else {
    textLines.push("高リスクの選手はいません。");
    textLines.push("");
  }

  if (hasCaution) {
    textLines.push("【注意レベル（1.3 ≦ ACWR ≦ 1.5）】");
    for (const a of cautionAthletes) {
      textLines.push(
        `- ${a.teamName} / ${a.athleteName} : ACWR ${a.latestAcwr.toFixed(
          2,
        )}, 最終練習日 ${a.lastTrainingDate}（${a.daysSinceLastTraining}日前）`,
      );
    }
    textLines.push("");
  }

  textLines.push(
    "※本メールは自動配信です。内容に基づき、トレーニング計画や出場可否の判断にご活用ください。",
  );

  const text = textLines.join("\n");

  return { subject, html, text };
}