interface InvitationEmailData {
  name: string;
  email: string;
  role: string;
  teamName?: string;
  passwordSetupLink: string;
  inviteExpiredUrl: string; 
  inviterName?: string;
  expiresInHours: number;
}

export function generateInvitationEmailHTML(data: InvitationEmailData): string {
  const roleDisplay = {
    athlete: 'アスリート',
    staff: 'スタッフ',
    admin: '管理者'
  }[data.role] || data.role;

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bekutaへの招待</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .card {
      background: white;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 50px 30px;
      text-align: center;
      position: relative;
    }
    .header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px);
      background-size: 30px 30px;
    }
    .icon {
      background: white;
      width: 80px;
      height: 80px;
      border-radius: 50%;
      margin: 0 auto 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      position: relative;
    }
    .icon svg {
      width: 40px;
      height: 40px;
    }
    .header h1 {
      color: white;
      font-size: 32px;
      margin: 0 0 10px 0;
      font-weight: bold;
    }
    .header p {
      color: rgba(255, 255, 255, 0.9);
      font-size: 18px;
      margin: 0;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 24px;
      color: #1a202c;
      margin: 0 0 20px 0;
      font-weight: 600;
    }
    .message {
      color: #4a5568;
      line-height: 1.6;
      margin-bottom: 30px;
      font-size: 16px;
    }
    .info-box {
      background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
      border-left: 4px solid #667eea;
      padding: 20px;
      margin: 20px 0;
      border-radius: 8px;
    }
    .info-item {
      margin: 12px 0;
      display: flex;
      align-items: start;
    }
    .info-label {
      font-weight: 600;
      color: #2d3748;
      min-width: 120px;
      font-size: 14px;
    }
    .info-value {
      color: #4a5568;
      font-size: 14px;
    }
    .setup-box {
      background: linear-gradient(135deg, #e6f7ff 0%, #d0edff 100%);
      border: 2px solid #3b82f6;
      padding: 25px;
      margin: 20px 0;
      border-radius: 12px;
      text-align: center;
    }
    .setup-label {
      font-size: 16px;
      color: #1e40af;
      font-weight: 600;
      margin-bottom: 15px;
    }
    .setup-note {
      font-size: 13px;
      color: #1e40af;
      margin-top: 12px;
      line-height: 1.5;
    }
    .cta-button {
      display: block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      padding: 18px 40px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 18px;
      margin: 30px 0;
      box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
      transition: all 0.3s ease;
      text-align: center;
    }
    .cta-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 15px 40px rgba(102, 126, 234, 0.5);
    }
    .steps {
      background: #f7fafc;
      padding: 25px;
      border-radius: 12px;
      margin: 25px 0;
    }
    .steps h3 {
      color: #2d3748;
      font-size: 18px;
      margin: 0 0 20px 0;
      text-align: center;
    }
    .step {
      display: flex;
      align-items: start;
      margin: 15px 0;
      color: #4a5568;
    }
    .step-number {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      margin-right: 12px;
      flex-shrink: 0;
      font-size: 14px;
    }
    .urgency {
      background: linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%);
      padding: 15px 20px;
      border-radius: 10px;
      margin: 20px 0;
      text-align: center;
      border: 2px solid #fdcb6e;
    }
    .urgency-icon {
      font-size: 24px;
      margin-bottom: 5px;
    }
    .urgency-text {
      color: #7d6608;
      font-weight: 600;
      margin: 0;
      font-size: 14px;
    }
    .footer {
      padding: 30px;
      text-align: center;
      color: #718096;
      font-size: 14px;
      background: #f7fafc;
      border-top: 1px solid #e2e8f0;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
    @media only screen and (max-width: 600px) {
      .container {
        padding: 20px 10px;
      }
      .header {
        padding: 30px 20px;
      }
      .header h1 {
        font-size: 24px;
      }
      .content {
        padding: 30px 20px;
      }
      .greeting {
        font-size: 20px;
      }
      .cta-button {
        padding: 16px 30px;
        font-size: 16px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#667eea" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2 L2 7 L12 12 L22 7 L12 2z"/>
            <polyline points="2 17 12 22 22 17"/>
            <polyline points="2 12 12 17 22 12"/>
          </svg>
        </div>
        <h1>ようこそ、${data.name}さん！</h1>
        ${data.teamName ? `<p>${data.teamName} があなたを待っています</p>` : '<p>チームがあなたを待っています</p>'}
      </div>

      <div class="content">
        <p class="greeting">Bekuta への招待</p>

        <p class="message">
          ${data.inviterName ? `${data.inviterName}から、` : ''}Bekuta（トレーニング負荷管理システム）へご招待します。<br/>
          このシステムで、トレーニング負荷を科学的に管理し、怪我のリスクを最小限に抑えることができます。
        </p>

        <div class="info-box">
          <div class="info-item">
            <span class="info-label">あなたの役割</span>
            <span class="info-value">${roleDisplay}</span>
          </div>
          <div class="info-item">
            <span class="info-label">メールアドレス</span>
            <span class="info-value">${data.email}</span>
          </div>
          ${data.teamName ? `
          <div class="info-item">
            <span class="info-label">チーム</span>
            <span class="info-value">${data.teamName}</span>
          </div>
          ` : ''}
        </div>

        <div class="setup-box">
          <div class="setup-label">🔐 まずはパスワードを設定してください</div>
          <div class="setup-note">
            セキュリティのため、最初に「Bekutaで使うパスワード」を自分で設定していただきます。<br>
            下のボタンからパスワード設定ページを開き、設定が終わったら Bekuta のログイン画面で
            <br>「メールアドレス」と「設定したパスワード」でログインしてください。
          </div>
        </div>

        <div class="urgency">
          <div class="urgency-icon">⏰</div>
          <p class="urgency-text">
            このリンクは ${data.expiresInHours}時間後に期限切れになります。<br/>
            期限が切れた場合は、管理者に新しい招待またはパスワードリセットを依頼してください。
          </p>
        </div>

        <a href="${data.passwordSetupLink}" class="cta-button">
          🔑 パスワードを設定する
        </a>

        <div class="steps">
          <h3>次のステップ</h3>
          <div class="step">
            <div class="step-number">1</div>
            <div>上のボタンをクリックしてパスワード設定ページを開く</div>
          </div>
          <div class="step">
            <div class="step-number">2</div>
            <div>あなた専用のパスワードを設定して保存する</div>
          </div>
          <div class="step">
            <div class="step-number">3</div>
            <div>Bekuta のログイン画面を開き、メールアドレスと設定したパスワードでログイン</div>
          </div>
          <div class="step">
            <div class="step-number">4</div>
            <div>チームに参加完了！トレーニング記録を開始</div>
          </div>
        </div>

        <p class="message" style="font-size: 14px; color: #718096;">
          ボタンが機能しない場合は、以下のURLをコピーしてブラウザに貼り付けてください：<br>
          <span style="word-break: break-all; color: #667eea;">${data.passwordSetupLink}</span>
        </p>
      </div>

      <div style="margin-top: 18px; font-size: 13px; color: #4a5568; line-height: 1.6;">
        もしリンクが開けない／期限切れの場合は、こちらから再発行できます：<br />
        <a href="${data.inviteExpiredUrl}" style="color:#667eea; text-decoration: underline;">
          招待リンクの再発行ページを開く
        </a>
      </div>

      <div class="footer">
        <p>このメールに心当たりがない場合は、無視していただいて構いません。</p>
        <p style="margin-top: 15px;">
          質問がある場合は、招待を送った管理者にお問い合わせください。
        </p>
        <p style="margin-top: 15px; font-size: 12px; color: #a0aec0;">
          © ${new Date().getFullYear()} Bekuta. All rights reserved.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

interface AlertEmailData {
  userName: string;
  alertTitle: string;
  alertMessage: string;
  priority: 'high' | 'medium' | 'low';
  acwrValue?: number;
  recommendedRange: string;
  recommendations?: string[];
  appUrl: string;
}

interface PasswordResetEmailData {
  userName: string;
  temporaryPassword: string;
  appUrl: string;
}

interface WeeklySummaryEmailData {
  userName: string;
  weekRange: string;
  trainingDays: number;
  avgACWR: string;
  totalLoad: number;
  alertCount: number;
  insights?: string[];
  appUrl: string;
}

export function generateAlertEmailHTML(data: AlertEmailData): string {
  const priorityColors = {
    high: { bg: '#fee2e2', border: '#dc2626', text: '#991b1b' },
    medium: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
    low: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' }
  };

  const colors = priorityColors[data.priority];
  const priorityLabel = { high: '高', medium: '中', low: '低' }[data.priority];

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ACWR アラート通知</title>
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    <div style="background: ${colors.border}; color: white; padding: 30px; text-align: center;">
      <h1 style="margin: 0; font-size: 24px;">⚠️ ACWR アラート通知</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">優先度: ${priorityLabel}</p>
    </div>

    <div style="padding: 30px;">
      <p style="font-size: 18px; color: #1f2937; margin: 0 0 20px 0;">こんにちは、${data.userName}さん</p>

      <div style="background: ${colors.bg}; border-left: 4px solid ${colors.border}; padding: 20px; margin: 20px 0; border-radius: 4px;">
        <h2 style="margin: 0 0 10px 0; color: ${colors.text}; font-size: 18px;">${data.alertTitle}</h2>
        <p style="margin: 0; color: #4b5563; line-height: 1.6;">${data.alertMessage}</p>
      </div>

      ${data.acwrValue ? `
      <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px;">現在のACWR値</p>
        <p style="margin: 0; font-size: 32px; font-weight: bold; color: ${colors.text};">${data.acwrValue.toFixed(2)}</p>
        <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;">推奨範囲: ${data.recommendedRange}</p>
      </div>
      ` : ''}

      ${data.recommendations && data.recommendations.length > 0 ? `
      <div style="margin: 20px 0;">
        <h3 style="color: #1f2937; font-size: 16px; margin: 0 0 15px 0;">推奨アクション</h3>
        ${data.recommendations.map(rec => `
          <div style="display: flex; align-items: start; margin: 10px 0;">
            <span style="color: ${colors.border}; margin-right: 10px;">•</span>
            <span style="color: #4b5563; line-height: 1.5;">${rec}</span>
          </div>
        `).join('')}
      </div>
      ` : ''}

      <a href="${data.appUrl}" style="display: inline-block; background: ${colors.border}; color: white; text-decoration: none; padding: 12px 30px; border-radius: 8px; margin: 20px 0; font-weight: 600;">
        詳細を確認
      </a>
    </div>

    <div style="padding: 20px; text-align: center; background: #f9fafb; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
      <p style="margin: 0;">© ${new Date().getFullYear()} Bekuta</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function generateAlertEmailText(data: AlertEmailData): string {
  const priorityLabel = { high: '高', medium: '中', low: '低' }[data.priority];

  return `
ACWR アラート通知

こんにちは、${data.userName}さん

優先度: ${priorityLabel}

━━━━━━━━━━━━━━━━━━━━━━
${data.alertTitle}
━━━━━━━━━━━━━━━━━━━━━━

${data.alertMessage}

${data.acwrValue ? `
現在のACWR値: ${data.acwrValue.toFixed(2)}
推奨範囲: ${data.recommendedRange}
` : ''}

${data.recommendations && data.recommendations.length > 0 ? `
推奨アクション:
${data.recommendations.map(rec => `• ${rec}`).join('\n')}
` : ''}

詳細を確認: ${data.appUrl}

━━━━━━━━━━━━━━━━━━━━━━
© ${new Date().getFullYear()} Bekuta
  `.trim();
}

export function generatePasswordResetEmailHTML(data: PasswordResetEmailData): string {
  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>パスワードリセット通知</title>
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    <div style="background: #3b82f6; color: white; padding: 30px; text-align: center;">
      <h1 style="margin: 0; font-size: 24px;">🔑 パスワードリセット</h1>
    </div>

    <div style="padding: 30px;">
      <p style="font-size: 18px; color: #1f2937; margin: 0 0 20px 0;">こんにちは、${data.userName}さん</p>

      <p style="color: #4b5563; line-height: 1.6;">
        管理者によってパスワードがリセットされました。以下の一時パスワードでログインし、新しいパスワードに変更してください。
      </p>

      <div style="background: #fef3c7; border: 2px dashed #f59e0b; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center;">
        <p style="margin: 0 0 10px 0; color: #92400e; font-weight: 600;">一時パスワード</p>
        <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 24px; font-weight: bold; color: #d97706; letter-spacing: 2px;">${data.temporaryPassword}</p>
        <p style="margin: 10px 0 0 0; color: #92400e; font-size: 12px;">⚠️ このパスワードは初回ログイン後に変更してください</p>
      </div>

      <a href="${data.appUrl}" style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 12px 30px; border-radius: 8px; margin: 20px 0; font-weight: 600;">
        ログインする
      </a>

      <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; color: #991b1b; font-size: 14px; font-weight: 600;">セキュリティに関する注意</p>
        <p style="margin: 10px 0 0 0; color: #7f1d1d; font-size: 14px;">
          このパスワードリセットに心当たりがない場合は、すぐに管理者に連絡してください。
        </p>
      </div>
    </div>

    <div style="padding: 20px; text-align: center; background: #f9fafb; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
      <p style="margin: 0;">© ${new Date().getFullYear()} Bekuta</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function generatePasswordResetEmailText(data: PasswordResetEmailData): string {
  return `
パスワードリセット通知

こんにちは、${data.userName}さん

管理者によってパスワードがリセットされました。
以下の一時パスワードでログインし、新しいパスワードに変更してください。

━━━━━━━━━━━━━━━━━━━━━━
一時パスワード
━━━━━━━━━━━━━━━━━━━━━━

${data.temporaryPassword}

⚠️ このパスワードは初回ログイン後に変更してください

━━━━━━━━━━━━━━━━━━━━━━

ログイン: ${data.appUrl}

【セキュリティに関する注意】
このパスワードリセットに心当たりがない場合は、
すぐに管理者に連絡してください。

━━━━━━━━━━━━━━━━━━━━━━
© ${new Date().getFullYear()} Bekuta
  `.trim();
}

export function generateWeeklySummaryEmailHTML(data: WeeklySummaryEmailData): string {
  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>週次トレーニングサマリー</title>
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center;">
      <h1 style="margin: 0; font-size: 24px;">📊 週次トレーニングサマリー</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">${data.weekRange}</p>
    </div>

    <div style="padding: 30px;">
      <p style="font-size: 18px; color: #1f2937; margin: 0 0 20px 0;">こんにちは、${data.userName}さん</p>

      <p style="color: #4b5563; line-height: 1.6; margin-bottom: 25px;">
        今週のトレーニング活動をまとめました。
      </p>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 25px 0;">
        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; text-align: center;">
          <p style="margin: 0 0 5px 0; color: #16a34a; font-size: 14px; font-weight: 600;">トレーニング日数</p>
          <p style="margin: 0; font-size: 32px; font-weight: bold; color: #15803d;">${data.trainingDays}</p>
          <p style="margin: 5px 0 0 0; color: #16a34a; font-size: 12px;">日</p>
        </div>

        <div style="background: #eff6ff; padding: 20px; border-radius: 8px; text-align: center;">
          <p style="margin: 0 0 5px 0; color: #2563eb; font-size: 14px; font-weight: 600;">平均ACWR</p>
          <p style="margin: 0; font-size: 32px; font-weight: bold; color: #1e40af;">${data.avgACWR}</p>
          <p style="margin: 5px 0 0 0; color: #2563eb; font-size: 12px;">推奨: 0.8-1.3</p>
        </div>

        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; text-align: center;">
          <p style="margin: 0 0 5px 0; color: #d97706; font-size: 14px; font-weight: 600;">総負荷</p>
          <p style="margin: 0; font-size: 32px; font-weight: bold; color: #b45309;">${data.totalLoad}</p>
          <p style="margin: 5px 0 0 0; color: #d97706; font-size: 12px;">AU</p>
        </div>

        <div style="background: ${data.alertCount > 0 ? '#fee2e2' : '#f0fdf4'}; padding: 20px; border-radius: 8px; text-align: center;">
          <p style="margin: 0 0 5px 0; color: ${data.alertCount > 0 ? '#dc2626' : '#16a34a'}; font-size: 14px; font-weight: 600;">アラート</p>
          <p style="margin: 0; font-size: 32px; font-weight: bold; color: ${data.alertCount > 0 ? '#b91c1c' : '#15803d'};">${data.alertCount}</p>
          <p style="margin: 5px 0 0 0; color: ${data.alertCount > 0 ? '#dc2626' : '#16a34a'}; font-size: 12px;">件</p>
        </div>
      </div>

      ${data.insights && data.insights.length > 0 ? `
      <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 25px 0;">
        <h3 style="color: #1f2937; font-size: 16px; margin: 0 0 15px 0;">📈 インサイト</h3>
        ${data.insights.map(insight => `
          <div style="display: flex; align-items: start; margin: 10px 0;">
            <span style="color: #10b981; margin-right: 10px;">✓</span>
            <span style="color: #4b5563; line-height: 1.5;">${insight}</span>
          </div>
        `).join('')}
      </div>
      ` : ''}

      <a href="${data.appUrl}" style="display: inline-block; background: #10b981; color: white; text-decoration: none; padding: 12px 30px; border-radius: 8px; margin: 20px 0; font-weight: 600;">
        詳細を確認
      </a>
    </div>

    <div style="padding: 20px; text-align: center; background: #f9fafb; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
      <p style="margin: 0;">© ${new Date().getFullYear()} Bekuta</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function generateWeeklySummaryEmailText(data: WeeklySummaryEmailData): string {
  return `
週次トレーニングサマリー

こんにちは、${data.userName}さん

${data.weekRange}

今週のトレーニング活動をまとめました。

━━━━━━━━━━━━━━━━━━━━━━
トレーニング統計
━━━━━━━━━━━━━━━━━━━━━━

トレーニング日数: ${data.trainingDays}日
平均ACWR: ${data.avgACWR} (推奨: 0.8-1.3)
総負荷: ${data.totalLoad} AU
アラート: ${data.alertCount}件

${data.insights && data.insights.length > 0 ? `
━━━━━━━━━━━━━━━━━━━━━━
インサイト
━━━━━━━━━━━━━━━━━━━━━━

${data.insights.map(insight => `✓ ${insight}`).join('\n')}
` : ''}

詳細を確認: ${data.appUrl}

━━━━━━━━━━━━━━━━━━━━━━
© ${new Date().getFullYear()} Bekuta
  `.trim();
}

export function generateInvitationEmailText(data: InvitationEmailData): string {
  const roleDisplay = {
    athlete: 'アスリート',
    staff: 'スタッフ',
    admin: '管理者'
  }[data.role] || data.role;

  return `
Bekuta への招待

ようこそ、${data.name}さん！

${data.inviterName ? `${data.inviterName}から、` : ''}Bekuta（トレーニング負荷管理システム）へご招待します。

このシステムで、トレーニング負荷を科学的に管理し、
怪我のリスクを最小限に抑えることができます。

━━━━━━━━━━━━━━━━━━━━━━
招待情報
━━━━━━━━━━━━━━━━━━━━━━

あなたの役割: ${roleDisplay}
メールアドレス: ${data.email}
${data.teamName ? `チーム: ${data.teamName}\n` : ''}

━━━━━━━━━━━━━━━━━━━━━━
パスワード設定
━━━━━━━━━━━━━━━━━━━━━━

🔐 セキュリティのため、まず Bekuta で使うパスワードを設定してください。
設定後は、Bekuta のログイン画面で
「メールアドレス」と「設定したパスワード」でログインします。

━━━━━━━━━━━━━━━━━━━━━━
次のステップ
━━━━━━━━━━━━━━━━━━━━━━

1. 以下のURLにアクセスしてパスワード設定ページを開く
   ${data.passwordSetupLink}

2. あなた専用のパスワードを設定し、「保存」する

3. Bekuta のログイン画面を開き、
   メールアドレスと設定したパスワードでログインする

4. チームに参加完了！トレーニング記録を開始

━━━━━━━━━━━━━━━━━━━━━━

⏰ このリンクは ${data.expiresInHours}時間後に期限切れになります。
   期限が切れた場合は、招待を送った管理者に
   新しい招待またはパスワードリセットの発行を依頼してください。

  リンクが開けない／期限切れの場合は、こちらから再発行できます：
  ${data.inviteExpiredUrl}

このメールに心当たりがない場合は、無視していただいて構いません。
質問がある場合は、招待を送った管理者にお問い合わせください。

© ${new Date().getFullYear()} Bekuta
  `.trim();
}