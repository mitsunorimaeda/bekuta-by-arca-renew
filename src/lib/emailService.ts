import { supabase } from './supabase';
import type { Alert } from './alerts';

interface SendEmailParams {
  to: string;
  type: 'invitation' | 'password_reset' | 'alert' | 'weekly_summary';
  data: Record<string, any>;
}

interface SendEmailResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * 共通メール送信関数
 */
export async function sendEmail(
  params: SendEmailParams
): Promise<SendEmailResult> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      console.error('[sendEmail] No auth session found');
      return { success: false, error: 'Not authenticated' };
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    if (!supabaseUrl) {
      console.error('[sendEmail] VITE_SUPABASE_URL is not set');
      return {
        success: false,
        error: 'Supabase URL is not configured',
      };
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    let result: any = {};
    try {
      result = await response.json();
    } catch (e) {
      // JSON で返らない場合もあるので念のため
      console.warn('[sendEmail] Failed to parse JSON response', e);
    }

    if (!response.ok) {
      console.error('[sendEmail] Failed response:', response.status, result);
      return {
        success: false,
        error: result?.error || 'Failed to send email',
      };
    }

    return {
      success: true,
      message: result?.message || 'Email sent successfully',
    };
  } catch (error: any) {
    console.error('Email sending error:', error);
    return {
      success: false,
      error: error?.message || 'Unexpected error while sending email',
    };
  }
}

/**
 * ACWR アラートメール
 */
export async function sendAlertEmail(
  userEmail: string,
  userName: string,
  alert: Alert & { recommendations?: string[] }
): Promise<SendEmailResult> {
  const acwrValue =
    typeof (alert as any).acwr_value === 'number'
      ? (alert as any).acwr_value.toFixed(2)
      : undefined;

  return sendEmail({
    to: userEmail,
    type: 'alert',
    data: {
      userName,
      alertTitle: alert.title,
      alertMessage: alert.message,
      priority: (alert as any).priority,
      acwrValue,
      recommendedRange: '0.8-1.3',
      recommendations: alert.recommendations ?? [],
      appUrl: window.location.origin,
    },
  });
}

/**
 * 週次サマリーメール
 * ※ 今は「機能停止中」。メールは送らずログだけ出す。
 */
export async function sendWeeklySummaryEmail(
  userEmail: string,
  userName: string,
  summaryData: {
    weekRange: string;
    trainingDays: number;
    avgACWR: string;
    totalLoad: number;
    alertCount: number;
    insights?: string[];
  }
): Promise<SendEmailResult> {
  console.info('[sendWeeklySummaryEmail] 現在この機能は停止中です', {
    userEmail,
    userName,
    summaryData,
  });

  // sendEmail は呼ばないので、実際のメール送信は発生しない
  return {
    success: true,
    message: 'Weekly summary email feature is currently disabled.',
  };
}

/**
 * 一時パスワードメール（初回ログイン用など）
 */
export async function sendPasswordResetEmail(
  userEmail: string,
  userName: string,
  temporaryPassword: string
): Promise<SendEmailResult> {
  return sendEmail({
    to: userEmail,
    type: 'password_reset',
    data: {
      userName,
      temporaryPassword,
      appUrl: window.location.origin,
    },
  });
}