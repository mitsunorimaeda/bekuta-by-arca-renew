interface LandingFooterProps {
  onNavigateToLogin: () => void;
  onNavigateToPrivacy: () => void;
  onNavigateToTerms: () => void;
  onNavigateToCommercial: () => void;
}

export function LandingFooter({
  onNavigateToLogin,
  onNavigateToPrivacy,
  onNavigateToTerms,
  onNavigateToCommercial,
}: LandingFooterProps) {
  return (
    <footer className="bg-gray-900 text-gray-400 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg font-bold text-white" style={{ letterSpacing: '-0.02em' }}>
                Bekuta
              </span>
              <span className="text-xs text-gray-500">by ARCA</span>
            </div>
            <p className="text-sm leading-relaxed">
              データサイエンスによる
              <br />
              トレーニング負荷管理システム
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-3">リンク</h4>
            <ul className="space-y-2">
              <li>
                <a href="#features" className="text-sm hover:text-white transition-colors">機能</a>
              </li>
              <li>
                <a href="#pricing" className="text-sm hover:text-white transition-colors">料金</a>
              </li>
              <li>
                <a href="#how-it-works" className="text-sm hover:text-white transition-colors">導入方法</a>
              </li>
              <li>
                <button onClick={onNavigateToLogin} className="text-sm hover:text-white transition-colors">
                  ログイン
                </button>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-3">法的情報</h4>
            <ul className="space-y-2">
              <li>
                <button onClick={onNavigateToPrivacy} className="text-sm hover:text-white transition-colors">
                  プライバシーポリシー
                </button>
              </li>
              <li>
                <button onClick={onNavigateToTerms} className="text-sm hover:text-white transition-colors">
                  利用規約
                </button>
              </li>
              <li>
                <button onClick={onNavigateToCommercial} className="text-sm hover:text-white transition-colors">
                  特定商取引法に基づく表記
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} ARCA Inc. All rights reserved.
          </p>
          <a
            href="mailto:info@arca.fit"
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            info@arca.fit
          </a>
        </div>
      </div>
    </footer>
  );
}
