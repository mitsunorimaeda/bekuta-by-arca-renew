import React, { useState, useEffect } from 'react';
import { User } from '../lib/supabase';
import {
  Book, Search, ChevronRight, ChevronDown, Home,
  Activity, Users, TrendingUp, Building2, Bell,
  Zap, HelpCircle, ArrowLeft, ExternalLink,
  ThumbsUp, ThumbsDown, Scale, Moon, Heart,
  Trophy, Shield, Smartphone, WifiOff, CreditCard, MessageCircle
} from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';

interface HelpPageProps {
  user: User;
  onBack: () => void;
}

type HelpCategory = 'athlete' | 'coach' | 'admin' | 'all';

interface HelpArticle {
  id: string;
  title: string;
  category: HelpCategory;
  icon: React.ReactNode;
  noteUrl?: string;
  sections: {
    heading: string;
    content: string;
    steps?: string[];
    tips?: string[];
  }[];
  relatedArticles?: string[];
}

const NOTE_BASE = 'https://note.com/bekuta_arca';

export function HelpPage({ user, onBack }: HelpPageProps) {
  const { isDarkMode } = useDarkMode();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<HelpCategory>('all');
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));
  const [helpful, setHelpful] = useState<Record<string, boolean | null>>({});

  const userRole = user.role;

  useEffect(() => {
    if (userRole === 'athlete') setSelectedCategory('athlete');
    else if (userRole === 'staff') setSelectedCategory('coach');
    else if (userRole === 'global_admin') setSelectedCategory('admin');
    else setSelectedCategory('all');
  }, [userRole]);

  const articles: HelpArticle[] = [
    // ========== 選手向け ==========
    {
      id: 'athlete-checkin',
      title: '毎日のチェックイン方法',
      category: 'athlete',
      icon: <Activity className="w-5 h-5" />,
      noteUrl: NOTE_BASE,
      sections: [
        {
          heading: 'チェックインとは',
          content: '毎日の練習内容・体調を記録することで、ACWRが自動計算され、怪我のリスクを可視化できます。1日1分で完了します。',
        },
        {
          heading: '記録の手順',
          content: '右下の「+」ボタンからチェックインを開始します。',
          steps: [
            '右下の青い「+」ボタンをタップ',
            '練習記録：RPE（きつさ 0〜10）とトレーニング時間を入力',
            '体重：今日の体重を入力',
            '睡眠・モチベーション：スライダーで記録',
            '「保存」をタップして完了',
          ],
          tips: [
            '毎日同じ時間に記録する習慣をつけましょう',
            'RPEは正直な感覚で。コーチに見られても大丈夫です',
            '練習がない日も「休養（RPE 0）」として記録すると、ACWRの精度が上がります',
          ],
        },
        {
          heading: 'オフラインでも記録できます',
          content: '電波の悪い体育館やグラウンドでも記録可能です。オフラインで保存した記録は、インターネットに接続した時に自動で送信されます。',
        },
      ],
      relatedArticles: ['athlete-acwr', 'athlete-gamification'],
    },
    {
      id: 'athlete-acwr',
      title: 'ACWR（トレーニング負荷）の見方',
      category: 'athlete',
      icon: <TrendingUp className="w-5 h-5" />,
      noteUrl: NOTE_BASE,
      sections: [
        {
          heading: 'ACWRとは',
          content: 'ACWR（急性:慢性負荷比）は、直近1週間の負荷と過去4週間の平均負荷の比率です。この数値で怪我のリスクを予測できます。',
          steps: [
            '急性負荷: 直近7日間のトレーニング負荷の合計',
            '慢性負荷: 過去28日間の平均トレーニング負荷',
            'ACWR = 急性負荷 ÷ 慢性負荷',
          ],
        },
        {
          heading: 'ACWRの目安',
          content: 'ダッシュボードの色で直感的にリスクがわかります。',
          steps: [
            '0.8〜1.3（緑）: 理想的なゾーン。このまま継続しましょう',
            '1.3〜1.5（黄）: 注意。負荷が急に増えています',
            '1.5以上（赤）: 高リスク。休息を取るか負荷を減らしましょう',
            '0.8未満（青）: トレーニング不足の可能性。徐々に負荷を上げましょう',
          ],
          tips: [
            '急激な変化を避け、週あたり10%以内の増加が安全です',
            '赤が出たらコーチに相談しましょう',
          ],
        },
      ],
      relatedArticles: ['athlete-checkin', 'athlete-dashboard'],
    },
    {
      id: 'athlete-dashboard',
      title: 'ダッシュボードの使い方',
      category: 'athlete',
      icon: <Home className="w-5 h-5" />,
      noteUrl: NOTE_BASE,
      sections: [
        {
          heading: '総合スコア',
          content: '画面上部に表示される総合スコア（0〜100）は、ACWR・体重・睡眠・モチベーションを統合したコンディション指標です。',
          tips: [
            '毎日チェックインすることでスコアの精度が上がります',
            '70以上を維持できるようにしましょう',
          ],
        },
        {
          heading: 'タブの切り替え',
          content: '画面上部のタブで、練習記録・体重・睡眠・モチベーションの詳細グラフを確認できます。各タブにはトレンドチャートと過去の記録一覧が表示されます。',
        },
      ],
      relatedArticles: ['athlete-checkin', 'athlete-acwr'],
    },
    {
      id: 'athlete-gamification',
      title: 'バッジ・ストリーク・ランキング',
      category: 'athlete',
      icon: <Trophy className="w-5 h-5" />,
      noteUrl: NOTE_BASE,
      sections: [
        {
          heading: 'ストリーク（連続記録）',
          content: '毎日チェックインを続けると、連続記録（ストリーク）が伸びていきます。ストリークが長いほどポイントが多くもらえます。',
          tips: ['1日でも忘れるとリセットされるので、通知をONにしておきましょう'],
        },
        {
          heading: 'バッジ',
          content: '特定の条件を達成するとバッジがもらえます。Common（銅）→ Rare（銀）→ Epic（金）→ Legendary（虹）の4ランクがあります。',
        },
        {
          heading: 'ランキング',
          content: 'チーム内でのポイントランキングが表示されます。チェックインの継続やバッジ獲得でポイントが貯まります。',
        },
      ],
    },
    {
      id: 'athlete-notification',
      title: '通知とメッセージ',
      category: 'athlete',
      icon: <Bell className="w-5 h-5" />,
      noteUrl: NOTE_BASE,
      sections: [
        {
          heading: 'Push通知の設定',
          content: '設定画面から通知をONにすると、チェックインリマインダーやコーチからのメッセージをスマホで受信できます。',
          steps: [
            'サイドメニュー → 設定 → 通知設定',
            '「通知を有効にする」をタップ',
            'ブラウザの通知許可で「許可」を選択',
          ],
        },
        {
          heading: 'メッセージ',
          content: 'ヘッダーの吹き出しアイコンからメッセージ画面を開けます。コーチとの個別やり取りができます。',
        },
      ],
    },
    {
      id: 'athlete-offline',
      title: 'オフラインでの利用',
      category: 'athlete',
      icon: <WifiOff className="w-5 h-5" />,
      sections: [
        {
          heading: 'オフライン保存',
          content: '電波が弱い場所でも、チェックインの記録は端末に一時保存されます。',
          steps: [
            '通常通りチェックインを入力して保存',
            '「オフラインで保存しました」と表示される',
            'インターネットに接続すると自動で同期される',
            '「同期完了」の表示で送信完了',
          ],
          tips: [
            'ホーム画面に追加（PWA）すると、オフライン対応がより安定します',
            '画面下部に未送信件数が表示されます',
          ],
        },
      ],
    },
    {
      id: 'athlete-pwa',
      title: 'ホーム画面への追加（PWA）',
      category: 'athlete',
      icon: <Smartphone className="w-5 h-5" />,
      sections: [
        {
          heading: 'アプリのように使う',
          content: 'Bekutaはブラウザで動くWebアプリですが、ホーム画面に追加するとネイティブアプリのように使えます。',
          steps: [
            'ブラウザでBekutaを開く',
            'iPhone: 共有ボタン（□↑）→「ホーム画面に追加」',
            'Android: メニュー（⋮）→「ホーム画面に追加」または「アプリをインストール」',
            'ホーム画面のアイコンからアプリとして起動',
          ],
          tips: [
            'ホーム画面から起動すると、フルスクリーンで表示されます',
            'Push通知を受信するにはホーム画面への追加が必要です（iPhone）',
          ],
        },
      ],
    },
    // ========== コーチ向け ==========
    {
      id: 'coach-dashboard',
      title: 'コーチダッシュボードの使い方',
      category: 'coach',
      icon: <Users className="w-5 h-5" />,
      noteUrl: NOTE_BASE,
      sections: [
        {
          heading: '選手一覧',
          content: 'ダッシュボードには全選手のACWR・コンディション・最終チェックイン日時が一覧表示されます。色でリスクレベルが直感的にわかります。',
          steps: [
            '赤（高リスク）の選手を優先的に確認',
            '選手をクリックすると詳細モーダルが開く',
            'モーダルでACWRチャート・体重推移・睡眠パターンを確認',
          ],
        },
        {
          heading: 'タブの使い方',
          content: 'ダッシュボードには「選手一覧」「通知」「レポート」「パフォーマンス」「その他」の5つのタブがあります。',
          steps: [
            '選手一覧: 全選手の状態を一目で確認',
            '通知: 選手への一斉通知を送信',
            'レポート: チーム・選手のレポートを生成（Proプラン）',
            'パフォーマンス: 測定記録の管理（Proプラン）',
            'その他: チーム分析・ランキング等',
          ],
        },
      ],
      relatedArticles: ['coach-notification', 'coach-report'],
    },
    {
      id: 'coach-notification',
      title: '通知の送信',
      category: 'coach',
      icon: <Bell className="w-5 h-5" />,
      noteUrl: NOTE_BASE,
      sections: [
        {
          heading: '一斉通知の送り方',
          content: 'ダッシュボードの「通知」タブから、全選手または選択した選手にPush通知を送れます。',
          steps: [
            '「通知」タブを開く',
            'タイトルと本文を入力',
            '送信先を選択（全員 or 個別選択）',
            '「送信」をタップ',
          ],
          tips: [
            'Freeプランは月10回まで、Proプランは無制限です',
            '送信履歴は「通知」タブの下部で確認できます',
          ],
        },
        {
          heading: 'メッセージ',
          content: 'ヘッダーの吹き出しアイコンから個別メッセージを送れます。通知とは異なり、個別の会話として記録されます。',
        },
      ],
    },
    {
      id: 'coach-report',
      title: 'レポート生成',
      category: 'coach',
      icon: <Book className="w-5 h-5" />,
      sections: [
        {
          heading: 'レポートの作成',
          content: 'チーム全体または個別選手のレポートを生成できます。期間を指定してPDFで出力可能です。',
          steps: [
            '「レポート」タブを開く',
            'レポートタイプ（チーム / 個人）を選択',
            '期間を指定（週次 / 月次 / 四半期 / カスタム）',
            '「レポート生成」をクリック',
          ],
          tips: ['この機能はProプラン以上で利用可能です'],
        },
      ],
    },
    {
      id: 'coach-invite',
      title: '選手の招待方法',
      category: 'coach',
      icon: <MessageCircle className="w-5 h-5" />,
      noteUrl: NOTE_BASE,
      sections: [
        {
          heading: 'シェアリンクで招待',
          content: 'シェアリンクを生成して、LINE・メール等で選手に共有するだけで招待できます。',
          steps: [
            '組織管理画面 → ユーザー管理 → 招待リンク',
            '役割（選手 / スタッフ）とチームを選択',
            '「リンクを生成」をクリック',
            '生成されたURLを選手に共有',
            '選手がURLを開いて名前・メール・パスワードを入力すれば登録完了',
          ],
          tips: [
            '有効期限や利用回数の上限を設定できます',
            'Freeプランは30人まで、Proは100人までです',
          ],
        },
      ],
    },
    // ========== 管理者向け ==========
    {
      id: 'admin-overview',
      title: '組織管理ダッシュボード',
      category: 'admin',
      icon: <Building2 className="w-5 h-5" />,
      noteUrl: NOTE_BASE,
      sections: [
        {
          heading: '概要',
          content: '組織管理ダッシュボードでは、チーム一覧・メンバー管理・プラン管理を行えます。',
          steps: [
            '概要: チームと所属メンバーの一覧',
            'ユーザー管理: 招待リンク生成・メンバー管理・承認待ち',
            '組織設定: メンバー管理・組織設定・プラン・移籍・チームアクセス',
          ],
        },
      ],
      relatedArticles: ['admin-plan'],
    },
    {
      id: 'admin-plan',
      title: 'プランとアップグレード',
      category: 'admin',
      icon: <CreditCard className="w-5 h-5" />,
      sections: [
        {
          heading: '料金プラン',
          content: 'Bekutaには Free / Pro（¥2,980/月）/ Pro Max（¥9,980/月）の3つのプランがあります。',
          steps: [
            'Free: 30人まで、1チーム、基本機能',
            'Pro: 100人まで、3チーム、レポート・エクスポート・パフォーマンス測定',
            'Pro Max: 300人まで、8チーム、優先サポート',
          ],
        },
        {
          heading: 'アップグレード方法',
          content: '組織設定の「プラン管理」からアップグレードできます。',
          steps: [
            '組織管理画面 → 組織設定タブ → プラン管理',
            'アップグレードしたいプランの「アップグレード」ボタンをクリック',
            'クレジットカード情報を入力して決済',
            '即座にプランが切り替わります',
          ],
          tips: [
            'テスト環境ではテストカード（4242 4242 4242 4242）が使用できます',
            '「請求管理」からプラン変更・解約・請求書確認ができます',
          ],
        },
      ],
    },
    // ========== 全ユーザー向け ==========
    {
      id: 'all-security',
      title: 'セキュリティとプライバシー',
      category: 'all',
      icon: <Shield className="w-5 h-5" />,
      sections: [
        {
          heading: 'データの保護',
          content: 'Bekutaは全ての通信をHTTPS（SSL/TLS）で暗号化しています。データはSupabase（AWS）上に安全に保管されます。',
          tips: [
            'パスワードは8文字以上で設定してください',
            'ログイン情報を他の人と共有しないでください',
          ],
        },
        {
          heading: 'プライバシー',
          content: '選手のデータは、所属チームのコーチと組織管理者のみが閲覧できます。他のチームの選手やコーチからは見えません。',
        },
      ],
    },
  ];

  const filteredArticles = articles.filter((article) => {
    const matchesCategory =
      selectedCategory === 'all' ||
      article.category === selectedCategory ||
      article.category === 'all';

    const matchesSearch =
      searchQuery === '' ||
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.sections.some(
        (section) =>
          section.heading.toLowerCase().includes(searchQuery.toLowerCase()) ||
          section.content.toLowerCase().includes(searchQuery.toLowerCase())
      );

    return matchesCategory && matchesSearch;
  });

  const currentArticle = selectedArticle ? articles.find((a) => a.id === selectedArticle) : null;

  const toggleSection = (index: number) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(index)) newExpanded.delete(index);
    else newExpanded.add(index);
    setExpandedSections(newExpanded);
  };

  const handleFeedback = (articleId: string, isHelpful: boolean) => {
    setHelpful((prev) => ({ ...prev, [articleId]: isHelpful }));
  };

  const dc = (cls: string, darkCls: string) => (isDarkMode ? darkCls : cls);

  return (
    <div className={`min-h-screen ${dc('bg-gray-50', 'bg-gray-900')}`}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={onBack}
            className={`flex items-center gap-2 mb-4 px-4 py-2 rounded-lg transition-colors ${dc(
              'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
              'text-gray-300 hover:text-white hover:bg-gray-800'
            )}`}
          >
            <ArrowLeft className="w-5 h-5" />
            戻る
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 rounded-lg ${dc('bg-blue-100', 'bg-blue-900/30')}`}>
              <Book className={`w-8 h-8 ${dc('text-blue-600', 'text-blue-400')}`} />
            </div>
            <div>
              <h1 className={`text-3xl font-bold ${dc('text-gray-900', 'text-white')}`}>
                ヘルプ・ユーザーマニュアル
              </h1>
              <p className={`text-sm ${dc('text-gray-600', 'text-gray-400')}`}>
                機能の使い方や疑問点を解決します
              </p>
            </div>
          </div>

          {/* Note link banner */}
          <a
            href={NOTE_BASE}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-3 p-4 rounded-lg mb-6 transition-colors ${dc(
              'bg-blue-50 hover:bg-blue-100 border border-blue-200',
              'bg-blue-900/20 hover:bg-blue-900/30 border border-blue-800'
            )}`}
          >
            <ExternalLink className={`w-5 h-5 ${dc('text-blue-600', 'text-blue-400')}`} />
            <div>
              <p className={`text-sm font-medium ${dc('text-blue-800', 'text-blue-300')}`}>
                詳しい使い方はNoteで公開中
              </p>
              <p className={`text-xs ${dc('text-blue-600', 'text-blue-400')}`}>
                スクリーンショット付きの詳細マニュアルをご覧いただけます
              </p>
            </div>
            <ChevronRight className={`w-5 h-5 ml-auto ${dc('text-blue-400', 'text-blue-500')}`} />
          </a>

          {/* Search + Category Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search
                className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${dc('text-gray-400', 'text-gray-500')}`}
              />
              <input
                type="text"
                placeholder="キーワードで検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-10 pr-4 py-3 rounded-lg border ${dc(
                  'bg-white border-gray-300 text-gray-900 placeholder-gray-400',
                  'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                )} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              />
            </div>

            <div className="flex gap-2 overflow-x-auto">
              {([
                { key: 'all' as const, label: 'すべて' },
                { key: 'athlete' as const, label: '選手' },
                { key: 'coach' as const, label: 'コーチ' },
                { key: 'admin' as const, label: '管理者' },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                    selectedCategory === key
                      ? 'bg-blue-600 text-white'
                      : dc('bg-white text-gray-700 hover:bg-gray-100', 'bg-gray-800 text-gray-300 hover:bg-gray-700')
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Article List */}
        {!selectedArticle ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredArticles.map((article) => {
              const colorClass =
                article.category === 'athlete'
                  ? dc('bg-green-100', 'bg-green-900/30')
                  : article.category === 'coach'
                  ? dc('bg-blue-100', 'bg-blue-900/30')
                  : article.category === 'admin'
                  ? dc('bg-purple-100', 'bg-purple-900/30')
                  : dc('bg-gray-100', 'bg-gray-700');

              const iconColor =
                article.category === 'athlete'
                  ? dc('text-green-600', 'text-green-400')
                  : article.category === 'coach'
                  ? dc('text-blue-600', 'text-blue-400')
                  : article.category === 'admin'
                  ? dc('text-purple-600', 'text-purple-400')
                  : dc('text-gray-600', 'text-gray-400');

              return (
                <button
                  key={article.id}
                  onClick={() => {
                    setSelectedArticle(article.id);
                    setExpandedSections(new Set([0]));
                  }}
                  className={`p-6 rounded-lg text-left transition-all hover:shadow-lg ${dc(
                    'bg-white hover:bg-gray-50 border border-gray-200',
                    'bg-gray-800 hover:bg-gray-750 border border-gray-700'
                  )}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${colorClass}`}>
                      {React.cloneElement(article.icon as React.ReactElement, {
                        className: `w-6 h-6 ${iconColor}`,
                      })}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-semibold mb-1 ${dc('text-gray-900', 'text-white')}`}>
                        {article.title}
                      </h3>
                      <p className={`text-sm truncate ${dc('text-gray-600', 'text-gray-400')}`}>
                        {article.sections[0].content.slice(0, 50)}...
                      </p>
                    </div>
                    <ChevronRight className={`w-5 h-5 flex-shrink-0 ${dc('text-gray-400', 'text-gray-600')}`} />
                  </div>
                </button>
              );
            })}
          </div>
        ) : currentArticle ? (
          /* Article Detail */
          <div className={`rounded-lg shadow-lg ${dc('bg-white', 'bg-gray-800')}`}>
            <div className={`p-6 border-b ${dc('border-gray-200', 'border-gray-700')}`}>
              <button
                onClick={() => setSelectedArticle(null)}
                className={`flex items-center gap-2 mb-4 text-sm ${dc(
                  'text-gray-600 hover:text-gray-900',
                  'text-gray-400 hover:text-gray-200'
                )}`}
              >
                <ArrowLeft className="w-4 h-4" />
                記事一覧に戻る
              </button>
              <h2 className={`text-2xl font-bold ${dc('text-gray-900', 'text-white')}`}>
                {currentArticle.title}
              </h2>
              <span
                className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${
                  currentArticle.category === 'athlete'
                    ? dc('bg-green-100 text-green-700', 'bg-green-900/30 text-green-400')
                    : currentArticle.category === 'coach'
                    ? dc('bg-blue-100 text-blue-700', 'bg-blue-900/30 text-blue-400')
                    : currentArticle.category === 'admin'
                    ? dc('bg-purple-100 text-purple-700', 'bg-purple-900/30 text-purple-400')
                    : dc('bg-gray-100 text-gray-700', 'bg-gray-700 text-gray-300')
                }`}
              >
                {currentArticle.category === 'athlete'
                  ? '選手向け'
                  : currentArticle.category === 'coach'
                  ? 'コーチ向け'
                  : currentArticle.category === 'admin'
                  ? '管理者向け'
                  : '全ユーザー向け'}
              </span>
            </div>

            <div className="p-6">
              {currentArticle.sections.map((section, index) => (
                <div
                  key={index}
                  className={`mb-4 ${dc('border-gray-200', 'border-gray-700')} ${
                    index !== currentArticle.sections.length - 1 ? 'border-b pb-4' : ''
                  }`}
                >
                  <button
                    onClick={() => toggleSection(index)}
                    className={`w-full flex items-center justify-between p-4 rounded-lg transition-colors ${dc(
                      'hover:bg-gray-50',
                      'hover:bg-gray-700'
                    )}`}
                  >
                    <h3 className={`text-lg font-semibold ${dc('text-gray-900', 'text-white')}`}>
                      {section.heading}
                    </h3>
                    {expandedSections.has(index) ? (
                      <ChevronDown className={`w-5 h-5 ${dc('text-gray-600', 'text-gray-400')}`} />
                    ) : (
                      <ChevronRight className={`w-5 h-5 ${dc('text-gray-600', 'text-gray-400')}`} />
                    )}
                  </button>

                  {expandedSections.has(index) && (
                    <div className="px-4 pt-2">
                      <p className={`mb-4 ${dc('text-gray-700', 'text-gray-300')}`}>{section.content}</p>

                      {section.steps && section.steps.length > 0 && (
                        <div className={`mb-4 p-4 rounded-lg ${dc('bg-gray-50', 'bg-gray-700')}`}>
                          <ol className="space-y-2">
                            {section.steps.map((step, si) => (
                              <li key={si} className={`flex gap-3 ${dc('text-gray-700', 'text-gray-300')}`}>
                                <span className={`font-semibold ${dc('text-blue-600', 'text-blue-400')}`}>
                                  {si + 1}.
                                </span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {section.tips && section.tips.length > 0 && (
                        <div
                          className={`p-4 rounded-lg ${dc(
                            'bg-yellow-50 border border-yellow-200',
                            'bg-yellow-900/20 border border-yellow-800'
                          )}`}
                        >
                          <div className="flex items-start gap-3">
                            <Zap
                              className={`w-5 h-5 flex-shrink-0 mt-0.5 ${dc('text-yellow-600', 'text-yellow-400')}`}
                            />
                            <div>
                              <h4 className={`font-semibold mb-2 ${dc('text-yellow-800', 'text-yellow-400')}`}>
                                ヒント
                              </h4>
                              <ul className="space-y-1">
                                {section.tips.map((tip, ti) => (
                                  <li
                                    key={ti}
                                    className={`text-sm ${dc('text-yellow-700', 'text-yellow-300')}`}
                                  >
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

              {/* Note link */}
              {currentArticle.noteUrl && (
                <a
                  href={currentArticle.noteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 p-4 rounded-lg mt-4 transition-colors ${dc(
                    'bg-blue-50 hover:bg-blue-100',
                    'bg-blue-900/20 hover:bg-blue-900/30'
                  )}`}
                >
                  <ExternalLink className={`w-5 h-5 ${dc('text-blue-600', 'text-blue-400')}`} />
                  <span className={`text-sm font-medium ${dc('text-blue-700', 'text-blue-300')}`}>
                    Noteで詳しい使い方を見る（スクリーンショット付き）
                  </span>
                </a>
              )}

              {/* Feedback */}
              <div className={`mt-6 pt-6 border-t ${dc('border-gray-200', 'border-gray-700')}`}>
                <p className={`text-sm mb-3 ${dc('text-gray-600', 'text-gray-400')}`}>
                  この記事は役に立ちましたか？
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleFeedback(currentArticle.id, true)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      helpful[currentArticle.id] === true
                        ? 'bg-green-600 text-white'
                        : dc('bg-gray-100 text-gray-700 hover:bg-gray-200', 'bg-gray-700 text-gray-300 hover:bg-gray-600')
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
                        : dc('bg-gray-100 text-gray-700 hover:bg-gray-200', 'bg-gray-700 text-gray-300 hover:bg-gray-600')
                    }`}
                  >
                    <ThumbsDown className="w-4 h-4" />
                    いいえ
                  </button>
                </div>
              </div>

              {/* Related Articles */}
              {currentArticle.relatedArticles && currentArticle.relatedArticles.length > 0 && (
                <div className={`mt-6 pt-6 border-t ${dc('border-gray-200', 'border-gray-700')}`}>
                  <h4 className={`font-semibold mb-3 ${dc('text-gray-900', 'text-white')}`}>関連記事</h4>
                  <div className="space-y-2">
                    {currentArticle.relatedArticles.map((relatedId) => {
                      const related = articles.find((a) => a.id === relatedId);
                      if (!related) return null;
                      return (
                        <button
                          key={relatedId}
                          onClick={() => {
                            setSelectedArticle(relatedId);
                            setExpandedSections(new Set([0]));
                          }}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${dc(
                            'hover:bg-gray-50',
                            'hover:bg-gray-700'
                          )}`}
                        >
                          {related.icon}
                          <span className={`text-sm ${dc('text-gray-700', 'text-gray-300')}`}>{related.title}</span>
                          <ChevronRight className={`w-4 h-4 ml-auto ${dc('text-gray-400', 'text-gray-600')}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Empty State */}
        {!selectedArticle && filteredArticles.length === 0 && (
          <div className={`text-center py-12 ${dc('text-gray-600', 'text-gray-400')}`}>
            <HelpCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>検索結果が見つかりませんでした</p>
            <p className="text-sm mt-2">別のキーワードで検索してみてください</p>
          </div>
        )}

        {/* Contact Section */}
        {!selectedArticle && (
          <div className={`mt-8 p-6 rounded-lg text-center ${dc('bg-white border border-gray-200', 'bg-gray-800 border border-gray-700')}`}>
            <HelpCircle className={`w-8 h-8 mx-auto mb-3 ${dc('text-gray-400', 'text-gray-500')}`} />
            <h3 className={`font-semibold mb-2 ${dc('text-gray-900', 'text-white')}`}>
              解決しない場合
            </h3>
            <p className={`text-sm mb-4 ${dc('text-gray-600', 'text-gray-400')}`}>
              お気軽にお問い合わせください
            </p>
            <a
              href="mailto:info@arca.fit"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              info@arca.fit にメール
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
