import { motion } from 'framer-motion';
import { ShieldCheck, Heart } from 'lucide-react';

export function SafetySection() {
  return (
    <section className="py-16 sm:py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900" style={{ letterSpacing: '-0.02em' }}>
            選手だけでなく、保護者も学校も守る
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="grid sm:grid-cols-2 gap-8 max-w-4xl mx-auto"
        >
          {/* Parents */}
          <div className="bg-white rounded-2xl p-8 border border-gray-100">
            <div className="w-12 h-12 rounded-xl bg-pink-100 flex items-center justify-center mb-5">
              <Heart size={24} className="text-pink-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-3">保護者の方へ</h3>
            <p className="text-gray-600 leading-relaxed">
              お子さんのコンディションが科学的にケアされている安心感。
              毎日のデータが記録されているから、「ちゃんと管理されている」とわかります。
            </p>
          </div>

          {/* School */}
          <div className="bg-white rounded-2xl p-8 border border-gray-100">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-5">
              <ShieldCheck size={24} className="text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-3">学校・教育機関の方へ</h3>
            <p className="text-gray-600 leading-relaxed">
              記録に基づく安全管理体制を構築。
              安全配慮義務への対応として、データに基づいた負荷管理の証跡を残せます。
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
