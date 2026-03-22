import { motion } from 'framer-motion';
import { Users, ClipboardCheck, BarChart3, ArrowRight } from 'lucide-react';

const steps = [
  {
    number: '1',
    icon: Users,
    title: 'チームを作成',
    time: '5分',
    description: 'アカウント作成後、シェアリンクを選手に共有するだけ。アプリのインストールも機材も不要。',
  },
  {
    number: '2',
    icon: ClipboardCheck,
    title: '選手が毎日チェックイン',
    time: '1分',
    description: 'RPE（練習のきつさ）と体調を入力。ゲーミフィケーションで記録が自然と習慣に。',
  },
  {
    number: '3',
    icon: BarChart3,
    title: 'リスクを可視化',
    time: '自動',
    description: 'ACWRが自動計算され、コーチのダッシュボードに表示。危険な選手にはアラートで通知。',
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.2 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900" style={{ letterSpacing: '-0.02em' }}>
            3ステップで始められる
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            複雑な設定は一切不要。今日から使えます。
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid md:grid-cols-3 gap-8 relative"
        >
          {/* Connection arrows (desktop only) */}
          <div className="hidden md:block absolute top-16 left-[33%] w-[34%] h-0.5 bg-gradient-to-r from-blue-200 to-blue-200" />

          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.number}
                variants={itemVariants}
                className="relative text-center"
              >
                {/* Step number */}
                <div className="w-14 h-14 mx-auto rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold mb-6 relative z-10">
                  {step.number}
                </div>

                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                  <div className="w-10 h-10 mx-auto rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                    <Icon size={20} className="text-blue-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{step.title}</h3>
                  <span className="inline-block px-2 py-0.5 text-xs font-medium text-blue-600 bg-blue-50 rounded mb-3">
                    {step.time}
                  </span>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Arrow for mobile */}
                {i < steps.length - 1 && (
                  <div className="md:hidden flex justify-center py-4">
                    <ArrowRight size={20} className="text-blue-300 rotate-90" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
