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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md paper-grain rounded-lg border border-[#bcae97] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 sm:px-7 py-5 border-b border-[#8c7960]/25 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl font-semibold text-[#261f19]">
              Account &amp; Sync
            </h2>
            <p className="text-xs text-[#756452] mt-0.5">
              {user
                ? 'Private cloud journal backup'
                : 'Optional Google sign-in for all-device sync'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close account dialog"
            className="text-[#6d5d4b] hover:text-[#261f19] cursor-pointer px-2 py-1 min-w-[40px] min-h-[40px] flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <div className="px-6 sm:px-7 py-5 space-y-5">
          {user ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="font-serif text-xl font-medium text-[#261f19]">
                  {user.displayName || 'Journal Owner'}
                </div>
                <div className="text-sm text-[#6d5d4b] truncate">
                  {user.email}
                </div>
              </div>

              <div className="pt-3 border-t border-[#8c7960]/20 space-y-1.5 text-sm text-[#5e4f40]">
                <div className="flex items-center justify-between gap-3">
                  <span>Sync status</span>
                  <span className="font-medium text-[#261f19] text-right">
                    {syncLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Synced entries</span>
                  <span className="font-medium text-[#261f19] tabular-nums">
                    {spreadsCount} {spreadsCount === 1 ? 'spread' : 'spreads'}
                  </span>
                </div>
              </div>

              {syncError ? (
                <div className="p-3 rounded border border-[#8c2d2d]/30 bg-[#8c2d2d]/5 text-xs text-[#732323] flex items-center justify-between gap-3">
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
              <p className="text-sm leading-relaxed text-[#4f4235]">
                Your current notebook is saved on this browser. Sign in with
                Google to back up your journal and keep every page synced across
                desktop, tablet, and phone.
              </p>
              <p className="text-xs leading-relaxed text-[#756452]">
                Any pages you have already written here will merge automatically
                into your account on sign-in.
              </p>
            </div>
          )}

          {authError ? (
            <div className="p-3 rounded border border-[#8c2d2d]/30 bg-[#8c2d2d]/5 text-xs text-[#732323] flex items-center justify-between gap-3">
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

        <div className="px-6 sm:px-7 py-4 border-t border-[#8c7960]/20 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#6d5d4b] hover:text-[#261f19] cursor-pointer whitespace-nowrap min-h-[40px]"
          >
            Close
          </button>
          {user ? (
            <button
              type="button"
              disabled={authBusy}
              onClick={() => void onSignOut()}
              className="px-5 py-2 text-sm font-medium rounded border border-[#8c7960]/40 bg-[#efe8da] text-[#3b2f24] hover:border-[#57361e] disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap min-h-[40px]"
            >
              {authBusy ? 'Signing out…' : 'Sign out'}
            </button>
          ) : (
            <button
              type="button"
              disabled={authBusy}
              onClick={() => void onSignInWithGoogle()}
              className="px-5 py-2 text-sm font-medium rounded bg-[#3a231c] text-[#f6f1e6] hover:bg-[#4c2e25] disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap min-h-[40px]"
            >
              {authBusy ? 'Signing in…' : 'Continue with Google'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
