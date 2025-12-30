// src/components/TutorialOverlay.tsx
import React, { useEffect, useId, useRef, useState } from 'react';

interface TutorialOverlayProps {
  targetElement?: HTMLElement | null;
  padding?: number;
  zIndex?: number; // Overlayのz
  onClick?: () => void;
}

export function TutorialOverlay({
  targetElement,
  padding = 8,
  zIndex = 10000,
  onClick,
}: TutorialOverlayProps) {
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const maskId = useId(); // ✅ 衝突回避

  useEffect(() => {
    if (!targetElement) {
      setHighlightRect(null);
      return;
    }

    const updateRect = () => {
      const rect = targetElement.getBoundingClientRect();
      setHighlightRect(rect);
    };

    updateRect();

    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [targetElement]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    // ✅ “背景クリックだけ” をスキップ扱いにする
    if (e.target === overlayRef.current) {
      onClick?.();
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 transition-all duration-300"
      style={{ zIndex }}
      onClick={handleOverlayClick}
      aria-hidden="true"
    >
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: zIndex + 1 }}
      >
        <defs>
          <mask id={`tutorial-mask-${maskId}`}>
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {highlightRect && (
              <rect
                x={highlightRect.left - padding}
                y={highlightRect.top - padding}
                width={highlightRect.width + padding * 2}
                height={highlightRect.height + padding * 2}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>

        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.7)"
          mask={`url(#tutorial-mask-${maskId})`}
        />

        {highlightRect && (
          <rect
            x={highlightRect.left - padding}
            y={highlightRect.top - padding}
            width={highlightRect.width + padding * 2}
            height={highlightRect.height + padding * 2}
            rx="8"
            fill="none"
            stroke="#3B82F6"
            strokeWidth="3"
            className="animate-pulse"
          />
        )}
      </svg>
    </div>
  );
}