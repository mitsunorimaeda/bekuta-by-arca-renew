import React from 'react';
import { Building2, ArrowLeft } from 'lucide-react';

interface CommercialTransactionsProps {
  onBack?: () => void;
}

export function CommercialTransactions({ onBack }: CommercialTransactionsProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {onBack && (
          <button
            onClick={onBack}
            className="mb-6 flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            戻る
          </button>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="flex items-center mb-6">
            <Building2 className="w-8 h-8 text-blue-600 dark:text-blue-400 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">特定商取引法に基づく表記</h1>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-8">
            特定商取引法第11条に基づく表示
          </p>

          <div className="space-y-6 text-gray-700 dark:text-gray-300">
            {/* 販売事業者 */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">販売事業者</h3>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p className="font-semibold">株式会社ARCA</p>
              </div>
            </div>

            {/* 運営責任者 */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">運営責任者</h3>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p>代表取締役 前田充範</p>
              </div>
            </div>

            {/* 所在地 */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">所在地</h3>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p>〒465-0008</p>
                <p>愛知県名古屋市名東区猪子石1-505</p>
              </div>
            </div>

            {/* 電話番号 */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">電話番号</h3>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p>090-3852-9463</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  受付時間: 平日 10:00〜18:00（土日祝日を除く）
                </p>
              </div>
            </div>

            {/* メールアドレス */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">メールアドレス</h3>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p>info@arca.fit</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  ※ 営業日2-3日以内に返信いたします
                </p>
              </div>
            </div>

            {/* 販売価格 */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">販売価格</h3>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 space-y-3">
                <div>
                  <p className="font-semibold mb-2">個人プラン</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">500円<span className="text-base font-normal text-gray-600 dark:text-gray-400">/月（税込）</span></p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    選手個人でトレーニング記録を管理
                  </p>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
                  <p className="font-semibold mb-2">チームプラン</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">5,000円<span className="text-base font-normal text-gray-600 dark:text-gray-400">/月（税込）</span></p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    30名までの選手とスタッフでデータ共有
                  </p>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
                  <p className="font-semibold mb-2">地域クラブプラン</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">15,000円<span className="text-base font-normal text-gray-600 dark:text-gray-400">/月（税込）</span></p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    100名までの選手、複数競技対応
                  </p>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
                  <p className="font-semibold mb-2">プロチームプラン</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">50,000円<span className="text-base font-normal text-gray-600 dark:text-gray-400">/月（税込）</span></p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    無制限の選手・スタッフ、優先サポート
                  </p>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                  ※ 表示価格は全て税込です<br/>
                  ※ 無料トライアル期間（7日間）あり
                </p>
              </div>
            </div>

            {/* 支払方法 */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">支払方法</h3>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <ul className="space-y-2">
                  <li>• クレジットカード（Visa、Mastercard、JCB、American Express、Diners Club）</li>
                  <li>• 銀行振込（法人プランのみ）</li>
                </ul>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                  ※ 決済はStripeを利用した安全な環境で行われます
                </p>
              </div>
            </div>

            {/* 支払時期 */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">支払時期</h3>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p className="mb-2"><strong>月額プラン:</strong> 毎月1日に自動課金</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  初回は登録日、2回目以降は翌月の同日に課金されます
                </p>
              </div>
            </div>

            {/* サービス提供時期 */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">サービス提供時期</h3>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p>お申し込み後、即時利用可能</p>
              </div>
            </div>

            {/* 返金・キャンセルポリシー */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">返金・キャンセルポリシー</h3>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 space-y-4">
                <div>
                  <p className="font-semibold mb-2">返金保証について</p>
                  <ul className="space-y-2 text-sm">
                    <li>• 初回登録後7日以内であれば、理由を問わず全額返金いたします</li>
                    <li>• 返金を希望される場合は、サポートまでご連絡ください</li>
                    <li>• 返金処理は申請後5-10営業日以内に完了します</li>
                  </ul>
                </div>

                <div className="border-t border-yellow-200 dark:border-yellow-700 pt-3">
                  <p className="font-semibold mb-2">解約について</p>
                  <ul className="space-y-2 text-sm">
                    <li>• いつでも解約可能です（違約金なし）</li>
                    <li>• マイページから簡単に解約手続きができます</li>
                    <li>• 解約後も契約期間終了まではサービスを利用できます</li>
                    <li>• 月の途中での解約でも日割り返金はございません</li>
                  </ul>
                </div>

                <div className="border-t border-yellow-200 dark:border-yellow-700 pt-3">
                  <p className="font-semibold mb-2">返金できない場合</p>
                  <ul className="space-y-2 text-sm">
                    <li>• サービス開始後8日以上経過した場合</li>
                    <li>• 利用規約違反によりアカウントが停止された場合</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 動作環境 */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">動作環境</h3>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 space-y-3">
                <div>
                  <p className="font-semibold mb-2">対応ブラウザ</p>
                  <ul className="text-sm space-y-1">
                    <li>• Google Chrome（最新版）</li>
                    <li>• Safari（最新版）</li>
                    <li>• Firefox（最新版）</li>
                    <li>• Microsoft Edge（最新版）</li>
                  </ul>
                </div>

                <div className="border-t border-blue-200 dark:border-blue-700 pt-3">
                  <p className="font-semibold mb-2">推奨環境</p>
                  <ul className="text-sm space-y-1">
                    <li>• インターネット接続必須</li>
                    <li>• 画面解像度: 1280x720以上推奨</li>
                    <li>• スマートフォン: iOS 14以上、Android 10以上</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 販売数量 */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">販売数量</h3>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p>制限なし</p>
              </div>
            </div>

            {/* 引渡時期 */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">サービス引渡時期</h3>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p>決済完了後、即時アクセス可能</p>
              </div>
            </div>

            {/* 契約の成立時期 */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">契約の成立時期</h3>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p>利用者が利用規約に同意し、決済が完了した時点で契約成立</p>
              </div>
            </div>

            {/* 特別な販売条件 */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">特別な販売条件</h3>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p>なし</p>
              </div>
            </div>

            {/* 注意事項 */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">注意事項</h3>
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 space-y-2">
                <ul className="space-y-2 text-sm">
                  <li>• 当サービスは継続課金（サブスクリプション）サービスです</li>
                  <li>• 解約するまで毎月自動的に課金されます</li>
                  <li>• 18歳未満の方は保護者の同意が必要です</li>
                  <li>• クレジットカード情報は当社では保管せず、決済代行会社（Stripe）にて安全に管理されます</li>
                  <li>• 本サービスは医療機器ではなく、診断・治療を目的とするものではありません</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-700 text-center text-sm text-gray-600 dark:text-gray-400">
            <p>制定日: 2025年10月9日</p>
            <p>最終更新日: 2025年10月9日</p>
          </div>
        </div>
      </div>
    </div>
  );
}
