import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

interface VirtualScrollListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number; // 表示領域外にも描画する要素数
  loading?: boolean;
  emptyMessage?: string;
}

export function VirtualScrollList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  loading = false,
  emptyMessage = "データがありません"
}: VirtualScrollListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  // 表示する要素の範囲を計算
  const visibleRange = useMemo(() => {
    const visibleStart = Math.floor(scrollTop / itemHeight);
    const visibleEnd = Math.min(
      visibleStart + Math.ceil(containerHeight / itemHeight),
      items.length - 1
    );

    // オーバースキャンを適用
    const start = Math.max(0, visibleStart - overscan);
    const end = Math.min(items.length - 1, visibleEnd + overscan);

    return { start, end };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  // 表示する要素のリスト
  const visibleItems = useMemo(() => {
    const result = [];
    for (let i = visibleRange.start; i <= visibleRange.end; i++) {
      result.push({
        index: i,
        item: items[i],
        offsetY: i * itemHeight
      });
    }
    return result;
  }, [items, visibleRange, itemHeight]);

  // スクロールハンドラー
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // 全体の高さ
  const totalHeight = items.length * itemHeight;

  // スクロール位置を特定のインデックスに設定
  const scrollToIndex = useCallback((index: number) => {
    if (scrollElementRef.current) {
      const targetScrollTop = index * itemHeight;
      scrollElementRef.current.scrollTop = targetScrollTop;
      setScrollTop(targetScrollTop);
    }
  }, [itemHeight]);

  // キーボードナビゲーション
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (items.length === 0) return;

    const currentIndex = Math.floor(scrollTop / itemHeight);
    
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (currentIndex > 0) {
          scrollToIndex(currentIndex - 1);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (currentIndex < items.length - 1) {
          scrollToIndex(currentIndex + 1);
        }
        break;
      case 'Home':
        e.preventDefault();
        scrollToIndex(0);
        break;
      case 'End':
        e.preventDefault();
        scrollToIndex(items.length - 1);
        break;
      case 'PageUp':
        e.preventDefault();
        const pageUpIndex = Math.max(0, currentIndex - Math.floor(containerHeight / itemHeight));
        scrollToIndex(pageUpIndex);
        break;
      case 'PageDown':
        e.preventDefault();
        const pageDownIndex = Math.min(
          items.length - 1, 
          currentIndex + Math.floor(containerHeight / itemHeight)
        );
        scrollToIndex(pageDownIndex);
        break;
    }
  }, [scrollTop, itemHeight, items.length, containerHeight, scrollToIndex]);

  if (loading) {
    return (
      <div 
        style={{ height: containerHeight }}
        className="flex items-center justify-center"
      >
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div 
        style={{ height: containerHeight }}
        className="flex items-center justify-center text-gray-500"
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* スクロール情報 */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <div>
          {visibleRange.start + 1} - {visibleRange.end + 1} / {items.length}件を表示
        </div>
        <div className="flex items-center space-x-2">
          <span>スクロール位置: {Math.round((scrollTop / (totalHeight - containerHeight)) * 100)}%</span>
        </div>
      </div>

      {/* 仮想スクロールコンテナ */}
      <div
        ref={scrollElementRef}
        style={{ height: containerHeight }}
        className="overflow-auto border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {/* 全体の高さを確保するためのコンテナ */}
        <div style={{ height: totalHeight, position: 'relative' }}>
          {/* 表示される要素 */}
          {visibleItems.map(({ index, item, offsetY }) => (
            <div
              key={index}
              style={{
                position: 'absolute',
                top: offsetY,
                left: 0,
                right: 0,
                height: itemHeight
              }}
            >
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>

      {/* ナビゲーションヘルプ */}
      <div className="text-xs text-gray-500 bg-gray-50 rounded p-2">
        <div className="grid grid-cols-2 gap-2">
          <div>↑↓: 上下移動</div>
          <div>Home/End: 先頭/末尾</div>
          <div>PageUp/PageDown: ページ移動</div>
          <div>マウスホイール: スクロール</div>
        </div>
      </div>

      {/* クイックジャンプ */}
      <div className="flex items-center space-x-2 text-sm">
        <span className="text-gray-600">ジャンプ:</span>
        <button
          onClick={() => scrollToIndex(0)}
          className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
        >
          先頭
        </button>
        <button
          onClick={() => scrollToIndex(Math.floor(items.length / 2))}
          className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
        >
          中央
        </button>
        <button
          onClick={() => scrollToIndex(items.length - 1)}
          className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
        >
          末尾
        </button>
      </div>
    </div>
  );
}