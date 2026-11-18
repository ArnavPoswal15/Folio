import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { JOURNAL_FONTS, JOURNAL_STORAGE_KEYS } from '../constants/journal';
import { JournalFontId } from '../types/journal';

/** Active appearance theme mode for the desk and journal paper. */
export type ThemeMode = 'light' | 'dark';

/** React context shape exposing theme toggles and journal writing font state. */
interface ThemeContextValue {
  theme: ThemeMode;
  isDark: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  journalFont: JournalFontId;
  setJournalFont: (font: JournalFontId) => void;
}

/** React context holding appearance theme and selected writing font. */
const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  isDark: false,
  setTheme: () => {},
  toggleTheme: () => {},
  journalFont: 'caveat',
  setJournalFont: () => {},
});

/**
 * Resolves the initial theme from localStorage, defaulting to light when unset.
 * @returns Initial `'light'` or `'dark'` theme mode.
 */
function getInitialTheme(): ThemeMode {
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(JOURNAL_STORAGE_KEYS.THEME);
      if (saved === 'dark' || saved === 'light') {
        return saved;
      }
    } catch {
      // Ignore storage access errors
    }
  }
  return 'light';
}

/**
 * Reads the persisted writing font identifier from localStorage or defaults to `'caveat'`.
 * @returns Initial JournalFontId for prose display and typing.
 */
function getInitialFont(): JournalFontId {
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(JOURNAL_STORAGE_KEYS.FONT);
      if (saved && saved in JOURNAL_FONTS) {
        return saved as JournalFontId;
      }
    } catch {
      // Ignore storage access errors
    }
  }
  return 'caveat';
}

/**
 * Provides theme state and journal font selection to the app tree.
 * @param props - Children elements wrapped by the theme provider.
 * @returns ThemeContext provider wrapping child nodes.
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);
  const [journalFont, setJournalFontState] =
    useState<JournalFontId>(getInitialFont);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(JOURNAL_STORAGE_KEYS.THEME, next);
    } catch {
      // Ignore storage write errors
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem(JOURNAL_STORAGE_KEYS.THEME, next);
      } catch {
        // Ignore storage write errors
      }
      return next;
    });
  }, []);

  const setJournalFont = useCallback((next: JournalFontId) => {
    setJournalFontState(next);
    try {
      window.localStorage.setItem(JOURNAL_STORAGE_KEYS.FONT, next);
    } catch {
      // Ignore storage write errors
    }
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme === 'dark',
        setTheme,
        toggleTheme,
        journalFont,
        setJournalFont,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Reads the current theme and writing font context values.
 * @returns Active ThemeContextValue with toggles and setters.
 */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
