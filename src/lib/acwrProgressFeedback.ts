export interface ProgressFeedback {
  title: string;
  message: string;
  type: 'success' | 'milestone' | 'encouragement';
  showConfetti?: boolean;
}

export function getDataEntryFeedback(
  totalDaysWithData: number,
  consecutiveDays: number
): ProgressFeedback | null {
  const MINIMUM_DAYS = 21;
  const RECOMMENDED_DAYS = 28;

  if (totalDaysWithData === MINIMUM_DAYS) {
    return {
      title: '🎉 ACWR分析が利用可能になりました！',
      message: '3週間のデータ蓄積完了。これからACWRで怪我リスクを管理できます。',
      type: 'milestone',
      showConfetti: true
    };
  }

  if (totalDaysWithData === RECOMMENDED_DAYS) {
    return {
      title: '✨ 推奨期間達成！',
      message: '4週間の完全なデータが揃いました。高精度なACWR分析が可能です。',
      type: 'milestone',
      showConfetti: true
    };
  }

  if (totalDaysWithData === 7) {
    return {
      title: '🎯 1週目完了！',
      message: '順調です。あと2週間でACWR分析が始まります。',
      type: 'milestone'
    };
  }

  if (totalDaysWithData === 14) {
    return {
      title: '📈 2週目完了！',
      message: '折り返し地点を通過。あと1週間でACWR分析開始です。',
      type: 'milestone'
    };
  }

  if (consecutiveDays === 3) {
    return {
      title: '🔥 3日連続記録！',
      message: '継続は力なり。この調子でデータを蓄積しましょう。',
      type: 'success'
    };
  }

  if (consecutiveDays === 7) {
    return {
      title: '💪 1週間連続記録！',
      message: '素晴らしい習慣化です。継続的な記録が正確な分析につながります。',
      type: 'success'
    };
  }

  if (consecutiveDays === 14) {
    return {
      title: '⭐ 2週間連続記録！',
      message: '驚異的な継続力です。もうすぐACWR分析が始まります。',
      type: 'success'
    };
  }

  if (totalDaysWithData % 5 === 0 && totalDaysWithData < MINIMUM_DAYS) {
    return {
      title: '記録継続中',
      message: `${totalDaysWithData}日目の記録完了。ACWR分析まであと${MINIMUM_DAYS - totalDaysWithData}日です。`,
      type: 'encouragement'
    };
  }

  return null;
}

export function getWeeklyProgress(daysWithData: number): {
  week: number;
  description: string;
  tip: string;
} {
  const week = Math.floor(daysWithData / 7) + 1;

  const weeklyInfo = {
    1: {
      description: '今週のトレーニング量を記録中',
      tip: '毎日のトレーニングを記録して、週間負荷を把握しましょう。'
    },
    2: {
      description: '先週との比較が可能になります',
      tip: '2週間のデータで負荷の変化が見えてきます。'
    },
    3: {
      description: 'ACWR分析の準備完了',
      tip: '来週からACWRで怪我リスクを管理できます。'
    },
    4: {
      description: '完全なACWR分析が可能',
      tip: '4週間のデータで最も正確な分析ができます。'
    }
  };

  const info = weeklyInfo[week as keyof typeof weeklyInfo] || weeklyInfo[4];

  return {
    week,
    description: info.description,
    tip: info.tip
  };
}

export function getDaysUntilACWR(daysWithData: number): {
  daysRemaining: number;
  isMinimumReached: boolean;
  isRecommendedReached: boolean;
  message: string;
} {
  const MINIMUM_DAYS = 21;
  const RECOMMENDED_DAYS = 28;

  const isMinimumReached = daysWithData >= MINIMUM_DAYS;
  const isRecommendedReached = daysWithData >= RECOMMENDED_DAYS;

  let daysRemaining = 0;
  let message = '';

  if (isRecommendedReached) {
    message = 'ACWR分析が最高精度で利用可能です';
  } else if (isMinimumReached) {
    daysRemaining = RECOMMENDED_DAYS - daysWithData;
    message = `あと${daysRemaining}日で推奨期間に到達します`;
  } else {
    daysRemaining = MINIMUM_DAYS - daysWithData;
    message = `ACWR分析まであと${daysRemaining}日です`;
  }

  return {
    daysRemaining,
    isMinimumReached,
    isRecommendedReached,
    message
  };
}
