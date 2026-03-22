import { motion } from 'framer-motion';
import { TrendingUp, AlertTriangle, Eye } from 'lucide-react';

const problems = [
  {
    icon: TrendingUp,
    title: '練習量の急激な増加',
    description: '大会前の追い込みで負荷が急上昇。体が適応する前に限界を超えてしまう。',
  },
  {
    icon: AlertTriangle,
    title: '疲労の蓄積に気づけない',
    description: '選手は「大丈夫」と言う。でも、体は限界のサインを出している。',
  },
  {
    icon: Eye,
    title: '感覚頼りの負荷管理',
    description: '経験と勘だけでは、見えない疲労がある。数値化しなければ、予兆は掴めない。',
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export function ProblemSection() {
  return (
    <section id="problem" className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900" style={{ letterSpacing: '-0.02em' }}>
            なぜ怪我は防げないのか？
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            多くの指導者が直面している、3つの壁
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid md:grid-cols-3 gap-8"
        >
          {problems.map((problem) => {
            const Icon = problem.icon;
            return (
              <motion.div
                key={problem.title}
                variants={itemVariants}
                className="relative p-8 bg-gray-50 rounded-2xl border border-gray-100"
              >
                <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-red-100 text-red-600 mb-5">
                  <Icon size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {problem.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {problem.description}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
