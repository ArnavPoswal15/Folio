import React from 'react';
import { PAGE_SHEET_METRICS } from '../../constants/journal';
import { WELCOME_ONBOARDING_STEPS } from '../../constants/workspace';
import { useTheme } from '../../contexts/ThemeContext';
import { WelcomeThemeCloseBar } from './WelcomeThemeCloseBar';

/** Props accepted by the WelcomeSpreadContent onboarding flyleaf component. */
interface WelcomeSpreadContentProps {
  side: 'left' | 'right';
  pageW: number;
  pageH: number;
  isMobile?: boolean;
  interactive?: boolean;
  locked?: boolean;
  authBusy?: boolean;
  authError?: string | null;
  onSignInWithGoogle?: () => void;
  onContinueLocal?: () => void;
  onCloseBook?: () => void;
  onClearAuthError?: () => void;
}

/**
 * Renders the guest welcome flyleaf spread with onboarding highlights and Google Sign-In / guest entry actions.
 * @param props - Page side, responsive dimensions, auth state, and onboarding action handlers.
 * @returns Styled paper page element representing left, right, or mobile welcome view.
 */
export const WelcomeSpreadContent: React.FC<WelcomeSpreadContentProps> = ({
  side,
  pageW,
  pageH,
  isMobile = false,
  interactive = true,
  locked = false,
  authBusy = false,
  authError = null,
  onSignInWithGoogle,
  onContinueLocal,
  onCloseBook,
  onClearAuthError,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const scaleRatio = Math.min(
    1,
    Math.max(
      PAGE_SHEET_METRICS.MIN_SCALE_RATIO,
      pageW / PAGE_SHEET_METRICS.REFERENCE_PAGE_W
    )
  );
  const paddingX = Math.round(
    isMobile
      ? PAGE_SHEET_METRICS.MOBILE_PAD_X
      : PAGE_SHEET_METRICS.DESKTOP_PAD_X * scaleRatio
  );
  const paddingTop = Math.round(
    isMobile
      ? PAGE_SHEET_METRICS.MOBILE_PAD_TOP
      : PAGE_SHEET_METRICS.DESKTOP_PAD_TOP * scaleRatio
  );
  const paddingBottom = Math.round(
    isMobile
      ? PAGE_SHEET_METRICS.MOBILE_PAD_BOTTOM
      : PAGE_SHEET_METRICS.DESKTOP_PAD_BOTTOM * scaleRatio
  );
  const controlsDisabled = !interactive || locked;

  return (
    <div
      className="relative isolate w-full h-full paper-grain overflow-hidden flex flex-col select-none"
      style={{
        width: `${pageW}px`,
        height: `${pageH}px`,
        paddingLeft: `${paddingX}px`,
        paddingRight: `${paddingX}px`,
        paddingTop: `${paddingTop}px`,
        paddingBottom: `${paddingBottom}px`,
      }}
    >
      {isMobile ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-7 spine-gutter-mobile"
        />
      ) : side === 'left' ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-12 spine-gutter-left"
        />
      ) : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-12 spine-gutter-right"
        />
      )}

      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 ${
          side === 'left' ? 'paper-edge-left' : 'paper-edge-right'
        }`}
      />

      {isMobile ? (
        <>
          <div className="relative z-10 pb-2.5 mb-4 border-b border-[#7c6952]/20 dark:border-[#423a32] flex items-center justify-between">
            <span className="font-serif text-base font-medium text-[#261f19] dark:text-[#ece3d4]">
              Folio
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <WelcomeThemeCloseBar
                isDark={isDark}
                disabled={controlsDisabled}
                onToggleTheme={toggleTheme}
                onCloseBook={onCloseBook}
                closeClassName="text-xs text-[#6d5d4b] dark:text-[#9f917f] hover:text-[#261f19] dark:hover:text-[#ece3d4] cursor-pointer whitespace-nowrap shrink-0"
              />
            </div>
          </div>

          <div className="relative z-10 flex-1 flex flex-col justify-between min-h-0">
            <div>
              <h1 className="font-serif text-[26px] leading-tight font-semibold text-[#261f19] dark:text-[#ece3d4]">
                Your Daily Journal
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-[#5c4f41] dark:text-[#bfb19e]">
                Sign in with Google for your synced journal, or try as a guest
                on this device.
              </p>

              <div className="mt-5 space-y-2.5 border-t border-[#7c6952]/15 dark:border-[#423a32] pt-4">
                {WELCOME_ONBOARDING_STEPS.map((step) => (
                  <div
                    key={step.num}
                    className="flex items-baseline gap-2.5 text-[13px] text-[#4a3e33] dark:text-[#c9bba8]"
                  >
                    <span className="text-xs text-[#8a7966] dark:text-[#968775] tabular-nums shrink-0">
                      {step.num}
                    </span>
                    <span>{step.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 space-y-2.5">
              {authError ? (
                <div className="p-2.5 rounded border border-[#8c2d2d]/30 dark:border-[#b84a45]/45 bg-[#8c2d2d]/5 dark:bg-[#331a1a]/80 text-xs text-[#732323] dark:text-[#f0a8a3] flex items-center justify-between gap-2">
                  <span>{authError}</span>
                  <button
                    type="button"
                    onClick={onClearAuthError}
                    className="underline shrink-0 cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              ) : null}

              <button
                type="button"
                disabled={controlsDisabled || authBusy}
                onClick={() => !controlsDisabled && onSignInWithGoogle?.()}
                className="w-full min-h-[44px] px-4 py-2.5 rounded bg-[#3a231c] dark:bg-[#d7c4a5] text-[#f6f1e6] dark:text-[#1b1511] text-sm font-medium hover:bg-[#4c2e25] dark:hover:bg-[#e5d5ba] disabled:opacity-55 transition-colors cursor-pointer"
              >
                {authBusy ? 'Signing in…' : 'Continue with Google'}
              </button>

              <button
                type="button"
                disabled={controlsDisabled || authBusy}
                onClick={() => !controlsDisabled && onContinueLocal?.()}
                className="w-full min-h-[42px] px-4 py-2 rounded border border-[#8c7960]/35 dark:border-[#4b4238] bg-[#efe8da] dark:bg-[#26221e] text-[#3b2f24] dark:text-[#e5dac9] text-sm hover:border-[#57361e] dark:hover:border-[#deb488]/60 disabled:opacity-55 transition-colors cursor-pointer"
              >
                Try as Guest →
              </button>
            </div>
          </div>
        </>
      ) : side === 'left' ? (
        <>
          <div className="relative z-10 flex-1 flex flex-col justify-center py-6 min-h-0">
            <h1 className="font-serif text-[34px] leading-tight font-semibold text-[#261f19] dark:text-[#ece3d4] tracking-tight">
              Folio
            </h1>
            <p className="mt-2 font-hand ink-prose text-[24px] leading-[30px] text-[#57361e] dark:text-[#deb488]">
              A quiet notebook for everyday pages.
            </p>
            <div className="mt-5 w-12 h-px bg-[#8c7960]/40 dark:bg-[#52483e]" />

            <div className="mt-7 space-y-3.5">
              {WELCOME_ONBOARDING_STEPS.map((step) => (
                <div
                  key={step.num}
                  className="flex items-baseline gap-3 text-[14px] leading-snug text-[#4f4235] dark:text-[#c9bba8]"
                >
                  <span className="text-xs text-[#8a7966] dark:text-[#968775] tabular-nums shrink-0">
                    {step.num}
                  </span>
                  <span>{step.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 pt-2 text-xs text-[#8a7966] dark:text-[#968775]">
            Guest preview · Saved in your browser
          </div>
        </>
      ) : (
        <>
          <div className="relative z-10 pb-2.5 mb-2 flex items-center justify-end gap-2">
            <WelcomeThemeCloseBar
              isDark={isDark}
              disabled={controlsDisabled}
              onToggleTheme={toggleTheme}
              onCloseBook={onCloseBook}
            />
          </div>

          <div className="relative z-10 flex-1 flex flex-col justify-center py-4 min-h-0">
            <h2 className="font-serif text-[28px] leading-tight font-semibold text-[#261f19] dark:text-[#ece3d4]">
              Open Your Journal
            </h2>
            <p className="mt-2.5 text-[15px] leading-relaxed text-[#5c4f41] dark:text-[#bfb19e]">
              Sign in with Google to view your synced notebooks across all
              devices, or explore as a guest first.
            </p>

            {authError ? (
              <div className="mt-4 p-3 rounded border border-[#8c2d2d]/30 dark:border-[#b84a45]/45 bg-[#8c2d2d]/5 dark:bg-[#331a1a]/80 text-xs text-[#732323] dark:text-[#f0a8a3] flex items-center justify-between gap-2">
                <span>{authError}</span>
                <button
                  type="button"
                  onClick={onClearAuthError}
                  className="underline shrink-0 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            ) : null}

            <div className="mt-6 space-y-3">
              <button
                type="button"
                disabled={controlsDisabled || authBusy}
                onClick={() => !controlsDisabled && onSignInWithGoogle?.()}
                className="w-full min-h-[44px] px-5 py-2.5 rounded bg-[#3a231c] dark:bg-[#d7c4a5] text-[#f6f1e6] dark:text-[#1b1511] text-sm font-medium hover:bg-[#4c2e25] dark:hover:bg-[#e5d5ba] disabled:opacity-55 transition-colors cursor-pointer"
              >
                {authBusy ? 'Signing in…' : 'Continue with Google'}
              </button>

              <button
                type="button"
                disabled={controlsDisabled || authBusy}
                onClick={() => !controlsDisabled && onContinueLocal?.()}
                className="w-full min-h-[42px] px-5 py-2 rounded border border-[#8c7960]/35 dark:border-[#4b4238] bg-[#efe8da] dark:bg-[#26221e] text-[#3b2f24] dark:text-[#e5dac9] text-sm hover:border-[#57361e] dark:hover:border-[#deb488]/60 disabled:opacity-55 transition-colors cursor-pointer"
              >
                Try as Guest →
              </button>
            </div>

            <p className="mt-4 text-xs text-[#7a6855] dark:text-[#9f917f]">
              Any notes written as a guest merge automatically if you sign in
              later.
            </p>
          </div>

          <div className="relative z-10 pt-2 h-6" />
        </>
      )}

      {(interactive || isMobile) && side === 'right' ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-0 z-10 w-5 h-5 opacity-45 corner-sheen-right"
        />
      ) : null}
    </div>
  );
};
