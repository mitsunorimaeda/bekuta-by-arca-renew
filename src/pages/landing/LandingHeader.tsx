import { useState } from 'react';
import { Menu, X } from 'lucide-react';

interface LandingHeaderProps {
  onNavigateToLogin: () => void;
  onNavigateToSignup: () => void;
}

export function LandingHeader({ onNavigateToLogin, onNavigateToSignup }: LandingHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <span
              className="text-xl font-bold text-blue-600"
              style={{ letterSpacing: '-0.02em' }}
            >
              Bekuta
            </span>
            <span className="text-xs text-gray-400 hidden sm:inline">by ARCA</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              機能
            </a>
            <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              料金
            </a>
            <a href="#how-it-works" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              導入方法
            </a>
            <button
              onClick={onNavigateToLogin}
              className="text-sm text-gray-700 hover:text-gray-900 transition-colors"
            >
              ログイン
            </button>
            <button
              onClick={onNavigateToSignup}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              無料で始める
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-600"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100">
            <div className="flex flex-col gap-3">
              <a
                href="#features"
                className="text-sm text-gray-600 py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                機能
              </a>
              <a
                href="#pricing"
                className="text-sm text-gray-600 py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                料金
              </a>
              <a
                href="#how-it-works"
                className="text-sm text-gray-600 py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                導入方法
              </a>
              <button
                onClick={() => { onNavigateToLogin(); setMobileMenuOpen(false); }}
                className="text-sm text-gray-700 py-2 text-left"
              >
                ログイン
              </button>
              <button
                onClick={() => { onNavigateToSignup(); setMobileMenuOpen(false); }}
                className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors text-center"
              >
                無料で始める
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
