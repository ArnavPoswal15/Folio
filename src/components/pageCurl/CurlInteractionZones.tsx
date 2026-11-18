import React from 'react';
import { CornerAnchor, TurnDirection } from '../../types/pageCurl';

/** Props accepted by the CurlInteractionZones edge/corner hit-target component. */
interface CurlInteractionZonesProps {
  enabled: boolean;
  isMobile: boolean;
  showWelcome: boolean;
  inkToolbarOpen: boolean;
  canTurnPrev: boolean;
  onStartHoverCurl: (direction: TurnDirection, corner: CornerAnchor) => void;
  onEndHoverCurl: () => void;
  onZonePointerDown: (
    e: React.PointerEvent<HTMLDivElement>,
    direction: TurnDirection,
    preferredCorner?: CornerAnchor
  ) => void;
  onZonePointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onZonePointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
}

/**
 * Renders the invisible corner and outer-edge hit zones that trigger hover peeks and drag-to-turn page curls.
 * @param props - Enable gate, layout flags, and pointer gesture callbacks from usePageCurl.
 * @returns Fragment containing edge/corner drag hit regions or null when disabled.
 */
export const CurlInteractionZones: React.FC<CurlInteractionZonesProps> = ({
  enabled,
  isMobile,
  showWelcome,
  inkToolbarOpen,
  canTurnPrev,
  onStartHoverCurl,
  onEndHoverCurl,
  onZonePointerDown,
  onZonePointerMove,
  onZonePointerUp,
}) => {
  if (!enabled) return null;

  const edgeWidth = inkToolbarOpen ? '16px' : isMobile ? '34px' : '40px';
  const cornerWidth = inkToolbarOpen ? '46px' : isMobile ? '84px' : '104px';
  const cornerHeight = inkToolbarOpen ? '46px' : isMobile ? '78px' : '92px';

  return (
    <>
      <div
        role="button"
        tabIndex={-1}
        aria-label="Fold or click to turn to next page"
        onPointerEnter={() => onStartHoverCurl('next', 'bottom')}
        onPointerLeave={onEndHoverCurl}
        onPointerDown={(e) => onZonePointerDown(e, 'next')}
        onPointerMove={onZonePointerMove}
        onPointerUp={onZonePointerUp}
        onPointerCancel={onZonePointerUp}
        className="absolute right-0 z-40 cursor-grab active:cursor-grabbing touch-none"
        style={{
          top: showWelcome ? '76px' : isMobile ? '168px' : '110px',
          bottom: '92px',
          width: edgeWidth,
        }}
      />

      <div
        role="button"
        tabIndex={-1}
        aria-label="Drag or click bottom right corner to turn page"
        onPointerEnter={() => onStartHoverCurl('next', 'bottom')}
        onPointerLeave={onEndHoverCurl}
        onPointerDown={(e) => onZonePointerDown(e, 'next', 'bottom')}
        onPointerMove={onZonePointerMove}
        onPointerUp={onZonePointerUp}
        onPointerCancel={onZonePointerUp}
        className="absolute right-0 bottom-0 z-40 cursor-grab active:cursor-grabbing touch-none"
        style={{
          width: cornerWidth,
          height: cornerHeight,
        }}
      />

      {canTurnPrev && (
        <>
          <div
            role="button"
            tabIndex={-1}
            aria-label="Fold or click to turn to previous page"
            onPointerEnter={() => onStartHoverCurl('prev', 'bottom')}
            onPointerLeave={onEndHoverCurl}
            onPointerDown={(e) => onZonePointerDown(e, 'prev')}
            onPointerMove={onZonePointerMove}
            onPointerUp={onZonePointerUp}
            onPointerCancel={onZonePointerUp}
            className="absolute left-0 z-40 cursor-grab active:cursor-grabbing touch-none"
            style={{
              top: '132px',
              bottom: '92px',
              width: edgeWidth,
            }}
          />
          <div
            role="button"
            tabIndex={-1}
            aria-label="Drag or click bottom left corner to turn back"
            onPointerEnter={() => onStartHoverCurl('prev', 'bottom')}
            onPointerLeave={onEndHoverCurl}
            onPointerDown={(e) => onZonePointerDown(e, 'prev', 'bottom')}
            onPointerMove={onZonePointerMove}
            onPointerUp={onZonePointerUp}
            onPointerCancel={onZonePointerUp}
            className="absolute left-0 bottom-0 z-40 cursor-grab active:cursor-grabbing touch-none"
            style={{
              width: cornerWidth,
              height: cornerHeight,
            }}
          />
        </>
      )}
    </>
  );
};
