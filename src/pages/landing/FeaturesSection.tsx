import { motion } from 'framer-motion';
import { BarChart3, Bell, FileText, Users, CheckCircle, Activity, Trophy, Heart } from 'lucide-react';

const coachFeatures = [
  { icon: Users, title: '全選手を一覧モニタリング', description: 'チーム全員のACWR・体調を一画面で把握' },
  { icon: Bell, title: '高リスク自動アラート', description: 'ACWR危険ゾーンの選手を自動検知して通知' },
  { icon: BarChart3, title: 'データ分析・可視化', description: 'トレンド分析で負荷の偏りを早期発見' },
  { icon: FileText, title: 'レポート生成', description: 'チーム状況をPDF/CSVでエクスポート' },
];

const athleteFeatures = [
  { icon: CheckCircle, title: '1分チェックイン', description: 'RPE・体調を毎日サクッと記録' },
  { icon: Activity, title: 'ACWR推移を確認', description: '自分のコンディションをリアルタイムで把握' },
  { icon: Heart, title: '統合コンディション管理', description: '体重・睡眠・モチベーション・月経周期を一元管理' },
  { icon: Trophy, title: 'ゲーミフィケーション', description: 'バッジ・ストリーク・ランキングで記録を習慣化' },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900" style={{ letterSpacing: '-0.02em' }}>
            コーチにも、選手にも。
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            それぞれの視点で、必要な情報を
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Coach Features */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users size={20} className="text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">コーチ・トレーナー向け</h3>
            </div>
            <div className="space-y-4">
              {coachFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={feature.title}
                    variants={itemVariants}
                    className="flex items-start gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Icon size={20} className="text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{feature.title}</h4>
                      <p className="text-sm text-gray-500 mt-0.5">{feature.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Athlete Features */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Activity size={20} className="text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">選手向け</h3>
            </div>
            <div className="space-y-4">
              {athleteFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={feature.title}
                    variants={itemVariants}
                    className="flex items-start gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                      <Icon size={20} className="text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{feature.title}</h4>
                      <p className="text-sm text-gray-500 mt-0.5">{feature.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
