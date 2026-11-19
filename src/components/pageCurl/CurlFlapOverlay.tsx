import React from 'react';
import { InkToolConfig } from '../../types/ink';
import { CurlGeometry, CurlPageDescriptor } from '../../types/pageCurl';
import { VoiceControl } from '../../types/voice';
import { JournalPageContent } from '../journalPage/JournalPageContent';

/** Props accepted by the CurlFlapOverlay component. */
interface CurlFlapOverlayProps {
  curl: CurlGeometry | null;
  pageW: number;
  pageH: number;
  isMobile: boolean;
  isDark: boolean;
  isSignedIn: boolean;
  voiceControl?: VoiceControl;
  inkConfig?: InkToolConfig;
  inkToolbarOpen?: boolean;
  inkToolbarSide?: 'left' | 'right';
  nextReveal: CurlPageDescriptor | null;
  prevReveal: CurlPageDescriptor | null;
  flapBack: CurlPageDescriptor | null;
}

function renderCurlPagePreview(
  descriptor: CurlPageDescriptor,
  pageW: number,
  pageH: number,
  isMobile: boolean,
  isSignedIn: boolean,
  voiceControl: VoiceControl | undefined,
  inkConfig: InkToolConfig | undefined,
  inkToolbarOpen: boolean,
  inkToolbarSide: 'left' | 'right' | undefined
) {
  const drawArmedOnThisPage = Boolean(
    inkToolbarOpen &&
      inkConfig?.drawArmed &&
      inkToolbarSide === descriptor.side
  );

  return (
    <JournalPageContent
      spread={descriptor.spread}
      side={descriptor.side}
      spreadIndex={descriptor.spreadIndex}
      pageW={pageW}
      pageH={pageH}
      isMobile={isMobile}
      isContinuation={descriptor.isContinuation}
      interactive={false}
      isSignedIn={isSignedIn}
      showEmptyPlaceholders={true}
      showPageChrome={true}
      showCornerSheen={true}
      voiceControl={voiceControl}
      inkConfig={inkConfig}
      inkToolbarOpen={drawArmedOnThisPage}
    />
  );
}

/**
 * Renders the cast shadow across an underlying sheet along the dynamic curl fold crease.
 * @param props - Active curl geometry, page dimensions, and dark mode flag.
 * @returns Positioned rotated fold shadow gradient overlay.
 */
const FoldCreaseShadow: React.FC<{
  curl: CurlGeometry;
  pageW: number;
  pageH: number;
  isDark: boolean;
}> = ({ curl, pageW, pageH, isDark }) => {
  const shadowRgb = isDark ? '4, 3, 2' : '22, 15, 9';
  const peakAlpha = isDark ? 0.44 : 0.26;
  const midAlpha = isDark ? 0.16 : 0.09;
  const diag = Math.hypot(pageW, pageH) * 2.4;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${curl.foldMidpointLocal.x}px`,
        top: `${curl.foldMidpointLocal.y}px`,
        width: `${diag}px`,
        height: `${diag}px`,
        transform: `translate(-50%, -50%) rotate(${curl.foldNormalDeg}deg)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: '50%',
          width: `${Math.round(40 + curl.intensity * 36)}px`,
          background: `linear-gradient(to left, rgba(${shadowRgb}, ${(
            peakAlpha * curl.intensity
          ).toFixed(3)}) 0%, rgba(${shadowRgb}, ${(
            midAlpha * curl.intensity
          ).toFixed(3)}) 45%, transparent 100%)`,
        }}
      />
    </div>
  );
};

/**
 * Renders the revealed underneath sheet, desktop center spine crease, and folded-over backside flap during page turns.
 * @param props - Computed CurlGeometry, dimensions, theme flags, and resolved reveal/flap descriptors.
 * @returns Curl overlay layers positioned inside the spread stage.
 */
export const CurlFlapOverlay: React.FC<CurlFlapOverlayProps> = ({
  curl,
  pageW,
  pageH,
  isMobile,
  isDark,
  isSignedIn,
  voiceControl,
  inkConfig,
  inkToolbarOpen = false,
  inkToolbarSide,
  nextReveal,
  prevReveal,
  flapBack,
}) => {
  const isTurningNext = Boolean(curl?.isActive && curl.direction === 'next');
  const isTurningPrev = Boolean(curl?.isActive && curl.direction === 'prev');
  const diag = Math.hypot(pageW, pageH) * 2.4;

  return (
    <>
      {isTurningNext && curl && nextReveal && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 z-10 isolate overflow-hidden rounded-r-[3px]"
          style={{
            left: isMobile ? '0px' : `${pageW}px`,
            width: `${pageW}px`,
            height: `${pageH}px`,
            clipPath: curl.underneathClip,
          }}
        >
          {renderCurlPagePreview(
            nextReveal,
            pageW,
            pageH,
            isMobile,
            isSignedIn,
            voiceControl,
            inkConfig,
            inkToolbarOpen,
            inkToolbarSide
          )}
          <FoldCreaseShadow
            curl={curl}
            pageW={pageW}
            pageH={pageH}
            isDark={isDark}
          />
        </div>
      )}

      {isTurningPrev && curl && prevReveal && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 z-10 isolate overflow-hidden rounded-l-[3px]"
          style={{
            width: `${pageW}px`,
            height: `${pageH}px`,
            clipPath: curl.underneathClip,
          }}
        >
          {renderCurlPagePreview(
            prevReveal,
            pageW,
            pageH,
            isMobile,
            isSignedIn,
            voiceControl,
            inkConfig,
            inkToolbarOpen,
            inkToolbarSide
          )}
          <FoldCreaseShadow
            curl={curl}
            pageW={pageW}
            pageH={pageH}
            isDark={isDark}
          />
        </div>
      )}

      {!isMobile && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 z-20"
          style={{
            left: `${pageW - 2}px`,
            width: '4px',
            background: isDark
              ? 'linear-gradient(to right, rgba(0,0,0,0.28), rgba(0,0,0,0.65), rgba(0,0,0,0.28))'
              : 'linear-gradient(to right, rgba(35,24,14,0.12), rgba(35,24,14,0.32), rgba(35,24,14,0.12))',
          }}
        />
      )}

      {curl && curl.isActive && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-30 isolate"
          style={{
            clipPath: curl.flapWrapperClip,
            filter: `drop-shadow(${
              curl.direction === 'next' ? '-6px' : '6px'
            } 6px 14px rgba(18, 12, 7, ${(0.22 * curl.intensity).toFixed(3)}))`,
          }}
        >
          <div
            className="absolute top-0 left-0 overflow-hidden"
            style={{
              width: `${pageW}px`,
              height: `${pageH}px`,
              transformOrigin: curl.backPageOrigin,
              transform: curl.backPageTransform,
              boxShadow: '0 0 1px rgba(80, 62, 42, 0.35)',
            }}
          >
            {flapBack &&
              renderCurlPagePreview(
                flapBack,
                pageW,
                pageH,
                isMobile,
                isSignedIn,
                voiceControl,
                inkConfig,
                inkToolbarOpen,
                inkToolbarSide
              )}
          </div>

          <div
            style={{
              position: 'absolute',
              left: `${curl.foldMidpoint.x}px`,
              top: `${curl.foldMidpoint.y}px`,
              width: `${diag}px`,
              height: `${diag}px`,
              transform: `translate(-50%, -50%) rotate(${curl.foldNormalDeg}deg)`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: '50%',
                width: `${Math.round(38 + curl.intensity * 32)}px`,
                background: isDark
                  ? `linear-gradient(to right, rgba(5, 4, 3, ${(
                      0.36 * curl.intensity
                    ).toFixed(3)}) 0%, rgba(235, 222, 202, ${(
                      0.16 * curl.intensity
                    ).toFixed(3)}) 28%, rgba(235, 222, 202, ${(
                      0.05 * curl.intensity
                    ).toFixed(3)}) 62%, transparent 100%)`
                  : `linear-gradient(to right, rgba(45, 32, 18, ${(
                      0.14 * curl.intensity
                    ).toFixed(3)}) 0%, rgba(255, 252, 244, ${(
                      0.56 * curl.intensity
                    ).toFixed(3)}) 28%, rgba(255, 250, 240, ${(
                      0.16 * curl.intensity
                    ).toFixed(3)}) 62%, transparent 100%)`,
              }}
            />
          </div>
        </div>
      )}
    </>
  );
};
