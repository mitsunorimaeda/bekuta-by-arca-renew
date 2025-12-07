import React from 'react';
import { Shield, FileText, Building2, Mail } from 'lucide-react';

interface FooterProps {
  onNavigateToPrivacy?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToCommercial?: () => void;
}

export function Footer({ onNavigateToPrivacy, onNavigateToTerms, onNavigateToCommercial }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        {/* モバイル版: 最小限の情報のみ表示 */}
        <div className="md:hidden">
          <div className="text-center space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              © {currentYear} 株式会社ARCA. All Rights Reserved.
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              法的情報はメニューからご覧いただけます
            </p>
          </div>
        </div>

        {/* タブレット・PC版: 詳細情報を表示 */}
        <div className="hidden md:grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* サービス情報 */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
              Bekuta by ARCA
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              データサイエンスによるトレーニング負荷管理システム。
              ACWRを用いて怪我リスクを可視化し、アスリートのパフォーマンス最適化をサポートします。
            </p>
            <div className="mt-4 flex items-center text-xs text-gray-500 dark:text-gray-400">
              <AlertCircle className="w-4 h-4 mr-1" />
              <span>医療機器ではありません</span>
            </div>
          </div>

          {/* 法的文書 */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
              法的情報
            </h3>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={onNavigateToPrivacy}
                  className="flex items-center text-xs text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  プライバシーポリシー
                </button>
              </li>
              <li>
                <button
                  onClick={onNavigateToTerms}
                  className="flex items-center text-xs text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  利用規約
                </button>
              </li>
              <li>
                <button
                  onClick={onNavigateToCommercial}
                  className="flex items-center text-xs text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  特定商取引法に基づく表記
                </button>
              </li>
            </ul>
          </div>

          {/* お問い合わせ */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
              お問い合わせ
            </h3>
            <div className="space-y-3">
              <a
                href="mailto:info@arca.fit"
                className="flex items-center text-xs text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <Mail className="w-4 h-4 mr-2" />
                info@arca.fit
              </a>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                営業日2-3日以内に返信いたします
              </p>
            </div>

            <div className="mt-4">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                運営事業者
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                株式会社ARCA<br/>
                代表取締役 前田充範
              </p>
            </div>
          </div>
        </div>

        {/* 免責事項 - タブレット・PC版のみ */}
        <div className="hidden md:block mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-4 rounded">
            <p className="text-xs text-yellow-800 dark:text-yellow-200 leading-relaxed">
              <strong>免責事項:</strong> 本サービスは医療機器ではなく、診断・治療を目的とするものではありません。
              怪我の予防を保証するものではなく、ACWRその他の指標は参考値です。
              最終的な判断は利用者本人、指導者、医療専門家が行ってください。
            </p>
          </div>
        </div>

        {/* コピーライト - タブレット・PC版のみ */}
        <div className="hidden md:block mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-2 md:space-y-0">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              © {currentYear} 株式会社ARCA. All Rights Reserved.
            </p>
            <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
              <span>Version 1.0.0</span>
              <span>•</span>
              <span>日本法準拠</span>
            </div>
          </div>
        </div>

        {/* オープンソースライセンス - タブレット・PC版のみ */}
        <div className="hidden md:block mt-4">
          <details className="text-xs text-gray-500 dark:text-gray-400">
            <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
              オープンソースライセンス
            </summary>
            <div className="mt-2 pl-4 space-y-1">
              <p>• React - MIT License</p>
              <p>• Recharts - MIT License</p>
              <p>• Supabase - Apache License 2.0</p>
              <p>• Lucide Icons - ISC License</p>
              <p>• Tailwind CSS - MIT License</p>
            </div>
          </details>
        </div>
      </div>
    </footer>
  );
}

// AlertCircle component for inline use
function AlertCircle({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}
