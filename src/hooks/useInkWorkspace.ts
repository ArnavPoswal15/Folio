import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  INK_CAPACITY_WARNING_TIMEOUT_MS,
  INK_HISTORY_MAX_STEPS,
} from '../constants/ink';
import {
  InkPaletteId,
  InkToolConfig,
  InkToolType,
  InkWidthPreset,
} from '../types/ink';
import { JournalSpread } from '../types/journal';

/**
 * Manages stylus toolbar open state, selected brush/color/weight, touch draw mode, undo/redo stacks, and quota toast.
 * @param spreadsRef - Live ref to chronological spreads array.
 * @param currentIndex - Currently active spread index.
 * @param isMobile - Whether single-page mobile layout is active.
 * @param mobileSide - Currently displayed mobile page side (`left` or `right`).
 * @param updateSpread - Callback persisting partial spread patches.
 * @returns Active ink configuration, undo/redo availability, warning message, and toolbar handlers.
 */
export function useInkWorkspace(
  spreadsRef: React.RefObject<JournalSpread[]>,
  currentIndex: number,
  isMobile: boolean,
  mobileSide: 'left' | 'right',
  updateSpread: (index: number, patch: Partial<JournalSpread>) => void
) {
  const [inkToolbarOpen, setInkToolbarOpen] = useState(false);
  const [inkTool, setInkTool] = useState<InkToolType>('fountain');
  const [inkColor, setInkColor] = useState<InkPaletteId>('charcoal');
  const [inkWidth, setInkWidth] = useState<InkWidthPreset>(2);
  const [allowTouchDraw, setAllowTouchDraw] = useState(false);
  const [activeInkSide, setActiveInkSide] = useState<'left' | 'right'>('left');
  const [inkCapacityWarning, setInkCapacityWarning] = useState<string | null>(
    null
  );

  const undoStacksRef = useRef<Map<string, string[]>>(new Map());
  const redoStacksRef = useRef<Map<string, string[]>>(new Map());
  const [, setHistoryTick] = useState(0);

  const effectiveInkSide: 'left' | 'right' = isMobile
    ? mobileSide
    : activeInkSide;

  const inkConfig = useMemo<InkToolConfig>(
    () => ({
      tool: inkTool,
      color: inkColor,
      width: inkWidth,
      drawArmed: inkToolbarOpen,
      allowTouchDraw,
    }),
    [allowTouchDraw, inkColor, inkToolbarOpen, inkTool, inkWidth]
  );

  const handleToggleInkToolbar = useCallback((side: 'left' | 'right') => {
    setActiveInkSide(side);
    setInkToolbarOpen((prev) => !prev);
  }, []);

  const handleStylusActive = useCallback(
    (_spreadIndex: number, side: 'left' | 'right') => {
      setActiveInkSide(side);
    },
    []
  );

  const handleCommitInk = useCallback(
    (spreadIndex: number, side: 'left' | 'right', nextSerialized: string) => {
      const targetSpread = spreadsRef.current[spreadIndex];
      if (!targetSpread) return;
      const field = side === 'left' ? 'leftInk' : 'rightInk';
      const prevSerialized = targetSpread[field] ?? '';
      if (prevSerialized === nextSerialized) return;

      const historyKey = `${targetSpread.id}:${side}`;
      const undoStack = undoStacksRef.current.get(historyKey) ?? [];
      undoStack.push(prevSerialized);
      if (undoStack.length > INK_HISTORY_MAX_STEPS) undoStack.shift();
      undoStacksRef.current.set(historyKey, undoStack);
      redoStacksRef.current.set(historyKey, []);
      setHistoryTick((n) => n + 1);
      setActiveInkSide(side);

      updateSpread(spreadIndex, { [field]: nextSerialized });
    },
    [spreadsRef, updateSpread]
  );

  const handleUndoInk = useCallback(() => {
    const cur = spreadsRef.current[currentIndex];
    if (!cur) return;
    const key = `${cur.id}:${effectiveInkSide}`;
    const undoStack = undoStacksRef.current.get(key);
    if (!undoStack || undoStack.length === 0) return;

    const field = effectiveInkSide === 'left' ? 'leftInk' : 'rightInk';
    const currentSerialized = cur[field] ?? '';
    const prevSerialized = undoStack.pop() ?? '';
    const redoStack = redoStacksRef.current.get(key) ?? [];
    redoStack.push(currentSerialized);
    if (redoStack.length > INK_HISTORY_MAX_STEPS) redoStack.shift();
    redoStacksRef.current.set(key, redoStack);
    setHistoryTick((n) => n + 1);

    updateSpread(currentIndex, { [field]: prevSerialized });
  }, [currentIndex, effectiveInkSide, spreadsRef, updateSpread]);

  const handleRedoInk = useCallback(() => {
    const cur = spreadsRef.current[currentIndex];
    if (!cur) return;
    const key = `${cur.id}:${effectiveInkSide}`;
    const redoStack = redoStacksRef.current.get(key);
    if (!redoStack || redoStack.length === 0) return;

    const field = effectiveInkSide === 'left' ? 'leftInk' : 'rightInk';
    const currentSerialized = cur[field] ?? '';
    const nextSerialized = redoStack.pop() ?? '';
    const undoStack = undoStacksRef.current.get(key) ?? [];
    undoStack.push(currentSerialized);
    if (undoStack.length > INK_HISTORY_MAX_STEPS) undoStack.shift();
    undoStacksRef.current.set(key, undoStack);
    setHistoryTick((n) => n + 1);

    updateSpread(currentIndex, { [field]: nextSerialized });
  }, [currentIndex, effectiveInkSide, spreadsRef, updateSpread]);

  const handleClearActiveInkPage = useCallback(() => {
    const cur = spreadsRef.current[currentIndex];
    if (!cur) return;
    const field = effectiveInkSide === 'left' ? 'leftInk' : 'rightInk';
    if (!cur[field]) return;
    handleCommitInk(currentIndex, effectiveInkSide, '');
  }, [currentIndex, effectiveInkSide, handleCommitInk, spreadsRef]);

  useEffect(() => {
    if (!inkCapacityWarning) return;
    const timer = window.setTimeout(
      () => setInkCapacityWarning(null),
      INK_CAPACITY_WARNING_TIMEOUT_MS
    );
    return () => window.clearTimeout(timer);
  }, [inkCapacityWarning]);

  const currentSpreadObj = spreadsRef.current[currentIndex];
  const activeHistoryKey = currentSpreadObj
    ? `${currentSpreadObj.id}:${effectiveInkSide}`
    : '';
  const canUndoInk =
    (undoStacksRef.current.get(activeHistoryKey)?.length ?? 0) > 0;
  const canRedoInk =
    (redoStacksRef.current.get(activeHistoryKey)?.length ?? 0) > 0;
  const hasInkOnActivePage = Boolean(
    currentSpreadObj &&
      (effectiveInkSide === 'left'
        ? currentSpreadObj.leftInk
        : currentSpreadObj.rightInk)
  );

  return {
    inkToolbarOpen,
    setInkToolbarOpen,
    inkTool,
    setInkTool,
    inkColor,
    setInkColor,
    inkWidth,
    setInkWidth,
    allowTouchDraw,
    toggleTouchDraw: useCallback(
      () => setAllowTouchDraw((prev) => !prev),
      []
    ),
    effectiveInkSide,
    inkConfig,
    inkCapacityWarning,
    setInkCapacityWarning,
    canUndoInk,
    canRedoInk,
    hasInkOnActivePage,
    handleToggleInkToolbar,
    handleStylusActive,
    handleCommitInk,
    handleUndoInk,
    handleRedoInk,
    handleClearActiveInkPage,
  };
}
