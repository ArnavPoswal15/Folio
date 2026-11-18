import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { BookPhase } from '../types/book';
import { PageFocusRequest } from '../types/pageContent';
import { TurnDirection } from '../types/pageCurl';
import { RecordingTarget } from '../types/voice';
import { appendTranscriptToBody } from '../utils/voice';
import { useInkWorkspace } from './useInkWorkspace';
import { useJournalStore } from './useJournalStore';
import { useViewportMetrics } from './useViewportMetrics';
import { useVoiceRecorder } from './useVoiceRecorder';

/**
 * Orchestrates workspace-level UI state, cover phases, modal dialogs, ink workspace, voice dictation, and spread navigation.
 * @returns Complete workspace controller state, store bindings, and memoized UI event handlers.
 */
export function useJournalWorkspace() {
  const { isDark, toggleTheme } = useTheme();
  const authState = useAuth();
  const store = useJournalStore(authState.user, authState.authReady);
  const metrics = useViewportMetrics();

  const [bookPhase, setBookPhase] = useState<BookPhase>('closed');
  const [indexModalOpen, setIndexModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [mobileSide, setMobileSide] = useState<'left' | 'right'>('left');
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [landscapeHintDismissed, setLandscapeHintDismissed] = useState(false);
  const [focusRequest, setFocusRequest] = useState<PageFocusRequest | null>(
    null
  );

  const focusNonceRef = useRef(0);
  const spreadsRef = useRef(store.spreads);
  spreadsRef.current = store.spreads;

  const ink = useInkWorkspace(
    spreadsRef,
    store.currentIndex,
    metrics.isMobile,
    mobileSide,
    store.updateSpread
  );

  const handleRequestFocus = useCallback(
    (req: Omit<PageFocusRequest, 'nonce'>) => {
      focusNonceRef.current += 1;
      setFocusRequest({ ...req, nonce: focusNonceRef.current });
    },
    []
  );

  const handleClearFocusRequest = useCallback((nonce: number) => {
    setFocusRequest((prev) => (prev?.nonce === nonce ? null : prev));
  }, []);

  useEffect(() => {
    if (authState.authReady && authState.user && !welcomeDismissed) {
      setWelcomeDismissed(true);
    }
  }, [authState.authReady, authState.user, welcomeDismissed]);

  const handleDismissWelcome = useCallback(() => {
    setWelcomeDismissed(true);
    setMobileSide('left');
  }, []);

  const showWelcome = authState.authReady && !welcomeDismissed;

  const handleVoiceTranscribed = useCallback(
    (target: RecordingTarget, text: string) => {
      const targetSpread = spreadsRef.current[target.spreadIndex];
      if (!targetSpread) return;
      const field = target.side === 'left' ? 'leftBody' : 'rightBody';
      store.updateSpread(target.spreadIndex, {
        [field]: appendTranscriptToBody(targetSpread[field], text),
      });
    },
    [store]
  );

  const voiceControl = useVoiceRecorder({
    enabled: bookPhase === 'open' && !showWelcome,
    onTranscribed: handleVoiceTranscribed,
  });

  const handleOpenBook = useCallback(() => {
    if (bookPhase !== 'closed') return;
    setBookPhase('opening');
  }, [bookPhase]);

  const handleOpenComplete = useCallback(() => {
    setBookPhase('open');
  }, []);

  const handleCloseBook = useCallback(() => {
    if (bookPhase !== 'open') return;
    voiceControl.onCancel();
    void store.flushPendingSaves();
    ink.setInkToolbarOpen(false);
    setIndexModalOpen(false);
    setExportModalOpen(false);
    setAccountModalOpen(false);
    setMobileSide('left');
    setBookPhase('closing');
  }, [bookPhase, ink, store, voiceControl]);

  const handleCloseComplete = useCallback(() => {
    setBookPhase('closed');
    if (!authState.user) {
      setWelcomeDismissed(false);
    }
  }, [authState.user]);

  const handleSignOut = useCallback(async () => {
    await store.flushPendingSaves();
    await authState.signOut();
    ink.setInkToolbarOpen(false);
    setAccountModalOpen(false);
    setWelcomeDismissed(false);
  }, [authState, ink, store]);

  const handleCommitTurn = useCallback(
    (direction: TurnDirection) => {
      if (metrics.isMobile) {
        if (direction === 'next') {
          if (mobileSide === 'left') {
            setMobileSide('right');
          } else {
            store.turnNext();
            setMobileSide('left');
          }
        } else if (mobileSide === 'right') {
          setMobileSide('left');
        } else if (store.currentIndex > 0) {
          store.turnPrev();
          setMobileSide('right');
        }
        return;
      }

      if (direction === 'prev') {
        store.turnPrev();
      } else {
        store.turnNext();
      }
    },
    [metrics.isMobile, mobileSide, store]
  );

  const handleSelectSpread = useCallback(
    (idx: number) => {
      store.goToSpread(idx);
      setMobileSide('left');
    },
    [store]
  );

  const handleNewSpread = useCallback(() => {
    store.createSpread();
    setMobileSide('left');
  }, [store]);

  useEffect(() => {
    if (!metrics.isLandscapeMobile && landscapeHintDismissed) {
      setLandscapeHintDismissed(false);
    }
  }, [landscapeHintDismissed, metrics.isLandscapeMobile]);

  const showFloatingInkBar =
    bookPhase === 'open' &&
    !showWelcome &&
    ink.inkToolbarOpen &&
    !indexModalOpen &&
    !exportModalOpen &&
    !accountModalOpen;

  return {
    isDark,
    toggleTheme,
    authState,
    store,
    metrics,
    bookPhase,
    mobileSide,
    showWelcome,
    indexModalOpen,
    setIndexModalOpen,
    exportModalOpen,
    setExportModalOpen,
    accountModalOpen,
    setAccountModalOpen,
    landscapeHintDismissed,
    setLandscapeHintDismissed,
    focusRequest,
    ink,
    voiceControl,
    showFloatingInkBar,
    handleRequestFocus,
    handleClearFocusRequest,
    handleDismissWelcome,
    handleOpenBook,
    handleOpenComplete,
    handleCloseBook,
    handleCloseComplete,
    handleSignOut,
    handleCommitTurn,
    handleSelectSpread,
    handleNewSpread,
  };
}
