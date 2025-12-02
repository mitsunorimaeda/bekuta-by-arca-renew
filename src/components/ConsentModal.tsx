import React, { useState } from 'react';
import { Shield, FileText, CheckCircle, AlertCircle } from 'lucide-react';

interface ConsentModalProps {
  onAccept: () => void;
  onDecline: () => void;
}

export function ConsentModal({ onAccept, onDecline }: ConsentModalProps) {
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [isMinor, setIsMinor] = useState<boolean | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // すべての条件が揃ったら同意ボタンを有効化
  const canAccept = agreedToTerms && agreedToPrivacy && isMinor !== null;

  // ✅ 1タップで進むシンプル仕様
  const handleAccept = () => {
    if (!canAccept || isLoggingOut) return;
    onAccept();
  };

  const handleDecline = async () => {
    setIsLoggingOut(true);
    await onDecline();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold">Bekuta へようこそ</h2>
              <p className="text-blue-100 text-sm mt-1">ご利用前に必ずお読みください</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="space-y-6">
            {/* 重要な注意事項 */}
            <div className="bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500 p-4 rounded">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 mr-3 mt-0.5 flex-shrink-0" />
                <div className="text-sm space-y-2">
                  <p className="font-bold text-orange-900 dark:text-orange-200">
                    本サービスについての重要なお知らせ
                  </p>
                  <ul className="space-y-1 text-orange-800 dark:text-orange-300">
                    <li>• 当サービスは医療機器ではなく、診断・治療を目的とするものではありません</li>
                    <li>• 怪我の予防を保証するものではありません</li>
                    <li>• ACWRは参考値であり、最終判断は本人・指導者・医療専門家が行います</li>
                    <li>• スポーツ活動には固有のリスクが伴います</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 年齢確認 */}
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-5">
              <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />
                年齢確認
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                あなたは18歳以上ですか？
              </p>
              <div className="flex space-x-4">
                <button
                  onClick={() => setIsMinor(false)}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                    isMinor === false
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                      : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
                  }`}
                >
                  <CheckCircle
                    className={`w-5 h-5 mx-auto mb-1 ${
                      isMinor === false ? 'text-green-500' : 'text-gray-400'
                    }`}
                  />
                  <span className="text-sm font-medium">18歳以上です</span>
                </button>
                <button
                  onClick={() => setIsMinor(true)}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                    isMinor === true
                      ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
                      : 'border-gray-300 dark:border-gray-600 hover:border-yellow-400'
                  }`}
                >
                  <AlertCircle
                    className={`w-5 h-5 mx-auto mb-1 ${
                      isMinor === true ? 'text-yellow-500' : 'text-gray-400'
                    }`}
                  />
                  <span className="text-sm font-medium">18歳未満です</span>
                </button>
              </div>

              {/* 未成年の注意ボックス（18歳未満を選んだら表示） */}
              {isMinor !== null && isMinor && (
                <div className="mt-4 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-600 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium mb-2">
                    保護者の同意が必要です
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-3">
                    18歳未満の方は、保護者の方と一緒にこの画面をご確認いただき、
                    保護者の方の同意を得た上でご利用ください。
                  </p>
                  <div className="bg-white dark:bg-yellow-800/20 rounded-lg p-3 text-xs text-yellow-900 dark:text-yellow-100">
                    保護者の方がいない場合は、「同意しない」ボタンを押して、
                    後ほど保護者の方と一緒に再度アクセスしてください。
                  </div>
                </div>
              )}
            </div>

            {/* 利用規約への同意 */}
            <div className="border-2 border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:border-blue-300 dark:hover:border-blue-600 transition-colors bg-white dark:bg-gray-800">
              <label className="flex items-start cursor-pointer group">
                <div className="relative flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div
                    className={`
                    w-6 h-6 border-2 rounded-md transition-all duration-200 flex items-center justify-center
                    ${
                      agreedToTerms
                        ? 'bg-blue-600 border-blue-600 dark:bg-blue-500 dark:border-blue-500'
                        : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 group-hover:border-blue-400 dark:group-hover:border-blue-500'
                    }
                    peer-focus:ring-2 peer-focus:ring-blue-500 peer-focus:ring-offset-2 dark:peer-focus:ring-offset-gray-800
                  `}
                  >
                    {agreedToTerms && (
                      <CheckCircle className="w-4 h-4 text-white" strokeWidth={3} />
                    )}
                  </div>
                </div>
                <div className="ml-4 flex-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    利用規約に同意します
                  </span>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    <a
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      利用規約を確認する →
                    </a>
                  </p>
                </div>
              </label>
            </div>

            {/* プライバシーポリシーへの同意 */}
            <div className="border-2 border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:border-blue-300 dark:hover:border-blue-600 transition-colors bg-white dark:bg-gray-800">
              <label className="flex items-start cursor-pointer group">
                <div className="relative flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={agreedToPrivacy}
                    onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div
                    className={`
                    w-6 h-6 border-2 rounded-md transition-all duration-200 flex items-center justify-center
                    ${
                      agreedToPrivacy
                        ? 'bg-blue-600 border-blue-600 dark:bg-blue-500 dark:border-blue-500'
                        : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 group-hover:border-blue-400 dark:group-hover:border-blue-500'
                    }
                    peer-focus:ring-2 peer-focus:ring-blue-500 peer-focus:ring-offset-2 dark:peer-focus:ring-offset-gray-800
                  `}
                  >
                    {agreedToPrivacy && (
                      <CheckCircle className="w-4 h-4 text-white" strokeWidth={3} />
                    )}
                  </div>
                </div>
                <div className="ml-4 flex-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    プライバシーポリシーに同意します
                  </span>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    <a
                      href="/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      プライバシーポリシーを確認する →
                    </a>
                  </p>
                </div>
              </label>
            </div>

            {/* データ収集の説明 */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">
                収集するデータについて
              </h4>
              <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-1">
                <li>• トレーニング記録（RPE、時間、負荷）</li>
                <li>• 体重記録（メモは本人のみ閲覧可能）</li>
                <li>• 所属チームのスタッフはあなたのトレーニングデータを閲覧できます</li>
                <li>• データは暗号化して安全に保管されます</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          {isLoggingOut ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-700 dark:text-gray-300 font-medium mb-2">
                保護者の同意承認を得てから利用してください
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                ログイン画面に戻ります...
              </p>
            </div>
          ) : (
            <>
              <div className="flex space-x-3">
                <button
                  onClick={handleDecline}
                  disabled={isLoggingOut}
                  className="flex-1 py-3 px-4 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  同意しない
                </button>
                <button
                  onClick={handleAccept}
                  disabled={!canAccept || isLoggingOut}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                    canAccept && !isLoggingOut
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isMinor ? '保護者の同意を得て利用開始' : '同意して利用開始'}
                </button>
              </div>
              <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-3">
                利用開始後もいつでも設定からこれらの文書を確認できます
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}