import { motion } from 'framer-motion';

interface CTASectionProps {
  onNavigateToSignup: () => void;
}

export function CTASection({ onNavigateToSignup }: CTASectionProps) {
  return (
    <section className="py-20 sm:py-28 bg-gradient-to-br from-blue-600 to-blue-800 relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,_white_1px,_transparent_1px)] bg-[length:30px_30px]" />
      </div>

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
        >
          <h2
            className="text-3xl sm:text-4xl font-bold text-white leading-tight"
            style={{ letterSpacing: '-0.02em' }}
          >
            もう「根性」ではなく
            <br />
            「データ」で選手を守りませんか？
          </h2>

          <p className="mt-6 text-lg text-blue-100">
            クレジットカード不要。5分で導入完了。
          </p>

          <button
            onClick={onNavigateToSignup}
            className="mt-10 px-10 py-4 text-lg font-semibold text-blue-600 bg-white rounded-xl hover:bg-blue-50 transition-colors shadow-lg"
          >
            無料で始める
          </button>
        </motion.div>
      </div>
    </section>
  );
}
