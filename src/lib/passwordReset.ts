// src/lib/passwordReset.ts
import { supabase } from './supabase';

function normalizeEmail(v: string) {
  return v.trim().toLowerCase();
}

export async function requestPasswordResetEmail(email: string) {
  const e = normalizeEmail(email);
  if (!e) throw new Error('メールアドレスが空です');

  const { data, error } = await supabase.functions.invoke('request-password-reset', {
    body: {
      email: e,
      redirectUrl: `${window.location.origin}/reset-password`,
    },
  });

  if (error) {
    console.error('[requestPasswordResetEmail] error:', error);
    throw new Error('送信に失敗しました。時間をおいて再度お試しください。');
  }

  return data;
}