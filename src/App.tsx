import React from 'react';
import { AccountModal } from './components/account/AccountModal';
import { PageCurlStage } from './components/book/PageCurlStage';
import { EntriesIndexModal } from './components/entriesIndex/EntriesIndexModal';
import { ExportJournalModal } from './components/export/ExportJournalModal';
import { InkToolbar } from './components/ink/InkToolbar';
import { ClosedBookPrompt } from './components/workspace/ClosedBookPrompt';
import { DeskThemeToggle } from './components/workspace/DeskThemeToggle';
import { InkWarningToast } from './components/workspace/InkWarningToast';
import { JournalErrorBoundary } from './components/workspace/JournalErrorBoundary';
import { LandscapeRotateModal } from './components/workspace/LandscapeRotateModal';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { useJournalWorkspace } from './hooks/useJournalWorkspace';

/**
 * Renders the dumb workspace shell connecting workspace controller state to the 3D journal stage, toolbars, and modals.
 * @returns Full desk workspace view wrapping the 3D journal and overlays.
 */
function JournalWorkspace() {
  const {
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
  } = useJournalWorkspace();

  return (
    <main className="relative w-screen h-[100dvh] desk-surface flex flex-col items-center justify-center overflow-hidden px-2">
      <DeskThemeToggle
        visible={bookPhase === 'closed'}
        isDark={isDark}
        onToggle={toggleTheme}
        hideOnMobile={metrics.isMobile}
      />

      <PageCurlStage
        spreads={store.spreads}
        currentIndex={store.currentIndex}
        pageW={metrics.pageW}
        pageH={metrics.pageH}
        isMobile={metrics.isMobile}
        mobileSide={mobileSide}
        bookPhase={bookPhase}
        upcomingBlankSpread={store.upcomingBlankSpread}
        showWelcome={showWelcome}
        isSignedIn={Boolean(authState.user)}
        authBusy={authState.authBusy}
        authError={authState.authError}
        onOpenBook={handleOpenBook}
        onOpenComplete={handleOpenComplete}
        onCloseComplete={handleCloseComplete}
        onUpdateSpread={store.updateSpread}
        onCommitTurn={handleCommitTurn}
        onNewSpread={handleNewSpread}
        onOpenIndex={() => setIndexModalOpen(true)}
        onOpenExport={() => setExportModalOpen(true)}
        onOpenAccount={() => setAccountModalOpen(true)}
        onSignInWithGoogle={() => void authState.signInWithGoogle()}
        onClearAuthError={authState.clearAuthError}
        onDismissWelcome={handleDismissWelcome}
        onCloseBook={handleCloseBook}
        voiceControl={voiceControl}
        inkConfig={ink.inkConfig}
        inkToolbarOpen={ink.inkToolbarOpen}
        inkToolbarSide={ink.effectiveInkSide}
        onToggleInkToolbar={ink.handleToggleInkToolbar}
        onCommitInk={ink.handleCommitInk}
        onStylusActive={ink.handleStylusActive}
        onInkCapacityWarning={ink.setInkCapacityWarning}
        onStageContinuationSpread={store.stageContinuationSpread}
        focusRequest={focusRequest}
        onRequestFocus={handleRequestFocus}
        onClearFocusRequest={handleClearFocusRequest}
      />

      <InkToolbar
        isOpen={showFloatingInkBar}
        isDark={isDark}
        tool={ink.inkTool}
        color={ink.inkColor}
        width={ink.inkWidth}
        allowTouchDraw={ink.allowTouchDraw}
        activeSideLabel={ink.effectiveInkSide === 'left' ? 'Left page' : 'Right page'}
        canUndo={ink.canUndoInk}
        canRedo={ink.canRedoInk}
        hasInkOnActivePage={ink.hasInkOnActivePage}
        onSelectTool={ink.setInkTool}
        onSelectColor={ink.setInkColor}
        onSelectWidth={ink.setInkWidth}
        onToggleTouchDraw={ink.toggleTouchDraw}
        onUndo={ink.handleUndoInk}
        onRedo={ink.handleRedoInk}
        onClearPage={ink.handleClearActiveInkPage}
        onClose={() => ink.setInkToolbarOpen(false)}
      />

      <InkWarningToast
        message={ink.inkCapacityWarning}
        onDismiss={() => ink.setInkCapacityWarning(null)}
      />

      <ClosedBookPrompt
        visible={bookPhase === 'closed'}
        authReady={authState.authReady}
        userEmail={authState.user?.email ?? null}
        authBusy={authState.authBusy}
        authError={authState.authError}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onSignInWithGoogle={() => void authState.signInWithGoogle()}
        onSignOut={() => void handleSignOut()}
        onClearAuthError={authState.clearAuthError}
      />

      <EntriesIndexModal
        isOpen={indexModalOpen}
        spreads={store.spreads}
        currentIndex={store.currentIndex}
        syncStatus={store.syncStatus}
        userEmail={authState.user?.email}
        onSelectSpread={handleSelectSpread}
        onNewSpread={handleNewSpread}
        onOpenExport={() => setExportModalOpen(true)}
        onOpenAccount={() => setAccountModalOpen(true)}
        onDeleteSpread={store.deleteSpread}
        onClose={() => setIndexModalOpen(false)}
      />

      <ExportJournalModal
        isOpen={exportModalOpen}
        spreads={store.spreads}
        onClose={() => setExportModalOpen(false)}
      />

      <AccountModal
        isOpen={accountModalOpen}
        user={authState.user}
        authBusy={authState.authBusy}
        authError={authState.authError}
        syncStatus={store.syncStatus}
        syncError={store.syncError}
        spreadsCount={store.spreads.length}
        onSignInWithGoogle={authState.signInWithGoogle}
        onSignOut={handleSignOut}
        onRetrySync={store.retrySync}
        onClearAuthError={authState.clearAuthError}
        onClose={() => setAccountModalOpen(false)}
      />

      <LandscapeRotateModal
        visible={metrics.isLandscapeMobile && !landscapeHintDismissed}
        onDismiss={() => setLandscapeHintDismissed(true)}
      />
    </main>
  );
}

/**
 * Root application shell wrapping ThemeProvider, JournalErrorBoundary, AuthProvider, and JournalWorkspace.
 * @returns Top-level React application element.
 */
export const App: React.FC = () => (
  <ThemeProvider>
    <JournalErrorBoundary>
      <AuthProvider>
        <JournalWorkspace />
      </AuthProvider>
    </JournalErrorBoundary>
  </ThemeProvider>
);

export default App;
