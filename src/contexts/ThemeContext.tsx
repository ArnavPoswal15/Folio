import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { JOURNAL_FONTS, JournalFontId } from '../types/journal';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'folio-theme';
const FONT_STORAGE_KEY = 'folio-journal-font';

interface ThemeContextValue {
  theme: ThemeMode;
  isDark: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  journalFont: JournalFontId;
  setJournalFont: (font: JournalFontId) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  isDark: false,
  setTheme: () => {},
  toggleTheme: () => {},
  journalFont: 'caveat',
  setJournalFont: () => {},
});

function getInitialTheme(): ThemeMode {
  if (typeof document !== 'undefined') {
    if (document.documentElement.classList.contains('dark')) {
      return 'dark';
    }
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') {
        return saved;
      }
    } catch {
      // Ignore storage access errors
    }
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }
  }
  return 'light';
}

function getInitialFont(): JournalFontId {
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(FONT_STORAGE_KEY);
      if (saved && saved in JOURNAL_FONTS) {
        return saved as JournalFontId;
      }
    } catch {
      // Ignore storage access errors
    }
  }
  return 'caveat';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);
  const [journalFont, setJournalFontState] =
    useState<JournalFontId>(getInitialFont);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Track OS preference only when user has not explicitly picked a theme
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') return;
      } catch {
        // Ignore storage access errors
      }
      setThemeState(e.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage write errors
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Ignore storage write errors
      }
      return next;
    });
  }, []);

  const setJournalFont = useCallback((next: JournalFontId) => {
    setJournalFontState(next);
    try {
      window.localStorage.setItem(FONT_STORAGE_KEY, next);
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

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
