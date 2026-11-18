import React from 'react';
import { BOOKMARK_RIBBON_CONFIG } from '../../constants/bookmark';
import { useBookmarkRibbon } from '../../hooks/useBookmarkRibbon';
import { BookmarkRibbonProps } from '../../types/bookmark';
import { INITIAL_RIBBON_PATH } from '../../utils/bookmarkRibbon';

const { W, BASE_LENGTH } = BOOKMARK_RIBBON_CONFIG;

/**
 * Simple burgundy bookmark ribbon with rubber pull and damped spring bounce (master behavior).
 */
export const BookmarkRibbon: React.FC<BookmarkRibbonProps> = ({ isMobile }) => {
  const { isTugging, ribbonPathRef, ribbonSheenPathRef, handlers } =
    useBookmarkRibbon();

  return (
    <button
      type="button"
      aria-label="Bookmark ribbon"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={handlers.handlePointerDown}
      onPointerMove={handlers.handlePointerMove}
      onPointerUp={handlers.handlePointerUp}
      onPointerCancel={handlers.handlePointerUp}
      onKeyDown={handlers.handleKeyDown}
      className={`group absolute ${
        isMobile ? 'right-10' : 'right-14'
      } w-4 h-9 z-[1] appearance-none bg-transparent border-0 p-0 touch-none select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#deb488] rounded-b ${
        isTugging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      style={{
        top: 'calc(100% - 8px)',
        filter: 'drop-shadow(1px 4px 6px rgba(24, 16, 11, 0.34))',
      }}
    >
      <span
        aria-hidden="true"
        className="absolute -inset-x-2.5 top-[8px] -bottom-3"
      />
      <svg
        width={W}
        height={BASE_LENGTH}
        viewBox={`0 0 ${W} ${BASE_LENGTH}`}
        overflow="visible"
        aria-hidden="true"
        className="pointer-events-none block overflow-visible"
      >
        <defs>
          <linearGradient
            id="bookmark-silk-grad"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor="#6e2226" />
            <stop offset="48%" stopColor="#8f3136" />
            <stop offset="100%" stopColor="#58191c" />
          </linearGradient>
          <linearGradient
            id="bookmark-sheen-grad"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="18%" stopColor="rgba(255, 232, 226, 0)" />
            <stop offset="50%" stopColor="rgba(255, 232, 226, 0.45)" />
            <stop offset="82%" stopColor="rgba(255, 232, 226, 0)" />
          </linearGradient>
        </defs>
        <path
          ref={ribbonPathRef}
          d={INITIAL_RIBBON_PATH}
          fill="url(#bookmark-silk-grad)"
        />
        <path
          ref={ribbonSheenPathRef}
          d={INITIAL_RIBBON_PATH}
          fill="url(#bookmark-sheen-grad)"
          style={{ opacity: 0 }}
        />
      </svg>
    </button>
  );
};