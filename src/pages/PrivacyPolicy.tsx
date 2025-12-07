import React from 'react';
import { Shield, ArrowLeft } from 'lucide-react';

interface PrivacyPolicyProps {
  onBack?: () => void;
}

export function PrivacyPolicy({ onBack }: PrivacyPolicyProps) {
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
            <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">プライバシーポリシー</h1>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-8">
            最終更新日: 2025年10月9日
          </p>

          <div className="space-y-8 text-gray-700 dark:text-gray-300">
            {/* 第1条 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">第1条（基本方針）</h2>
              <p className="leading-relaxed">
                Bekuta（以下「当サービス」といいます）は、利用者の個人情報保護の重要性について認識し、個人情報の保護に関する法律（以下「個人情報保護法」といいます）を遵守すると共に、以下のプライバシーポリシー（以下「本ポリシー」といいます）に従い、適切な取扱い及び保護に努めます。
              </p>
            </section>

            {/* 第2条 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">第2条（収集する情報）</h2>
              <p className="leading-relaxed mb-3">
                当サービスは、利用者から以下の情報を収集します：
              </p>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 space-y-2">
                <p><strong>1. アカウント情報</strong></p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>氏名</li>
                  <li>メールアドレス</li>
                  <li>パスワード（暗号化して保管）</li>
                  <li>生年月日（年齢確認のため）</li>
                  <li>所属チーム情報</li>
                </ul>

                <p className="mt-4"><strong>2. トレーニング記録</strong></p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>トレーニング日時</li>
                  <li>RPE（主観的運動強度）</li>
                  <li>トレーニング時間</li>
                  <li>計算された負荷値</li>
                </ul>

                <p className="mt-4"><strong>3. 体重記録</strong></p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>測定日時</li>
                  <li>体重（kg）</li>
                  <li>メモ（利用者が入力した場合のみ）</li>
                </ul>

                <p className="mt-4"><strong>4. 利用情報</strong></p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>アクセスログ</li>
                  <li>利用状況データ</li>
                  <li>デバイス情報</li>
                </ul>
              </div>
            </section>

            {/* 第3条 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">第3条（利用目的）</h2>
              <p className="leading-relaxed mb-3">
                収集した個人情報は、以下の目的で利用します：
              </p>
              <ul className="list-decimal list-inside space-y-2 ml-4">
                <li>ACWR（急性慢性ワークロード比）の計算および表示</li>
                <li>トレーニング負荷の可視化およびグラフ表示</li>
                <li>怪我リスクアラートの生成および通知</li>
                <li>スタッフ・コーチへのトレーニングデータの共有（選手本人が所属するチームのみ）</li>
                <li>サービスの提供、維持、改善</li>
                <li>利用者からのお問い合わせへの対応</li>
                <li>利用規約違反への対応</li>
                <li>サービスに関する重要なお知らせの通知</li>
              </ul>
            </section>

            {/* 第4条 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">第4条（第三者提供）</h2>
              <div className="space-y-4">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-4">
                  <p className="font-bold mb-2">重要：データ共有の範囲</p>
                  <p className="leading-relaxed">
                    当サービスでは、選手のトレーニング記録は所属チームのスタッフ・コーチと共有されます。ただし、<strong>体重記録のメモ欄は選手本人のみが閲覧可能</strong>であり、スタッフ・コーチには共有されません。
                  </p>
                </div>

                <p className="leading-relaxed">
                  以下の場合を除き、利用者の同意なく第三者に個人情報を提供することはありません：
                </p>

                <ul className="list-decimal list-inside space-y-2 ml-4">
                  <li>法令に基づく場合</li>
                  <li>人の生命、身体または財産の保護のために必要がある場合であって、本人の同意を得ることが困難であるとき</li>
                  <li>国の機関もしくは地方公共団体またはその委託を受けた者が法令の定める事務を遂行することに対して協力する必要がある場合であって、本人の同意を得ることにより当該事務の遂行に支障を及ぼすおそれがあるとき</li>
                </ul>

                <div className="mt-4">
                  <p className="font-bold mb-2">データ処理委託先</p>
                  <p className="leading-relaxed mb-2">
                    当サービスは、以下の第三者サービスを利用してデータを処理・保管しています：
                  </p>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li><strong>Supabase（米国）</strong>: データベース管理、認証</li>
                  </ul>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    これらのサービスプロバイダーは、適切なセキュリティ対策を講じており、個人情報保護法に準拠したデータ処理を行っています。
                  </p>
                </div>
              </div>
            </section>

            {/* 第5条 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">第5条（保管期間）</h2>
              <p className="leading-relaxed">
                個人情報は、利用目的の達成に必要な期間保管します。具体的には：
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-3">
                <li><strong>アカウント情報</strong>: アカウント削除後1年間</li>
                <li><strong>トレーニング記録</strong>: アカウント削除後1年間</li>
                <li><strong>体重記録</strong>: アカウント削除後1年間</li>
                <li><strong>アクセスログ</strong>: 6ヶ月間</li>
              </ul>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                ※ 法令により保管が義務付けられている場合は、当該期間保管します。
              </p>
            </section>

            {/* 第6条 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">第6条（利用者の権利）</h2>
              <p className="leading-relaxed mb-3">
                利用者は、自己の個人情報について、以下の権利を有します：
              </p>
              <div className="space-y-4">
                <div>
                  <p className="font-bold mb-2">1. 開示請求</p>
                  <p className="text-sm">保管されている個人情報の開示を請求できます。</p>
                </div>
                <div>
                  <p className="font-bold mb-2">2. 訂正・追加・削除</p>
                  <p className="text-sm">個人情報が事実でない場合、訂正、追加または削除を請求できます。</p>
                </div>
                <div>
                  <p className="font-bold mb-2">3. 利用停止・消去</p>
                  <p className="text-sm">個人情報が目的外利用されている場合、利用停止または消去を請求できます。</p>
                </div>
                <div>
                  <p className="font-bold mb-2">4. データポータビリティ</p>
                  <p className="text-sm">自己のデータをダウンロードできます（アプリ内の設定から可能）。</p>
                </div>
              </div>
            </section>

            {/* 第7条 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">第7条（セキュリティ対策）</h2>
              <p className="leading-relaxed mb-3">
                当サービスは、個人情報の保護のため、以下のセキュリティ対策を講じています：
              </p>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 space-y-2">
                <ul className="list-disc list-inside space-y-2">
                  <li><strong>通信の暗号化</strong>: TLS 1.3による暗号化通信</li>
                  <li><strong>データベースの暗号化</strong>: AES-256による暗号化</li>
                  <li><strong>アクセス制御</strong>: ロールベースアクセス制御（RBAC）</li>
                  <li><strong>認証セキュリティ</strong>: パスワードのハッシュ化、多要素認証対応</li>
                  <li><strong>定期的なバックアップ</strong>: データ損失防止のための自動バックアップ</li>
                  <li><strong>セキュリティ監視</strong>: 不正アクセスの監視・検知</li>
                </ul>
              </div>
            </section>

            {/* 第8条 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">第8条（Cookie等の技術）</h2>
              <p className="leading-relaxed">
                当サービスは、利用者の利便性向上のため、Cookie及びこれに類する技術を使用します。これにより収集された情報は、アクセス解析やサービス改善のために使用されますが、個人を特定する情報は含まれません。
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                ※ Cookieの使用を望まない場合は、ブラウザの設定で無効化できますが、一部機能が利用できなくなる可能性があります。
              </p>
            </section>

            {/* 第9条 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">第9条（未成年者の個人情報）</h2>
              <div className="bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-500 p-4">
                <p className="leading-relaxed mb-3">
                  <strong>18歳未満の方は、保護者の同意を得た上で当サービスをご利用ください。</strong>
                </p>
                <p className="leading-relaxed text-sm">
                  未成年者の個人情報を収集する場合、法定代理人（保護者）の同意を得た上で収集します。保護者の方は、お子様の個人情報について、開示、訂正、削除等を請求することができます。
                </p>
              </div>
            </section>

            {/* 第10条 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">第10条（データ侵害時の対応）</h2>
              <p className="leading-relaxed">
                万が一、個人情報の漏洩、滅失、毀損等が発生した場合、当サービスは以下の対応を行います：
              </p>
              <ul className="list-decimal list-inside space-y-2 ml-4 mt-3">
                <li>速やかに事実関係を調査し、被害の拡大防止措置を講じます</li>
                <li>個人情報保護委員会への報告（必要な場合）</li>
                <li>影響を受ける利用者への通知</li>
                <li>再発防止策の実施</li>
              </ul>
            </section>

            {/* 第11条 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">第11条（プライバシーポリシーの変更）</h2>
              <p className="leading-relaxed">
                本ポリシーの内容は、法令の変更やサービスの改善等により、予告なく変更することがあります。変更後のプライバシーポリシーは、本ページに掲載した時点から効力を生じるものとします。重要な変更については、サービス内で通知いたします。
              </p>
            </section>

            {/* 第12条 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">第12条（お問い合わせ窓口）</h2>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-6">
                <p className="leading-relaxed mb-4">
                  個人情報の取扱いに関するお問い合わせは、以下までご連絡ください：
                </p>
                <div className="space-y-2 text-sm">
                  <p><strong>サービス名</strong>: Bekuta</p>
                  <p><strong>運営事業者</strong>: 株式会社ARCA</p>
                  <p><strong>個人情報保護管理者</strong>: 前田充範</p>
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
