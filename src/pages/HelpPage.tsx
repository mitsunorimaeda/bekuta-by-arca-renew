import React, { useState, useEffect } from 'react';
import { User } from '../lib/supabase';
import {
  Book, Search, ChevronRight, ChevronDown, Home,
  Activity, Users, TrendingUp,
  Building2,
  Zap, HelpCircle, ArrowLeft,
  ThumbsUp, ThumbsDown
} from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';
import type { AppRole } from '../lib/roles';

interface HelpPageProps {
  user: User;
  onBack: () => void;
}

type HelpCategory = 'athlete' | 'coach' | 'admin' | 'all';
type SelectedCategory = 'all' | 'athlete' | 'coach' | 'admin';

useEffect(() => {
  const normalizeRole = (role?: string | null): AppRole | 'unknown' => {
    if (!role) return 'unknown';
  
    if (
      role === 'athlete' ||
      role === 'staff' ||
      role === 'global_admin'
    ) {
      return role;
    }
  
    return 'unknown';
  };
}, [userRole]);

interface HelpArticle {
  id: string;
  title: string;
  category: HelpCategory;
  icon: React.ReactNode;
  sections: {
    heading: string;
    content: string;
    steps?: string[];
    tips?: string[];
  }[];
  relatedArticles?: string[];
}



export function HelpPage({ user, onBack }: HelpPageProps) {
  const { isDarkMode } = useDarkMode();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SelectedCategory>('all');
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));
  const [helpful, setHelpful] = useState<{ [key: string]: boolean | null }>({});

  const userRole = user.role;

  useEffect(() => {
    const r = normalizeRole(userRole);
  
    if (r === 'athlete') setSelectedCategory('athlete');
    else if (isCoachLike(userRole)) setSelectedCategory('coach');
    else if (isAdminLike(userRole)) setSelectedCategory('admin');
    else setSelectedCategory('all');
  }, [userRole]);

  const articles: HelpArticle[] = [
    {
      id: 'athlete-dashboard',
      title: 'ダッシュボードの使い方',
      category: 'athlete',
      icon: <Home className="w-5 h-5" />,
      sections: [
        {
          heading: 'ダッシュボード概要',
          content: 'ダッシュボードは、あなたのトレーニングデータ、パフォーマンス、コンディションを一目で確認できる画面です。',
          steps: [
            '画面上部に現在のACWR（トレーニング負荷）が表示されます',
            '中央部にトレーニング履歴、体重、睡眠、モチベーションのグラフが表示されます',
            'アラートがある場合は画面上部に通知が表示されます',
            '各タブをクリックして詳細なデータを確認できます'
          ]
        },
        {
          heading: 'クイック記録バー',
          content: '画面下部の「+」ボタンから、トレーニング、体重、睡眠などを素早く記録できます。',
          tips: ['毎日同じ時間に記録する習慣をつけましょう', '記録を忘れた場合は後から追加も可能です']
        }
      ],
      relatedArticles: ['athlete-training', 'athlete-acwr']
    },
    {
      id: 'athlete-training',
      title: 'トレーニング記録の入力',
      category: 'athlete',
      icon: <Activity className="w-5 h-5" />,
      sections: [
        {
          heading: 'トレーニング記録の追加方法',
          content: 'トレーニング負荷（RPE × 時間）を記録することで、怪我のリスク管理ができます。',
          steps: [
            '「トレーニング記録」タブをクリック',
            '「+ 記録を追加」ボタンをクリック',
            '日付、種目、時間（分）、RPE（主観的運動強度 1-10）を入力',
            '「保存」をクリックして記録完了'
          ]
        },
        {
          heading: 'RPE（主観的運動強度）とは',
          content: 'RPEは1〜10のスケールで、トレーニングのきつさを評価します。',
          steps: [
            '1-2: 非常に軽い',
            '3-4: 軽い',
            '5-6: やや強い',
            '7-8: 強い',
            '9-10: 非常に強い'
          ],
          tips: ['正直な感覚で評価することが重要です', 'コーチの指示と自分の感覚を照らし合わせましょう']
        },
        {
          heading: '過去の記録の編集・削除',
          content: '間違えて入力した記録は、編集または削除が可能です。',
          steps: [
            'トレーニング記録リストから編集したい記録を探す',
            '記録をクリックして詳細を表示',
            '「編集」または「削除」ボタンをクリック'
          ]
        }
      ],
      relatedArticles: ['athlete-acwr', 'athlete-alerts']
    },
    {
      id: 'athlete-acwr',
      title: 'ACWR（トレーニング負荷）の理解',
      category: 'athlete',
      icon: <TrendingUp className="w-5 h-5" />,
      sections: [
        {
          heading: 'ACWRとは',
          content: 'ACWR（Acute:Chronic Workload Ratio）は、急性負荷と慢性負荷の比率で、怪我のリスクを評価する指標です。',
          steps: [
            '急性負荷: 直近1週間のトレーニング負荷',
            '慢性負荷: 過去4週間の平均トレーニング負荷',
            'ACWR = 急性負荷 ÷ 慢性負荷'
          ]
        },
        {
          heading: 'ACWRの目安',
          content: 'ACWRの値によって、トレーニング計画を調整することが重要です。',
          steps: [
            '0.8〜1.3: 理想的なゾーン（緑色）',
            '1.3〜1.5: 注意が必要（黄色）',
            '1.5以上: 怪我のリスクが高い（赤色）',
            '0.8未満: トレーニング不足の可能性（青色）'
          ],
          tips: [
            '赤色が表示されたら、休息を取るか負荷を減らしましょう',
            '青色が続く場合は、トレーニング強度を上げることを検討しましょう'
          ]
        },
        {
          heading: 'ACWRグラフの見方',
          content: 'グラフには週ごとのACWRの推移が表示されます。',
          tips: [
            '急激な上昇は避けるようにしましょう',
            '安定した推移が理想的です',
            'コーチと相談しながら調整してください'
          ]
        }
      ],
      relatedArticles: ['athlete-training', 'athlete-alerts']
    },
    {
      id: 'coach-dashboard',
      title: 'コーチダッシュボードの使い方',
      category: 'coach',
      icon: <Users className="w-5 h-5" />,
      sections: [
        {
          heading: 'コーチビュー概要',
          content: 'チーム全体のデータを管理し、各選手の状態を把握できます。',
          steps: [
            'チーム選択でデータを切り替え',
            '選手一覧で個別の状態を確認',
            'チーム平均ACWRでチーム全体の負荷を監視',
            'アラートパネルで注意が必要な選手を把握'
          ]
        },
        {
          heading: 'チーム選択',
          content: '複数のチームを担当している場合、チームを切り替えて表示できます。',
          steps: [
            '画面上部のチームセレクターをクリック',
            '担当しているチームが一覧表示される',
            '表示したいチームを選択'
          ]
        }
      ],
      relatedArticles: ['coach-athletes', 'coach-alerts']
    },
    {
      id: 'admin-overview',
      title: '組織管理ダッシュボード',
      category: 'admin',
      icon: <Building2 className="w-5 h-5" />,
      sections: [
        {
          heading: '組織管理者の役割',
          content: '組織全体のユーザー、チーム、権限、サブスクリプションを管理します。',
          steps: [
            '新規ユーザーの招待',
            'チームの作成と管理',
            '役割と権限の設定',
            'サブスクリプションの管理',
            '組織設定のカスタマイズ'
          ]
        },
        {
          heading: 'ダッシュボードの見方',
          content: '組織の概要を一目で確認できます。',
          steps: [
            '総ユーザー数、チーム数の表示',
            'アクティブユーザーの把握',
            '最近の活動ログ',
            'サブスクリプションステータス'
          ]
        }
      ],
      relatedArticles: ['admin-users', 'admin-teams']
    }
  ];

  const filteredArticles = articles.filter(article => {
    const matchesCategory =
      selectedCategory === 'all' ||
      article.category === selectedCategory ||
      article.category === 'all';

    const matchesSearch =
      searchQuery === '' ||
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.sections.some(section =>
        section.heading.toLowerCase().includes(searchQuery.toLowerCase()) ||
        section.content.toLowerCase().includes(searchQuery.toLowerCase())
      );

    return matchesCategory && matchesSearch;
  });

  const currentArticle = selectedArticle ? articles.find(a => a.id === selectedArticle) : null;

  const toggleSection = (index: number) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(index)) newExpanded.delete(index);
    else newExpanded.add(index);
    setExpandedSections(newExpanded);
  };

  const handleFeedback = (articleId: string, isHelpful: boolean) => {
    setHelpful(prev => ({ ...prev, [articleId]: isHelpful }));
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <button
            onClick={onBack}
            className={`flex items-center gap-2 mb-4 px-4 py-2 rounded-lg transition-colors ${
              isDarkMode
                ? 'text-gray-300 hover:text-white hover:bg-gray-800'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
            戻る
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
              <Book className={`w-8 h-8 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
            <div>
              <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                ヘルプ・ユーザーマニュアル
              </h1>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                機能の使い方や疑問点を解決します
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
              <input
                type="text"
                placeholder="キーワードで検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-10 pr-4 py-3 rounded-lg border ${
                  isDarkMode
                    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-blue-600 text-white'
                    : isDarkMode
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                すべて
              </button>
              <button
                onClick={() => setSelectedCategory('athlete')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedCategory === 'athlete'
                    ? 'bg-blue-600 text-white'
                    : isDarkMode
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                選手
              </button>
              <button
                onClick={() => setSelectedCategory('coach')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedCategory === 'coach'
                    ? 'bg-blue-600 text-white'
                    : isDarkMode
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                コーチ
              </button>
              <button
                onClick={() => setSelectedCategory('admin')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedCategory === 'admin'
                    ? 'bg-blue-600 text-white'
                    : isDarkMode
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                管理者
              </button>
            </div>
          </div>
        </div>

        {!selectedArticle ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredArticles.map((article) => (
              <button
                key={article.id}
                onClick={() => {
                  setSelectedArticle(article.id);
                  setExpandedSections(new Set([0]));
                }}
                className={`p-6 rounded-lg text-left transition-all hover:shadow-lg ${
                  isDarkMode
                    ? 'bg-gray-800 hover:bg-gray-750 border border-gray-700'
                    : 'bg-white hover:bg-gray-50 border border-gray-200'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${
                    article.category === 'athlete'
                      ? isDarkMode ? 'bg-green-900/30' : 'bg-green-100'
                      : article.category === 'coach'
                      ? isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100'
                      : isDarkMode ? 'bg-purple-900/30' : 'bg-purple-100'
                  }`}>
                    {React.cloneElement(article.icon as React.ReactElement, {
                      className: `w-6 h-6 ${
                        article.category === 'athlete'
                          ? isDarkMode ? 'text-green-400' : 'text-green-600'
                          : article.category === 'coach'
                          ? isDarkMode ? 'text-blue-400' : 'text-blue-600'
                          : isDarkMode ? 'text-purple-400' : 'text-purple-600'
                      }`
                    })}
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {article.title}
                    </h3>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {article.sections[0].content.slice(0, 60)}...
                    </p>
                  </div>
                  <ChevronRight className={`w-5 h-5 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                </div>
              </button>
            ))}
          </div>
        ) : currentArticle ? (
          <div className={`rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className={`p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <button
                onClick={() => setSelectedArticle(null)}
                className={`flex items-center gap-2 mb-4 text-sm ${
                  isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
                記事一覧に戻る
              </button>
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${
                  currentArticle.category === 'athlete'
                    ? isDarkMode ? 'bg-green-900/30' : 'bg-green-100'
                    : currentArticle.category === 'coach'
                    ? isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100'
                    : isDarkMode ? 'bg-purple-900/30' : 'bg-purple-100'
                }`}>
                  {React.cloneElement(currentArticle.icon as React.ReactElement, {
                    className: `w-8 h-8 ${
                      currentArticle.category === 'athlete'
                        ? isDarkMode ? 'text-green-400' : 'text-green-600'
                        : currentArticle.category === 'coach'
                        ? isDarkMode ? 'text-blue-400' : 'text-blue-600'
                        : isDarkMode ? 'text-purple-400' : 'text-purple-600'
                    }`
                  })}
                </div>
                <div>
                  <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {currentArticle.title}
                  </h2>
                  <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${
                    currentArticle.category === 'athlete'
                      ? isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                      : currentArticle.category === 'coach'
                      ? isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'
                      : isDarkMode ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {currentArticle.category === 'athlete'
                      ? '選手向け'
                      : currentArticle.category === 'coach'
                      ? 'コーチ向け'
                      : '管理者向け'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6">
              {currentArticle.sections.map((section, index) => (
                <div
                  key={index}
                  className={`mb-4 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} ${
                    index !== currentArticle.sections.length - 1 ? 'border-b pb-4' : ''
                  }`}
                >
                  <button
                    onClick={() => toggleSection(index)}
                    className={`w-full flex items-center justify-between p-4 rounded-lg transition-colors ${
                      isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                    }`}
                  >
                    <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {section.heading}
                    </h3>
                    {expandedSections.has(index) ? (
                      <ChevronDown className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                    ) : (
                      <ChevronRight className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                    )}
                  </button>

                  {expandedSections.has(index) && (
                    <div className="px-4 pt-2">
                      <p className={`mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{section.content}</p>

                      {section.steps && section.steps.length > 0 && (
                        <div className={`mb-4 p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                          <ol className="space-y-2">
                            {section.steps.map((step, stepIndex) => (
                              <li
                                key={stepIndex}
                                className={`flex gap-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
                              >
                                <span className={`font-semibold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                                  {stepIndex + 1}.
                                </span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {section.tips && section.tips.length > 0 && (
                        <div
                          className={`p-4 rounded-lg ${
                            isDarkMode
                              ? 'bg-yellow-900/20 border border-yellow-800'
                              : 'bg-yellow-50 border border-yellow-200'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <Zap className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />
                            <div>
                              <h4 className={`font-semibold mb-2 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-800'}`}>
                                ヒント
                              </h4>
                              <ul className="space-y-1">
                                {section.tips.map((tip, tipIndex) => (
                                  <li key={tipIndex} className={`text-sm ${isDarkMode ? 'text-yellow-300' : 'text-yellow-700'}`}>
                                    • {tip}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              <div className={`mt-6 pt-6 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <p className={`text-sm mb-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  この記事は役に立ちましたか？
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleFeedback(currentArticle.id, true)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      helpful[currentArticle.id] === true
                        ? 'bg-green-600 text-white'
                        : isDarkMode
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <ThumbsUp className="w-4 h-4" />
                    はい
                  </button>
                  <button
                    onClick={() => handleFeedback(currentArticle.id, false)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      helpful[currentArticle.id] === false
                        ? 'bg-red-600 text-white'
                        : isDarkMode
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <ThumbsDown className="w-4 h-4" />
                    いいえ
                  </button>
                </div>
              </div>

              {currentArticle.relatedArticles && currentArticle.relatedArticles.length > 0 && (
                <div className={`mt-6 pt-6 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <h4 className={`font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    関連記事
                  </h4>
                  <div className="space-y-2">
                    {currentArticle.relatedArticles.map((relatedId) => {
                      const relatedArticle = articles.find(a => a.id === relatedId);
                      if (!relatedArticle) return null;
                      return (
                        <button
                          key={relatedId}
                          onClick={() => {
                            setSelectedArticle(relatedId);
                            setExpandedSections(new Set([0]));
                          }}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                            isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                          }`}
                        >
                          {relatedArticle.icon}
                          <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            {relatedArticle.title}
                          </span>
                          <ChevronRight className={`w-4 h-4 ml-auto ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {!selectedArticle && filteredArticles.length === 0 && (
          <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            <HelpCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>検索結果が見つかりませんでした</p>
            <p className="text-sm mt-2">別のキーワードで検索してみてください</p>
          </div>
        )}
      </div>
    </div>
  );
}