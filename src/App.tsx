import { Moon, Sun } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccountModal } from './components/AccountModal';
import { EntriesIndexModal } from './components/EntriesIndexModal';
import { ExportJournalModal } from './components/ExportJournalModal';
import { BookPhase, PageCurlStage } from './components/PageCurlStage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { useJournalStore } from './hooks/useJournalStore';
import { RecordingTarget, useVoiceRecorder } from './hooks/useVoiceRecorder';
import { TurnDirection } from './utils/pageCurlGeometry';

function appendTranscriptToBody(existing: string, transcript: string): string {
  const clean = transcript.trim();
  if (!clean) return existing;
  if (!existing.trim()) return clean;
  if (/[\s\n]$/.test(existing)) return `${existing}${clean}`;
  if (/[.!?…]["')\]]*$/.test(existing)) return `${existing}\n\n${clean}`;
  return `${existing} ${clean}`;
}

interface ViewportMetrics {
  pageW: number;
  pageH: number;
  isMobile: boolean;
}

function computeViewportMetrics(vw: number, vh: number): ViewportMetrics {
  const isMobile = vw < 768;

  if (isMobile) {
    const pageW = Math.max(256, Math.min(440, vw - 44));
    const maxH = Math.max(360, vh - 128);
    const pageH = Math.min(maxH, Math.round(pageW / 0.67));
    return { pageW, pageH, isMobile: true };
  }

  const availW = Math.max(540, vw - 64);
  const availH = Math.max(360, vh - 134);

  const maxPageWByWidth = Math.floor((availW - 24) / 2);
  const maxPageWByHeight = Math.floor((availH - 22) * 0.758);

  const pageW = Math.max(250, Math.min(480, maxPageWByWidth, maxPageWByHeight));
  const pageH = Math.round(pageW / 0.758);

  return { pageW, pageH, isMobile: false };
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class JournalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen desk-surface flex items-center justify-center p-6">
          <div className="paper-grain rounded-lg p-8 max-w-md text-center shadow-2xl border border-[#bcae97] dark:border-[#3d362e]">
            <h1 className="font-serif text-2xl font-semibold text-[#261f19] dark:text-[#ece3d4]">
              Unable to display journal page
            </h1>
            <p className="mt-2 text-sm text-[#6d5d4b] dark:text-[#9f917f]">
              Your entries remain saved safely. Reload to reopen the book.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 px-5 py-2 text-sm font-medium bg-[#3a231c] dark:bg-[#d7c4a5] text-[#f6f1e6] dark:text-[#1b1511] rounded hover:bg-[#4c2e25] dark:hover:bg-[#e5d5ba] transition-colors cursor-pointer"
            >
              Reopen Journal
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function JournalWorkspace() {
  const { isDark, toggleTheme } = useTheme();
  const {
    user,
    authReady,
    authBusy,
    authError,
    signInWithGoogle,
    signOut,
    clearAuthError,
  } = useAuth();

  const {
    spreads,
    currentIndex,
    upcomingBlankSpread,
    syncStatus,
    syncError,
    retrySync,
    flushPendingSaves,
    updateSpread,
    goToSpread,
    turnPrev,
    turnNext,
    createSpread,
    deleteSpread,
  } = useJournalStore(user, authReady);

  const [bookPhase, setBookPhase] = useState<BookPhase>('closed');
  const [indexModalOpen, setIndexModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [mobileSide, setMobileSide] = useState<'left' | 'right'>('left');
  const [welcomeDismissed, setWelcomeDismissed] = useState<boolean>(false);

  // Logged-in users go straight into their clean synced journal
  useEffect(() => {
    if (authReady && user && !welcomeDismissed) {
      setWelcomeDismissed(true);
    }
  }, [authReady, user, welcomeDismissed]);

  const handleDismissWelcome = useCallback(() => {
    setWelcomeDismissed(true);
    setMobileSide('left');
  }, []);

  const showWelcome = authReady && !welcomeDismissed;

  const spreadsRef = useRef(spreads);
  spreadsRef.current = spreads;

  const handleVoiceTranscribed = useCallback(
    (target: RecordingTarget, text: string) => {
      const targetSpread = spreadsRef.current[target.spreadIndex];
      if (!targetSpread) return;
      const field = target.side === 'left' ? 'leftBody' : 'rightBody';
      updateSpread(target.spreadIndex, {
        [field]: appendTranscriptToBody(targetSpread[field], text),
      });
    },
    [updateSpread]
  );

  const voiceControl = useVoiceRecorder({
    enabled: bookPhase === 'open' && !showWelcome,
    onTranscribed: handleVoiceTranscribed,
  });

  const [metrics, setMetrics] = useState(() =>
    computeViewportMetrics(
      typeof window !== 'undefined' ? window.innerWidth : 1440,
      typeof window !== 'undefined' ? window.innerHeight : 900
    )
  );

  useEffect(() => {
    const onResize = () => {
      setMetrics(
        computeViewportMetrics(window.innerWidth, window.innerHeight)
      );
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
    void flushPendingSaves();
    setIndexModalOpen(false);
    setExportModalOpen(false);
    setAccountModalOpen(false);
    setMobileSide('left');
    setBookPhase('closing');
  }, [bookPhase, flushPendingSaves, voiceControl]);

  const handleCloseComplete = useCallback(() => {
    setBookPhase('closed');
    if (!user) {
      setWelcomeDismissed(false);
    }
  }, [user]);

  const handleSignOut = useCallback(async () => {
    await flushPendingSaves();
    await signOut();
    setAccountModalOpen(false);
    setWelcomeDismissed(false);
  }, [flushPendingSaves, signOut]);

  const handleCommitTurn = useCallback(
    (direction: TurnDirection) => {
      if (metrics.isMobile) {
        if (direction === 'next') {
          if (mobileSide === 'left') {
            setMobileSide('right');
          } else {
            turnNext();
            setMobileSide('left');
          }
        } else {
          if (mobileSide === 'right') {
            setMobileSide('left');
          } else if (currentIndex > 0) {
            turnPrev();
            setMobileSide('right');
          }
        }
        return;
      }

      if (direction === 'prev') {
        turnPrev();
      } else {
        turnNext();
      }
    },
    [currentIndex, metrics.isMobile, mobileSide, turnNext, turnPrev]
  );

  const handleSelectSpread = useCallback(
    (idx: number) => {
      goToSpread(idx);
      setMobileSide('left');
    },
    [goToSpread]
  );

  const handleNewSpread = useCallback(() => {
    createSpread();
    setMobileSide('left');
  }, [createSpread]);

  const { pageW, pageH, isMobile } = metrics;

  return (
    <main className="relative w-screen h-[100dvh] desk-surface flex flex-col items-center justify-center overflow-hidden px-2">
      {/* Quiet desk appearance toggle visible when closed */}
      <div
        className={`fixed top-4 right-5 z-30 transition-opacity duration-300 ${
          bookPhase === 'closed' ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <button
          type="button"
          onClick={toggleTheme}
          disabled={bookPhase !== 'closed'}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#8c7960]/30 dark:border-[#4b4238] bg-[#faf6ed]/75 dark:bg-[#1f1c19]/85 text-xs text-[#4a3d30] dark:text-[#d5c8b6] hover:border-[#57361e]/60 dark:hover:border-[#deb488]/50 hover:text-[#261f19] dark:hover:text-[#ece3d4] transition-colors cursor-pointer whitespace-nowrap shrink-0 min-h-[36px] backdrop-blur-[2px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#57361e] dark:focus-visible:ring-[#deb488]"
        >
          {isDark ? (
            <>
              <Sun className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Light</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Dark</span>
            </>
          )}
        </button>
      </div>

      <PageCurlStage
        spreads={spreads}
        currentIndex={currentIndex}
        pageW={pageW}
        pageH={pageH}
        isMobile={isMobile}
        mobileSide={mobileSide}
        bookPhase={bookPhase}
        upcomingBlankSpread={upcomingBlankSpread}
        showWelcome={showWelcome}
        isSignedIn={Boolean(user)}
        authBusy={authBusy}
        authError={authError}
        onOpenBook={handleOpenBook}
        onOpenComplete={handleOpenComplete}
        onCloseComplete={handleCloseComplete}
        onUpdateSpread={updateSpread}
        onCommitTurn={handleCommitTurn}
        onNewSpread={handleNewSpread}
        onOpenIndex={() => setIndexModalOpen(true)}
        onOpenExport={() => setExportModalOpen(true)}
        onOpenAccount={() => setAccountModalOpen(true)}
        onSignInWithGoogle={() => void signInWithGoogle()}
        onClearAuthError={clearAuthError}
        onDismissWelcome={handleDismissWelcome}
        onCloseBook={handleCloseBook}
        voiceControl={voiceControl}
      />

      {/* Quiet fixed-height prompt & optional Google Sign-In visible only when closed */}
      <div
        className={`mt-5 h-12 flex flex-col items-center justify-center gap-1 px-4 text-center transition-opacity duration-500 ${
          bookPhase === 'closed' ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <p className="text-sm tracking-wide font-serif italic text-[#5c4f41] dark:text-[#b2a390] opacity-85">
          Click the book to open
        </p>

        {authReady ? (
          user ? (
            <div className="flex items-center gap-2 text-xs text-[#6d5d4b] dark:text-[#9f917f]">
              <span className="truncate max-w-[230px] sm:max-w-xs">
                Synced as {user.email}
              </span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                disabled={authBusy || bookPhase !== 'closed'}
                onClick={() => void handleSignOut()}
                className="text-[#4a3b2c] dark:text-[#d6c7b4] hover:text-[#261f19] dark:hover:text-[#ece3d4] underline underline-offset-2 cursor-pointer whitespace-nowrap shrink-0"
              >
                {authBusy ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={authBusy || bookPhase !== 'closed'}
              onClick={() => void signInWithGoogle()}
              className="text-xs text-[#57361e] dark:text-[#deb488] hover:text-[#261f19] dark:hover:text-[#f2e7d5] underline underline-offset-2 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {authBusy
                ? 'Connecting Google account…'
                : 'Sign in with Google to sync across devices'}
            </button>
          )
        ) : (
          <div className="h-4" />
        )}
      </div>

      {bookPhase === 'closed' && authError ? (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-md flex items-center gap-2 text-xs text-[#732323] dark:text-[#f0a8a3] bg-[#faf6ed]/95 dark:bg-[#2a1919]/95 border border-[#8c2d2d]/30 dark:border-[#b84a45]/45 rounded px-3.5 py-2 shadow-sm text-center">
          <span>{authError}</span>
          <button
            type="button"
            onClick={clearAuthError}
            className="underline cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <EntriesIndexModal
        isOpen={indexModalOpen}
        spreads={spreads}
        currentIndex={currentIndex}
        syncStatus={syncStatus}
        userEmail={user?.email}
        onSelectSpread={handleSelectSpread}
        onNewSpread={handleNewSpread}
        onOpenExport={() => setExportModalOpen(true)}
        onOpenAccount={() => setAccountModalOpen(true)}
        onDeleteSpread={deleteSpread}
        onClose={() => setIndexModalOpen(false)}
      />

      <ExportJournalModal
        isOpen={exportModalOpen}
        spreads={spreads}
        onClose={() => setExportModalOpen(false)}
      />

      <AccountModal
        isOpen={accountModalOpen}
        user={user}
        authBusy={authBusy}
        authError={authError}
        syncStatus={syncStatus}
        syncError={syncError}
        spreadsCount={spreads.length}
        onSignInWithGoogle={signInWithGoogle}
        onSignOut={handleSignOut}
        onRetrySync={retrySync}
        onClearAuthError={clearAuthError}
        onClose={() => setAccountModalOpen(false)}
      />
    </main>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <JournalErrorBoundary>
        <AuthProvider>
          <JournalWorkspace />
        </AuthProvider>
      </JournalErrorBoundary>
    </ThemeProvider>
  );
}
