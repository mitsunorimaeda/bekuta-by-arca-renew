import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';

export function SolutionSection() {
  return (
    <section className="py-20 sm:py-28 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 text-sm font-medium text-blue-700 bg-blue-100 rounded-full">
              <Activity size={16} />
              ACWR（Acute:Chronic Workload Ratio）
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900" style={{ letterSpacing: '-0.02em' }}>
              &ldquo;見えない疲労&rdquo;を、数値化する
            </h2>
            <p className="mt-4 text-lg text-gray-500">
              世界中のプロチームが採用する科学的指標を、あなたの部活でも。
            </p>
          </motion.div>

          {/* ACWR Diagram */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
            className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-12 shadow-sm"
          >
            <div className="grid sm:grid-cols-2 gap-8 items-center">
              {/* Left: Explanation */}
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  ACWRとは？
                </h3>
                <p className="text-gray-600 leading-relaxed mb-6">
                  直近1週間の練習負荷（急性負荷）を、過去4週間の平均（慢性負荷）で割った比率です。
                  この値が<span className="font-semibold text-gray-800">0.8〜1.3</span>の範囲なら安全。
                  超えると怪我のリスクが急増します。
                </p>
                <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 font-mono">
                  ACWR = 急性負荷（1週間）÷ 慢性負荷（4週間平均）
                </div>
              </div>

              {/* Right: Visual gauge */}
              <div className="flex flex-col items-center">
                <div className="w-full max-w-xs">
                  {/* Risk zones */}
                  <div className="flex rounded-xl overflow-hidden h-12 mb-4">
                    <div className="bg-blue-200 flex-1 flex items-center justify-center text-xs font-medium text-blue-800">
                      低すぎ
                    </div>
                    <div className="bg-green-400 flex-[1.5] flex items-center justify-center text-xs font-bold text-green-900">
                      安全ゾーン
                    </div>
                    <div className="bg-amber-300 flex-1 flex items-center justify-center text-xs font-medium text-amber-800">
                      注意
                    </div>
                    <div className="bg-red-400 flex-1 flex items-center justify-center text-xs font-bold text-red-900">
                      危険
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 px-1">
                    <span>0.0</span>
                    <span>0.8</span>
                    <span>1.3</span>
                    <span>1.5+</span>
                  </div>
                </div>
                <p className="mt-6 text-sm text-gray-500 text-center">
                  Bekutaが毎日自動計算。
                  <br />
                  危険ゾーンに入ったらアラートでお知らせ。
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
