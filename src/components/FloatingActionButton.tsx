import React from 'react';
import { Plus } from 'lucide-react';

interface FloatingActionButtonProps {
  onClick: () => void;
}

export function FloatingActionButton({ onClick }: FloatingActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full p-4 shadow-2xl transition-all hover:scale-110 active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800"
      style={{
        WebkitTapHighlightColor: 'rgba(0,0,0,0)',
        touchAction: 'manipulation'
      }}
      aria-label="記録を追加"
    >
      <Plus className="w-8 h-8" />
    </button>
  );
}
