import React from 'react';
import { EmailNotificationSettings } from '../EmailNotificationSettings';
import type { Database } from '../../lib/database.types';

type UserProfile = Database['public']['Tables']['users']['Row'];

type Props = {
  user: UserProfile;
  onOpenProfileEdit: () => void;
};

export function AthleteSettingsView({ user, onOpenProfileEdit }: Props) {
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

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transition-colors">
        <EmailNotificationSettings userId={user.id} userEmail={user.email ?? ''} />
      </div>
    </div>
  );
}