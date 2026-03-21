import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useMessages } from '../hooks/useMessages';
import { MessageSquare, X, Send, Search, Loader, User, AlertCircle, EyeOff, Eye, MoreVertical } from 'lucide-react';
import { supabase } from '../lib/supabase';

// スワイプ対応スレッドアイテム
function SwipeableThread({
  thread,
  isActive,
  isHidden,
  onSelect,
  onHide,
  onUnhide,
}: {
  thread: any;
  isActive: boolean;
  isHidden: boolean;
  onSelect: () => void;
  onHide: () => void;
  onUnhide: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const swipingRef = useRef(false);
  const [offsetX, setOffsetX] = useState(0);
  const [showAction, setShowAction] = useState(false);

  const THRESHOLD = 70; // スワイプ閾値

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = 0;
    swipingRef.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const diff = e.touches[0].clientX - startXRef.current;
    // 左スワイプのみ
    if (diff < -10) {
      swipingRef.current = true;
      const clamped = Math.max(diff, -100);
      currentXRef.current = clamped;
      setOffsetX(clamped);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (currentXRef.current < -THRESHOLD) {
      setShowAction(true);
      setOffsetX(-THRESHOLD);
    } else {
      setShowAction(false);
      setOffsetX(0);
    }
  }, []);

  const handleClick = useCallback(() => {
    if (swipingRef.current) return; // スワイプ中はクリックしない
    if (showAction) {
      setShowAction(false);
      setOffsetX(0);
      return;
    }
    onSelect();
  }, [showAction, onSelect]);

  const handleAction = useCallback(() => {
    if (isHidden) {
      onUnhide();
    } else {
      onHide();
    }
    setShowAction(false);
    setOffsetX(0);
  }, [isHidden, onHide, onUnhide]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden border-b border-gray-200 dark:border-gray-700 ${
        isActive ? 'bg-blue-50 dark:bg-gray-700' : isHidden ? 'opacity-60' : ''
      }`}
    >
      {/* 背景アクションボタン */}
      <div className="absolute inset-y-0 right-0 flex items-center">
        <button
          onClick={handleAction}
          className={`h-full px-5 text-white text-xs font-medium flex items-center gap-1 ${
            isHidden ? 'bg-blue-500' : 'bg-gray-500'
          }`}
        >
          {isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          {isHidden ? '表示' : '非表示'}
        </button>
      </div>

      {/* スライドするコンテンツ */}
      <div
        className="relative bg-white dark:bg-gray-800 transition-transform duration-150 ease-out"
        style={{ transform: `translateX(${offsetX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
      >
        <div className="p-3 cursor-pointer group">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                  {thread.other_user?.name || '不明なユーザー'}
                </p>
                {(thread.unread_count || 0) > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                    {thread.unread_count}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                {thread.other_user?.role === 'global_admin'
                  ? '管理者'
                  : thread.other_user?.role === 'staff'
                  ? 'コーチ'
                  : 'アスリート'}
              </p>
              {thread.last_message_preview && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                  {thread.last_message_preview}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 ml-2">
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {new Date(thread.last_message_at).toLocaleDateString('ja-JP', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              {/* PC: ホバーで表示 */}
              <button
                onClick={(e) => { e.stopPropagation(); handleAction(); }}
                className="hidden sm:block p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600"
                title={isHidden ? '再表示' : '非表示'}
              >
                {isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MessagingPanelProps {
  userId: string;
  userName: string;
  onClose: () => void;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

export const MessagingPanel = React.memo(function MessagingPanel({
  userId,
  userName,
  onClose,
}: MessagingPanelProps) {
  const {
    threads,
    messages,
    loading,
    error,
    activeThreadId,
    setActiveThreadId,
    totalUnreadCount,
    getOrCreateThread,
    sendMessage,
    markThreadAsRead,
    fetchMessages,
    hideThread,
    unhideThread,
    hiddenThreadIds,
    hiddenCount,
    showHidden,
    setShowHidden,
  } = useMessages(userId);

  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedNewUser, setSelectedNewUser] = useState<string | null>(null);
  const [showThreadList, setShowThreadList] = useState(true);

  // Get active thread details
  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId),
    [threads, activeThreadId]
  );

  // Filter threads by search query
  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;
    const query = searchQuery.toLowerCase();
    return threads.filter(
      (thread) =>
        thread.other_user?.name.toLowerCase().includes(query) ||
        thread.other_user?.email.toLowerCase().includes(query)
    );
  }, [threads, searchQuery]);

  // Fetch available users for new conversation
  const fetchAvailableUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);

      // Get user's organization
      const { data: userOrgs } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userId);

      if (!userOrgs || userOrgs.length === 0) {
        setAvailableUsers([]);
        return;
      }

      const organizationIds = userOrgs.map((org) => org.organization_id);

      // Get all users in the same organizations
      const { data: orgMembers } = await supabase
        .from('organization_members')
        .select('user_id')
        .in('organization_id', organizationIds);

      if (!orgMembers) {
        setAvailableUsers([]);
        return;
      }

      const userIds = [...new Set(orgMembers.map((m) => m.user_id))].filter(
        (id) => id !== userId
      );

      // Get user details
      const { data: users } = await supabase
        .from('users')
        .select('id, name, email, role')
        .in('id', userIds)
        .order('name');

      setAvailableUsers(users || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoadingUsers(false);
    }
  }, [userId]);

  // Handle thread selection
  const handleThreadSelect = useCallback(
    async (threadId: string) => {
      setActiveThreadId(threadId);
      setShowNewMessage(false);
      setShowThreadList(false);
      await fetchMessages(threadId);
      await markThreadAsRead(threadId);
    },
    [setActiveThreadId, fetchMessages, markThreadAsRead]
  );

  // Handle send message
  const handleSendMessage = useCallback(async () => {
    if (!messageInput.trim() || sending) return;

    let threadId = activeThreadId;
    let receiverId = activeThread?.other_user?.id;

    // If new message mode, create thread first
    if (showNewMessage && selectedNewUser) {
      try {
        setSending(true);
        threadId = await getOrCreateThread(selectedNewUser);
        receiverId = selectedNewUser;
        setActiveThreadId(threadId);
        setShowNewMessage(false);
        setSelectedNewUser(null);
        setSending(false);
      } catch (err) {
        console.error('Error creating thread:', err);
        setSending(false);
        alert('スレッドの作成に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'));
        return;
      }
    }

    if (!threadId || !receiverId) return;

    setSending(true);
    const result = await sendMessage(threadId, messageInput, receiverId);
    setSending(false);

    if (result.success) {
      setMessageInput('');
    }
  }, [
    messageInput,
    sending,
    activeThreadId,
    activeThread,
    showNewMessage,
    selectedNewUser,
    getOrCreateThread,
    sendMessage,
    setActiveThreadId,
  ]);

  // Handle key press in input
  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  // Fetch available users when opening new message
  useEffect(() => {
    if (showNewMessage) {
      fetchAvailableUsers();
    }
  }, [showNewMessage, fetchAvailableUsers]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (activeThreadId && messages[activeThreadId]) {
      const messagesContainer = document.getElementById('messages-container');
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }
  }, [activeThreadId, messages]);

  return (
    <div className="w-full">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm w-full h-[calc(100vh-10rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              メッセージ
            </h2>
            {totalUnreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                {totalUnreadCount}
              </span>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Threads List */}
          <div className={`${
            showThreadList ? 'flex' : 'hidden sm:flex'
          } w-full sm:w-1/3 border-r border-gray-200 dark:border-gray-700 flex-col`}>
            {/* Search and New Message */}
            <div className="p-3 space-y-2 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="会話を検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
              <button
                onClick={() => {
                  setShowNewMessage(true);
                  setActiveThreadId(null);
                  setShowThreadList(false); // モバイルではスレッドリストを隠す
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-colors text-sm font-medium"
              >
                新しいメッセージ
              </button>
            </div>

            {/* Threads */}
            <div className="flex-1 overflow-y-auto">
              {loading && threads.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <Loader className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : filteredThreads.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {searchQuery ? '該当する会話がありません' : 'メッセージはありません'}
                  </p>
                </div>
              ) : (
                filteredThreads.map((thread) => {
                  const isHidden = hiddenThreadIds.has(thread.id);
                  return (
                    <SwipeableThread
                      key={thread.id}
                      thread={thread}
                      isActive={activeThreadId === thread.id}
                      isHidden={isHidden}
                      onSelect={() => handleThreadSelect(thread.id)}
                      onHide={() => hideThread(thread.id)}
                      onUnhide={() => unhideThread(thread.id)}
                    />
                  );
                })
              )}

              {/* 非表示スレッド切替 */}
              {hiddenCount > 0 && (
                <button
                  onClick={() => setShowHidden((v) => !v)}
                  className="w-full py-2 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center gap-1 border-t border-gray-200 dark:border-gray-700"
                >
                  {showHidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  {showHidden ? '非表示を隠す' : `非表示のスレッド（${hiddenCount}件）`}
                </button>
              )}
            </div>
          </div>

          {/* Messages Area */}
          <div className={`${
            !showThreadList ? 'flex' : 'hidden sm:flex'
          } flex-1 flex-col`}>
            {showNewMessage ? (
              /* New Message Composer */
              <>
                {/* Mobile Back Button */}
                <div className="sm:hidden p-4 border-b border-gray-200 dark:border-gray-700 flex items-center space-x-3">
                  <button
                    onClick={() => {
                      setShowNewMessage(false);
                      setShowThreadList(true);
                    }}
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    新しいメッセージ
                  </h3>
                </div>
                <div className="flex-1 flex flex-col p-4">
                <h3 className="hidden sm:block text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  新しいメッセージ
                </h3>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    宛先を選択
                  </label>
                  {loadingUsers ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader className="w-6 h-6 animate-spin text-blue-600" />
                    </div>
                  ) : availableUsers.length === 0 ? (
                    <div className="text-center py-8">
                      <User className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        メッセージを送信できるユーザーがいません
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {availableUsers.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => setSelectedNewUser(user.id)}
                          className={`w-full p-3 border rounded-lg text-left transition-colors ${
                            selectedNewUser === user.id
                              ? 'border-blue-500 bg-blue-50 dark:bg-gray-700'
                              : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          <p className="font-semibold text-gray-900 dark:text-white text-sm">
                            {user.name}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {user.email} •{' '}
                            {user.role === 'global_admin'
                              ? '管理者'
                              : user.role === 'staff'
                              ? 'コーチ'
                              : 'アスリート'}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              </>
            ) : activeThread ? (
              /* Active Conversation */
              <>
                {/* Conversation Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center space-x-3">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => {
                      setActiveThreadId(null);
                      setShowThreadList(true);
                    }}
                    className="sm:hidden text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {activeThread.other_user?.name || '不明なユーザー'}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {activeThread.other_user?.role === 'global_admin'
                        ? '管理者'
                        : activeThread.other_user?.role === 'staff'
                        ? 'コーチ'
                        : 'アスリート'}
                    </p>
                  </div>
                </div>

                {/* Messages */}
                <div
                  id="messages-container"
                  className="flex-1 overflow-y-auto p-4 space-y-3"
                >
                  {messages[activeThreadId]?.map((message) => {
                    const isOwn = message.sender_id === userId;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                            isOwn
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {message.content}
                          </p>
                          <p
                            className={`text-xs mt-1 ${
                              isOwn ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            {new Date(message.created_at).toLocaleTimeString(
                              'ja-JP',
                              {
                                hour: '2-digit',
                                minute: '2-digit',
                              }
                            )}
                            {isOwn && message.is_read && ' • 既読'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              /* No Thread Selected */
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    会話を選択してください
                  </p>
                </div>
              </div>
            )}

            {/* Message Input */}
            {(activeThread || (showNewMessage && selectedNewUser)) && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                {error && (
                  <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}
                <div className="flex space-x-2">
                  <textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="メッセージを入力... (Enterで送信)"
                    rows={2}
                    maxLength={2000}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm resize-none"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim() || sending}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                  >
                    {sending ? (
                      <Loader className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {messageInput.length}/2000文字
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
