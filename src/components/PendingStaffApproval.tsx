// src/components/PendingStaffApproval.tsx
// 承認待ちスタッフの一覧表示・承認UI

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { UserCheck, Clock, RefreshCw, CheckCircle } from 'lucide-react';

interface PendingStaff {
  id: string;
  name: string;
  email: string;
  created_at: string;
  team_id: string | null;
  teams: { name: string } | null;
}

interface Props {
  organizationId: string;
}

export function PendingStaffApproval({ organizationId }: Props) {
  const [pendingList, setPendingList] = useState<PendingStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    setError(null);

    // organization_members から organization_id でフィルタ → users を JOIN
    const { data, error: err } = await supabase
      .from('users')
      .select(`
        id, name, email, created_at, team_id,
        teams:team_id(name)
      `)
      .eq('role', 'staff')
      .eq('is_active', false)
      .order('created_at', { ascending: true });

    if (err) {
      setError('データの取得に失敗しました');
    } else {
      // organization フィルタ: organization_members テーブルから絞り込む
      const { data: memberIds } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', organizationId);

      const orgUserIds = new Set((memberIds ?? []).map((m: any) => m.user_id));
      const filtered = (data ?? []).filter((u: any) => orgUserIds.has(u.id));
      setPendingList(filtered as PendingStaff[]);
    }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleApprove = async (userId: string) => {
    setApprovingId(userId);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({ is_active: true })
        .eq('id', userId);

      if (updateError) {
        setError(`承認に失敗しました: ${updateError.message}`);
        return;
      }

      setApprovedIds((prev) => new Set([...prev, userId]));
      setPendingList((prev) => prev.filter((u) => u.id !== userId));
    } finally {
      setApprovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-orange-500" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            承認待ちスタッフ
          </h3>
          {pendingList.length > 0 && (
            <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-medium px-2 py-0.5 rounded-full">
              {pendingList.length}件
            </span>
          )}
        </div>
        <button
          onClick={fetchPending}
          className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <RefreshCw className="w-3 h-3" />
          更新
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-lg p-3">
          {error}
        </div>
      )}

      {approvedIds.size > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-sm rounded-lg p-3 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {approvedIds.size}件を承認しました
        </div>
      )}

      {pendingList.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center">
          <UserCheck className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            現在、承認待ちのスタッフはいません。
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingList.map((staff) => (
            <div
              key={staff.id}
              className="bg-white dark:bg-gray-800 border border-orange-200 dark:border-orange-900/50 rounded-xl p-4 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-gray-900 dark:text-white">
                    {staff.name}
                  </span>
                  {staff.teams?.name && (
                    <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                      {staff.teams.name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{staff.email}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  申請日: {new Date(staff.created_at).toLocaleDateString('ja-JP')}
                </p>
              </div>

              <button
                onClick={() => handleApprove(staff.id)}
                disabled={approvingId === staff.id}
                className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors flex-shrink-0"
              >
                {approvingId === staff.id ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                ) : (
                  <UserCheck className="w-3.5 h-3.5" />
                )}
                承認する
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
