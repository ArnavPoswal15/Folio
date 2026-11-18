import React from 'react';

/** Internal state tracking whether a render exception was caught. */
interface ErrorBoundaryState {
  hasError: boolean;
}

/** Catches unexpected runtime errors inside the journal workspace and offers safe reload recovery. */
export class JournalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  /**
   * Transitions the boundary into fallback recovery mode after a descendant throws.
   * @returns Updated state flagging the caught error.
   */
  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  /**
   * Renders either child components or a paper-styled reload prompt when an error occurs.
   * @returns Wrapped children or error recovery screen.
   */
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
