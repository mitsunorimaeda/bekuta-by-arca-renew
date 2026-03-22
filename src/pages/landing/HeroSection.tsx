import { motion } from 'framer-motion';
import { Shield, ArrowDown } from 'lucide-react';

interface HeroSectionProps {
  onNavigateToSignup: () => void;
}

export function HeroSection({ onNavigateToSignup }: HeroSectionProps) {
  return (
    <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100/40 via-transparent to-transparent" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 text-sm font-medium text-blue-700 bg-blue-100 rounded-full"
          >
            <Shield size={16} />
            データでアスリートを守る
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight"
            style={{ letterSpacing: '-0.02em' }}
          >
            選手の怪我を、
            <br />
            <span className="text-blue-600">データで防ぐ。</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-lg sm:text-xl text-gray-600 leading-relaxed"
          >
            エースが大会直前に怪我をした経験、ありませんか？
            <br className="hidden sm:block" />
            Bekutaは科学的指標
            <span className="font-semibold text-gray-800">ACWR</span>
            で&ldquo;見えない疲労&rdquo;を可視化し、選手を守ります。
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button
              onClick={onNavigateToSignup}
              className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30"
            >
              無料で始める
            </button>
            <a
              href="#problem"
              className="w-full sm:w-auto px-8 py-3.5 text-base font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              詳しく見る
              <ArrowDown size={16} />
            </a>
          </motion.div>

          {/* Social proof */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-8 text-sm text-gray-400"
          >
            クレジットカード不要 ・ 5分で導入完了 ・ 機材不要
          </motion.p>
        </div>
      </div>
    </section>
  );
}
