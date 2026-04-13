import React, { useState } from 'react';
import { EmailNotificationSettings } from '../EmailNotificationSettings';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';

type UserProfile = Database['public']['Tables']['users']['Row'];

type Props = {
  user: UserProfile;
  onOpenProfileEdit: () => void;
};

export function AthleteSettingsView({ user, onOpenProfileEdit }: Props) {
  const [shareEnabled, setShareEnabled] = useState<boolean>(
    user.share_cycle_data_with_coaches ?? false
  );
  const [shareLoading, setShareLoading] = useState(false);
  const [shareMessage, setShareMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== '削除する') return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.rpc('request_account_deletion', { p_user_id: user.id });
      if (error) throw error;
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (err: any) {
      console.error('Account deletion failed:', err?.message);
      alert('削除に失敗しました。サポートにお問い合わせください。');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleShareToggle = async () => {
    const newValue = !shareEnabled;
    setShareLoading(true);
    setShareMessage(null);
    try {
      const { error } = await supabase
        .from('users')
        .update({ share_cycle_data_with_coaches: newValue })
        .eq('id', user.id);
      if (error) throw error;
      setShareEnabled(newValue);
      setShareMessage({
        type: 'success',
        text: newValue
          ? 'コーチとのデータ共有をONにしました'
          : 'コーチとのデータ共有をOFFにしました',
      });
    } catch (err) {
      console.error('share_cycle_data update error:', err);
      setShareMessage({ type: 'error', text: '設定の更新に失敗しました' });
    } finally {
      setShareLoading(false);
      setTimeout(() => setShareMessage(null), 3000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transition-colors">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">プロフィール設定</h2>
          <button
            onClick={onOpenProfileEdit}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            編集
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">名前</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{user.name ?? '-'}</p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">メールアドレス</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{user.email ?? '-'}</p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">性別</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {user.gender === 'male'
                  ? '男性'
                  : user.gender === 'female'
                  ? '女性'
                  : user.gender === 'other'
                  ? 'その他'
                  : user.gender === 'prefer_not_to_say'
                  ? '回答しない'
                  : '未設定'}
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">身長</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {user.height_cm ? `${user.height_cm} cm` : '未設定'}
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">生年月日</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {user.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString('ja-JP') : '未設定'}
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">電話番号</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {user.phone_number ? user.phone_number : '未設定'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* コーチとコンディションデータを共有 */}
      {(user.gender === 'female') && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transition-colors">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            コンディションデータの共有設定
          </h2>
          <div className="flex items-start space-x-4">
            <div className="flex-1">
              <h3 className="font-medium text-gray-900 dark:text-white">
                コーチと月経周期・基礎体温データを共有
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                ONにすると、担当コーチが月経周期・基礎体温データを閲覧できます。
                パフォーマンス向上のサポートに活用されます。
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                ※ デフォルトはOFF。いつでも変更できます。
              </p>
            </div>
            <button
              onClick={handleShareToggle}
              disabled={shareLoading}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                shareEnabled ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'
              } ${shareLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              aria-pressed={shareEnabled}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  shareEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {shareMessage && (
            <p
              className={`mt-3 text-sm ${
                shareMessage.type === 'success'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {shareMessage.text}
            </p>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transition-colors">
        <EmailNotificationSettings userId={user.id} />
      </div>

      {/* アカウント削除 */}
      <div className="border border-red-200 dark:border-red-800 rounded-xl p-5 mt-8">
        <h3 className="text-base font-semibold text-red-700 dark:text-red-400 mb-1">アカウント削除</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          アカウントを削除すると、すべての練習記録・体重・コンディションデータが完全に削除されます。この操作は取り消せません。
        </p>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            アカウントを削除する
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              本当に削除しますか？「削除する」と入力して確認してください:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="削除する"
              className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== '削除する' || deleteLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleteLoading ? '削除中...' : '完全に削除する'}
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}