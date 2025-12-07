import { TutorialStep } from '../components/TutorialController';

export const athleteTutorialSteps: TutorialStep[] = [
  {
    id: 'athlete-welcome',
    title: 'Bekuta へようこそ',
    description: '総合コンディショニングアプリBekutaへようこそ。トレーニング、体重、睡眠、モチベーション、パフォーマンスを一元管理し、データでコンディションを可視化します。',
    position: 'center',
  },
  {
    id: 'athlete-unified-checkin',
    title: '統合デイリーチェックイン',
    description: '1つの画面で「トレーニング」「体重」「睡眠」「モチベーション」を記録。毎日のルーティンをシンプルに、続けやすく設計しています。',
    targetSelector: '[data-tutorial="daily-checkin"]',
    position: 'bottom',
  },
  {
    id: 'athlete-performance',
    title: 'パフォーマンス記録',
    description: 'ベンチプレス、スクワットなどの筋力、持久力、スプリントなどのパフォーマンス測定を記録。成長を可視化し、ベスト更新を祝います。',
    targetSelector: '[data-tutorial="performance-tab"]',
    position: 'bottom',
  },
  {
    id: 'athlete-acwr-chart',
    title: 'トレーニング負荷の可視化',
    description: '急性・慢性ワークロード比（ACWR）で怪我リスクを科学的に管理。0.8〜1.3が理想的で、急激な負荷増加を防ぎます。',
    targetSelector: '[data-tutorial="acwr-chart"]',
    position: 'top',
  },
  {
    id: 'athlete-multi-metric',
    title: '総合コンディションタイムライン',
    description: 'トレーニング、体重、睡眠、モチベーションを同時表示。相関関係を見つけ、コンディションの全体像を把握しましょう。',
    targetSelector: '[data-tutorial="multi-metric-timeline"]',
    position: 'top',
  },
  {
    id: 'athlete-alerts',
    title: 'インテリジェントアラート',
    description: '複数の指標を統合分析し、怪我リスク、オーバートレーニング、回復不足を早期に発見。アクション提案で対応もサポートします。',
    targetSelector: '[data-tutorial="alert-badge"]',
    position: 'bottom',
  },
  {
    id: 'athlete-gamification',
    title: 'ゲーミフィケーション',
    description: '楽しくモチベーションを維持！記録を続けてストリークを伸ばし、ポイントを獲得してレベルアップ。バッジを集めて達成感を味わいましょう。',
    targetSelector: '[data-tutorial="gamification-tab"]',
    position: 'bottom',
  },
  {
    id: 'athlete-complete',
    title: 'チュートリアル完了！',
    description: 'Bekutaで総合的なコンディション管理を始めましょう。毎日データを記録し、科学的な根拠に基づいたトレーニングでパフォーマンスを最大化します。',
    position: 'center',
  },
];

export const staffTutorialSteps: TutorialStep[] = [
  {
    id: 'staff-welcome',
    title: 'Bekuta スタッフダッシュボードへようこそ',
    description: 'チーム全体のトレーニング状況を科学的に監視し、選手の怪我リスクをデータに基づいて管理できます。',
    position: 'center',
  },
  {
    id: 'staff-team-selector',
    title: 'チーム選択',
    description: '担当するチームを選択できます。複数のチームを管理している場合は、ここで切り替えられます。',
    targetSelector: '[data-tutorial="team-selector"]',
    position: 'bottom',
  },
  {
    id: 'staff-alert-summary',
    title: 'リアルタイムアラート',
    description: 'チーム全体の注意が必要な選手が一目で分かります。AIが分析した優先度の高いアラートに素早く対応し、怪我を事前に防ぎましょう。',
    targetSelector: '[data-tutorial="alert-summary"]',
    position: 'bottom',
  },
  {
    id: 'staff-athletes-tab',
    title: '選手一覧',
    description: 'チームの全選手を一覧で確認できます。各選手の状態を把握し、個別にサポートできます。',
    targetSelector: '[data-tutorial="athletes-tab"]',
    position: 'bottom',
  },
  {
    id: 'staff-athlete-list',
    title: '選手の詳細確認',
    description: '選手をクリックすると、詳細なトレーニング履歴とACWRグラフを確認できます。',
    targetSelector: '[data-tutorial="athlete-list"]',
    position: 'right',
  },
  {
    id: 'staff-team-average',
    title: 'チームパフォーマンス分析',
    description: 'チーム全体の平均ACWRの推移を科学的に分析できます。トレーニングプログラムの効果を定量的に評価し、最適化に役立てましょう。',
    targetSelector: '[data-tutorial="team-average-tab"]',
    position: 'bottom',
  },
  {
    id: 'staff-trends',
    title: '傾向分析',
    description: 'チームの長期的な傾向を分析し、トレーニング計画の最適化に役立てられます。',
    targetSelector: '[data-tutorial="trends-tab"]',
    position: 'bottom',
  },
  {
    id: 'staff-export',
    title: 'データエクスポート',
    description: 'トレーニングデータをCSV形式でエクスポートし、詳細な分析や記録保管ができます。',
    targetSelector: '[data-tutorial="export-button"]',
    position: 'bottom',
  },
  {
    id: 'staff-complete',
    title: 'チュートリアル完了！',
    description: 'これでBekutaスタッフダッシュボードの基本的な使い方を学びました。データ駆動型アプローチで選手の安全を守り、最大限のパフォーマンス向上をサポートしましょう。',
    position: 'center',
  },
];

export const adminTutorialSteps: TutorialStep[] = [
  {
    id: 'admin-welcome',
    title: 'Bekuta 管理者ダッシュボードへようこそ',
    description: '組織全体のトレーニングデータを一元管理。ユーザー招待、チーム管理、システム監視を効率的に行えます。',
    position: 'center',
  },
  {
    id: 'admin-alert-summary',
    title: '統合アラート監視',
    description: '組織全体のアラートを一画面で監視できます。重大な怪我リスクやシステム問題に素早く対応し、安全な環境を維持しましょう。',
    targetSelector: '[data-tutorial="admin-alert-summary"]',
    position: 'bottom',
  },
  {
    id: 'admin-overview-tab',
    title: '概要タブ',
    description: 'システム全体の統計情報や重要な指標を確認できます。',
    targetSelector: '[data-tutorial="overview-tab"]',
    position: 'bottom',
  },
  {
    id: 'admin-invite-tab',
    title: 'ユーザー招待システム',
    description: '新しいユーザーを招待し、Bekutaエコシステムを拡大できます。個別招待とCSV一括招待の2つの方法で、効率的なオンボーディングが可能です。',
    targetSelector: '[data-tutorial="invite-tab"]',
    position: 'bottom',
  },
  {
    id: 'admin-single-invite',
    title: '個別ユーザー招待',
    description: '1人ずつ招待する場合はこちらを使います。名前、メール、役割、チームを入力してください。',
    targetSelector: '[data-tutorial="single-invite"]',
    position: 'right',
  },
  {
    id: 'admin-bulk-invite',
    title: '一括ユーザー招待',
    description: 'CSVファイルから複数のユーザーを一度に招待できます。テンプレートをダウンロードして使用してください。',
    targetSelector: '[data-tutorial="bulk-invite"]',
    position: 'right',
  },
  {
    id: 'admin-manage-tab',
    title: 'ユーザー管理',
    description: '既存のユーザー情報を編集、削除できます。パスワードリセットもここから行えます。',
    targetSelector: '[data-tutorial="manage-tab"]',
    position: 'bottom',
  },
  {
    id: 'admin-user-list',
    title: 'ユーザー一覧',
    description: '全ユーザーの情報を確認できます。検索機能を使って特定のユーザーを見つけることもできます。',
    targetSelector: '[data-tutorial="user-list"]',
    position: 'top',
  },
  {
    id: 'admin-complete',
    title: 'チュートリアル完了！',
    description: 'Bekuta管理者ダッシュボードの基本機能をマスターしました。データ駆動型のアプローチで、組織全体のパフォーマンス向上と安全なトレーニング環境を実現しましょう。',
    position: 'center',
  },
];

export const gamificationTutorialSteps: TutorialStep[] = [
  {
    id: 'gamification-welcome',
    title: 'ゲーミフィケーションへようこそ！',
    description: 'モチベーションを維持しながら継続的な記録を楽しもう！ストリーク、ポイント、バッジ、目標で成長を可視化します。',
    position: 'center',
  },
  {
    id: 'gamification-streaks',
    title: 'ストリーク - 連続記録',
    description: '毎日記録を続けてストリークを伸ばそう！練習、体重、睡眠、モチベーションの4種類。連続記録が途切れそうな時は警告が表示されます。',
    targetSelector: '[data-tutorial="streaks-section"]',
    position: 'right',
  },
  {
    id: 'gamification-level',
    title: 'レベル & ポイント',
    description: '記録を入力するとポイントを獲得！レベルアップすると新しいランクタイトルが手に入ります。ビギナーからレジェンドまで、7段階のランクがあります。',
    targetSelector: '[data-tutorial="level-section"]',
    position: 'right',
  },
  {
    id: 'gamification-badges',
    title: 'バッジコレクション',
    description: '特別な達成でバッジを獲得！7日連続記録、パーソナルベスト更新、完璧な週など。レアリティは4段階（Common, Rare, Epic, Legendary）。',
    targetSelector: '[data-tutorial="badges-card"]',
    position: 'bottom',
  },
  {
    id: 'gamification-goals',
    title: '目標設定',
    description: '自分だけの目標を設定して達成を目指そう！パフォーマンス、体重、ストリーク、習慣、カスタムなど様々な目標タイプから選べます。',
    targetSelector: '[data-tutorial="goals-section"]',
    position: 'left',
  },
  {
    id: 'gamification-rankings',
    title: 'チームランキング',
    description: 'チームメンバーと競い合おう！週間記録数とポイントの2つのランキングがあります。切磋琢磨して成長しましょう。',
    targetSelector: '[data-tutorial="rankings-section"]',
    position: 'left',
  },
  {
    id: 'gamification-complete',
    title: 'さあ、始めよう！',
    description: '楽しみながら記録を続けて、ストリークを伸ばし、バッジを集めましょう。継続は力なり！',
    position: 'center',
  },
];

export function getTutorialSteps(role: 'athlete' | 'staff' | 'admin' | 'gamification'): TutorialStep[] {
  switch (role) {
    case 'athlete':
      return athleteTutorialSteps;
    case 'staff':
      return staffTutorialSteps;
    case 'admin':
      return adminTutorialSteps;
    case 'gamification':
      return gamificationTutorialSteps;
    default:
      return [];
  }
}
