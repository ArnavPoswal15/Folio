import React from 'react';
import { useInkCanvas } from '../../hooks/useInkCanvas';
import { InkToolConfig } from '../../types/ink';

/** Props accepted by the InkCanvasLayer overlay component. */
interface InkCanvasLayerProps {
  serializedInk: string;
  interactive: boolean;
  locked?: boolean;
  isDark: boolean;
  inkConfig: InkToolConfig;
  onCommitInk?: (nextSerialized: string) => void;
  onPenActivity?: () => void;
  onStylusActive?: () => void;
  onCapacityWarning?: (message: string) => void;
  children: React.ReactNode;
}

/**
 * Renders the prose layer with a transparent DPR-scaled handwriting ink canvas and eraser reticle.
 * @param props - Serialized strokes, ink tool config, theme flag, commit handlers, and prose children.
 * @returns Wrapper element containing prose children, ink canvas, and optional eraser ring.
 */
export const InkCanvasLayer: React.FC<InkCanvasLayerProps> = ({
  serializedInk,
  interactive,
  locked = false,
  isDark,
  inkConfig,
  onCommitInk,
  onPenActivity,
  onStylusActive,
  onCapacityWarning,
  children,
}) => {
  const { refs, cursorClass, touchActionStyle, handlers } = useInkCanvas({
    serializedInk,
    interactive,
    locked,
    isDark,
    inkConfig,
    onCommitInk,
    onPenActivity,
    onStylusActive,
    onCapacityWarning,
  });

  return (
    <div
      ref={refs.wrapperRef}
      onPointerDownCapture={handlers.handlePointerDownCapture}
      onPointerMove={handlers.handlePointerMove}
      onPointerUp={handlers.finishActivePointer}
      onPointerCancel={handlers.finishActivePointer}
      onPointerLeave={handlers.handlePointerLeave}
      className={`relative w-full h-full ${cursorClass}`}
      style={{ touchAction: touchActionStyle }}
    >
      {children}

      <canvas
        ref={refs.canvasRef}
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 w-full h-full z-10 select-none ${
          inkConfig.drawArmed ? 'opacity-100' : ''
        }`}
      />

      {interactive ? (
        <div
          ref={refs.eraserRingRef}
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 z-20 w-5 h-5 rounded-full border border-[#57361e]/80 dark:border-[#deb488]/85 bg-[#faf6ed]/35 dark:bg-[#1d1a17]/35 opacity-0 transition-opacity duration-75"
        />
      ) : null}
    </div>
  );
};
