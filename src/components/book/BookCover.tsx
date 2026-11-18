import React from 'react';
import { BOOK_COVER_CONFIG } from '../../constants/book';
import { BookCoverRefs, BookPhase } from '../../types/book';
import { JournalDateParts, JournalSpread } from '../../types/journal';
import { JournalPageContent } from '../journalPage/JournalPageContent';
import { WelcomeSpreadContent } from '../welcome/WelcomeSpreadContent';

/** Props accepted by the 3D hinged BookCover component. */
interface BookCoverProps {
  bookPhase: BookPhase;
  isMobile: boolean;
  isDark: boolean;
  pageW: number;
  pageH: number;
  halfBookW: number;
  fullBookH: number;
  dateParts: JournalDateParts;
  showWelcome: boolean;
  currentSpread: JournalSpread;
  currentIndex: number;
  isCurrentContinuation: boolean;
  isSignedIn: boolean;
  canTurnPrev: boolean;
  canTurnNext: boolean;
  coverRef: BookCoverRefs['coverRef'];
  coverFrontRef: BookCoverRefs['coverFrontRef'];
  coverBackRef: BookCoverRefs['coverBackRef'];
  mobileBackFaceRef: BookCoverRefs['mobileBackFaceRef'];
  onOpenBook: () => void;
}

/**
 * Renders the 3D hinged front book cover with gold-foil exterior embossing and non-interactive back interior face.
 * @param props - Book phase, dimensions, refs for GSAP rotation, and left-page preview props.
 * @returns Hinged 3D front cover container element.
 */
export const BookCover: React.FC<BookCoverProps> = ({
  bookPhase,
  isMobile,
  isDark,
  pageW,
  pageH,
  halfBookW,
  fullBookH,
  dateParts,
  showWelcome,
  currentSpread,
  currentIndex,
  isCurrentContinuation,
  isSignedIn,
  canTurnPrev,
  canTurnNext,
  coverRef,
  coverFrontRef,
  coverBackRef,
  mobileBackFaceRef,
  onOpenBook,
}) => (
  <div
    ref={coverRef}
    className="absolute top-0"
    style={{
      left: isMobile
        ? '0px'
        : `${halfBookW}px`,
      width: isMobile
        ? `${pageW + BOOK_COVER_CONFIG.FRAME_PAD_FULL_PX}px`
        : `${halfBookW}px`,
      height: `${fullBookH}px`,
      transformOrigin: 'left center',
      transformStyle: 'preserve-3d',
      willChange: 'transform',
      zIndex: 60,
    }}
  >
    <button
      ref={coverFrontRef}
      type="button"
      disabled={bookPhase !== 'closed'}
      onClick={bookPhase === 'closed' ? onOpenBook : undefined}
      aria-label="Open journal"
      className={`group absolute inset-0 cover-cloth book-cover-edge rounded-l-[4px] rounded-r-xl overflow-hidden flex flex-col justify-between opacity-100 ${
        isMobile ? 'p-8' : 'p-11'
      } text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8c6b48] ${
        bookPhase === 'closed' ? 'cursor-pointer' : 'pointer-events-none'
      }`}
      style={{
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: `rotateY(0deg) translateZ(${BOOK_COVER_CONFIG.COVER_FACE_Z}px)`,
      }}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 ${
          isMobile ? 'w-7' : 'w-9'
        }`}
        style={{
          background:
            'linear-gradient(to right, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.12) 52%, rgba(255,220,180,0.08) 65%, transparent 100%)',
          borderRight: '1px solid rgba(0,0,0,0.35)',
        }}
      />

      <div
        aria-hidden="true"
        className={`absolute ${
          isMobile ? 'inset-4 left-9' : 'inset-6 left-12'
        } rounded-sm pointer-events-none`}
        style={{
          border: '1px solid rgba(212, 180, 128, 0.28)',
          boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.25)',
        }}
      />

      <div
        className={`relative z-10 ${
          isMobile ? 'pl-6 pt-1' : 'pl-8 pt-2'
        } flex items-center justify-end`}
      >
        <span className="text-xs tracking-[0.26em] text-[#d4bc96]/70 tabular-nums">
          {dateParts.year || '2026'}
        </span>
      </div>

      <div
        className={`relative z-10 ${
          isMobile ? 'pl-6' : 'pl-8'
        } my-auto flex flex-col items-start`}
      >
        <h1
          className={`font-serif ${
            isMobile ? 'text-4xl' : 'text-[42px]'
          } leading-none font-normal tracking-tight text-[#e8d5b3]`}
          style={{
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.45)',
          }}
        >
          Journal
        </h1>
        <div className="mt-4 w-12 h-px bg-[#d4b480]/35" />
        <p className="mt-3 font-serif italic text-base text-[#cbb086]/80">
          {dateParts.monthDay}
        </p>
      </div>

      <div
        className={`relative z-10 ${
          isMobile ? 'pl-6' : 'pl-8'
        } pb-1 flex items-center justify-end`}
      >
        <span className="text-xs tracking-wide text-[#dcc49e]/75 group-hover:text-[#f2dfc0] transition-colors">
          Open →
        </span>
      </div>
    </button>

    {isMobile ? (
      <div
        ref={mobileBackFaceRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 cover-cloth rounded-r-xl rounded-l-none p-[11px] pl-0"
        style={{
          backfaceVisibility: 'visible',
          WebkitBackfaceVisibility: 'visible',
          transform: `rotateY(180deg) translateZ(${BOOK_COVER_CONFIG.COVER_FACE_Z}px)`,
        }}
      >
        <div className="w-full h-full rounded-r-[3px] mobile-back-paper" />
      </div>
    ) : (
      <div
        ref={coverBackRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 cover-cloth book-frame-edge rounded-l-xl rounded-r-none"
        style={{
          backfaceVisibility: 'visible',
          WebkitBackfaceVisibility: 'visible',
          transform: `rotateY(180deg) translateZ(${BOOK_COVER_CONFIG.COVER_FACE_Z}px)`,
          paddingTop: `${BOOK_COVER_CONFIG.FRAME_PAD_HALF_PX}px`,
          paddingBottom: `${BOOK_COVER_CONFIG.FRAME_PAD_HALF_PX}px`,
          paddingLeft: `${BOOK_COVER_CONFIG.FRAME_PAD_HALF_PX}px`,
          paddingRight: '0px',
        }}
      >
        <div className="pointer-events-none absolute top-[14px] bottom-[14px] left-[6px] w-[5px] rounded-l-sm paper-stack-left" />
        <div
          className="relative overflow-hidden rounded-l-[3px]"
          style={{ width: `${pageW}px`, height: `${pageH}px` }}
        >
          {showWelcome ? (
            <WelcomeSpreadContent
              side="left"
              pageW={pageW}
              pageH={pageH}
              interactive={false}
            />
          ) : (
            <JournalPageContent
              spread={currentSpread}
              side="left"
              spreadIndex={currentIndex}
              pageW={pageW}
              pageH={pageH}
              isContinuation={isCurrentContinuation}
              interactive={false}
              isSignedIn={isSignedIn}
              showEmptyPlaceholders={true}
              showCornerSheen={true}
              canTurnPrev={canTurnPrev}
              canTurnNext={canTurnNext}
            />
          )}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-[2px] z-20"
            style={{
              background: isDark
                ? 'linear-gradient(to right, rgba(0,0,0,0.26), rgba(0,0,0,0.6))'
                : 'linear-gradient(to right, rgba(35,24,14,0.12), rgba(35,24,14,0.32))',
            }}
          />
        </div>
      </div>
    )}
  </div>
);
