// src/components/InviteLinkGenerator.tsx
// 組織管理者向け：シェアリンク招待トークン生成・管理UI

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Team } from '../lib/supabase';
import { Link, Copy, Check, Trash2, Plus, RefreshCw, Users, UserCheck, Clock, Infinity } from 'lucide-react';

interface TokenRecord {
  id: string;
  token: string;
  role: 'athlete' | 'staff';
  team_id: string | null;
  organization_id: string;
  is_active: boolean;
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
  label: string | null;
  created_at: string;
  teams: { name: string } | null;
}

interface Props {
  organizationId: string;
  teams: Team[];
  planLimits?: {
    currentAthletes: number;
    athleteLimit: number | null;
    isAtLimit: boolean;
    isOverLimit: boolean;
    staffLimit: number | null;
    teamsLimit: number | null;
  };
}

const ROLE_LABEL: Record<string, string> = {
  athlete: '選手',
  staff: 'スタッフ（コーチ・トレーナー）',
};

export function InviteLinkGenerator({ organizationId, teams, planLimits }: Props) {
  const [tokens, setTokens] = useState<TokenRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // フォーム
  const [role, setRole] = useState<'athlete' | 'staff'>('athlete');
  const [selectedTeamId, setSelectedTeamId] = useState(teams[0]?.id ?? '');
  const [expiresIn, setExpiresIn] = useState<'none' | '7' | '30' | '90'>('none');
  const [maxUses, setMaxUses] = useState('');
  const [label, setLabel] = useState('');

  const fetchTokens = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('team_invite_tokens')
      .select('*, teams:team_id(name)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (!err) setTokens((data as TokenRecord[]) ?? []);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  useEffect(() => {
    if (teams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId]);

  const handleGenerate = async () => {
    setError(null);

    // プラン制限チェック
    if (planLimits) {
      if (role === 'athlete' && planLimits.athleteLimit !== null && planLimits.isAtLimit) {
        setError(`選手数が上限（${planLimits.athleteLimit}人）に達しています。プランをアップグレードしてください。`);
        return;
      }
      if (role === 'staff' && planLimits.staffLimit !== null) {
        // 現在のスタッフ数をカウント
        const { count } = await supabase
          .from('organization_members')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .in('role', ['staff', 'organization_admin']);
        if (count !== null && count >= planLimits.staffLimit) {
          setError(`スタッフ数が上限（${planLimits.staffLimit}人）に達しています。プランをアップグレードしてください。`);
          return;
        }
      }
    }

    setGenerating(true);
    try {
      const expiresAt =
        expiresIn !== 'none'
          ? new Date(Date.now() + parseInt(expiresIn) * 86400 * 1000).toISOString()
          : null;

      const { error: insertError } = await supabase.from('team_invite_tokens').insert({
        organization_id: organizationId,
        team_id: selectedTeamId || null,
        role,
        expires_at: expiresAt,
        max_uses: maxUses ? parseInt(maxUses) : null,
        label: label.trim() || null,
      });

      if (insertError) {
        setError(`リンクの生成に失敗しました: ${insertError.message}`);
        return;
      }

      setLabel('');
      setMaxUses('');
      await fetchTokens();
    } finally {
      setGenerating(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    const { error: err } = await supabase
      .from('team_invite_tokens')
      .update({ is_active: false })
      .eq('id', id);
    if (!err) {
      setTokens((prev) => prev.map((t) => (t.id === id ? { ...t, is_active: false } : t)));
    }
  };

  const handleCopy = async (token: string, id: string) => {
    const url = `${window.location.origin}/join?token=${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const joinUrl = (token: string) => `${window.location.origin}/join?token=${token}`;

  const activeTokens = tokens.filter((t) => t.is_active);
  const inactiveTokens = tokens.filter((t) => !t.is_active);

  return (
    <div className="space-y-6">
      {/* 新規リンク生成フォーム */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Plus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">新しい招待リンクを生成</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {/* ロール */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ロール <span className="text-red-500">*</span>
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'athlete' | 'staff')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="athlete">選手（登録後すぐログイン可）</option>
              <option value="staff">スタッフ（管理者承認後にログイン可）</option>
            </select>
          </div>

          {/* チーム */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              チーム
            </label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">（チームなし）</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* 有効期限 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              有効期限
            </label>
            <select
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value as typeof expiresIn)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="none">無期限</option>
              <option value="7">7日間</option>
              <option value="30">30日間</option>
              <option value="90">90日間</option>
            </select>
          </div>

          {/* 最大利用人数 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              最大利用人数（空欄＝無制限）
            </label>
            <input
              type="number"
              min="1"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="例: 30"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* ラベル */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ラベル（任意・管理用メモ）
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="例: 2026年入学選手用"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {generating ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : (
            <Link className="w-4 h-4" />
          )}
          {generating ? '生成中...' : '招待リンクを生成'}
        </button>
      </div>

      {/* 有効なリンク一覧 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            有効な招待リンク（{activeTokens.length}件）
          </h3>
          <button
            onClick={fetchTokens}
            className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <RefreshCw className="w-3 h-3" />
            更新
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />
          </div>
        ) : activeTokens.length === 0 ? (
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center text-sm text-gray-500 dark:text-gray-400">
            有効な招待リンクがありません。上のフォームから生成してください。
          </div>
        ) : (
          <div className="space-y-3">
            {activeTokens.map((t) => (
              <TokenCard
                key={t.id}
                token={t}
                joinUrl={joinUrl(t.token)}
                copied={copiedId === t.id}
                onCopy={() => handleCopy(t.token, t.id)}
                onDeactivate={() => handleDeactivate(t.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 無効化済みリンク */}
      {inactiveTokens.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">
            無効化済み（{inactiveTokens.length}件）
          </h3>
          <div className="space-y-2">
            {inactiveTokens.slice(0, 5).map((t) => (
              <div
                key={t.id}
                className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 opacity-60"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {t.role === 'athlete' ? (
                      <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    ) : (
                      <UserCheck className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {ROLE_LABEL[t.role]}
                      {t.teams?.name ? ` — ${t.teams.name}` : ''}
                      {t.label ? ` [${t.label}]` : ''}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {t.use_count}回使用
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== 個別トークンカード =====
interface TokenCardProps {
  token: TokenRecord;
  joinUrl: string;
  copied: boolean;
  onCopy: () => void;
  onDeactivate: () => void;
}

function TokenCard({ token: t, joinUrl, copied, onCopy, onDeactivate }: TokenCardProps) {
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  const isExpired = t.expires_at ? new Date(t.expires_at) < new Date() : false;
  const isOverLimit = t.max_uses !== null && t.use_count >= t.max_uses;

  const statusBadge = isExpired
    ? <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full">期限切れ</span>
    : isOverLimit
    ? <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full">上限到達</span>
    : <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">有効</span>;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      {/* ヘッダー行 */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {t.role === 'athlete' ? (
            <Users className="w-4 h-4 text-blue-500 flex-shrink-0" />
          ) : (
            <UserCheck className="w-4 h-4 text-purple-500 flex-shrink-0" />
          )}
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {ROLE_LABEL[t.role]}
          </span>
          {t.teams?.name && (
            <span className="text-xs text-gray-500 dark:text-gray-400">— {t.teams.name}</span>
          )}
          {t.label && (
            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
              {t.label}
            </span>
          )}
          {statusBadge}
        </div>
      </div>

      {/* URL */}
      <div className="flex items-center gap-2 mb-3">
        <input
          type="text"
          readOnly
          value={joinUrl}
          className="flex-1 min-w-0 px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded text-gray-600 dark:text-gray-300 font-mono"
          onFocus={(e) => e.target.select()}
        />
        <button
          onClick={onCopy}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded transition-colors flex-shrink-0"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'コピー済み' : 'コピー'}
        </button>
      </div>

      {/* メタ情報 */}
      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          <span>
            {t.use_count}
            {t.max_uses !== null ? ` / ${t.max_uses}` : ''} 人使用
            {t.max_uses === null && <Infinity className="w-3 h-3 inline ml-1" />}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>
            {t.expires_at
              ? `${new Date(t.expires_at).toLocaleDateString('ja-JP')} まで`
              : '無期限'}
          </span>
        </div>
      </div>

      {/* 無効化ボタン */}
      <div className="flex justify-end">
        {confirmDeactivate ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-600 dark:text-red-400">本当に無効化しますか？</span>
            <button
              onClick={() => { onDeactivate(); setConfirmDeactivate(false); }}
              className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition-colors"
            >
              無効化する
            </button>
            <button
              onClick={() => setConfirmDeactivate(false)}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 px-2 py-1 rounded"
            >
              キャンセル
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDeactivate(true)}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            無効化
          </button>
        )}
      </div>
    </div>
  );
}
