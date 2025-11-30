import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginatedTableProps<T> {
  data: T[];
  itemsPerPage?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  renderHeader?: () => React.ReactNode;
  loading?: boolean;
  emptyMessage?: string;
}

export function PaginatedTable<T>({
  data,
  itemsPerPage = 20,
  renderItem,
  renderHeader,
  loading = false,
  emptyMessage = "データがありません"
}: PaginatedTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);

  // ページネーション計算
  const totalPages = Math.ceil(data.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  
  const currentData = useMemo(() => {
    return data.slice(startIndex, endIndex);
  }, [data, startIndex, endIndex]);

  // ページ変更ハンドラー
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const goToFirstPage = () => goToPage(1);
  const goToLastPage = () => goToPage(totalPages);
  const goToPreviousPage = () => goToPage(currentPage - 1);
  const goToNextPage = () => goToPage(currentPage + 1);

  // ページ番号の表示範囲を計算
  const getPageNumbers = () => {
    const delta = 2; // 現在のページの前後に表示するページ数
    const range = [];
    const rangeWithDots = [];

    for (let i = Math.max(2, currentPage - delta); 
         i <= Math.min(totalPages - 1, currentPage + delta); 
         i++) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* データ情報 */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <div>
          {startIndex + 1} - {Math.min(endIndex, data.length)} / {data.length}件を表示
        </div>
        <div>
          ページ {currentPage} / {totalPages}
        </div>
      </div>

      {/* テーブルヘッダー */}
      {renderHeader && renderHeader()}

      {/* データ表示 */}
      <div className="space-y-2">
        {currentData.map((item, index) => renderItem(item, startIndex + index))}
      </div>

      {/* ページネーションコントロール */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2 py-4">
          {/* 最初のページへ */}
          <button
            onClick={goToFirstPage}
            disabled={currentPage === 1}
            className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            title="最初のページ"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>

          {/* 前のページへ */}
          <button
            onClick={goToPreviousPage}
            disabled={currentPage === 1}
            className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            title="前のページ"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* ページ番号 */}
          <div className="flex items-center space-x-1">
            {getPageNumbers().map((pageNumber, index) => (
              <React.Fragment key={index}>
                {pageNumber === '...' ? (
                  <span className="px-3 py-2 text-gray-500">...</span>
                ) : (
                  <button
                    onClick={() => goToPage(pageNumber as number)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === pageNumber
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {pageNumber}
                  </button>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* 次のページへ */}
          <button
            onClick={goToNextPage}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            title="次のページ"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* 最後のページへ */}
          <button
            onClick={goToLastPage}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            title="最後のページ"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ページサイズ選択 */}
      <div className="flex items-center justify-center space-x-2 text-sm">
        <span className="text-gray-600">表示件数:</span>
        <select
          value={itemsPerPage}
          onChange={(e) => {
            const newItemsPerPage = parseInt(e.target.value);
            // ページサイズ変更時は1ページ目に戻る
            setCurrentPage(1);
          }}
          className="border border-gray-300 rounded px-2 py-1"
        >
          <option value={10}>10件</option>
          <option value={20}>20件</option>
          <option value={50}>50件</option>
          <option value={100}>100件</option>
        </select>
      </div>
    </div>
  );
}