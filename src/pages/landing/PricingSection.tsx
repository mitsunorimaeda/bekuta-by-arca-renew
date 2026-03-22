import { motion } from 'framer-motion';
import { Check, Smartphone, CreditCard, Zap } from 'lucide-react';

interface PricingSectionProps {
  onNavigateToSignup: () => void;
}

const freeFeatures = [
  '選手30人まで',
  'ACWR自動計算',
  '毎日のチェックイン',
  'コーチダッシュボード',
  'ゲーミフィケーション',
  '体重・睡眠・モチベーション管理',
  '月経周期トラッキング',
  'Push通知（月10回）',
];

const highlights = [
  { icon: Smartphone, text: '機材不要。スマホだけで完結。' },
  { icon: CreditCard, text: 'クレジットカード不要。' },
  { icon: Zap, text: '5分で導入完了。' },
];

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
            無料で、すべての機能を。
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            まずは無料プランで、チームのコンディション管理を始めましょう。
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="max-w-md mx-auto"
        >
          {/* Free Plan Card */}
          <div className="relative bg-white border-2 border-blue-600 rounded-2xl p-8 shadow-xl shadow-blue-600/10">
            {/* Badge */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span className="px-4 py-1 text-sm font-semibold text-white bg-blue-600 rounded-full">
                おすすめ
              </span>
            </div>

            <div className="text-center mb-8">
              <h3 className="text-xl font-bold text-gray-900">Free</h3>
              <div className="mt-4 flex items-baseline justify-center gap-1">
                <span className="text-5xl font-bold text-gray-900">¥0</span>
                <span className="text-gray-500">/月</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">ずっと無料。制限なし。</p>
            </div>

            {/* Features */}
            <ul className="space-y-3 mb-8">
              {freeFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <Check size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <button
              onClick={onNavigateToSignup}
              className="w-full py-3.5 text-base font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
            >
              無料で始める
            </button>
          </div>
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
