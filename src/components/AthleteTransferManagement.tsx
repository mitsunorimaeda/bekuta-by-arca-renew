import React, { useState } from 'react';
import { useAthleteTransfers } from '../hooks/useAthleteTransfers';
import { UserCog, ArrowRight, Check, X, Clock, AlertCircle, History } from 'lucide-react';
import { AthleteTransferRequest, TransferHistory } from '../lib/athleteTransferQueries';

interface AthleteTransferManagementProps {
  userId: string;
  organizationId: string;
  isAdmin?: boolean;
}

export function AthleteTransferManagement({
  userId,
  organizationId,
  isAdmin = false
}: AthleteTransferManagementProps) {
  const {
    myRequests,
    pendingRequests,
    organizationRequests,
    myAthletes,
    loading,
    error,
    createTransferRequest,
    approveTransfer,
    rejectTransfer,
    cancelTransferRequest,
    getTransferHistory,
    getAvailableDestinationTeams
  } = useAthleteTransfers(userId, organizationId);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAthlete, setSelectedAthlete] = useState<any>(null);
  const [destinationTeamId, setDestinationTeamId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<AthleteTransferRequest | null>(null);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'my' | 'pending' | 'all'>('my');
  const [availableTeams, setAvailableTeams] = useState<any[]>([]);
  const [viewingHistory, setViewingHistory] = useState(false);
  const [historyData, setHistoryData] = useState<TransferHistory[]>([]);

  const handleSelectAthlete = async (athlete: any) => {
    setSelectedAthlete(athlete);
    try {
      const teams = await getAvailableDestinationTeams(athlete.team_id);
      setAvailableTeams(teams);
      setShowCreateModal(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : '利用可能なチームの取得に失敗しました');
    }
  };

  const handleCreateRequest = async () => {
    if (!selectedAthlete || !destinationTeamId) return;

    setProcessing(true);
    try {
      await createTransferRequest(
        selectedAthlete.id,
        selectedAthlete.team_id,
        destinationTeamId,
        transferReason
      );
      setShowCreateModal(false);
      setSelectedAthlete(null);
      setDestinationTeamId('');
      setTransferReason('');
      setAvailableTeams([]);
    } catch (err) {
      alert(err instanceof Error ? err.message : '移籍リクエストの作成に失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  const handleApprove = async (request: AthleteTransferRequest) => {
    if (!confirm(`${request.athlete?.name}の移籍を承認しますか？`)) return;

    setProcessing(true);
    try {
      await approveTransfer(request.id, reviewNotes);
      setSelectedRequest(null);
      setReviewNotes('');
    } catch (err) {
      alert(err instanceof Error ? err.message : '承認に失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (request: AthleteTransferRequest) => {
    setProcessing(true);
    try {
      await rejectTransfer(request.id, reviewNotes);
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
      await cancelTransferRequest(requestId);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'キャンセルに失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  const handleViewHistory = async (athleteId: string) => {
    try {
      const history = await getTransferHistory(athleteId);
      setHistoryData(history);
      setViewingHistory(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : '履歴の取得に失敗しました');
    }
  };

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
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
            <Check className="h-3 w-3" />
            承認済み
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
            <Check className="h-3 w-3" />
            完了
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
            <UserCog className="h-6 w-6" />
            選手移籍管理
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            選手のチーム間移籍をリクエスト・管理
          </p>
        </div>
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
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              担当選手
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myAthletes.map((athlete) => (
                <div
                  key={athlete.id}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    {athlete.name}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {athlete.team?.name}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleSelectAthlete(athlete)}
                      className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      移籍申請
                    </button>
                    <button
                      onClick={() => handleViewHistory(athlete.id)}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <History className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              移籍リクエスト履歴
            </h3>
            <div className="space-y-4">
              {myRequests.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
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
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {request.athlete?.name}
                          </span>
                          {getStatusBadge(request.status)}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <span>{request.from_team?.name}</span>
                          <ArrowRight className="h-4 w-4" />
                          <span>{request.to_team?.name}</span>
                        </div>
                        {request.request_reason && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                            理由: {request.request_reason}
                          </p>
                        )}
                        {request.review_notes && (
                          <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              <span className="font-medium">レビュー:</span> {request.review_notes}
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
          </div>
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
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {request.athlete?.name}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        の移籍リクエスト
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                      <span>{request.from_team?.name}</span>
                      <ArrowRight className="h-4 w-4" />
                      <span>{request.to_team?.name}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      リクエスト者: {request.requester?.name}
                    </p>
                    {request.request_reason && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        理由: {request.request_reason}
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
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {request.athlete?.name}
                      </span>
                      {getStatusBadge(request.status)}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                      <span>{request.from_team?.name}</span>
                      <ArrowRight className="h-4 w-4" />
                      <span>{request.to_team?.name}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      リクエスト者: {request.requester?.name}
                    </p>
                    {request.request_reason && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        理由: {request.request_reason}
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

      {showCreateModal && selectedAthlete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              移籍リクエストを作成
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  選手
                </label>
                <p className="text-gray-900 dark:text-white">{selectedAthlete.name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  現在のチーム: {selectedAthlete.team?.name}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  移籍先チーム
                </label>
                <select
                  value={destinationTeamId}
                  onChange={(e) => setDestinationTeamId(e.target.value)}
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
                  移籍理由
                </label>
                <textarea
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="移籍の理由を入力..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setSelectedAthlete(null);
                  setDestinationTeamId('');
                  setTransferReason('');
                  setAvailableTeams([]);
                }}
                disabled={processing}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleCreateRequest}
                disabled={processing || !destinationTeamId}
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
              移籍リクエストのレビュー
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">選手:</span> {selectedRequest.athlete?.name}
                </p>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-1">
                  <span>{selectedRequest.from_team?.name}</span>
                  <ArrowRight className="h-4 w-4" />
                  <span>{selectedRequest.to_team?.name}</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  <span className="font-medium">リクエスト者:</span> {selectedRequest.requester?.name}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  レビューメモ（任意）
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

      {viewingHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                移籍履歴
              </h3>
              <button
                onClick={() => setViewingHistory(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {historyData.length === 0 ? (
                <p className="text-center py-8 text-gray-500 dark:text-gray-400">
                  移籍履歴はありません
                </p>
              ) : (
                historyData.map((history) => (
                  <div
                    key={history.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                  >
                    <div className="flex items-center gap-2 text-sm mb-1">
                      {history.from_team ? (
                        <>
                          <span className="text-gray-600 dark:text-gray-400">
                            {history.from_team.name}
                          </span>
                          <ArrowRight className="h-4 w-4" />
                        </>
                      ) : (
                        <span className="text-gray-600 dark:text-gray-400">新規登録</span>
                      )}
                      <span className="text-gray-900 dark:text-white font-medium">
                        {history.to_team.name}
                      </span>
                    </div>
                    {history.transfer_reason && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {history.transfer_reason}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {new Date(history.transfer_date).toLocaleString('ja-JP')} by{' '}
                      {history.transferred_by_user?.name}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
