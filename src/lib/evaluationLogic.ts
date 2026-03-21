// 評価指標の基本定義
export type EvalMaster = {
  id: string;
  name: string;
  unit: string;
  category: 'ROM' | 'MMT' | 'PROTOCOL' | 'CIRCUM';
  minPhase: number;      // 実施可能な最小フェーズ
  recommendPhase: number; // 最も推奨されるフェーズ
  targetLSI?: number;    // 目標とする健側比 (%)
};

// 部位ごとの評価マスター（body_part_key と完全一致させる）
export const EVAL_MASTER: Record<string, EvalMaster[]> = {
  // --- 下肢 ---
  knee: [
      { id: 'knee_flex', name: '膝屈曲可動域', unit: '°', category: 'ROM', minPhase: 1, recommendPhase: 1, targetLSI: 95 },
      { id: 'knee_ext', name: '膝伸展可動域', unit: '°', category: 'ROM', minPhase: 1, recommendPhase: 1, targetLSI: 100 },
      { id: 'thigh_circum', name: '大腿周径(10cm)', unit: 'cm', category: 'CIRCUM', minPhase: 1, recommendPhase: 2 },
      { id: 'quad_mmt', name: '大腿四頭筋筋力', unit: 'grade', category: 'MMT', minPhase: 2, recommendPhase: 3 },
      { id: 'single_leg_squat', name: '片脚スクワット(質)', unit: 'score', category: 'PROTOCOL', minPhase: 3, recommendPhase: 4 },
      { id: 'single_hop', name: '片脚幅跳び', unit: 'cm', category: 'PROTOCOL', minPhase: 4, recommendPhase: 5, targetLSI: 90 },
      { id: 'side_hop_30s', name: 'サイドホップ(30秒)', unit: '回', category: 'PROTOCOL', minPhase: 4, recommendPhase: 5, targetLSI: 90 },
  ],
  ankle: [
      { id: 'ankle_df', name: '足関節背屈可動域', unit: '°', category: 'ROM', minPhase: 1, recommendPhase: 1, targetLSI: 95 },
      { id: 'ankle_pf', name: '足関節底屈可動域', unit: '°', category: 'ROM', minPhase: 1, recommendPhase: 1, targetLSI: 95 },
      { id: 'ankle_circum', name: '足関節周径(8の字)', unit: 'cm', category: 'CIRCUM', minPhase: 1, recommendPhase: 2 },
      { id: 'sebt_ant', name: 'SEBT(前方リーチ)', unit: 'cm', category: 'PROTOCOL', minPhase: 2, recommendPhase: 3, targetLSI: 90 },
      { id: 'side_hop_ankle', name: 'サイドホップ', unit: '回', category: 'PROTOCOL', minPhase: 4, recommendPhase: 5, targetLSI: 90 },
  ],
  hip: [
      { id: 'hip_flex', name: '股関節屈曲可動域', unit: '°', category: 'ROM', minPhase: 1, recommendPhase: 1 },
      { id: 'hip_abd_mmt', name: '中殿筋筋力(MMT)', unit: 'grade', category: 'MMT', minPhase: 2, recommendPhase: 3 },
      { id: 'star_excursion', name: 'スターエクスカーション', unit: 'cm', category: 'PROTOCOL', minPhase: 3, recommendPhase: 4 },
  ],

  // --- 体幹部（背面） ---
  upper_back: [
      { id: 'thoracic_ext', name: '胸椎伸展可動域', unit: 'cm', category: 'ROM', minPhase: 1, recommendPhase: 2 },
      { id: 'thoracic_rot', name: '胸椎回旋可動域', unit: '°', category: 'ROM', minPhase: 1, recommendPhase: 2, targetLSI: 90 },
      { id: 'scapular_dys', name: '肩甲骨運動制御', unit: 'score', category: 'PROTOCOL', minPhase: 2, recommendPhase: 3 },
      { id: 'cet_test', name: 'Combined Elevation Test', unit: 'cm', category: 'PROTOCOL', minPhase: 3, recommendPhase: 4 },
  ],
  lumbar: [
      { id: 'lumbar_flex', name: '腰椎前屈(指床間距離)', unit: 'cm', category: 'ROM', minPhase: 1, recommendPhase: 1 },
      { id: 'lumbar_ext', name: '腰椎後屈可動域', unit: '°', category: 'ROM', minPhase: 1, recommendPhase: 2 },
      { id: 'mcgill_ext', name: '背筋持久性(McGill)', unit: '秒', category: 'PROTOCOL', minPhase: 3, recommendPhase: 4 },
      { id: 'multifidus_palp', name: '多裂筋収縮確認', unit: 'score', category: 'PROTOCOL', minPhase: 1, recommendPhase: 2 },
  ],

  // --- 体幹部（前面） ---
  thoracic_front: [
      { id: 'chest_exp', name: '胸郭拡張差', unit: 'cm', category: 'CIRCUM', minPhase: 1, recommendPhase: 1 },
      { id: 'rib_cage_mob', name: '肋骨可動性', unit: 'score', category: 'PROTOCOL', minPhase: 1, recommendPhase: 2 },
  ],
  abdominal: [
      { id: 'front_plank', name: 'フロントプランク', unit: '秒', category: 'PROTOCOL', minPhase: 2, recommendPhase: 3 },
      { id: 'side_plank', name: 'サイドプランク', unit: '秒', category: 'PROTOCOL', minPhase: 3, recommendPhase: 4, targetLSI: 95 },
      { id: 'abd_drawing', name: '腹部ドローイン保持', unit: '秒', category: 'PROTOCOL', minPhase: 1, recommendPhase: 2 },
  ],

  // --- 上肢 ---
  shoulder: [
      { id: 'sh_int_rot', name: '肩内旋可動域', unit: '°', category: 'ROM', minPhase: 1, recommendPhase: 1, targetLSI: 90 },
      { id: 'sh_ext_rot', name: '肩外旋可動域', unit: '°', category: 'ROM', minPhase: 1, recommendPhase: 1, targetLSI: 95 },
      { id: 'ckcuest', name: 'CKCUEST(安定性)', unit: '回', category: 'PROTOCOL', minPhase: 3, recommendPhase: 4, targetLSI: 90 },
      { id: 'y_balance_uq', name: 'Yバランス(上肢)', unit: 'cm', category: 'PROTOCOL', minPhase: 4, recommendPhase: 5 },
  ]
};

// 判定ロジック関数
export const getEvalStatus = (evaluation: EvalMaster, currentPhase: number) => {
  if (currentPhase < evaluation.minPhase) {
      return 'LOCKED'; // まだ実施すべきではない
  }
  if (currentPhase === evaluation.recommendPhase) {
      return 'RECOMMENDED'; // 今まさにやるべき
  }
  return 'AVAILABLE'; // 実施可能
};

// LSI (健側比) 計算
export const calculateLSI = (affected: number, healthy: number): number | null => {
  if (!affected || !healthy || healthy === 0) return null;
  return Math.round((affected / healthy) * 100);
};