import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Bell, Shield, Calendar, CheckCircle, AlertCircle, Save } from 'lucide-react';

interface EmailNotificationSettingsProps {
  userId: string;
  userEmail: string;
}

interface NotificationPreferences {
  invitations: boolean;
  alerts: boolean;
  password_reset: boolean;
  weekly_summary: boolean;
}

export function EmailNotificationSettings({ userId, userEmail }: EmailNotificationSettingsProps) {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    invitations: true,
    alerts: true,
    password_reset: true,
    weekly_summary: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadPreferences();
  }, [userId]);

  const loadPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('email_notifications')
        .eq('id', userId)
        .single();

      if (error) throw error;

      if (data?.email_notifications) {
        setPreferences(data.email_notifications as NotificationPreferences);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('users')
        .update({ email_notifications: preferences })
        .eq('id', userId);

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'メール通知設定を保存しました',
      });
    } catch (error: any) {
      console.error('Error saving preferences:', error);
      setMessage({
        type: 'error',
        text: error.message || '設定の保存に失敗しました',
      });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">メール通知設定</h2>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start">
          <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>メールアドレス:</strong> {userEmail}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              通知メールはこのアドレスに送信されます
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 space-y-6 transition-colors">
        <div className="flex items-start space-x-4">
          <Bell className="w-6 h-6 text-red-600 dark:text-red-400 mt-1 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">アラート通知</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  高リスクのACWR値や怪我の予測アラートをメールで受信
                </p>
              </div>
              <button
                onClick={() => handleToggle('alerts')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.alerts
                    ? 'bg-blue-600 dark:bg-blue-500'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.alerts ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700"></div>

        <div className="flex items-start space-x-4">
          <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">招待メール</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  新規ユーザーとして招待された際の通知メール
                </p>
              </div>
              <button
                onClick={() => handleToggle('invitations')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.invitations
                    ? 'bg-blue-600 dark:bg-blue-500'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.invitations ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700"></div>

        <div className="flex items-start space-x-4">
          <Shield className="w-6 h-6 text-yellow-600 dark:text-yellow-400 mt-1 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">パスワードリセット通知</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  パスワードがリセットされた際のセキュリティ通知
                </p>
              </div>
              <button
                onClick={() => handleToggle('password_reset')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.password_reset
                    ? 'bg-blue-600 dark:bg-blue-500'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.password_reset ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700"></div>

        <div className="flex items-start space-x-4">
          <Calendar className="w-6 h-6 text-green-600 dark:text-green-400 mt-1 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">週次サマリー</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  毎週月曜日に先週のトレーニング状況をまとめたレポートを受信
                </p>
              </div>
              <button
                onClick={() => handleToggle('weekly_summary')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.weekly_summary
                    ? 'bg-blue-600 dark:bg-blue-500'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.weekly_summary ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-center space-x-3 p-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
          } transition-colors`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center space-x-2"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>保存中...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>設定を保存</span>
            </>
          )}
        </button>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 transition-colors">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          <strong>注意:</strong> セキュリティに関する重要な通知（パスワードリセット等）は、設定に関わらず送信される場合があります。
        </p>
      </div>
    </div>
  );
}
