import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { auth, googleProvider } from '../lib/firebase';

/** React context shape exposing Firebase user state and Google authentication handlers. */
interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  authBusy: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
}

/** React context holding Firebase Auth state and sign-in/sign-out operations. */
const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Translates Firebase Auth exceptions into concise, user-friendly guidance.
 * @param error - Unknown error thrown by Firebase Auth popup or state listener.
 * @returns Human-readable authentication error message.
 */
function formatAuthError(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code?: unknown }).code ?? '');
    if (
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request'
    ) {
      return 'Sign-in was canceled before completing.';
    }
    if (code === 'auth/popup-blocked') {
      return 'Pop-up was blocked by the browser. Allow pop-ups for this site and try again.';
    }
    if (code === 'auth/unauthorized-domain') {
      return 'This domain is not yet listed under Firebase Auth Authorized domains.';
    }
    if (code === 'auth/network-request-failed') {
      return 'Network error while reaching Google sign-in. Check your connection and try again.';
    }
  }
  return error instanceof Error
    ? error.message
    : 'Unable to sign in with Google.';
}

/**
 * Provides Firebase Authentication state and Google OAuth sign-in/out actions to child components.
 * @param props - Children elements wrapped by the auth provider.
 * @returns AuthContext provider wrapping child nodes.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (nextUser) => {
        setUser(nextUser);
        setAuthReady(true);
      },
      (error) => {
        setAuthError(formatAuthError(error));
        setAuthReady(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    setAuthBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      setAuthError(formatAuthError(error));
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    setAuthBusy(true);
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      setAuthError(formatAuthError(error));
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        authBusy,
        authError,
        signInWithGoogle,
        signOut,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Reads the nearest AuthProvider context value.
 * @returns Active AuthContextValue containing user session and auth methods.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return ctx;
}
