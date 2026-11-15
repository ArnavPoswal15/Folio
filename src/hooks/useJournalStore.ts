import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  where,
  writeBatch,
} from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  DEFAULT_SPREADS,
  getNextIsoDate,
  isUntouchedDefaultSpread,
  loadJournalSpreads,
  saveJournalSpreads,
  sortSpreadsChronologically,
} from '../data/initialEntries';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  JournalSpread,
  sanitizeSpreadId,
  sanitizeSpreadPayload,
  SyncStatus,
} from '../types/journal';

interface JournalState {
  spreads: JournalSpread[];
  currentIndex: number;
}

type JournalAction =
  | { type: 'UPDATE_SPREAD'; index: number; patch: Partial<JournalSpread>; updatedAt: number }
  | { type: 'GO_TO_SPREAD'; index: number }
  | { type: 'TURN_PREV' }
  | { type: 'TURN_NEXT'; createdSpread?: JournalSpread }
  | { type: 'CREATE_SPREAD'; createdSpread: JournalSpread }
  | { type: 'DELETE_SPREAD'; index: number }
  | { type: 'APPLY_CLOUD_SPREADS'; spreads: JournalSpread[]; preserveSpreadId?: string }
  | { type: 'RESET_TO_LOCAL'; spreads: JournalSpread[] };

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

function journalReducer(state: JournalState, action: JournalAction): JournalState {
  switch (action.type) {
    case 'UPDATE_SPREAD': {
      const idx = clampIndex(action.index, state.spreads.length);
      const nextSpreads = state.spreads.map((item, i) =>
        i === idx
          ? sanitizeSpreadPayload({
              ...item,
              ...action.patch,
              updatedAt: action.updatedAt,
            })
          : item
      );
      return {
        ...state,
        spreads: nextSpreads,
      };
    }

    case 'GO_TO_SPREAD': {
      return {
        ...state,
        currentIndex: clampIndex(action.index, state.spreads.length),
      };
    }

    case 'TURN_PREV': {
      return {
        ...state,
        currentIndex: Math.max(0, state.currentIndex - 1),
      };
    }

    case 'TURN_NEXT': {
      if (state.currentIndex < state.spreads.length - 1) {
        return {
          ...state,
          currentIndex: state.currentIndex + 1,
        };
      }
      if (!action.createdSpread) return state;
      const nextSpreads = sortSpreadsChronologically([
        ...state.spreads,
        action.createdSpread,
      ]);
      const nextIdx = nextSpreads.findIndex(
        (s) => s.id === action.createdSpread!.id
      );
      return {
        spreads: nextSpreads,
        currentIndex: nextIdx !== -1 ? nextIdx : nextSpreads.length - 1,
      };
    }

    case 'CREATE_SPREAD': {
      const nextSpreads = sortSpreadsChronologically([
        ...state.spreads,
        action.createdSpread,
      ]);
      const nextIdx = nextSpreads.findIndex(
        (s) => s.id === action.createdSpread.id
      );
      return {
        spreads: nextSpreads,
        currentIndex: nextIdx !== -1 ? nextIdx : nextSpreads.length - 1,
      };
    }

    case 'DELETE_SPREAD': {
      if (state.spreads.length <= 1) return state;
      const filtered = state.spreads.filter((_, i) => i !== action.index);
      const safeSpreads = filtered.length > 0 ? filtered : DEFAULT_SPREADS;
      let nextIndex = state.currentIndex;
      if (state.currentIndex > action.index) {
        nextIndex = state.currentIndex - 1;
      } else if (state.currentIndex === action.index) {
        nextIndex = Math.max(0, action.index - 1);
      }
      return {
        spreads: safeSpreads,
        currentIndex: clampIndex(nextIndex, safeSpreads.length),
      };
    }

    case 'APPLY_CLOUD_SPREADS': {
      const sorted = sortSpreadsChronologically(
        action.spreads.length > 0 ? action.spreads : DEFAULT_SPREADS
      );
      let nextIndex = state.currentIndex;
      if (action.preserveSpreadId) {
        const found = sorted.findIndex((s) => s.id === action.preserveSpreadId);
        if (found !== -1) nextIndex = found;
      }
      return {
        spreads: sorted,
        currentIndex: clampIndex(nextIndex, sorted.length),
      };
    }

    case 'RESET_TO_LOCAL': {
      const sorted = sortSpreadsChronologically(
        action.spreads.length > 0 ? action.spreads : DEFAULT_SPREADS
      );
      const todayIdx = sorted.findIndex((s) => s.date === '2026-11-14');
      return {
        spreads: sorted,
        currentIndex: todayIdx !== -1 ? todayIdx : Math.max(0, sorted.length - 1),
      };
    }

    default:
      return state;
  }
}

function createInitialState(): JournalState {
  const safeSpreads = loadJournalSpreads();
  const todayIdx = safeSpreads.findIndex((s) => s.date === '2026-11-14');
  const currentIndex =
    todayIdx !== -1 ? todayIdx : Math.max(0, safeSpreads.length - 1);
  return {
    spreads: safeSpreads,
    currentIndex,
  };
}

function generateUniqueSpreadId(): string {
  const rand = Math.random().toString(36).slice(2, 7);
  return sanitizeSpreadId(`spread-${Date.now()}-${rand}`);
}

function toFirestoreSpreadDoc(spread: JournalSpread, uid: string) {
  const clean = sanitizeSpreadPayload(spread);
  return {
    id: clean.id,
    userId: uid,
    date: clean.date,
    contextNote: clean.contextNote,
    leftBody: clean.leftBody,
    rightBody: clean.rightBody,
    inkColor: clean.inkColor,
    paperStyle: clean.paperStyle,
    clientUpdatedAt: clean.updatedAt,
    updatedAt: serverTimestamp(),
  };
}

function fromFirestoreSpreadDoc(
  docId: string,
  data: Record<string, unknown>
): JournalSpread {
  const serverTs = data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : 0;
  const clientTs =
    typeof data.clientUpdatedAt === 'number' && Number.isFinite(data.clientUpdatedAt)
      ? data.clientUpdatedAt
      : serverTs || Date.now();

  return sanitizeSpreadPayload({
    id: typeof data.id === 'string' && data.id ? data.id : docId,
    date: typeof data.date === 'string' ? data.date : '2026-11-14',
    contextNote: typeof data.contextNote === 'string' ? data.contextNote : '',
    leftBody: typeof data.leftBody === 'string' ? data.leftBody : '',
    rightBody: typeof data.rightBody === 'string' ? data.rightBody : '',
    inkColor:
      data.inkColor === 'midnight' || data.inkColor === 'sepia'
        ? data.inkColor
        : 'charcoal',
    paperStyle:
      data.paperStyle === 'dotted' || data.paperStyle === 'blank'
        ? data.paperStyle
        : 'ruled',
    updatedAt: clientTs,
  });
}

function summarizeSyncError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('Quota exceeded')) {
    return 'Daily cloud sync quota exceeded. Changes remain saved on this device.';
  }
  if (raw.includes('Missing or insufficient permissions') || raw.includes('PERMISSION_DENIED')) {
    return 'Unable to verify cloud permissions. Changes remain saved locally.';
  }
  return 'Cloud sync paused temporarily. Changes remain saved on this device.';
}

export function useJournalStore(user: User | null, authReady: boolean) {
  const [state, dispatch] = useReducer(journalReducer, undefined, createInitialState);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncTrigger, setSyncTrigger] = useState(0);

  const stateRef = useRef(state);
  stateRef.current = state;

  const userRef = useRef<User | null>(user);
  userRef.current = user;

  // Track pending debounced writes per spread ID so snapshot updates never clobber mid-typing
  const pendingWritesRef = useRef<Map<string, { timer: number; spread: JournalSpread }>>(
    new Map()
  );
  const inFlightIdsRef = useRef<Set<string>>(new Set());

  const wasSignedInRef = useRef(false);

  // Mirror guest spreads to localStorage when signed out, and per-user cache when signed in
  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      saveJournalSpreads(state.spreads);
    } else {
      try {
        localStorage.setItem(
          `folio_journal_cloud_${user.uid}`,
          JSON.stringify(state.spreads)
        );
      } catch {
        // Ignore storage quota errors cleanly
      }
    }
  }, [authReady, state.spreads, user]);

  const safeIndex = clampIndex(state.currentIndex, state.spreads.length);
  const currentSpread = state.spreads[safeIndex] ?? DEFAULT_SPREADS[0];

  const writeSpreadToCloud = useCallback(
    async (uid: string, spread: JournalSpread): Promise<void> => {
      const clean = sanitizeSpreadPayload(spread);
      const path = `users/${uid}/spreads/${clean.id}`;
      inFlightIdsRef.current.add(clean.id);
      setSyncStatus('syncing');
      try {
        await setDoc(doc(db, 'users', uid, 'spreads', clean.id), toFirestoreSpreadDoc(clean, uid));
        setSyncError(null);
        if (pendingWritesRef.current.size === 0) {
          setSyncStatus('synced');
        }
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.WRITE, path);
        } catch (wrapped) {
          setSyncStatus('error');
          setSyncError(summarizeSyncError(wrapped));
        }
      } finally {
        inFlightIdsRef.current.delete(clean.id);
      }
    },
    []
  );

  const flushPendingSaves = useCallback(async () => {
    const activeUser = userRef.current;
    const entries = Array.from(pendingWritesRef.current.entries());
    if (entries.length === 0) return;

    entries.forEach(([, entry]) => {
      window.clearTimeout(entry.timer);
    });
    pendingWritesRef.current.clear();

    if (!activeUser) return;
    await Promise.all(
      entries.map(([, entry]) => writeSpreadToCloud(activeUser.uid, entry.spread))
    );
  }, [writeSpreadToCloud]);

  const scheduleCloudWrite = useCallback(
    (spread: JournalSpread) => {
      const activeUser = userRef.current;
      if (!activeUser) return;

      const existing = pendingWritesRef.current.get(spread.id);
      if (existing) {
        window.clearTimeout(existing.timer);
      }

      setSyncStatus('syncing');
      const timer = window.setTimeout(() => {
        pendingWritesRef.current.delete(spread.id);
        const latestUser = userRef.current;
        if (latestUser) {
          void writeSpreadToCloud(latestUser.uid, spread);
        }
      }, 600);

      pendingWritesRef.current.set(spread.id, { timer, spread });
    },
    [writeSpreadToCloud]
  );

  // Flush unsaved debounced writes when hiding/closing tab
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        void flushPendingSaves();
      }
    };
    const onPageHide = () => {
      void flushPendingSaves();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [flushPendingSaves]);

  // Connect to Firestore, auto-merge local entries, and subscribe via onSnapshot when signed in
  useEffect(() => {
    if (!authReady) return;

    if (!user) {
      pendingWritesRef.current.forEach((entry) => window.clearTimeout(entry.timer));
      pendingWritesRef.current.clear();
      inFlightIdsRef.current.clear();
      setSyncStatus('local');
      setSyncError(null);
      if (wasSignedInRef.current) {
        wasSignedInRef.current = false;
        dispatch({ type: 'RESET_TO_LOCAL', spreads: loadJournalSpreads() });
      }
      return;
    }

    wasSignedInRef.current = true;
    let cancelled = false;
    let unsubscribeSnapshot: Unsubscribe | null = null;
    const uid = user.uid;

    const bootstrapAndListen = async () => {
      setSyncStatus('syncing');
      setSyncError(null);

      try {
        // 1. Ensure user profile doc exists / stays current
        const userPath = `users/${uid}`;
        const userDocRef = doc(db, 'users', uid);
        const profilePayload = {
          uid,
          displayName: (user.displayName ?? '').slice(0, 120),
          email: (user.email ?? 'journal@user.local').slice(0, 320),
          updatedAt: serverTimestamp(),
        };

        try {
          await setDoc(userDocRef, profilePayload);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, userPath);
        }

        if (cancelled) return;

        // 2. Fetch existing cloud spreads to merge local edits cleanly
        const spreadsPath = `users/${uid}/spreads`;
        const spreadsQuery = query(
          collection(db, 'users', uid, 'spreads'),
          where('userId', '==', uid)
        );

        let existingCloudSpreads: JournalSpread[] = [];
        try {
          const snapshot = await getDocs(spreadsQuery);
          existingCloudSpreads = snapshot.docs.map((d) =>
            fromFirestoreSpreadDoc(d.id, d.data() as Record<string, unknown>)
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, spreadsPath);
        }

        if (cancelled) return;

        // 3. Automatically merge guest local entries into cloud
        const guestSpreads = loadJournalSpreads();
        const cloudById = new Map(existingCloudSpreads.map((s) => [s.id, s]));
        const toUpload: JournalSpread[] = [];

        if (existingCloudSpreads.length === 0) {
          const seed = guestSpreads.length > 0 ? guestSpreads : DEFAULT_SPREADS;
          seed.forEach((s) => toUpload.push(sanitizeSpreadPayload(s)));
        } else {
          for (const local of guestSpreads) {
            if (isUntouchedDefaultSpread(local)) continue;
            const cleanLocal = sanitizeSpreadPayload(local);
            const cloudMatch = cloudById.get(cleanLocal.id);
            if (!cloudMatch) {
              toUpload.push(cleanLocal);
            } else if (cleanLocal.updatedAt > cloudMatch.updatedAt) {
              toUpload.push(cleanLocal);
            }
          }
        }

        if (toUpload.length > 0) {
          const CHUNK_SIZE = 380;
          for (let i = 0; i < toUpload.length; i += CHUNK_SIZE) {
            const chunk = toUpload.slice(i, i + CHUNK_SIZE);
            const batch = writeBatch(db);
            for (const spread of chunk) {
              batch.set(
                doc(db, 'users', uid, 'spreads', spread.id),
                toFirestoreSpreadDoc(spread, uid)
              );
            }
            try {
              await batch.commit();
            } catch (err) {
              handleFirestoreError(err, OperationType.WRITE, spreadsPath);
            }
          }
          // Reset guest local buffer cleanly once guest drafts have merged into cloud
          saveJournalSpreads(DEFAULT_SPREADS);
        }

        if (cancelled) return;

        // 4. Attach real-time cross-device onSnapshot listener
        unsubscribeSnapshot = onSnapshot(
          spreadsQuery,
          (snapshot) => {
            if (cancelled) return;
            const cloudList = snapshot.docs.map((d) =>
              fromFirestoreSpreadDoc(d.id, d.data() as Record<string, unknown>)
            );

            // Protect locally dirty/in-flight spreads from stale remote echoes
            const localById = new Map(
              stateRef.current.spreads.map((s) => [s.id, s])
            );
            const mergedMap = new Map(cloudList.map((s) => [s.id, s]));

            for (const [id, entry] of pendingWritesRef.current.entries()) {
              mergedMap.set(id, entry.spread);
            }
            for (const id of inFlightIdsRef.current.values()) {
              const localVersion = localById.get(id);
              if (localVersion) mergedMap.set(id, localVersion);
            }

            const mergedList = Array.from(mergedMap.values());
            if (mergedList.length > 0) {
              const activeId =
                stateRef.current.spreads[
                  clampIndex(stateRef.current.currentIndex, stateRef.current.spreads.length)
                ]?.id;
              dispatch({
                type: 'APPLY_CLOUD_SPREADS',
                spreads: mergedList,
                preserveSpreadId: activeId,
              });
            }

            if (pendingWritesRef.current.size === 0 && inFlightIdsRef.current.size === 0) {
              setSyncStatus('synced');
              setSyncError(null);
            }
          },
          (err) => {
            try {
              handleFirestoreError(err, OperationType.LIST, spreadsPath);
            } catch (wrapped) {
              if (!cancelled) {
                setSyncStatus('error');
                setSyncError(summarizeSyncError(wrapped));
              }
            }
          }
        );
      } catch (err) {
        if (!cancelled) {
          setSyncStatus('error');
          setSyncError(summarizeSyncError(err));
        }
      }
    };

    void bootstrapAndListen();

    return () => {
      cancelled = true;
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [authReady, syncTrigger, user]);

  const retrySync = useCallback(() => {
    setSyncTrigger((n) => n + 1);
  }, []);

  const upcomingBlankSpread = useMemo<JournalSpread>(() => {
    const last = state.spreads[state.spreads.length - 1];
    return {
      id: `spread-upcoming-${state.spreads.length + 1}`,
      date: getNextIsoDate(last?.date ?? '2026-11-14'),
      contextNote: '',
      leftBody: '',
      rightBody: '',
      inkColor: currentSpread?.inkColor ?? 'charcoal',
      paperStyle: currentSpread?.paperStyle ?? 'ruled',
      updatedAt: Date.now(),
    };
  }, [currentSpread?.inkColor, currentSpread?.paperStyle, state.spreads]);

  const updateSpread = useCallback(
    (index: number, patch: Partial<JournalSpread>) => {
      const idx = clampIndex(index, stateRef.current.spreads.length);
      const target = stateRef.current.spreads[idx];
      if (!target) return;
      const now = Date.now();
      const nextSpread = sanitizeSpreadPayload({
        ...target,
        ...patch,
        updatedAt: now,
      });

      dispatch({ type: 'UPDATE_SPREAD', index: idx, patch, updatedAt: now });
      scheduleCloudWrite(nextSpread);
    },
    [scheduleCloudWrite]
  );

  const goToSpread = useCallback(
    (index: number) => {
      void flushPendingSaves();
      dispatch({ type: 'GO_TO_SPREAD', index });
    },
    [flushPendingSaves]
  );

  const turnPrev = useCallback(() => {
    void flushPendingSaves();
    dispatch({ type: 'TURN_PREV' });
  }, [flushPendingSaves]);

  const turnNext = useCallback(() => {
    void flushPendingSaves();
    const curState = stateRef.current;
    if (curState.currentIndex < curState.spreads.length - 1) {
      dispatch({ type: 'TURN_NEXT' });
      return;
    }

    const created = sanitizeSpreadPayload({
      ...upcomingBlankSpread,
      id: generateUniqueSpreadId(),
      updatedAt: Date.now(),
    });
    dispatch({ type: 'TURN_NEXT', createdSpread: created });

    const activeUser = userRef.current;
    if (activeUser) {
      void writeSpreadToCloud(activeUser.uid, created);
    }
  }, [flushPendingSaves, upcomingBlankSpread, writeSpreadToCloud]);

  const createSpread = useCallback(() => {
    void flushPendingSaves();
    const curState = stateRef.current;
    const last = curState.spreads[curState.spreads.length - 1];
    const current = curState.spreads[clampIndex(curState.currentIndex, curState.spreads.length)];

    const created = sanitizeSpreadPayload({
      id: generateUniqueSpreadId(),
      date: getNextIsoDate(last?.date ?? '2026-11-14'),
      contextNote: '',
      leftBody: '',
      rightBody: '',
      inkColor: current?.inkColor ?? 'charcoal',
      paperStyle: current?.paperStyle ?? 'ruled',
      updatedAt: Date.now(),
    });

    dispatch({ type: 'CREATE_SPREAD', createdSpread: created });

    const activeUser = userRef.current;
    if (activeUser) {
      void writeSpreadToCloud(activeUser.uid, created);
    }
  }, [flushPendingSaves, writeSpreadToCloud]);

  const deleteSpread = useCallback(
    (index: number) => {
      const curState = stateRef.current;
      if (curState.spreads.length <= 1) return;
      const target = curState.spreads[index];
      if (!target) return;

      const pending = pendingWritesRef.current.get(target.id);
      if (pending) {
        window.clearTimeout(pending.timer);
        pendingWritesRef.current.delete(target.id);
      }

      dispatch({ type: 'DELETE_SPREAD', index });

      const activeUser = userRef.current;
      if (activeUser) {
        const path = `users/${activeUser.uid}/spreads/${target.id}`;
        setSyncStatus('syncing');
        deleteDoc(doc(db, 'users', activeUser.uid, 'spreads', target.id))
          .then(() => {
            setSyncError(null);
            if (pendingWritesRef.current.size === 0) setSyncStatus('synced');
          })
          .catch((err) => {
            try {
              handleFirestoreError(err, OperationType.DELETE, path);
            } catch (wrapped) {
              setSyncStatus('error');
              setSyncError(summarizeSyncError(wrapped));
            }
          });
      }
    },
    []
  );

  return {
    spreads: state.spreads,
    currentIndex: safeIndex,
    currentSpread,
    upcomingBlankSpread,
    syncStatus,
    syncError,
    retrySync,
    flushPendingSaves,
    updateSpread,
    goToSpread,
    turnPrev,
    turnNext,
    createSpread,
    deleteSpread,
  };
}
