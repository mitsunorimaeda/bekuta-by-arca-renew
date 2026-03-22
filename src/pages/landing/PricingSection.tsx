import { motion } from 'framer-motion';
import { Check, X, Smartphone, CreditCard, Zap } from 'lucide-react';

interface PricingSectionProps {
  onNavigateToSignup: () => void;
}

interface PlanFeature {
  label: string;
  free: string | boolean;
  pro: string | boolean;
  proMax: string | boolean;
}

const planFeatures: PlanFeature[] = [
  { label: '選手数', free: '20人', pro: '100人', proMax: '300人' },
  { label: 'チーム数', free: '1チーム', pro: '1チーム', proMax: '8チーム' },
  { label: 'ACWR自動計算', free: true, pro: true, proMax: true },
  { label: 'チェックイン', free: true, pro: true, proMax: true },
  { label: 'コーチダッシュボード', free: true, pro: true, proMax: true },
  { label: 'ゲーミフィケーション', free: true, pro: true, proMax: true },
  { label: '体重・睡眠・モチベーション', free: true, pro: true, proMax: true },
  { label: '月経周期トラッキング', free: true, pro: true, proMax: true },
  { label: 'Push通知', free: '月10回', pro: '無制限', proMax: '無制限' },
  { label: 'データ保持', free: '1年間', pro: '3年間', proMax: '無制限' },
  { label: 'データエクスポート（CSV）', free: false, pro: true, proMax: true },
  { label: 'レポート自動生成', free: false, pro: true, proMax: true },
  { label: '優先サポート', free: false, pro: false, proMax: true },
  { label: 'API連携', free: false, pro: false, proMax: true },
];

const highlights = [
  { icon: Smartphone, text: '機材不要。スマホだけで完結。' },
  { icon: CreditCard, text: 'クレジットカード不要。' },
  { icon: Zap, text: '5分で導入完了。' },
];

function FeatureValue({ value }: { value: string | boolean }) {
  if (value === true) return <Check size={18} className="text-blue-600 mx-auto" />;
  if (value === false) return <X size={18} className="text-gray-300 mx-auto" />;
  return <span className="text-sm text-gray-700">{value}</span>;
}

export function PricingSection({ onNavigateToSignup }: PricingSectionProps) {
  return (
    <section id="pricing" className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900" style={{ letterSpacing: '-0.02em' }}>
            チームの規模に合わせて選べる
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            まずは無料プランで始めて、成長に合わせてアップグレード
          </p>
        </motion.div>

        {/* Plan Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16"
        >
          {/* Free */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8">
            <div className="text-center mb-6">
              <h3 className="text-lg font-bold text-gray-900">Free</h3>
              <div className="mt-3 flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-gray-900">¥0</span>
                <span className="text-gray-500 text-sm">/月</span>
              </div>
              <p className="mt-2 text-xs text-gray-500">20人まで・1チーム</p>
            </div>
            <button
              onClick={onNavigateToSignup}
              className="w-full py-3 text-sm font-semibold text-blue-600 border-2 border-blue-600 rounded-xl hover:bg-blue-50 transition-colors"
            >
              無料で始める
            </button>
          </div>

          {/* Pro - Highlighted */}
          <div className="relative bg-white border-2 border-blue-600 rounded-2xl p-6 sm:p-8 shadow-xl shadow-blue-600/10">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span className="px-4 py-1 text-sm font-semibold text-white bg-blue-600 rounded-full">
                おすすめ
              </span>
            </div>
            <div className="text-center mb-6">
              <h3 className="text-lg font-bold text-gray-900">Pro</h3>
              <div className="mt-3 flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-gray-900">¥2,980</span>
                <span className="text-gray-500 text-sm">/月</span>
              </div>
              <p className="mt-2 text-xs text-gray-500">100人まで・1チーム</p>
            </div>
            <button
              onClick={onNavigateToSignup}
              className="w-full py-3 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
            >
              無料で始める
            </button>
          </div>

          {/* Pro Max */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8">
            <div className="text-center mb-6">
              <h3 className="text-lg font-bold text-gray-900">Pro Max</h3>
              <div className="mt-3 flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-gray-900">¥9,980</span>
                <span className="text-gray-500 text-sm">/月</span>
              </div>
              <p className="mt-2 text-xs text-gray-500">300人まで・8チーム</p>
            </div>
            <button
              onClick={onNavigateToSignup}
              className="w-full py-3 text-sm font-semibold text-gray-700 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
            >
              お問い合わせ
            </button>
          </div>
        </motion.div>

        {/* Feature Comparison Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.6 }}
          className="max-w-5xl mx-auto overflow-x-auto"
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 pr-4 font-medium text-gray-500 w-2/5">機能</th>
                <th className="text-center py-3 px-2 font-semibold text-gray-700 w-1/5">Free</th>
                <th className="text-center py-3 px-2 font-semibold text-blue-600 w-1/5">Pro</th>
                <th className="text-center py-3 px-2 font-semibold text-gray-700 w-1/5">Pro Max</th>
              </tr>
            </thead>
            <tbody>
              {planFeatures.map((feature) => (
                <tr key={feature.label} className="border-b border-gray-100">
                  <td className="py-3 pr-4 text-gray-700">{feature.label}</td>
                  <td className="py-3 px-2 text-center"><FeatureValue value={feature.free} /></td>
                  <td className="py-3 px-2 text-center bg-blue-50/30"><FeatureValue value={feature.pro} /></td>
                  <td className="py-3 px-2 text-center"><FeatureValue value={feature.proMax} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        {/* Highlights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10"
        >
          {highlights.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.text} className="flex items-center gap-2 text-sm text-gray-500">
                <Icon size={18} className="text-gray-400" />
                {item.text}
              </div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
