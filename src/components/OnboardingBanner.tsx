// src/components/OnboardingBanner.tsx
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, UserCircle, Bell, ChevronRight } from 'lucide-react';
import {
  registerServiceWorker,
  enablePushForCurrentUser,
} from '../lib/pushClient';

interface OnboardingBannerProps {
  userId: string;
  gender: string | null;
  heightCm: number | null;
  dateOfBirth: string | null;
  onOpenProfileEdit: () => void;
}

const PUBLIC_VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

export function OnboardingBanner({
  userId,
  gender,
  heightCm,
  dateOfBirth,
  onOpenProfileEdit,
}: OnboardingBannerProps) {
  const [dismissed, setDismissed] = useState(true); // default hidden
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushReady, setPushReady] = useState(false);

  const storageKey = `onboarding-banner-dismissed-${userId}`;

  useEffect(() => {
    // Check if dismissed
    const wasDismissed = localStorage.getItem(storageKey);
    if (wasDismissed === 'true') {
      setDismissed(true);
      return;
    }
    setDismissed(false);

    // Check push status
    checkPush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const checkPush = async () => {
    try {
      const reg = await registerServiceWorker();
      setPushReady(!!reg);

      const { data } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      setPushEnabled(!!data);
    } catch {
      setPushReady(false);
      setPushEnabled(false);
    }
  };

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    localStorage.setItem(storageKey, 'true');
  }, [storageKey]);

  const handleEnablePush = async () => {
    if (!PUBLIC_VAPID_KEY || pushBusy) return;
    setPushBusy(true);
    try {
      await registerServiceWorker();
      await enablePushForCurrentUser(PUBLIC_VAPID_KEY);
      setPushEnabled(true);
    } catch (e) {
      console.warn('Push enable failed:', e);
    } finally {
      setPushBusy(false);
    }
  };

  // Determine what's missing
  const profileIncomplete = !gender || !heightCm || !dateOfBirth;
  const pushMissing = pushEnabled === false;
  const nothingToShow = !profileIncomplete && !pushMissing;

  if (dismissed || pushEnabled === null || nothingToShow) return null;

  return (
    <div className="mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 relative animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        aria-label="閉じる"
      >
        <X className="w-4 h-4" />
      </button>

      <p className="text-sm font-semibold text-gray-800 dark:text-white mb-3">
        Bekutaをもっと活用しよう
      </p>

      <div className="space-y-2">
        {/* Profile completion */}
        {profileIncomplete && (
          <button
            onClick={() => {
              onOpenProfileEdit();
              handleDismiss();
            }}
            className="w-full flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg
              hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left group"
          >
            <div className="bg-blue-100 dark:bg-blue-900/40 p-2 rounded-lg flex-shrink-0">
              <UserCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white">プロフィールを完成させる</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {[!gender && '性別', !heightCm && '身長', !dateOfBirth && '生年月日']
                  .filter(Boolean)
                  .join('・')}が未設定です
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 flex-shrink-0" />
          </button>
        )}

        {/* Push notification */}
        {pushMissing && pushReady && (
          <button
            onClick={handleEnablePush}
            disabled={pushBusy}
            className="w-full flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg
              hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left group
              disabled:opacity-50"
          >
            <div className="bg-purple-100 dark:bg-purple-900/40 p-2 rounded-lg flex-shrink-0">
              <Bell className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {pushBusy ? '設定中...' : 'プッシュ通知をONにする'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                リマインダーやコーチからの連絡を受け取れます
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 flex-shrink-0" />
          </button>
        )}
      </div>
    </div>
  );
}
