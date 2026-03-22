import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';

export function FounderStorySection() {
  return (
    <section className="py-20 sm:py-28 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8 }}
          className="relative"
        >
          {/* Quote icon */}
          <div className="flex justify-center mb-10">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Quote size={24} className="text-blue-600" />
            </div>
          </div>

          {/* Story */}
          <div className="space-y-8 text-center">
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-2xl sm:text-3xl font-bold text-gray-900"
              style={{ letterSpacing: '-0.02em' }}
            >
              晴れ舞台を目前に、
              <br />
              羽を失ったエース
            </motion.h2>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="space-y-6 text-gray-600 leading-relaxed text-base sm:text-lg"
            >
              <p>
                県大会決勝の二日前。
                <br />
                「この子の足、見てやってください」
              </p>

              <p>
                連れてこられた選手の診断は、第五中足骨の疲労骨折。
              </p>

              <p className="text-xl sm:text-2xl font-medium text-gray-800">
                「決勝に、出たいです」
              </p>

              <p>
                分かってる。
                <br />
                でも、この状態では出ても跳べやしない。
              </p>

              <p className="font-medium text-gray-800">
                私は、何もしてあげられませんでした。
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="pt-4 border-t border-gray-200"
            />

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="space-y-6 text-gray-600 leading-relaxed text-base sm:text-lg"
            >
              <p>
                学生スポーツには、特別な魅力があります。
                <br />
                限られた時間の中で精一杯輝こうとする彼ら彼女らは、
                <br className="hidden sm:block" />
                眩いほどに輝いています。
              </p>

              <p className="text-xl sm:text-2xl font-bold text-gray-900">
                本当はもっと輝ける。
                <br />
                そのためにできることが、まだある。
              </p>
            </motion.div>

            {/* Mission statement */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="pt-8"
            >
              <p className="text-blue-600 font-medium text-base sm:text-lg">
                だから私はBekutaを作りました。
                <br />
                あの時の&ldquo;もしも&rdquo;を、データで変えるために。
              </p>

              <div className="mt-8 flex flex-col items-center gap-1">
                <span className="text-sm font-semibold text-gray-900">前田 充範</span>
                <span className="text-sm text-gray-500">Bekuta創業者 / ストレングストレーナー</span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
