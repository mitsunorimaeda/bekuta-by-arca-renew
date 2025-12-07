import React, { useState } from 'react';
import { useTeamAccessRequests } from '../hooks/useTeamAccessRequests';
import { Users, Send, Check, X, Clock, AlertCircle, Plus } from 'lucide-react';
import { TeamAccessRequest } from '../lib/teamAccessQueries';

interface TeamAccessRequestManagementProps {
  userId: string;
  organizationId: string;
  isAdmin?: boolean;
}

export function TeamAccessRequestManagement({
  userId,
  organizationId,
  isAdmin = false
}: TeamAccessRequestManagementProps) {
  const {
    myRequests,
    pendingRequests,
    organizationRequests,
    availableTeams,
    loading,
    error,
    createRequest,
    approveRequest,
    rejectRequest,
    cancelRequest
  } = useTeamAccessRequests(userId, organizationId);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [requestMessage, setRequestMessage] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<TeamAccessRequest | null>(null);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'my' | 'pending' | 'all'>('my');

  const handleCreateRequest = async () => {
    if (!selectedTeamId) return;

    setProcessing(true);
    try {
      await createRequest(selectedTeamId, requestMessage);
      setShowCreateModal(false);
      setSelectedTeamId('');
      setRequestMessage('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'リクエストの作成に失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  const handleApprove = async (request: TeamAccessRequest) => {
    setProcessing(true);
    try {
      await approveRequest(request.id, reviewNotes);
      setSelectedRequest(null);
      setReviewNotes('');
    } catch (err) {
      alert(err instanceof Error ? err.message : '承認に失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (request: TeamAccessRequest) => {
    setProcessing(true);
    try {
      await rejectRequest(request.id, reviewNotes);
      setSelectedRequest(null);
      setReviewNotes('');
    } catch (err) {
      alert(err instanceof Error ? err.message : '却下に失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async (requestId: string) => {
    if (!confirm('このリクエストをキャンセルしますか？')) return;

    setProcessing(true);
    try {
      await cancelRequest(requestId);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'キャンセルに失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  // Debug log
  console.log('TeamAccessRequestManagement render:', {
    userId,
    organizationId,
    availableTeamsCount: availableTeams.length,
    loading,
    error
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            <Clock className="h-3 w-3" />
            承認待ち
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
            <Check className="h-3 w-3" />
            承認済み
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
            <X className="h-3 w-3" />
            却下
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="h-6 w-6" />
            チームアクセス管理
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            他のチームへのアクセス権をリクエスト・管理
          </p>
        </div>
        {availableTeams.length > 0 && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            新規リクエスト
          </button>
        )}
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('my')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'my'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            自分のリクエスト ({myRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'pending'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            承認待ち ({pendingRequests.length})
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('all')}
              className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'all'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              すべて ({organizationRequests.length})
            </button>
          )}
        </nav>
      </div>

      {activeTab === 'my' && (
        <div className="space-y-4">
          {myRequests.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              リクエストはありません
            </div>
          ) : (
            myRequests.map((request) => (
              <div
                key={request.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {request.team?.name}
                      </h3>
                      {getStatusBadge(request.status)}
                    </div>
                    {request.request_message && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        {request.request_message}
                      </p>
                    )}
                    {request.review_notes && (
                      <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          <span className="font-medium">レビューメモ:</span> {request.review_notes}
                        </p>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                      {new Date(request.created_at).toLocaleString('ja-JP')}
                    </p>
                  </div>
                  {request.status === 'pending' && (
                    <button
                      onClick={() => handleCancel(request.id)}
                      disabled={processing}
                      className="ml-4 px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                    >
                      キャンセル
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'pending' && (
        <div className="space-y-4">
          {pendingRequests.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              承認待ちのリクエストはありません
            </div>
          ) : (
            pendingRequests.map((request) => (
              <div
                key={request.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {request.requester?.name}
                      </h3>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        が {request.team?.name} へのアクセスをリクエスト
                      </span>
                    </div>
                    {request.request_message && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        {request.request_message}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                      {new Date(request.created_at).toLocaleString('ja-JP')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      承認
                    </button>
                    <button
                      onClick={() => {
                        setSelectedRequest(request);
                        setReviewNotes('');
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      却下
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'all' && isAdmin && (
        <div className="space-y-4">
          {organizationRequests.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              リクエストはありません
            </div>
          ) : (
            organizationRequests.map((request) => (
              <div
                key={request.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {request.requester?.name}
                      </h3>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        → {request.team?.name}
                      </span>
                      {getStatusBadge(request.status)}
                    </div>
                    {request.request_message && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        {request.request_message}
                      </p>
                    )}
                    {request.review_notes && (
                      <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          <span className="font-medium">レビュー:</span> {request.review_notes}
                          {request.reviewer && ` by ${request.reviewer.name}`}
                        </p>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                      {new Date(request.created_at).toLocaleString('ja-JP')}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              チームアクセスをリクエスト
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  チームを選択
                </label>
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">選択してください</option>
                  {availableTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  メッセージ（任意）
                </label>
                <textarea
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="リクエストの理由や詳細を入力..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={processing}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleCreateRequest}
                disabled={processing || !selectedTeamId}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {processing ? '送信中...' : 'リクエスト送信'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              リクエストのレビュー
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">リクエスト者:</span> {selectedRequest.requester?.name}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">チーム:</span> {selectedRequest.team?.name}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  メモ（任意）
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="レビューコメントを入力..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setSelectedRequest(null);
                  setReviewNotes('');
                }}
                disabled={processing}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleReject(selectedRequest)}
                disabled={processing}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                却下
              </button>
              <button
                onClick={() => handleApprove(selectedRequest)}
                disabled={processing}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                承認
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
