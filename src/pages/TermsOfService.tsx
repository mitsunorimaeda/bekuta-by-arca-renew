import React from 'react';
import { FileText, ArrowLeft } from 'lucide-react';

interface TermsOfServiceProps {
  onBack?: () => void;
}

export function TermsOfService({ onBack }: TermsOfServiceProps) {
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
            <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">利用規約</h1>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-8">
            最終更新日: 2025年10月9日
          </p>

          <div className="space-y-8 text-gray-700 dark:text-gray-300">
            {/* 第1条 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">第1条（適用）</h2>
              <div className="space-y-3 leading-relaxed">
                <p>
                  本規約は、Bekuta（以下「当サービス」といいます）の利用に関する条件を、利用者と当サービス運営者（以下「当社」といいます）との間で定めるものです。
                </p>
                <p>
                  利用者は、当サービスを利用することにより、本規約の全ての内容に同意したものとみなされます。
                </p>
              </div>
            </section>

            {/* 第2条 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">第2条（定義）</h2>
              <p className="leading-relaxed mb-3">本規約において使用する用語の定義は、以下のとおりとします。</p>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 space-y-3">
                <div>
                  <p className="font-bold">1. 「当サービス」</p>
                  <p className="text-sm ml-4">
                    ACWR（急性慢性ワークロード比）を用いたトレーニング負荷管理およびデータ可視化を提供するWebアプリケーション
                  </p>
                </div>
                <div>
                  <p className="font-bold">2. 「利用者」</p>
                  <p className="text-sm ml-4">
                    当サービスにアカウントを登録し、利用する全ての個人（選手、スタッフ、管理者を含む）
                  </p>
                </div>
                <div>
                  <p className="font-bold">3. 「選手」</p>
                  <p className="text-sm ml-4">
                    自己のトレーニングデータを記録・管理する利用者
                  </p>
                </div>
                <div>
                  <p className="font-bold">4. 「スタッフ」</p>
                  <p className="text-sm ml-4">
                    チームに所属する選手のデータを閲覧・分析する権限を持つ利用者（コーチ、トレーナー等）
                  </p>
                </div>
                <div>
                  <p className="font-bold">5. 「チーム」</p>
                  <p className="text-sm ml-4">
                    複数の選手とスタッフが所属するグループ単位
                  </p>
                </div>
              </div>
            </section>

            {/* 第3条 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">第3条（利用資格）</h2>
              <div className="space-y-4">
                <p className="leading-relaxed">
                  当サービスの利用には、以下の条件を満たす必要があります：
                </p>
                <ul className="list-decimal list-inside space-y-2 ml-4">
                  <li>本規約およびプライバシーポリシーに同意すること</li>
                  <li>正確かつ最新の情報を登録すること</li>
                  <li>18歳未満の方は、保護者の同意を得ること</li>
                </ul>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-4 mt-4">
                  <p className="font-bold mb-2">未成年者の利用について</p>
                  <p className="text-sm leading-relaxed">
                    18歳未満の方が当サービスを利用する場合、必ず保護者の同意を得た上でご利用ください。
                    保護者の方は、お子様の利用状況を適切に監督する責任を負います。
                  </p>
                </div>
              </div>
            </section>

            {/* 第4条 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">第4条（アカウント管理）</h2>
              <div className="space-y-4">
                <p className="leading-relaxed">
                  利用者は、自己の責任においてアカウント情報を管理するものとし、以下の事項を遵守するものとします：
                </p>
                <ul className="list-decimal list-inside space-y-2 ml-4">
                  <li>パスワードは第三者に開示または漏洩しないこと</li>
                  <li>アカウントを第三者に使用させないこと</li>
                  <li>不正アクセスを発見した場合は、直ちに当社に通知すること</li>
                </ul>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                  ※ アカウント情報の管理不十分により生じた損害について、当社は一切の責任を負いません。
                </p>
              </div>
            </section>

            {/* 第5条 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">第5条（サービスの内容）</h2>
              <div className="space-y-4">
                <p className="leading-relaxed">当サービスは、以下の機能を提供します：</p>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 space-y-2">
                  <ul className="list-disc list-inside space-y-2">
                    <li>トレーニング記録の入力・管理</li>
                    <li>体重記録の入力・管理</li>
                    <li>ACWR（急性慢性ワークロード比）の自動計算</li>
                    <li>トレーニング負荷の可視化（グラフ表示）</li>
                    <li>怪我リスクアラートの表示</li>
                    <li>チーム単位でのデータ管理（スタッフ向け）</li>
                    <li>データのエクスポート</li>
                  </ul>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                  ※ サービス内容は予告なく変更・追加・削除される場合があります。
                </p>
              </div>
            </section>

            {/* 第6条 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">第6条（禁止事項）</h2>
              <p className="leading-relaxed mb-3">利用者は、以下の行為を行ってはなりません：</p>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                <ul className="list-decimal list-inside space-y-3">
                  <li>虚偽の情報を登録・入力する行為</li>
                  <li>他人のアカウントを不正に利用する行為</li>
                  <li>当サービスの運営を妨害する行為</li>
                  <li>当サービスのシステムに不正にアクセスする行為</li>
                  <li>リバースエンジニアリング、逆コンパイル等を行う行為</li>
                  <li>他の利用者のプライバシーを侵害する行為</li>
                  <li>法令または公序良俗に違反する行為</li>
                  <li>当社または第三者の権利を侵害する行為</li>
                  <li>商業目的での無断利用</li>
                  <li>その他、当社が不適切と判断する行為</li>
                </ul>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                ※ 上記禁止事項に違反した場合、当社は事前通知なくアカウントを停止または削除することがあります。
              </p>
            </section>

            {/* 第7条 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">第7条（免責事項）</h2>
              <div className="bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500 p-6 space-y-4">
                <p className="font-bold text-lg">重要：サービスの性質について</p>

                <div className="space-y-3">
                  <div>
                    <p className="font-bold mb-2">1. 怪我予防の保証について</p>
                    <p className="text-sm leading-relaxed">
                      当サービスは、トレーニング負荷管理を支援するツールであり、<strong>怪我の予防・治療を保証するものではありません。</strong>
                      ACWRその他の指標は参考値であり、最終的な判断は利用者本人、指導者、医療専門家が行うものとします。
                    </p>
                  </div>

                  <div>
                    <p className="font-bold mb-2">2. 医療行為ではないことの確認</p>
                    <p className="text-sm leading-relaxed">
                      当サービスは医療機器ではなく、診断、治療、予防を目的とするものではありません。
                      体調不良や怪我の兆候がある場合は、必ず医療機関を受診してください。
                    </p>
                  </div>

                  <div>
                    <p className="font-bold mb-2">3. スポーツ活動のリスクについて</p>
                    <p className="text-sm leading-relaxed">
                      スポーツ活動には固有のリスクが伴うことを利用者は理解し、自己責任において活動するものとします。
                      当サービスの利用により発生した怪我・疾病について、当社は一切の責任を負いません。
                      ただし、当社の故意または重過失による場合はこの限りではありません。
                    </p>
                  </div>

                  <div>
                    <p className="font-bold mb-2">4. データの正確性について</p>
                    <p className="text-sm leading-relaxed">
                      当サービスが提供する計算結果やグラフ等は、利用者が入力したデータに基づいて生成されます。
                      入力データの正確性について、当社は責任を負いません。
                    </p>
                  </div>

                  <div>
                    <p className="font-bold mb-2">5. システム障害・データ損失について</p>
                    <p className="text-sm leading-relaxed">
                      当社は、システム障害、メンテナンス、通信障害等により当サービスが利用できない場合、
                      またはデータの損失・破損が発生した場合について、損害賠償責任を負いません。
                      ただし、当社の故意または重過失による場合はこの限りではありません。
                    </p>
                  </div>

                  <div>
                    <p className="font-bold mb-2">6. 損害賠償の上限</p>
                    <p className="text-sm leading-relaxed">
                      当社が利用者に対して損害賠償責任を負う場合、その賠償額は、
                      利用者が当社に支払った直近3ヶ月分の利用料金を上限とします。
                      （無料利用者の場合は10,000円を上限とします）
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 第8条 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">第8条（知的財産権）</h2>
              <div className="space-y-3">
                <p className="leading-relaxed">
                  当サービスに関する知的財産権（著作権、商標権、特許権等）は、全て当社または正当な権利者に帰属します。
                </p>
                <p className="leading-relaxed">
                  利用者が入力したデータ（トレーニング記録、体重記録等）の所有権は利用者に帰属しますが、
                  当社はサービスの提供・改善のために必要な範囲でこれを利用できるものとします。
                </p>
              </div>
            </section>

            {/* 第9条 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">第9条（サービスの停止・変更）</h2>
              <p className="leading-relaxed mb-3">
                当社は、以下の場合、利用者への事前通知なく当サービスの全部または一部を停止・中断することができます：
              </p>
              <ul className="list-decimal list-inside space-y-2 ml-4">
                <li>システムの保守・点検を行う場合</li>
                <li>システム障害が発生した場合</li>
                <li>地震、火災、停電等の不可抗力により運営が困難な場合</li>
                <li>その他、当社が必要と判断した場合</li>
              </ul>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                ※ サービス停止により利用者に損害が生じた場合でも、当社は一切の責任を負いません。
              </p>
            </section>

            {/* 第10条 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">第10条（サービスの終了）</h2>
              <div className="space-y-3">
                <p className="leading-relaxed">
                  当社は、30日前までに利用者に通知することにより、当サービスを終了することができます。
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  サービス終了時は、事前に利用者データのダウンロード機能を提供するよう努めます。
                </p>
              </div>
            </section>

            {/* 第11条 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">第11条（アカウントの停止・削除）</h2>
              <div className="space-y-4">
                <p className="leading-relaxed">当社は、以下の場合、利用者のアカウントを停止または削除することができます：</p>
                <ul className="list-decimal list-inside space-y-2 ml-4">
                  <li>本規約に違反した場合</li>
                  <li>登録情報に虚偽があることが判明した場合</li>
                  <li>6ヶ月以上利用がない場合</li>
                  <li>その他、当社が不適切と判断した場合</li>
                </ul>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                  ※ アカウント削除時のデータ復旧はできません。定期的にデータをエクスポートすることを推奨します。
                </p>
              </div>
            </section>

            {/* 第12条 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">第12条（規約の変更）</h2>
              <p className="leading-relaxed">
                当社は、必要に応じて本規約を変更することができます。
                変更後の規約は、当サービス上に掲載した時点から効力を生じるものとします。
                重要な変更については、サービス内で事前に通知いたします。
              </p>
            </section>

            {/* 第13条 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">第13条（準拠法・裁判管轄）</h2>
              <div className="space-y-3">
                <p className="leading-relaxed">
                  <strong>準拠法：</strong>本規約は日本法に準拠し、日本法に従って解釈されます。
                </p>
                <p className="leading-relaxed">
                  <strong>裁判管轄：</strong>当サービスに関する紛争については、東京地方裁判所を第一審の専属的合意管轄裁判所とします。
                </p>
              </div>
            </section>

            {/* 第14条 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">第14条（お問い合わせ）</h2>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-6">
                <p className="leading-relaxed mb-4">
                  本規約に関するお問い合わせは、以下までご連絡ください：
                </p>
                <div className="space-y-2 text-sm">
                  <p><strong>サービス名</strong>: Bekuta</p>
                  <p><strong>運営事業者</strong>: 株式会社ARCA</p>
                  <p><strong>代表者</strong>: 前田充範</p>
                  <p><strong>メールアドレス</strong>: info@arca.fit</p>
                  <p className="text-gray-600 dark:text-gray-400 mt-4">
                    ※ 営業日2-3日以内に返信いたします。
                  </p>
                </div>
              </div>
            </section>
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
