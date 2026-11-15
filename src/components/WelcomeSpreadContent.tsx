import React from 'react';

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

const ONBOARDING_STEPS = [
  { num: '01.', text: 'Write in ink on ruled, dotted, or blank pages' },
  { num: '02.', text: 'Drag or click any corner to turn pages smoothly' },
  { num: '03.', text: 'Sign in with Google to keep entries synced everywhere' },
];

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
  const scaleRatio = Math.min(1, Math.max(0.76, pageW / 470));
  const paddingX = Math.round(isMobile ? 24 : 42 * scaleRatio);
  const paddingTop = Math.round(isMobile ? 20 : 30 * scaleRatio);
  const paddingBottom = Math.round(isMobile ? 18 : 26 * scaleRatio);

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
      {/* Subtle spine gutter curvature shading */}
      {isMobile ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-7"
          style={{
            background:
              'linear-gradient(to right, rgba(38, 27, 16, 0.14) 0%, transparent 100%)',
          }}
        />
      ) : side === 'left' ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-12"
          style={{
            background:
              'linear-gradient(to left, rgba(38, 27, 16, 0.17) 0%, rgba(38, 27, 16, 0.06) 42%, transparent 100%)',
          }}
        />
      ) : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-12"
          style={{
            background:
              'linear-gradient(to right, rgba(38, 27, 16, 0.16) 0%, rgba(38, 27, 16, 0.05) 42%, transparent 100%)',
          }}
        />
      )}

      {/* Subtle outer paper edge highlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          boxShadow:
            side === 'left'
              ? 'inset 1px 0 0 rgba(255,255,255,0.55)'
              : 'inset -1px 0 0 rgba(255,255,255,0.55)',
        }}
      />

      {isMobile ? (
        <>
          <div className="relative z-10 pb-2.5 mb-4 border-b border-[#7c6952]/20 flex items-center justify-between">
            <span className="font-serif text-base font-medium text-[#261f19]">
              Folio
            </span>
            <button
              type="button"
              disabled={!interactive || locked}
              onClick={() => interactive && !locked && onCloseBook?.()}
              className="text-xs text-[#6d5d4b] hover:text-[#261f19] cursor-pointer whitespace-nowrap shrink-0"
            >
              Close
            </button>
          </div>

          <div className="relative z-10 flex-1 flex flex-col justify-between min-h-0">
            <div>
              <h1 className="font-serif text-[26px] leading-tight font-semibold text-[#261f19]">
                Your Daily Journal
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-[#5c4f41]">
                Sign in with Google for your synced journal, or try as a guest
                on this device.
              </p>

              <div className="mt-5 space-y-2.5 border-t border-[#7c6952]/15 pt-4">
                {ONBOARDING_STEPS.map((step) => (
                  <div
                    key={step.num}
                    className="flex items-baseline gap-2.5 text-[13px] text-[#4a3e33]"
                  >
                    <span className="text-xs text-[#8a7966] tabular-nums shrink-0">
                      {step.num}
                    </span>
                    <span>{step.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 space-y-2.5">
              {authError ? (
                <div className="p-2.5 rounded border border-[#8c2d2d]/30 bg-[#8c2d2d]/5 text-xs text-[#732323] flex items-center justify-between gap-2">
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
                disabled={!interactive || locked || authBusy}
                onClick={() => interactive && !locked && onSignInWithGoogle?.()}
                className="w-full min-h-[44px] px-4 py-2.5 rounded bg-[#3a231c] text-[#f6f1e6] text-sm font-medium hover:bg-[#4c2e25] disabled:opacity-55 transition-colors cursor-pointer"
              >
                {authBusy ? 'Signing in…' : 'Continue with Google'}
              </button>

              <button
                type="button"
                disabled={!interactive || locked || authBusy}
                onClick={() => interactive && !locked && onContinueLocal?.()}
                className="w-full min-h-[42px] px-4 py-2 rounded border border-[#8c7960]/35 bg-[#efe8da] text-[#3b2f24] text-sm hover:border-[#57361e] disabled:opacity-55 transition-colors cursor-pointer"
              >
                Try as Guest →
              </button>
            </div>
          </div>
        </>
      ) : side === 'left' ? (
        <>
          <div className="relative z-10 flex-1 flex flex-col justify-center py-6 min-h-0">
            <h1 className="font-serif text-[34px] leading-tight font-semibold text-[#261f19] tracking-tight">
              Folio
            </h1>
            <p className="mt-2 font-hand text-[24px] leading-[30px] text-[#57361e]">
              A quiet notebook for everyday pages.
            </p>
            <div className="mt-5 w-12 h-px bg-[#8c7960]/40" />

            <div className="mt-7 space-y-3.5">
              {ONBOARDING_STEPS.map((step) => (
                <div
                  key={step.num}
                  className="flex items-baseline gap-3 text-[14px] leading-snug text-[#4f4235]"
                >
                  <span className="text-xs text-[#8a7966] tabular-nums shrink-0">
                    {step.num}
                  </span>
                  <span>{step.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 pt-2 text-xs text-[#8a7966]">
            Guest preview · Saved in your browser
          </div>
        </>
      ) : (
        <>
          <div className="relative z-10 pb-2.5 mb-2 flex items-center justify-end">
            <button
              type="button"
              disabled={!interactive || locked}
              onClick={() => interactive && !locked && onCloseBook?.()}
              className="text-[12.5px] text-[#6d5d4b] hover:text-[#261f19] transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:underline"
            >
              Close
            </button>
          </div>

          <div className="relative z-10 flex-1 flex flex-col justify-center py-4 min-h-0">
            <h2 className="font-serif text-[28px] leading-tight font-semibold text-[#261f19]">
              Open Your Journal
            </h2>
            <p className="mt-2.5 text-[15px] leading-relaxed text-[#5c4f41]">
              Sign in with Google to view your synced notebooks across all
              devices, or explore as a guest first.
            </p>

            {authError ? (
              <div className="mt-4 p-3 rounded border border-[#8c2d2d]/30 bg-[#8c2d2d]/5 text-xs text-[#732323] flex items-center justify-between gap-2">
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
                disabled={!interactive || locked || authBusy}
                onClick={() => interactive && !locked && onSignInWithGoogle?.()}
                className="w-full min-h-[44px] px-5 py-2.5 rounded bg-[#3a231c] text-[#f6f1e6] text-sm font-medium hover:bg-[#4c2e25] disabled:opacity-55 transition-colors cursor-pointer"
              >
                {authBusy ? 'Signing in…' : 'Continue with Google'}
              </button>

              <button
                type="button"
                disabled={!interactive || locked || authBusy}
                onClick={() => interactive && !locked && onContinueLocal?.()}
                className="w-full min-h-[42px] px-5 py-2 rounded border border-[#8c7960]/35 bg-[#efe8da] text-[#3b2f24] text-sm hover:border-[#57361e] disabled:opacity-55 transition-colors cursor-pointer"
              >
                Try as Guest →
              </button>
            </div>

            <p className="mt-4 text-xs text-[#7a6855]">
              Any notes written as a guest merge automatically if you sign in
              later.
            </p>
          </div>

          <div className="relative z-10 pt-2 h-6" />
        </>
      )}

      {/* Subtle bottom-right corner sheen inviting page turn */}
      {(interactive || isMobile) && side === 'right' ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-0 z-10 w-5 h-5 opacity-45"
          style={{
            background:
              'linear-gradient(135deg, transparent 50%, rgba(155, 134, 108, 0.22) 52%, rgba(255, 252, 245, 0.55) 100%)',
          }}
        />
      ) : null}
    </div>
  );
};
