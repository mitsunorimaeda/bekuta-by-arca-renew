import React, { useEffect, useRef } from 'react';

interface TutorialOverlayProps {
  targetElement?: HTMLElement | null;
  padding?: number;
  zIndex?: number;
  onClick?: () => void;
}

export function TutorialOverlay({
  targetElement,
  padding = 8,
  zIndex = 9998,
  onClick
}: TutorialOverlayProps) {
  const [highlightRect, setHighlightRect] = React.useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (targetElement) {
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
    } else {
      setHighlightRect(null);
    }
  }, [targetElement]);

  const handleOverlayClick = (e: React.MouseEvent) => {
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
          <mask id="tutorial-mask">
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
          mask="url(#tutorial-mask)"
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
