import { User } from 'firebase/auth';
import React, { useEffect } from 'react';
import { SyncStatus } from '../types/journal';

interface AccountModalProps {
  isOpen: boolean;
  user: User | null;
  authBusy: boolean;
  authError: string | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  spreadsCount: number;
  onSignInWithGoogle: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onRetrySync: () => void;
  onClearAuthError: () => void;
  onClose: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  user,
  authBusy,
  authError,
  syncStatus,
  syncError,
  spreadsCount,
  onSignInWithGoogle,
  onSignOut,
  onRetrySync,
  onClearAuthError,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const syncLabel =
    syncStatus === 'synced'
      ? 'Synced across your devices'
      : syncStatus === 'syncing'
        ? 'Syncing changes…'
        : syncStatus === 'error'
          ? 'Sync paused — saved locally'
          : 'Saved locally on this device';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Account and cross-device sync"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/75 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md paper-grain rounded-lg border border-[#bcae97] dark:border-[#3d362e] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 sm:px-7 py-5 border-b border-[#8c7960]/25 dark:border-[#423a32] flex items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl font-semibold text-[#261f19] dark:text-[#ece3d4]">
              Account &amp; Sync
            </h2>
            <p className="text-xs text-[#756452] dark:text-[#9f917f] mt-0.5">
              {user
                ? 'Private cloud journal backup'
                : 'Optional Google sign-in for all-device sync'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close account dialog"
            className="text-[#6d5d4b] dark:text-[#9f917f] hover:text-[#261f19] dark:hover:text-[#ece3d4] cursor-pointer px-2 py-1 min-w-[40px] min-h-[40px] flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <div className="px-6 sm:px-7 py-5 space-y-5">
          {user ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="font-serif text-xl font-medium text-[#261f19] dark:text-[#ece3d4]">
                  {user.displayName || 'Journal Owner'}
                </div>
                <div className="text-sm text-[#6d5d4b] dark:text-[#9f917f] truncate">
                  {user.email}
                </div>
              </div>

              <div className="pt-3 border-t border-[#8c7960]/20 dark:border-[#423a32] space-y-1.5 text-sm text-[#5e4f40] dark:text-[#bfb19e]">
                <div className="flex items-center justify-between gap-3">
                  <span>Sync status</span>
                  <span className="font-medium text-[#261f19] dark:text-[#ece3d4] text-right">
                    {syncLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Synced entries</span>
                  <span className="font-medium text-[#261f19] dark:text-[#ece3d4] tabular-nums">
                    {spreadsCount} {spreadsCount === 1 ? 'spread' : 'spreads'}
                  </span>
                </div>
              </div>

              {syncError ? (
                <div className="p-3 rounded border border-[#8c2d2d]/30 dark:border-[#b84a45]/45 bg-[#8c2d2d]/5 dark:bg-[#331a1a]/80 text-xs text-[#732323] dark:text-[#f0a8a3] flex items-center justify-between gap-3">
                  <span>{syncError}</span>
                  <button
                    type="button"
                    onClick={onRetrySync}
                    className="font-medium underline cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Retry
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-[#4f4235] dark:text-[#c9bba8]">
                Your current notebook is saved on this browser. Sign in with
                Google to back up your journal and keep every page synced across
                desktop, tablet, and phone.
              </p>
              <p className="text-xs leading-relaxed text-[#756452] dark:text-[#9f917f]">
                Any pages you have already written here will merge automatically
                into your account on sign-in.
              </p>
            </div>
          )}

          {authError ? (
            <div className="p-3 rounded border border-[#8c2d2d]/30 dark:border-[#b84a45]/45 bg-[#8c2d2d]/5 dark:bg-[#331a1a]/80 text-xs text-[#732323] dark:text-[#f0a8a3] flex items-center justify-between gap-3">
              <span>{authError}</span>
              <button
                type="button"
                onClick={onClearAuthError}
                className="underline cursor-pointer whitespace-nowrap shrink-0"
              >
                Dismiss
              </button>
            </div>
          ) : null}
        </div>

        <div className="px-6 sm:px-7 py-4 border-t border-[#8c7960]/20 dark:border-[#423a32] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#6d5d4b] dark:text-[#9f917f] hover:text-[#261f19] dark:hover:text-[#ece3d4] cursor-pointer whitespace-nowrap min-h-[40px]"
          >
            Close
          </button>
          {user ? (
            <button
              type="button"
              disabled={authBusy}
              onClick={() => void onSignOut()}
              className="px-5 py-2 text-sm font-medium rounded border border-[#8c7960]/40 dark:border-[#4b4238] bg-[#efe8da] dark:bg-[#26221e] text-[#3b2f24] dark:text-[#e5dac9] hover:border-[#57361e] dark:hover:border-[#deb488]/60 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap min-h-[40px]"
            >
              {authBusy ? 'Signing out…' : 'Sign out'}
            </button>
          ) : (
            <button
              type="button"
              disabled={authBusy}
              onClick={() => void onSignInWithGoogle()}
              className="px-5 py-2 text-sm font-medium rounded bg-[#3a231c] dark:bg-[#d7c4a5] text-[#f6f1e6] dark:text-[#1b1511] hover:bg-[#4c2e25] dark:hover:bg-[#e5d5ba] disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap min-h-[40px]"
            >
              {authBusy ? 'Signing in…' : 'Continue with Google'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
