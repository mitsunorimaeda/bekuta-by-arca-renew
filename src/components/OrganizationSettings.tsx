import React, { useState } from 'react';
import { useOrganizations } from '../hooks/useOrganizations';
import { Settings, Bell, Shield, Palette, Globe } from 'lucide-react';
import type { Database } from '../lib/database.types';

type Organization = Database['public']['Tables']['organizations']['Row'];

interface OrganizationSettingsProps {
  organizationId: string;
}

export function OrganizationSettings({ organizationId }: OrganizationSettingsProps) {
  const { organizations, updateOrganization } = useOrganizations(undefined);
  const organization = organizations.find(org => org.id === organizationId);

  const [activeTab, setActiveTab] = useState<'general' | 'notifications' | 'security' | 'appearance'>('general');
  const [saving, setSaving] = useState(false);

  if (!organization) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600 dark:text-gray-400">組織が見つかりません</div>
      </div>
    );
  }

  const tabs = [
    { id: 'general' as const, name: '一般設定', icon: Globe },
    { id: 'notifications' as const, name: '通知', icon: Bell },
    { id: 'security' as const, name: 'セキュリティ', icon: Shield },
    { id: 'appearance' as const, name: '外観', icon: Palette },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Settings className="h-6 w-6" />
          組織設定
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">{organization.name}の詳細設定</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
        <div className="border-b dark:border-gray-700">
          <nav className="flex px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 mr-8 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'general' && (
            <GeneralSettings
              organization={organization}
              onUpdate={updateOrganization}
              saving={saving}
              setSaving={setSaving}
            />
          )}
          {activeTab === 'notifications' && (
            <NotificationSettings
              organization={organization}
              onUpdate={updateOrganization}
              saving={saving}
              setSaving={setSaving}
            />
          )}
          {activeTab === 'security' && (
            <SecuritySettings
              organization={organization}
              onUpdate={updateOrganization}
              saving={saving}
              setSaving={setSaving}
            />
          )}
          {activeTab === 'appearance' && (
            <AppearanceSettings
              organization={organization}
              onUpdate={updateOrganization}
              saving={saving}
              setSaving={setSaving}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function GeneralSettings({
  organization,
  onUpdate,
  saving,
  setSaving
}: {
  organization: Organization;
  onUpdate: (id: string, updates: any) => Promise<any>;
  saving: boolean;
  setSaving: (saving: boolean) => void;
}) {
  const [name, setName] = useState(organization.name);
  const [description, setDescription] = useState(organization.description || '');
  const settings = organization.settings || {};
  const [timezone, setTimezone] = useState(settings.timezone || 'Asia/Tokyo');
  const [language, setLanguage] = useState(settings.language || 'ja');

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(organization.id, {
        name,
        description,
        settings: {
          ...settings,
          timezone,
          language
        }
      });
      alert('設定を保存しました');
    } catch (err) {
      alert(err instanceof Error ? err.message : '設定の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          組織名
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          説明
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          タイムゾーン
        </label>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="Asia/Tokyo">日本標準時 (JST)</option>
          <option value="America/New_York">東部標準時 (EST)</option>
          <option value="America/Los_Angeles">太平洋標準時 (PST)</option>
          <option value="Europe/London">グリニッジ標準時 (GMT)</option>
          <option value="UTC">協定世界時 (UTC)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          言語
        </label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="ja">日本語</option>
          <option value="en">English</option>
        </select>
      </div>

      <div className="pt-4 border-t dark:border-gray-700">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {saving ? '保存中...' : '設定を保存'}
        </button>
      </div>
    </div>
  );
}

function NotificationSettings({
  organization,
  onUpdate,
  saving,
  setSaving
}: {
  organization: Organization;
  onUpdate: (id: string, updates: any) => Promise<any>;
  saving: boolean;
  setSaving: (saving: boolean) => void;
}) {
  const settings = organization.settings || {};
  const notifications = settings.notifications || {};

  const [emailAlerts, setEmailAlerts] = useState(notifications.emailAlerts !== false);
  const [highPriorityOnly, setHighPriorityOnly] = useState(notifications.highPriorityOnly || false);
  const [weeklyReport, setWeeklyReport] = useState(notifications.weeklyReport || false);
  const [usageLimitWarnings, setUsageLimitWarnings] = useState(notifications.usageLimitWarnings !== false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(organization.id, {
        settings: {
          ...settings,
          notifications: {
            emailAlerts,
            highPriorityOnly,
            weeklyReport,
            usageLimitWarnings
          }
        }
      });
      alert('通知設定を保存しました');
    } catch (err) {
      alert(err instanceof Error ? err.message : '設定の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <label className="flex items-center justify-between">
          <div>
            <div className="font-medium text-gray-900 dark:text-white">メールアラート</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              ACWRアラートをメールで受信
            </div>
          </div>
          <input
            type="checkbox"
            checked={emailAlerts}
            onChange={(e) => setEmailAlerts(e.target.checked)}
            className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
          />
        </label>

        <label className="flex items-center justify-between">
          <div>
            <div className="font-medium text-gray-900 dark:text-white">高優先度のみ</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              高優先度アラートのみを通知
            </div>
          </div>
          <input
            type="checkbox"
            checked={highPriorityOnly}
            onChange={(e) => setHighPriorityOnly(e.target.checked)}
            disabled={!emailAlerts}
            className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
          />
        </label>

        <label className="flex items-center justify-between">
          <div>
            <div className="font-medium text-gray-900 dark:text-white">週次レポート</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              毎週月曜日にサマリーレポートを受信
            </div>
          </div>
          <input
            type="checkbox"
            checked={weeklyReport}
            onChange={(e) => setWeeklyReport(e.target.checked)}
            className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
          />
        </label>

        <label className="flex items-center justify-between">
          <div>
            <div className="font-medium text-gray-900 dark:text-white">使用量制限警告</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              プラン制限に近づいた際に通知
            </div>
          </div>
          <input
            type="checkbox"
            checked={usageLimitWarnings}
            onChange={(e) => setUsageLimitWarnings(e.target.checked)}
            className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
          />
        </label>
      </div>

      <div className="pt-4 border-t dark:border-gray-700">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {saving ? '保存中...' : '設定を保存'}
        </button>
      </div>
    </div>
  );
}

function SecuritySettings({
  organization,
  onUpdate,
  saving,
  setSaving
}: {
  organization: Organization;
  onUpdate: (id: string, updates: any) => Promise<any>;
  saving: boolean;
  setSaving: (saving: boolean) => void;
}) {
  const settings = organization.settings || {};
  const security = settings.security || {};

  const [dataRetentionDays, setDataRetentionDays] = useState(security.dataRetentionDays || 365);
  const [requireMFA, setRequireMFA] = useState(security.requireMFA || false);
  const [allowExport, setAllowExport] = useState(security.allowExport !== false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(organization.id, {
        settings: {
          ...settings,
          security: {
            dataRetentionDays,
            requireMFA,
            allowExport
          }
        }
      });
      alert('セキュリティ設定を保存しました');
    } catch (err) {
      alert(err instanceof Error ? err.message : '設定の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          データ保持期間（日数）
        </label>
        <input
          type="number"
          value={dataRetentionDays}
          onChange={(e) => setDataRetentionDays(parseInt(e.target.value))}
          min="30"
          max="3650"
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          古いトレーニング記録は自動的にアーカイブされます
        </p>
      </div>

      <div className="space-y-4">
        <label className="flex items-center justify-between">
          <div>
            <div className="font-medium text-gray-900 dark:text-white">多要素認証を要求</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              全メンバーにMFAを強制（開発中）
            </div>
          </div>
          <input
            type="checkbox"
            checked={requireMFA}
            onChange={(e) => setRequireMFA(e.target.checked)}
            disabled
            className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
          />
        </label>

        <label className="flex items-center justify-between">
          <div>
            <div className="font-medium text-gray-900 dark:text-white">データエクスポート許可</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              メンバーがデータをエクスポートできる
            </div>
          </div>
          <input
            type="checkbox"
            checked={allowExport}
            onChange={(e) => setAllowExport(e.target.checked)}
            className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
          />
        </label>
      </div>

      <div className="pt-4 border-t dark:border-gray-700">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {saving ? '保存中...' : '設定を保存'}
        </button>
      </div>
    </div>
  );
}

function AppearanceSettings({
  organization,
  onUpdate,
  saving,
  setSaving
}: {
  organization: Organization;
  onUpdate: (id: string, updates: any) => Promise<any>;
  saving: boolean;
  setSaving: (saving: boolean) => void;
}) {
  const settings = organization.settings || {};
  const appearance = settings.appearance || {};

  const [primaryColor, setPrimaryColor] = useState(appearance.primaryColor || '#3B82F6');
  const [acwrThresholdLow, setAcwrThresholdLow] = useState(appearance.acwrThresholdLow || 0.8);
  const [acwrThresholdHigh, setAcwrThresholdHigh] = useState(appearance.acwrThresholdHigh || 1.3);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(organization.id, {
        settings: {
          ...settings,
          appearance: {
            primaryColor,
            acwrThresholdLow,
            acwrThresholdHigh
          }
        }
      });
      alert('外観設定を保存しました');
    } catch (err) {
      alert(err instanceof Error ? err.message : '設定の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          プライマリーカラー
        </label>
        <div className="flex items-center gap-4">
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-10 w-20 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
          />
          <input
            type="text"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          組織のブランドカラー（開発中）
        </p>
      </div>

      <div className="pt-4 border-t dark:border-gray-700">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4">ACWR閾値カスタマイズ</h4>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              低リスク閾値（下限）
            </label>
            <input
              type="number"
              value={acwrThresholdLow}
              onChange={(e) => setAcwrThresholdLow(parseFloat(e.target.value))}
              step="0.1"
              min="0.5"
              max="1.0"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              この値未満は低トレーニング負荷として警告
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              高リスク閾値（上限）
            </label>
            <input
              type="number"
              value={acwrThresholdHigh}
              onChange={(e) => setAcwrThresholdHigh(parseFloat(e.target.value))}
              step="0.1"
              min="1.2"
              max="2.0"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              この値を超えると高リスクとして警告
            </p>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t dark:border-gray-700">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {saving ? '保存中...' : '設定を保存'}
        </button>
      </div>
    </div>
  );
}
