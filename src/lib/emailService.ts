import { supabase } from './supabase';
import { Alert } from './alerts';

interface SendEmailParams {
  to: string;
  type: 'invitation' | 'password_reset' | 'alert' | 'weekly_summary';
  data: Record<string, any>;
}

export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return {
        success: false,
        error: 'Not authenticated'
      };
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    const response = await fetch(
      `${supabaseUrl}/functions/v1/send-email`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || 'Failed to send email'
      };
    }

    return {
      success: true,
      message: result.message
    };
  } catch (error: any) {
    console.error('Email sending error:', error);
    return {
      success: false,
      error: error.message || 'Unexpected error while sending email'
    };
  }
}

export async function sendAlertEmail(
  userEmail: string,
  userName: string,
  alert: Alert
): Promise<{ success: boolean; message?: string; error?: string }> {
  const roleLabels = {
    athlete: '選手',
    staff: 'スタッフ',
    admin: '管理者'
  };

  const priorityLabels = {
    high: '高',
    medium: '中',
    low: '低'
  };

  return sendEmail({
    to: userEmail,
    type: 'alert',
    data: {
      userName,
      alertTitle: alert.title,
      alertMessage: alert.message,
      priority: alert.priority,
      acwrValue: alert.acwr_value?.toFixed(2),
      recommendedRange: '0.8-1.3',
      recommendations: alert.recommendations,
      appUrl: window.location.origin
    }
  });
}

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
): Promise<{ success: boolean; message?: string; error?: string }> {
  return sendEmail({
    to: userEmail,
    type: 'weekly_summary',
    data: {
      userName,
      ...summaryData,
      appUrl: window.location.origin
    }
  });
}

export async function sendPasswordResetEmail(
  userEmail: string,
  userName: string,
  temporaryPassword: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  return sendEmail({
    to: userEmail,
    type: 'password_reset',
    data: {
      userName,
      temporaryPassword,
      appUrl: window.location.origin
    }
  });
}
