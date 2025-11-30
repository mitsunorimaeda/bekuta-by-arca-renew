import React, { useState } from 'react';
import { MessageCircle, Send, ThumbsUp, AlertCircle, Info, X } from 'lucide-react';
import { useCoachComments, CoachComment } from '../hooks/useCoachComments';

interface CoachCommentPanelProps {
  userId: string;
  userRole: 'athlete' | 'staff';
  athleteId?: string;
  athleteName?: string;
  onClose?: () => void;
}

export function CoachCommentPanel({ userId, userRole, athleteId, athleteName, onClose }: CoachCommentPanelProps) {
  const { comments, loading, addComment, markAsRead, getUnreadCount } = useCoachComments(userId, userRole);
  const [newComment, setNewComment] = useState('');
  const [sentiment, setSentiment] = useState<CoachComment['sentiment']>('neutral');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const unreadCount = getUnreadCount();
  const displayComments = userRole === 'staff' && athleteId
    ? comments.filter((c) => c.athlete_id === athleteId)
    : comments;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !athleteId) return;

    setIsSubmitting(true);
    try {
      await addComment(athleteId, newComment.trim(), sentiment);
      setNewComment('');
      setSentiment('neutral');
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSentimentIcon = (s: CoachComment['sentiment']) => {
    switch (s) {
      case 'positive':
        return <ThumbsUp className="w-4 h-4 text-green-500" />;
      case 'constructive':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getSentimentBg = (s: CoachComment['sentiment']) => {
    switch (s) {
      case 'positive':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'constructive':
        return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800';
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <MessageCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {userRole === 'athlete' ? 'コーチからのコメント' : `${athleteName || 'アスリート'}へのコメント`}
          </h3>
          {unreadCount > 0 && userRole === 'athlete' && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        )}
      </div>

      {/* Comments List */}
      <div className="p-4 max-h-96 overflow-y-auto space-y-3">
        {displayComments.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">まだコメントがありません</p>
          </div>
        ) : (
          displayComments.map((comment) => (
            <div
              key={comment.id}
              onClick={() => {
                if (userRole === 'athlete' && !comment.is_read) {
                  markAsRead(comment.id);
                }
              }}
              className={`p-4 rounded-lg border transition-all ${getSentimentBg(comment.sentiment)} ${
                !comment.is_read && userRole === 'athlete' ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {getSentimentIcon(comment.sentiment)}
                  {userRole === 'athlete' && comment.coach && (
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {comment.coach.name}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(comment.created_at).toLocaleDateString('ja-JP')}
                </span>
              </div>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{comment.comment}</p>
              {!comment.is_read && userRole === 'athlete' && (
                <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-semibold">
                  新着
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Comment Form (Coach only) */}
      {userRole === 'staff' && athleteId && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex space-x-2 mb-2">
              <button
                type="button"
                onClick={() => setSentiment('positive')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  sentiment === 'positive'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <ThumbsUp className="w-4 h-4 inline mr-1" />
                ポジティブ
              </button>
              <button
                type="button"
                onClick={() => setSentiment('neutral')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  sentiment === 'neutral'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Info className="w-4 h-4 inline mr-1" />
                中立
              </button>
              <button
                type="button"
                onClick={() => setSentiment('constructive')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  sentiment === 'constructive'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <AlertCircle className="w-4 h-4 inline mr-1" />
                建設的
              </button>
            </div>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="コメントを入力..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-colors resize-none"
            />
            <button
              type="submit"
              disabled={!newComment.trim() || isSubmitting}
              className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? '送信中...' : 'コメントを送信'}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
