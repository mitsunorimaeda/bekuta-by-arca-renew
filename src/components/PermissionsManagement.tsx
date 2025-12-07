import React, { useState } from 'react';
import { usePermissions } from '../hooks/useSubscription';
import { Shield, Check, X, Info } from 'lucide-react';

interface PermissionsManagementProps {
  organizationId?: string;
}

export function PermissionsManagement({ organizationId }: PermissionsManagementProps) {
  const { allPermissions, loading, error } = usePermissions(undefined);
  const [selectedRole, setSelectedRole] = useState<string>('organization_admin');

  const roles = [
    {
      id: 'admin',
      name: 'システム管理者',
      description: 'すべての機能とデータにアクセス可能'
    },
    {
      id: 'organization_admin',
      name: '組織管理者',
      description: '組織内のすべてのデータと設定を管理（監督、GM、統括コーチなど）'
    },
    {
      id: 'staff',
      name: 'コーチ',
      description: '担当チームのデータと設定を管理'
    },
    {
      id: 'member',
      name: '一般メンバー',
      description: '通常のコーチ/選手として活動（管理権限なし）'
    }
  ];

  const {
    permissions: rolePermissions,
    loading: roleLoading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions
  } = usePermissions(selectedRole);

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
        <p className="text-red-800 dark:text-red-200">{error}</p>
      </div>
    );
  }

  const groupedPermissions = allPermissions.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, typeof allPermissions>);

  const categoryNames: Record<string, string> = {
    athlete: 'アスリート管理',
    training: 'トレーニング記録',
    reports: 'レポートと分析',
    organization: '組織管理',
    billing: '課金管理',
    admin: '管理者機能'
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Shield className="h-6 w-6" />
          権限管理
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          ロールごとの権限設定を確認・管理
        </p>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-semibold mb-1">権限について</p>
            <p>
              各ロールには事前定義された権限セットが割り当てられています。
              組織管理者は組織内のすべてのデータにアクセスでき、部署マネージャーは担当部署のデータのみにアクセスできます。
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">ロール一覧</h3>
          <div className="space-y-2">
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedRole === role.id
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-600 dark:border-blue-400'
                    : 'bg-gray-50 dark:bg-gray-700 border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="font-medium text-gray-900 dark:text-white">{role.name}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{role.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {roles.find(r => r.id === selectedRole)?.name}の権限
          </h3>

          {roleLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedPermissions).map(([category, perms]) => (
                <div key={category} className="border-b dark:border-gray-700 pb-6 last:border-0 last:pb-0">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                    {categoryNames[category] || category}
                  </h4>
                  <div className="space-y-2">
                    {perms.map((perm) => {
                      const hasThisPermission =
                        selectedRole === 'admin' ||
                        (rolePermissions && rolePermissions.some((rp: any) =>
                          rp.permission && rp.permission.permission_key === perm.permission_key
                        ));

                      return (
                        <div
                          key={perm.id}
                          className="flex items-center justify-between p-3 rounded bg-gray-50 dark:bg-gray-700"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 dark:text-white text-sm">
                              {perm.name}
                            </div>
                            {perm.description && (
                              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                {perm.description}
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            {hasThisPermission ? (
                              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                                <Check className="h-5 w-5" />
                                <span className="text-sm font-medium">許可</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-gray-400 dark:text-gray-600">
                                <X className="h-5 w-5" />
                                <span className="text-sm font-medium">不可</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">権限マトリックス</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b dark:border-gray-700">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                  権限
                </th>
                {roles.map((role) => (
                  <th
                    key={role.id}
                    className="text-center py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white"
                  >
                    {role.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedPermissions).flatMap(([category, perms]) =>
                perms.map((perm, idx) => (
                  <tr
                    key={perm.id}
                    className={`border-b dark:border-gray-700 ${
                      idx === 0 ? 'border-t-2 dark:border-t-gray-600' : ''
                    }`}
                  >
                    <td className="py-2 px-4 text-sm">
                      <div className="font-medium text-gray-900 dark:text-white">{perm.name}</div>
                      {idx === 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-semibold mt-1">
                          {categoryNames[category]}
                        </div>
                      )}
                    </td>
                    {roles.map((role) => {
                      const { permissions: rPerms } = usePermissions(role.id);
                      const hasThisPermission =
                        role.id === 'admin' ||
                        (rPerms && rPerms.some((rp: any) =>
                          rp.permission && rp.permission.permission_key === perm.permission_key
                        ));

                      return (
                        <td key={role.id} className="text-center py-2 px-4">
                          {hasThisPermission ? (
                            <Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" />
                          ) : (
                            <X className="h-5 w-5 text-gray-300 dark:text-gray-600 mx-auto" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
