import React, { useState } from 'react';
import { User, supabase } from '../lib/supabase';
import { X, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';

interface UserDeleteModalProps {
  user: User;
  onClose: () => void;
  onUserDeleted: () => void;
}

export function UserDeleteModal({ user, onClose, onUserDeleted }: UserDeleteModalProps) {
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleDelete = async () => {
    if (confirmText !== user.name) {
      setMessage({
        type: 'error',
        text: 'ユーザー名が一致しません。'
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('認証が必要です');
      }

      // Call the delete user function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const response = await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'ユーザーの削除に失敗しました');
      }

      setMessage({
        type: 'success',
        text: 'ユーザーを削除しました。'
      });

      setTimeout(() => {
        onUserDeleted();
      }, 1000);

    } catch (error: any) {
      console.error('Error deleting user:', error);
      setMessage({
        type: 'error',
        text: `削除に失敗しました: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="bg-red-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <AlertTriangle className="w-6 h-6 mr-3" />
              <h2 className="text-xl font-bold">ユーザー削除</h2>
            </div>
            <button
              onClick={onClose}
              className="bg-red-500 hover:bg-red-400 rounded-full p-2 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
                <div>
                  <h3 className="font-medium text-red-900 mb-2">警告: この操作は取り消せません</h3>
                  <div className="text-sm text-red-700 space-y-1">
                    <p>• ユーザーアカウントが完全に削除されます</p>
                    <p>• 関連する練習記録も全て削除されます</p>
                    <p>• チームとの関連付けも削除されます</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">削除対象ユーザー</h4>
              <div className="text-sm text-gray-700">
                <p><strong>名前:</strong> {user.name}</p>
                <p><strong>メール:</strong> {user.email}</p>
                <p><strong>役割:</strong> {
                  user.role === 'athlete' ? '選手' : 
                  user.role === 'staff' ? 'スタッフ' : '管理者'
                }</p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              削除を確認するため、ユーザー名「<strong>{user.name}</strong>」を入力してください
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder={user.name}
            />
          </div>

          {message && (
            <div className={`flex items-center space-x-3 p-3 rounded-lg mb-4 ${
              message.type === 'success' 
                ? 'bg-green-50 border border-green-200 text-green-600'
                : 'bg-red-50 border border-red-200 text-red-600'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              )}
              <span className="text-sm">{message.text}</span>
            </div>
          )}

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleDelete}
              disabled={loading || confirmText !== user.name}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              {loading ? '削除中...' : '削除する'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}