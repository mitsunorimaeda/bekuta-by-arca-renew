import { useEffect, useState } from 'react';

// D-day: 2026-05-19 10:00 JST = 2026-05-19T01:00:00.000Z
const D_DAY_MS = Date.UTC(2026, 4, 19, 1, 0, 0);
// D-1 切替予告に文言を強める閾値: 2026-05-18 00:00 JST = 2026-05-17T15:00:00.000Z
const FINAL_NOTICE_MS = Date.UTC(2026, 4, 17, 15, 0, 0);

const SESSION_KEY = 'bekuta-migration-banner-dismissed';

export function MigrationBanner() {
  const [now, setNow] = useState<number>(() => Date.now());
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    // 5 分ごとに再評価（D-day をまたいだ場合に自動で消える）
    const id = window.setInterval(() => setNow(Date.now()), 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  if (now >= D_DAY_MS) return null;
  if (dismissed) return null;

  const isFinalNotice = now >= FINAL_NOTICE_MS;

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      // sessionStorage 不可な環境では状態のみで処理
    }
    setDismissed(true);
  };

  const message = isFinalNotice
    ? '明日 5/19（火）朝にBekutaが新バージョンへ切り替わります。データ・ログイン情報は引き継がれます。'
    : '5/19（火）朝にBekutaが新バージョンへ切り替わります。データ・ログイン情報は引き継がれます。';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        paddingBottom: 'env(safe-area-inset-bottom)',
        backgroundColor: isFinalNotice ? '#1e3a8a' : '#0f172a',
        color: '#ffffff',
        boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
        fontFamily:
          'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", "Hiragino Sans", "Noto Sans JP", sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 14px',
          maxWidth: 960,
          margin: '0 auto',
        }}
      >
        <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>
          <span style={{ marginRight: 6 }} aria-hidden="true">
            📢
          </span>
          {message}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="閉じる"
          style={{
            flex: '0 0 auto',
            background: 'rgba(255,255,255,0.12)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
