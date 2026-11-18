import { Moon, Sun } from 'lucide-react';
import React from 'react';

/** Props accepted by the ClosedBookPrompt component. */
interface ClosedBookPromptProps {
  visible: boolean;
  authReady: boolean;
  userEmail: string | null;
  authBusy: boolean;
  authError: string | null;
  isDark: boolean;
  onToggleTheme: () => void;
  onSignInWithGoogle: () => void;
  onSignOut: () => void;
  onClearAuthError: () => void;
}

/**
 * Renders the "Click the book to open" cue, Google account sync status line, and closed-state auth errors.
 * @param props - Closed-book visibility, auth session/error state, and sign-in/out callbacks.
 * @returns Closed-book footer prompt and optional error toast.
 */
export const ClosedBookPrompt: React.FC<ClosedBookPromptProps> = ({
  visible,
  authReady,
  userEmail,
  authBusy,
  authError,
  isDark,
  onToggleTheme,
  onSignInWithGoogle,
  onSignOut,
  onClearAuthError,
}) => (
  <>
    <div
      className={`mt-5 min-h-12 flex flex-col items-center justify-center gap-1 px-4 text-center transition-opacity duration-500 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="relative w-full max-w-sm flex items-center justify-center px-10">
        <p className="text-sm tracking-wide font-serif italic text-[#5c4f41] dark:text-[#b2a390] opacity-85">
          Click the book to open
        </p>
        <button
          type="button"
          disabled={!visible}
          onClick={onToggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="md:hidden absolute right-0 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-2 py-1.5 rounded border border-[#8c7960]/30 dark:border-[#4b4238] bg-[#faf6ed]/75 dark:bg-[#1f1c19]/85 text-[11px] text-[#4a3d30] dark:text-[#d5c8b6] transition-colors cursor-pointer shrink-0 min-h-[32px] backdrop-blur-[2px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#57361e] dark:focus-visible:ring-[#deb488]"
        >
          {isDark ? (
            <>
              <Sun className="w-3 h-3" strokeWidth={1.75} />
              <span>Light</span>
            </>
          ) : (
            <>
              <Moon className="w-3 h-3" strokeWidth={1.75} />
              <span>Dark</span>
            </>
          )}
        </button>
      </div>

      {authReady ? (
        userEmail ? (
          <div className="flex items-center gap-2 text-xs text-[#6d5d4b] dark:text-[#9f917f]">
            <span className="truncate max-w-[230px] sm:max-w-xs">
              Synced as {userEmail}
            </span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              disabled={authBusy || !visible}
              onClick={onSignOut}
              className="text-[#4a3b2c] dark:text-[#d6c7b4] hover:text-[#261f19] dark:hover:text-[#ece3d4] underline underline-offset-2 cursor-pointer whitespace-nowrap shrink-0"
            >
              {authBusy ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={authBusy || !visible}
            onClick={onSignInWithGoogle}
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

    {visible && authError && (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-md flex items-center gap-2 text-xs text-[#732323] dark:text-[#f0a8a3] bg-[#faf6ed]/95 dark:bg-[#2a1919]/95 border border-[#8c2d2d]/30 dark:border-[#b84a45]/45 rounded px-3.5 py-2 shadow-sm text-center">
        <span>{authError}</span>
        <button
          type="button"
          onClick={onClearAuthError}
          className="underline cursor-pointer shrink-0"
        >
          Dismiss
        </button>
      </div>
    )}
  </>
);
