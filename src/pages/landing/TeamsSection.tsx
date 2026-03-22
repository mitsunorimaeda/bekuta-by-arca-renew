import { motion } from 'framer-motion';
import { School, Trophy } from 'lucide-react';

interface Team {
  school: string;
  clubs: string[];
}

const teams: Team[] = [
  {
    school: '愛知工業大学名電高等学校',
    clubs: ['フェンシング部', 'サッカー部', 'バドミントン部', '陸上部', 'チアリーディング部', 'バスケットボール部', 'バレーボール部'],
  },
  {
    school: '大同大学大同高等学校',
    clubs: ['サッカー部'],
  },
  {
    school: '三重県立津西高等学校',
    clubs: ['サッカー部'],
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export function TeamsSection() {
  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 text-sm font-medium text-amber-700 bg-amber-100 rounded-full">
            <Trophy size={16} />
            導入実績
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900" style={{ letterSpacing: '-0.02em' }}>
            多くのチームに選ばれています
          </h2>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto"
        >
          {teams.map((team) => (
            <motion.div
              key={team.school}
              variants={itemVariants}
              className="bg-gray-50 rounded-2xl p-6 border border-gray-100"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <School size={20} className="text-blue-600" />
                </div>
                <h3 className="text-sm font-bold text-gray-900 leading-tight">
                  {team.school}
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {team.clubs.map((club) => (
                  <span
                    key={club}
                    className="px-3 py-1 text-xs font-medium text-gray-600 bg-white rounded-full border border-gray-200"
                  >
                    {club}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 text-center text-sm text-gray-400"
        >
          ※ 2026年3月時点
        </motion.p>
      </div>
    </section>
  );
}
