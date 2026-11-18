import React from 'react';
import { BOOK_COVER_CONFIG } from '../../constants/book';
import { BookCoverRefs, BookPhase } from '../../types/book';
import { BookmarkRibbon } from '../bookmark/BookmarkRibbon';

/** Props accepted by the BookFrameChrome 3D binding shell component. */
interface BookFrameChromeProps {
  stageW: number;
  pageH: number;
  fullBookH: number;
  isMobile: boolean;
  bookPhase: BookPhase;
  bookWrapperRef: BookCoverRefs['bookWrapperRef'];
  deskShadowRef: BookCoverRefs['deskShadowRef'];
  frameRef: BookCoverRefs['frameRef'];
  spreadRef: React.RefObject<HTMLDivElement | null>;
  coverNode: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Renders the 3D perspective stage, smooth desk drop shadow, cloth frame, paper edges, bookmark ribbon, and open spread container.
 * @param props - Dimensions, mobile flag, phase, GSAP/spread DOM refs, hinged cover node, and spread children.
 * @returns Perspective container wrapping the physical hardbound journal shell.
 */
export const BookFrameChrome: React.FC<BookFrameChromeProps> = ({
  stageW,
  pageH,
  fullBookH,
  isMobile,
  bookPhase,
  bookWrapperRef,
  deskShadowRef,
  frameRef,
  spreadRef,
  coverNode,
  children,
}) => {
  const outerW = stageW + BOOK_COVER_CONFIG.FRAME_PAD_FULL_PX;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        width: `${outerW}px`,
        height: `${fullBookH}px`,
        perspective: `${BOOK_COVER_CONFIG.PERSPECTIVE_PX}px`,
      }}
    >
      <div
        ref={bookWrapperRef}
        className="relative"
        style={{
          width: `${outerW}px`,
          height: `${fullBookH}px`,
          transformStyle: 'preserve-3d',
          willChange: 'transform',
        }}
      >
        <div
          ref={deskShadowRef}
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 rounded-xl book-frame-shadow"
          style={{
            width: `${outerW}px`,
            height: `${fullBookH}px`,
            transformOrigin: 'right center',
            transform: `translateZ(${BOOK_COVER_CONFIG.DESK_SHADOW_Z}px)`,
            willChange: 'transform',
            zIndex: 0,
          }}
        />

        <div
          ref={frameRef}
          className="relative z-[1] cover-cloth book-frame-edge rounded-xl p-[11px]"
          style={{
            width: `${outerW}px`,
            height: `${fullBookH}px`,
            transform:
              bookPhase === 'open'
                ? undefined
                : `translateZ(${BOOK_COVER_CONFIG.FRAME_Z}px)`,
            transformStyle: 'flat',
          }}
        >
          {!isMobile ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-[14px] bottom-[14px] left-[6px] w-[5px] rounded-l-sm paper-stack-left"
            />
          ) : null}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-[14px] bottom-[14px] right-[6px] w-[5px] rounded-r-sm paper-stack-right"
          />

          <BookmarkRibbon isMobile={isMobile} />

          <div
            ref={spreadRef}
            className={`relative z-[2] bg-[#efe8da] dark:bg-[#191614] rounded-[3px] shadow-inner ${
              isMobile ? 'overflow-hidden' : ''
            }`}
            style={{
              width: `${stageW}px`,
              height: `${pageH}px`,
              visibility: bookPhase === 'closed' ? 'hidden' : 'visible',
            }}
          >
            {children}
          </div>
        </div>

        {coverNode}
      </div>
    </div>
  );
};
