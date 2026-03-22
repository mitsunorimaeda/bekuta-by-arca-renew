// src/lib/posthog.ts
import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const IS_PROD = import.meta.env.PROD;

let initialized = false;

/**
 * PostHog 初期化（main.tsx から1回だけ呼ぶ）
 */
export function initPostHog() {
  if (!POSTHOG_KEY || initialized) return;

  posthog.init(POSTHOG_KEY, {
    api_host: 'https://us.i.posthog.com',
    // SPA なのでページ遷移を自動キャプチャ
    capture_pageview: true,
    capture_pageleave: true,
    // パフォーマンス計測
    capture_performance: IS_PROD,
    // ── Session Replay（本番のみ）──
    // パスワード等のinputはマスク、それ以外のテキスト・UIは録画
    session_recording: IS_PROD
      ? {
          maskAllInputs: false,           // 全inputマスク → OFF
          maskInputOptions: {
            password: true,               // パスワードだけマスク
          },
          maskTextSelector: '[data-mask]', // data-mask属性の要素だけテキストマスク
        }
      : undefined,
    // ── Surveys ──
    enable_surveys: true,
    // ── Autocapture（クリック・フォーム送信を自動記録）──
    autocapture: true,
    // Cookie使わずlocalStorage
    persistence: 'localStorage',
    // 開発環境ではログ出す
    loaded: (ph) => {
      if (!IS_PROD) {
        console.log('[PostHog] initialized');
      }
    },
  });

  initialized = true;
}

/**
 * ユーザー識別（ログイン時に呼ぶ）
 */
export function identifyUser(
  userId: string,
  properties?: {
    role?: string;
    team_name?: string;
    organization_name?: string;
    name?: string;
  }
) {
  if (!POSTHOG_KEY) return;
  posthog.identify(userId, properties);
}

/**
 * ユーザー識別リセット（ログアウト時に呼ぶ）
 */
export function resetUser() {
  if (!POSTHOG_KEY) return;
  posthog.reset();
}

/**
 * イベント送信
 */
export function trackEvent(eventName: string, properties?: Record<string, any>) {
  if (!POSTHOG_KEY) return;
  posthog.capture(eventName, properties);
}

/**
 * ユーザープロパティ更新（identify済みのユーザーに対して）
 */
export function setUserProperties(properties: Record<string, any>) {
  if (!POSTHOG_KEY) return;
  posthog.people.set(properties);
}

/**
 * グループ設定（チーム・組織単位の分析用）
 */
export function setGroup(groupType: string, groupKey: string, properties?: Record<string, any>) {
  if (!POSTHOG_KEY) return;
  posthog.group(groupType, groupKey, properties);
}
