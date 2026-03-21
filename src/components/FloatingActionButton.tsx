import React from "react";
import { Plus, Camera } from "lucide-react";
import { stopAllMediaStreams } from "../lib/stopCamera";

type Props = {
  onClick: () => void;          // ＋
  onCameraClick?: () => void;   // 📷（あれば表示）
};

export function FloatingActionButton({ onClick, onCameraClick }: Props) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
      {/* 📷：栄養ONのときだけ */}
      {onCameraClick && (
        <button
          type="button"
          onClick={onCameraClick}
          className="h-14 w-14 rounded-full shadow-lg
                     bg-blue-600 text-white
                     flex items-center justify-center
                     active:scale-95 transition"
          aria-label="食事を撮影・選択"
        >
          <Camera className="w-6 h-6" />
        </button>
      )}

      {/* ＋：常に表示 */}
      <button
        type="button"
        onClick={onClick}
        data-tutorial="fab-button"
        className="h-14 w-14 rounded-full shadow-lg
                   bg-blue-600 text-white
                   flex items-center justify-center
                   active:scale-95 transition"
        aria-label="今日の記録を追加"
      >
        <Plus className="w-7 h-7" />
      </button>
    </div>
  );
}