// send-email (Supabase Edge Function)

// 先頭付近
declare const Deno: any;
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const IS_DEV =
  Deno.env.get('ENVIRONMENT') === 'development' ||
  Deno.env.get('NODE_ENV') === 'development';

function generateAlertEmailHTML(data: any): string {
  const priorityColors = {
    high: { bg: '#fee2e2', border: '#dc2626', text: '#991b1b' },
    medium: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
    low: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' }
  };
  const colors = priorityColors[data.priority as 'high' | 'medium' | 'low'];
  const priorityLabel = { high: '高', medium: '中', low: '低' }[data.priority as 'high' | 'medium' | 'low'];

  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>ACWR アラート通知</title></head><body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;"><div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);"><div style="background: ${colors.border}; color: white; padding: 30px; text-align: center;"><h1 style="margin: 0; font-size: 24px;">⚠️ ACWR アラート通知</h1><p style="margin: 10px 0 0 0; opacity: 0.9;">優先度: ${priorityLabel}</p></div><div style="padding: 30px;"><p style="font-size: 18px; color: #1f2937; margin: 0 0 20px 0;">こんにちは、${data.userName}さん</p><div style="background: ${colors.bg}; border-left: 4px solid ${colors.border}; padding: 20px; margin: 20px 0; border-radius: 4px;"><h2 style="margin: 0 0 10px 0; color: ${colors.text}; font-size: 18px;">${data.alertTitle}</h2><p style="margin: 0; color: #4b5563; line-height: 1.6;">${data.alertMessage}</p></div>${data.acwrValue ? `<div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;"><p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px;">現在のACWR値</p><p style="margin: 0; font-size: 32px; font-weight: bold; color: ${colors.text};">${data.acwrValue.toFixed(2)}</p><p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;">推奨範囲: ${data.recommendedRange}</p></div>` : ''}<a href="${data.appUrl}" style="display: inline-block; background: ${colors.border}; color: white; text-decoration: none; padding: 12px 30px; border-radius: 8px; margin: 20px 0; font-weight: 600;">詳細を確認</a></div><div style="padding: 20px; text-align: center; background: #f9fafb; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;"><p style="margin: 0;">© ${new Date().getFullYear()} Bekuta</p></div></div></body></html>`;
}

function generateAlertEmailText(data: any): string {
  const priorityLabel = { high: '高', medium: '中', low: '低' }[data.priority as 'high' | 'medium' | 'low'];
  return `ACWR アラート通知\n\nこんにちは、${data.userName}さん\n\n優先度: ${priorityLabel}\n\n━━━━━━━━━━━━━━━━━━━━━━\n${data.alertTitle}\n━━━━━━━━━━━━━━━━━━━━━━\n\n${data.alertMessage}\n\n${data.acwrValue ? `現在のACWR値: ${data.acwrValue.toFixed(2)}\n推奨範囲: ${data.recommendedRange}\n` : ''}\n詳細を確認: ${data.appUrl}\n\n━━━━━━━━━━━━━━━━━━━━━━\n© ${new Date().getFullYear()} Bekuta`;
}

function generatePasswordResetEmailHTML(data: any): string {
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>パスワードリセット通知</title></head><body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;"><div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);"><div style="background: #3b82f6; color: white; padding: 30px; text-align: center;"><h1 style="margin: 0; font-size: 24px;">🔑 パスワードリセット</h1></div><div style="padding: 30px;"><p style="font-size: 18px; color: #1f2937; margin: 0 0 20px 0;">こんにちは、${data.userName}さん</p><p style="color: #4b5563; line-height: 1.6;">管理者によってパスワードがリセットされました。以下の一時パスワードでログインし、新しいパスワードに変更してください。</p><div style="background: #fef3c7; border: 2px dashed #f59e0b; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center;"><p style="margin: 0 0 10px 0; color: #92400e; font-weight: 600;">一時パスワード</p><p style="margin: 0; font-family: 'Courier New', monospace; font-size: 24px; font-weight: bold; color: #d97706; letter-spacing: 2px;">${data.temporaryPassword}</p><p style="margin: 10px 0 0 0; color: #92400e; font-size: 12px;">⚠️ このパスワードは初回ログイン後に変更してください</p></div><a href="${data.appUrl}" style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 12px 30px; border-radius: 8px; margin: 20px 0; font-weight: 600;">ログインする</a></div><div style="padding: 20px; text-align: center; background: #f9fafb; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;"><p style="margin: 0;">© ${new Date().getFullYear()} Bekuta</p></div></div></body></html>`;
}

function generatePasswordResetEmailText(data: any): string {
  return `パスワードリセット通知\n\nこんにちは、${data.userName}さん\n\n管理者によってパスワードがリセットされました。\n以下の一時パスワードでログインし、新しいパスワードに変更してください。\n\n━━━━━━━━━━━━━━━━━━━━━━\n一時パスワード\n━━━━━━━━━━━━━━━━━━━━━━\n\n${data.temporaryPassword}\n\n⚠️ このパスワードは初回ログイン後に変更してください\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nログイン: ${data.appUrl}\n\n━━━━━━━━━━━━━━━━━━━━━━\n© ${new Date().getFullYear()} Bekuta`;
}

function generateWeeklySummaryEmailHTML(data: any): string {
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>週次トレーニングサマリー</title></head><body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;"><div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);"><div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center;"><h1 style="margin: 0; font-size: 24px;">📊 週次トレーニングサマリー</h1><p style="margin: 10px 0 0 0; opacity: 0.9;">${data.weekRange}</p></div><div style="padding: 30px;"><p style="font-size: 18px; color: #1f2937; margin: 0 0 20px 0;">こんにちは、${data.userName}さん</p><p style="color: #4b5563; line-height: 1.6; margin-bottom: 25px;">今週のトレーニング活動をまとめました。</p><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 25px 0;"><div style="background: #f0fdf4; padding: 20px; border-radius: 8px; text-align: center;"><p style="margin: 0 0 5px 0; color: #16a34a; font-size: 14px; font-weight: 600;">トレーニング日数</p><p style="margin: 0; font-size: 32px; font-weight: bold; color: #15803d;">${data.trainingDays}</p><p style="margin: 5px 0 0 0; color: #16a34a; font-size: 12px;">日</p></div><div style="background: #eff6ff; padding: 20px; border-radius: 8px; text-align: center;"><p style="margin: 0 0 5px 0; color: #2563eb; font-size: 14px; font-weight: 600;">平均ACWR</p><p style="margin: 0; font-size: 32px; font-weight: bold; color: #1e40af;">${data.avgACWR}</p><p style="margin: 5px 0 0 0; color: #2563eb; font-size: 12px;">推奨: 0.8-1.3</p></div></div><a href="${data.appUrl}" style="display: inline-block; background: #10b981; color: white; text-decoration: none; padding: 12px 30px; border-radius: 8px; margin: 20px 0; font-weight: 600;">詳細を確認</a></div><div style="padding: 20px; text-align: center; background: #f9fafb; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;"><p style="margin: 0;">© ${new Date().getFullYear()} Bekuta</p></div></div></body></html>`;
}

function generateWeeklySummaryEmailText(data: any): string {
  return `週次トレーニングサマリー\n\nこんにちは、${data.userName}さん\n\n${data.weekRange}\n\n今週のトレーニング活動をまとめました。\n\n━━━━━━━━━━━━━━━━━━━━━━\nトレーニング統計\n━━━━━━━━━━━━━━━━━━━━━━\n\nトレーニング日数: ${data.trainingDays}日\n平均ACWR: ${data.avgACWR} (推奨: 0.8-1.3)\n総負荷: ${data.totalLoad} AU\nアラート: ${data.alertCount}件\n\n詳細を確認: ${data.appUrl}\n\n━━━━━━━━━━━━━━━━━━━━━━\n© ${new Date().getFullYear()} Bekuta`;
}

function generateInvitationEmailHTML(data: any): string {
  const roleDisplay = { athlete: 'アスリート', staff: 'スタッフ', admin: '管理者' }[data.role] || data.role;
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Bekutaへの招待</title></head><body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh;"><div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);"><div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 50px 30px; text-align: center;"><h1 style="margin: 0; font-size: 32px; font-weight: bold;">ようこそ、${data.name}さん！</h1><p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">${data.teamName ? `${data.teamName} があなたを待っています` : 'チームがあなたを待っています'}</p></div><div style="padding: 40px 30px;"><p style="font-size: 24px; color: #1a202c; margin: 0 0 20px 0; font-weight: 600;">Bekuta への招待</p><p style="color: #4a5568; line-height: 1.6; margin-bottom: 30px;">${data.inviterName ? `${data.inviterName}から、` : ''}Bekuta（怪我予防システム）へご招待します。</p><p style="color: #4a5568; line-height: 1.6; margin-bottom: 30px;">以下のボタンをクリックして、パスワードを設定してください。</p><a href="${data.passwordSetupLink}" style="display: block; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 18px 40px; border-radius: 12px; font-weight: 600; font-size: 18px; margin: 30px 0;">🔑 パスワードを設定する</a><div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;"><p style="margin: 0; color: #856404; font-size: 14px;"><strong>⏰ 重要:</strong> このリンクは${data.expiresInHours || 24}時間後に期限切れになります。</p></div></div><div style="padding: 30px; text-align: center; background: #f7fafc; border-top: 1px solid #e2e8f0; color: #718096; font-size: 14px;"><p style="margin: 0;">© ${new Date().getFullYear()} Bekuta</p></div></div></div></body></html>`;
}

function generateInvitationEmailText(data: any): string {
  const roleDisplay = { athlete: 'アスリート', staff: 'スタッフ', admin: '管理者' }[data.role] || data.role;
  return `Bekuta への招待\n\nようこそ、${data.name}さん！\n\n${data.inviterName ? `${data.inviterName}から、` : ''}Bekuta（怪我予防システム）へご招待します。\n\n━━━━━━━━━━━━━━━━━━━━━━\n招待情報\n━━━━━━━━━━━━━━━━━━━━━━\n\nあなたの役割: ${roleDisplay}\nメールアドレス: ${data.email}\n${data.teamName ? `チーム: ${data.teamName}` : ''}\n\n━━━━━━━━━━━━━━━━━━━━━━\nパスワード設定\n━━━━━━━━━━━━━━━━━━━━━━\n\n以下のリンクからパスワードを設定してください：\n${data.passwordSetupLink}\n\n⏰ この招待は ${data.expiresInHours || 24}時間後に期限切れになります\n\n━━━━━━━━━━━━━━━━━━━━━━\n© ${new Date().getFullYear()} Bekuta`;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface DirectEmailRequest {
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface TemplatedEmailRequest {
  to: string;
  type: 'invitation' | 'password_reset' | 'alert' | 'weekly_summary';
  data: Record<string, any>;
}

type EmailRequest = DirectEmailRequest | TemplatedEmailRequest;

function isDirectEmail(req: EmailRequest): req is DirectEmailRequest {
  return 'subject' in req && 'html' in req;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const requestData: EmailRequest = await req.json();
    const { to } = requestData;

    if (!to) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: to' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    let emailSubject: string;
    let emailHtml: string;
    let emailText: string;
    let alertCategory: string | null = null;

    if (isDirectEmail(requestData)) {
      emailSubject = requestData.subject;
      emailHtml = requestData.html;
      emailText = requestData.text;
    } else {
      const { type, data } = requestData;

      switch (type) {
        case 'alert':
          emailSubject = `⚠️ ACWR アラート通知 - ${data.alertTitle || 'トレーニング負荷警告'}`;
          emailHtml = generateAlertEmailHTML(data);
          emailText = generateAlertEmailText(data);
          alertCategory = data.type || null;
          break;

        case 'password_reset':
          emailSubject = '🔑 パスワードリセット通知 - Bekuta';
          emailHtml = generatePasswordResetEmailHTML(data);
          emailText = generatePasswordResetEmailText(data);
          break;

        case 'weekly_summary':
          emailSubject = `📊 週次トレーニングサマリー - ${data.weekRange || '今週'}`;
          emailHtml = generateWeeklySummaryEmailHTML(data);
          emailText = generateWeeklySummaryEmailText(data);
          break;

        case 'invitation':
          emailSubject = `🎉 ${data.teamName || 'Bekuta'}への招待`;
          emailHtml = generateInvitationEmailHTML(data);
          emailText = generateInvitationEmailText(data);
          break;

        default:
          return new Response(
            JSON.stringify({ error: `Unknown email type: ${type}` }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
      }
    }

    if (IS_DEV) {
      console.log('='.repeat(80));
      console.log('📧 EMAIL READY TO SEND');
      console.log('='.repeat(80));
      console.log('To:', to);
      console.log('Subject:', emailSubject);
      console.log('Timestamp:', new Date().toISOString());
      console.log('-'.repeat(80));
      console.log('HTML Preview:');
      console.log(emailHtml.substring(0, 500) + '...');
      console.log('-'.repeat(80));
      console.log('Text Content:');
      console.log(emailText);
      console.log('='.repeat(80));
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const emailType = isDirectEmail(requestData) ? 'other' : requestData.type;
    let deliveryStatus: 'simulated' | 'sent' | 'failed' = 'simulated';
    let errorMessage: string | null = null;

    // 共通で email_logs に保存するヘルパー
    const logEmail = async () => {
      try {
        await supabaseClient.from('email_logs').insert({
          email: to,
          email_type: emailType,
          alert_category: alertCategory,
          status: deliveryStatus,
          error_message: errorMessage,
          subject: emailSubject,
          body: emailText,
          user_id: null // 必要なら email から users.id を引いて入れる
        });
      } catch (e) {
        if (IS_DEV) {
          console.error('Failed to insert email_logs:', e);
        }
      }
    };

    if (resendApiKey && resendApiKey.startsWith('re_')) {
      if (IS_DEV) {
        console.log('📮 Sending email via Resend...');
      }

      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Bekuta <noreply@arca.fit>',
            to: [to],
            subject: emailSubject,
            html: emailHtml,
            text: emailText
          })
        });

        const result = await response.json();

        if (!response.ok) {
          if (IS_DEV) {
            console.error('❌ Resend API error:', result);
          }
          deliveryStatus = 'failed';
          errorMessage = JSON.stringify(result);

          await logEmail();

          return new Response(
            JSON.stringify({
              success: false,
              error: 'Email sending failed via Resend',
              details: result
            }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }

        if (IS_DEV) {
          console.log('✅ Email sent successfully via Resend:', result);
        }
        deliveryStatus = 'sent';
        await logEmail();

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Email sent successfully via Resend',
            emailId: result.id
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      } catch (error: any) {
        if (IS_DEV) {
          console.error('❌ Resend integration error:', error);
        }
        deliveryStatus = 'failed';
        errorMessage = error.message;

        await logEmail();

        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to send email via Resend',
            details: error.message
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    } else {
      if (IS_DEV) {
        console.log('ℹ️  RESEND_API_KEY not configured. Email simulated.');
      }

      deliveryStatus = 'simulated';
      await logEmail();

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email logged (simulation: RESEND_API_KEY not configured)',
          simulated: true,
          preview: {
            to,
            subject: emailSubject,
            textPreview: emailText.substring(0, 200) + '...'
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

  } catch (error: any) {
    if (IS_DEV) {
      console.error('❌ Unexpected error:', error);
    }
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});