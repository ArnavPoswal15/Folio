import React, { useId } from 'react';
import { useBookmarkRibbon } from '../../hooks/useBookmarkRibbon';
import { BookmarkRibbonProps } from '../../types/bookmark';

/**
 * Renders the woven burgundy silk bookmark ribbon hanging below the book frame with spring physics.
 * @param props - Mobile viewport flag and reactive motion pulse key.
 * @returns Interactive SVG bookmark ribbon button.
 */
export const BookmarkRibbon: React.FC<BookmarkRibbonProps> = ({
  isMobile,
  motionPulseKey,
}) => {
  const uid = useId().replace(/:/g, '');
  const { isDragging, refs, handlers } = useBookmarkRibbon(
    isMobile,
    motionPulseKey
  );

  const gradId = `ribbon-silk-${uid}`;
  const weaveId = `ribbon-weave-${uid}`;
  const sheenId = `ribbon-sheen-${uid}`;
  const creaseId = `ribbon-crease-${uid}`;
  const shadowFilterId = `ribbon-shadow-${uid}`;

  return (
    <button
      type="button"
      aria-label="Bookmark ribbon"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={handlers.handleKeyDown}
      className={`pointer-events-none absolute ${
        isMobile ? 'right-10' : 'right-14'
      } w-4 h-9 z-[1] appearance-none bg-transparent border-0 p-0 touch-none select-none overflow-visible focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#deb488] rounded-b`}
      style={{
        top: 'calc(100% - 2px)',
      }}
    >
      <svg
        width="180"
        height="176"
        viewBox="-90 -6 180 176"
        overflow="visible"
        className="pointer-events-none absolute -top-[6px] -left-[82px]"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#58191d" />
            <stop offset="16%" stopColor="#752429" />
            <stop offset="50%" stopColor="#943339" />
            <stop offset="84%" stopColor="#712226" />
            <stop offset="100%" stopColor="#4c1417" />
          </linearGradient>

          <pattern
            id={weaveId}
            width="6"
            height="3"
            patternUnits="userSpaceOnUse"
          >
            <rect width="6" height="1.5" fill="rgba(255, 224, 214, 0.055)" />
            <rect
              y="1.5"
              width="6"
              height="1.5"
              fill="rgba(22, 6, 8, 0.14)"
            />
          </pattern>

          <linearGradient id={sheenId} x1="0%" y1="0%" x2="100%" y2="85%">
            <stop offset="0%" stopColor="rgba(255, 232, 226, 0)" />
            <stop offset="42%" stopColor="rgba(255, 234, 228, 0.42)" />
            <stop offset="65%" stopColor="rgba(255, 234, 228, 0.16)" />
            <stop offset="100%" stopColor="rgba(255, 232, 226, 0)" />
          </linearGradient>

          <linearGradient
            id={creaseId}
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="-6"
            x2="0"
            y2="7"
          >
            <stop offset="0%" stopColor="rgba(16, 6, 7, 0.78)" />
            <stop offset="55%" stopColor="rgba(16, 6, 7, 0.28)" />
            <stop offset="100%" stopColor="rgba(16, 6, 7, 0)" />
          </linearGradient>

          <filter
            id={shadowFilterId}
            x="-40%"
            y="-15%"
            width="180%"
            height="150%"
          >
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
        </defs>

        <path
          ref={refs.shadowPathRef}
          fill="rgba(16, 10, 7, 0.55)"
          filter={`url(#${shadowFilterId})`}
          style={{ opacity: 0.34 }}
        />

        <path
          ref={refs.ribbonPathRef}
          fill={`url(#${gradId})`}
          stroke="rgba(255, 224, 214, 0.14)"
          strokeWidth="0.7"
          strokeLinejoin="round"
        />

        <path ref={refs.weavePathRef} fill={`url(#${weaveId})`} />

        <path
          ref={refs.sheenPathRef}
          fill={`url(#${sheenId})`}
          style={{ opacity: 0 }}
        />

        <path
          ref={refs.edgeHighlightRef}
          fill="none"
          stroke="rgba(255, 230, 224, 0.42)"
          strokeWidth="1.05"
          strokeLinecap="round"
          style={{ opacity: 0.14 }}
        />

        <path
          ref={refs.creasePathRef}
          fill={`url(#${creaseId})`}
          style={{ opacity: 0.4 }}
        />

        <path
          ref={refs.hitPathRef}
          fill="none"
          stroke="transparent"
          strokeWidth="34"
          strokeLinecap="round"
          onPointerEnter={handlers.handlePointerEnter}
          onPointerDown={handlers.handlePointerDown}
          onPointerMove={handlers.handlePointerMove}
          onPointerUp={handlers.handlePointerUp}
          onPointerCancel={handlers.handlePointerUp}
          className={`pointer-events-auto touch-none ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        />
      </svg>
    </button>
  );
};
