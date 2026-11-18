import { Eraser, Feather, Highlighter, PenTool, X } from 'lucide-react';
import React from 'react';
import {
  INK_PALETTE,
  INK_PALETTE_ORDER,
  INK_TOOL_ITEMS,
  INK_WIDTH_ITEMS,
} from '../../constants/ink';
import { InkPaletteId, InkToolType, InkWidthPreset } from '../../types/ink';
import { InkHistoryActions } from './InkHistoryActions';

/** Props accepted by the floating InkToolbar component. */
interface InkToolbarProps {
  isOpen: boolean;
  isDark: boolean;
  tool: InkToolType;
  color: InkPaletteId;
  width: InkWidthPreset;
  allowTouchDraw: boolean;
  activeSideLabel: string;
  canUndo: boolean;
  canRedo: boolean;
  hasInkOnActivePage: boolean;
  onSelectTool: (tool: InkToolType) => void;
  onSelectColor: (color: InkPaletteId) => void;
  onSelectWidth: (width: InkWidthPreset) => void;
  onToggleTouchDraw: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClearPage: () => void;
  onClose: () => void;
}

/** Mapping from ink tool IDs to Lucide icon components. */
const TOOL_ICONS: Record<
  InkToolType,
  React.FC<{ className?: string; strokeWidth?: number }>
> = {
  pen: PenTool,
  fountain: Feather,
  highlighter: Highlighter,
  eraser: Eraser,
};

/**
 * Renders the floating stylus and handwriting toolbar for selecting tools, stroke weight, ink color, undo/redo, touch draw, and clearing.
 * @param props - Current ink tool configuration, undo/redo flags, and tool selection handlers.
 * @returns Floating toolbar element or null when closed.
 */
export const InkToolbar: React.FC<InkToolbarProps> = ({
  isOpen,
  isDark,
  tool,
  color,
  width,
  allowTouchDraw,
  activeSideLabel,
  canUndo,
  canRedo,
  hasInkOnActivePage,
  onSelectTool,
  onSelectColor,
  onSelectWidth,
  onToggleTouchDraw,
  onUndo,
  onRedo,
  onClearPage,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="toolbar"
      aria-label="Stylus and handwriting tools"
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-16px)] overflow-x-auto no-scrollbar rounded-xl border border-[#8c7960]/30 dark:border-[#4b4238] bg-[#faf6ed]/92 dark:bg-[#201c18]/92 backdrop-blur-md shadow-[0_10px_28px_-6px_rgba(32,20,12,0.22)] dark:shadow-[0_12px_32px_-6px_rgba(0,0,0,0.65)] px-2.5 py-1.5"
    >
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-max">
        <div
          className="flex items-center gap-0.5 rounded-lg bg-[#efe7d7]/80 dark:bg-[#2a241f]/90 p-0.5"
          role="group"
          aria-label="Pen tools"
        >
          {INK_TOOL_ITEMS.map(({ id, label }) => {
            const active = tool === id;
            const Icon = TOOL_ICONS[id];
            return (
              <button
                key={id}
                type="button"
                aria-label={label}
                aria-pressed={active}
                title={label}
                onClick={() => onSelectTool(id)}
                className={`min-w-[38px] min-h-[38px] sm:min-w-[36px] sm:min-h-[36px] px-2 inline-flex items-center justify-center rounded-md transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#57361e] dark:focus-visible:ring-[#deb488] ${
                  active
                    ? 'bg-[#3a231c] dark:bg-[#deb488] text-[#faf6ed] dark:text-[#1b1511] shadow-xs'
                    : 'text-[#5b4d3e] dark:text-[#b7a896] hover:text-[#261f19] dark:hover:text-[#ece3d4] hover:bg-[#e5dac6]/70 dark:hover:bg-[#352e28]'
                }`}
              >
                <Icon className="w-4 h-4" strokeWidth={1.8} />
              </button>
            );
          })}
        </div>

        <span
          aria-hidden="true"
          className="h-5 w-px bg-[#8c7960]/25 dark:bg-[#423a32] shrink-0"
        />

        <div
          className={`flex items-center gap-0.5 transition-opacity ${
            tool === 'eraser' ? 'opacity-40 pointer-events-none' : 'opacity-100'
          }`}
          role="group"
          aria-label="Stroke weight"
        >
          {INK_WIDTH_ITEMS.map((item) => {
            const active = width === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-label={item.label}
                aria-pressed={active}
                title={item.label}
                onClick={() => onSelectWidth(item.id)}
                className={`w-8 h-9 inline-flex items-center justify-center rounded-md transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#57361e] dark:focus-visible:ring-[#deb488] ${
                  active
                    ? 'bg-[#e6dcc9] dark:bg-[#342e27]'
                    : 'hover:bg-[#efe7d7] dark:hover:bg-[#2b2621]'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="rounded-full bg-[#3a231c] dark:bg-[#e8dfd1]"
                  style={{ width: `${item.dotPx}px`, height: `${item.dotPx}px` }}
                />
              </button>
            );
          })}
        </div>

        <span
          aria-hidden="true"
          className="h-5 w-px bg-[#8c7960]/25 dark:bg-[#423a32] shrink-0"
        />

        <div
          className={`flex items-center gap-1.5 px-1 transition-opacity ${
            tool === 'eraser' ? 'opacity-40 pointer-events-none' : 'opacity-100'
          }`}
          role="group"
          aria-label="Ink color"
        >
          {INK_PALETTE_ORDER.map((id) => {
            const swatch = INK_PALETTE[id];
            const active = color === id;
            const hex =
              tool === 'highlighter'
                ? isDark
                  ? swatch.darkHighlighter
                  : swatch.lightHighlighter
                : isDark
                  ? swatch.darkHex
                  : swatch.lightHex;
            return (
              <button
                key={id}
                type="button"
                aria-label={swatch.label}
                aria-pressed={active}
                title={swatch.label}
                onClick={() => onSelectColor(id)}
                className={`w-5 h-5 rounded-full transition-transform cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#57361e] dark:focus-visible:ring-[#deb488] ${
                  active
                    ? 'scale-115 ring-2 ring-offset-2 ring-offset-[#faf6ed] dark:ring-offset-[#201c18] ring-[#3a231c] dark:ring-[#e8dfd1]'
                    : 'opacity-80 hover:opacity-100 hover:scale-105'
                }`}
                style={{ backgroundColor: hex }}
              />
            );
          })}
        </div>

        <span
          aria-hidden="true"
          className="h-5 w-px bg-[#8c7960]/25 dark:bg-[#423a32] shrink-0"
        />

        <InkHistoryActions
          activeSideLabel={activeSideLabel}
          canUndo={canUndo}
          canRedo={canRedo}
          allowTouchDraw={allowTouchDraw}
          hasInkOnActivePage={hasInkOnActivePage}
          onUndo={onUndo}
          onRedo={onRedo}
          onToggleTouchDraw={onToggleTouchDraw}
          onClearPage={onClearPage}
        />

        <span
          aria-hidden="true"
          className="h-5 w-px bg-[#8c7960]/25 dark:bg-[#423a32] shrink-0"
        />

        <button
          type="button"
          aria-label="Done drawing"
          title="Close stylus bar (Apple Pencil still writes anytime)"
          onClick={onClose}
          className="min-h-[36px] px-2.5 inline-flex items-center gap-1 rounded-md text-xs font-medium text-[#3a231c] dark:text-[#ece3d4] bg-[#efe7d7] dark:bg-[#2d2722] hover:bg-[#e5dac6] dark:hover:bg-[#38312b] transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#57361e] dark:focus-visible:ring-[#deb488]"
        >
          <X className="w-3.5 h-3.5" strokeWidth={1.85} />
          <span>Done</span>
        </button>
      </div>
    </div>
  );
};
