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
  createBlankTodaySpread,
  DEFAULT_SPREADS,
  getNextIsoDate,
  getTodayIsoDate,
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
  | {
      type: 'STAGE_CONTINUATION';
      afterSpreadId: string;
      rightBodyFit: string;
      continuationSpread: JournalSpread;
      isNew: boolean;
      updatedAt: number;
    }
  | { type: 'DELETE_SPREAD'; index: number }
  | { type: 'APPLY_CLOUD_SPREADS'; spreads: JournalSpread[]; preserveSpreadId?: string }
  | { type: 'PREPARE_SIGNED_IN'; cachedSpreads: JournalSpread[] }
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

    case 'STAGE_CONTINUATION': {
      const updated = state.spreads.map((s) =>
        s.id === action.afterSpreadId
          ? sanitizeSpreadPayload({
              ...s,
              rightBody: action.rightBodyFit,
              updatedAt: action.updatedAt,
            })
          : s.id === action.continuationSpread.id && !action.isNew
            ? action.continuationSpread
            : s
      );
      const nextSpreads = sortSpreadsChronologically(
        action.isNew ? [...updated, action.continuationSpread] : updated
      );
      const preservedIdx = nextSpreads.findIndex(
        (s) => s.id === action.afterSpreadId
      );
      return {
        spreads: nextSpreads,
        currentIndex:
          preservedIdx !== -1
            ? preservedIdx
            : clampIndex(state.currentIndex, nextSpreads.length),
      };
    }

    case 'DELETE_SPREAD': {
      if (state.spreads.length <= 1) return state;
      const filtered = state.spreads.filter((_, i) => i !== action.index);
      const safeSpreads =
        filtered.length > 0 ? filtered : [createBlankTodaySpread()];
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
        action.spreads.length > 0 ? action.spreads : [createBlankTodaySpread()]
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

    case 'PREPARE_SIGNED_IN': {
      const cleaned = sortSpreadsChronologically(
        action.cachedSpreads.filter((s) => !isUntouchedDefaultSpread(s))
      );
      const nextSpreads =
        cleaned.length > 0 ? cleaned : [createBlankTodaySpread()];
      return {
        spreads: nextSpreads,
        currentIndex: Math.max(0, nextSpreads.length - 1),
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

function generateContinuationSpreadId(
  parentId: string,
  existingSpreads: JournalSpread[]
): string {
  const existingIds = new Set(existingSpreads.map((s) => s.id));
  const baseMatch = parentId.match(/^(.*)-c(\d+)$/);
  const root = baseMatch ? baseMatch[1] : parentId;
  let seq = baseMatch ? Number(baseMatch[2]) + 1 : 1;

  while (seq < 1000) {
    const candidate = sanitizeSpreadId(`${root}-c${seq}`);
    if (!existingIds.has(candidate)) {
      return candidate;
    }
    seq += 1;
  }
  return generateUniqueSpreadId();
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
    leftInk: clean.leftInk,
    rightInk: clean.rightInk,
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
    date: typeof data.date === 'string' ? data.date : getTodayIsoDate(),
    contextNote: typeof data.contextNote === 'string' ? data.contextNote : '',
    leftBody: typeof data.leftBody === 'string' ? data.leftBody : '',
    rightBody: typeof data.rightBody === 'string' ? data.rightBody : '',
    leftInk: typeof data.leftInk === 'string' ? data.leftInk : '',
    rightInk: typeof data.rightInk === 'string' ? data.rightInk : '',
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
  const currentSpread = state.spreads[safeIndex] ?? state.spreads[0];

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

    // Immediately replace any untouched demo spreads in state with clean signed-in cache or blank page
    let cachedSignedInSpreads: JournalSpread[] = [];
    try {
      const rawCache = localStorage.getItem(`folio_journal_cloud_${uid}`);
      if (rawCache) {
        const parsedCache = JSON.parse(rawCache);
        if (Array.isArray(parsedCache)) {
          cachedSignedInSpreads = parsedCache
            .map(sanitizeSpreadPayload)
            .filter((s) => !isUntouchedDefaultSpread(s));
        }
      }
    } catch {
      cachedSignedInSpreads = [];
    }
    dispatch({
      type: 'PREPARE_SIGNED_IN',
      cachedSpreads: cachedSignedInSpreads,
    });

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

        // 2. Fetch existing cloud spreads to merge real user edits cleanly
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

        // 3. Filter out untouched hardcoded sample spreads and merge only genuine entries
        const untouchedSampleIds = existingCloudSpreads
          .filter(isUntouchedDefaultSpread)
          .map((s) => s.id);
        const realCloudSpreads = existingCloudSpreads.filter(
          (s) => !isUntouchedDefaultSpread(s)
        );

        const guestSpreads = loadJournalSpreads().filter(
          (s) => !isUntouchedDefaultSpread(s)
        );
        const cloudById = new Map(realCloudSpreads.map((s) => [s.id, s]));
        const toUpload: JournalSpread[] = [];

        for (const local of guestSpreads) {
          const cleanLocal = sanitizeSpreadPayload(local);
          const cloudMatch = cloudById.get(cleanLocal.id);
          if (!cloudMatch || cleanLocal.updatedAt > cloudMatch.updatedAt) {
            toUpload.push(cleanLocal);
          }
        }

        if (realCloudSpreads.length === 0 && toUpload.length === 0) {
          toUpload.push(createBlankTodaySpread());
        }

        if (toUpload.length > 0 || untouchedSampleIds.length > 0) {
          const operations: Array<
            | { kind: 'set'; spread: JournalSpread }
            | { kind: 'delete'; id: string }
          > = [
            ...untouchedSampleIds.map((id) => ({ kind: 'delete' as const, id })),
            ...toUpload.map((spread) => ({ kind: 'set' as const, spread })),
          ];

          const CHUNK_SIZE = 380;
          for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
            const chunk = operations.slice(i, i + CHUNK_SIZE);
            const batch = writeBatch(db);
            for (const op of chunk) {
              const ref = doc(db, 'users', uid, 'spreads', op.kind === 'set' ? op.spread.id : op.id);
              if (op.kind === 'delete') {
                batch.delete(ref);
              } else {
                batch.set(ref, toFirestoreSpreadDoc(op.spread, uid));
              }
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
            const cloudList = snapshot.docs
              .map((d) =>
                fromFirestoreSpreadDoc(d.id, d.data() as Record<string, unknown>)
              )
              .filter((s) => !isUntouchedDefaultSpread(s));

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
      date: getNextIsoDate(last?.date ?? getTodayIsoDate()),
      contextNote: '',
      leftBody: '',
      rightBody: '',
      leftInk: '',
      rightInk: '',
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
      date: getNextIsoDate(last?.date ?? getTodayIsoDate()),
      contextNote: '',
      leftBody: '',
      rightBody: '',
      leftInk: '',
      rightInk: '',
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

  const stageContinuationSpread = useCallback(
    (index: number, rightBodyFit: string, overflowLeftBody: string): number => {
      const curState = stateRef.current;
      const idx = clampIndex(index, curState.spreads.length);
      const current = curState.spreads[idx];
      if (!current) return idx;

      const now = Date.now();
      const updatedCurrent = sanitizeSpreadPayload({
        ...current,
        rightBody: rightBodyFit,
        updatedAt: now,
      });

      const nextExisting = curState.spreads[idx + 1];
      const reuseSameDateNext = Boolean(
        nextExisting && nextExisting.date === current.date
      );

      const existingNextLeft = nextExisting?.leftBody ?? '';
      const mergedNextLeft =
        reuseSameDateNext && overflowLeftBody && existingNextLeft
          ? `${overflowLeftBody}${
              /[\s\n]$/.test(overflowLeftBody) ||
              /^[\s\n]/.test(existingNextLeft)
                ? ''
                : '\n'
            }${existingNextLeft}`
          : overflowLeftBody || existingNextLeft;

      const continuationSpread = reuseSameDateNext
        ? sanitizeSpreadPayload({
            ...nextExisting,
            leftBody: mergedNextLeft,
            inkColor: current.inkColor,
            paperStyle: current.paperStyle,
            updatedAt: now,
          })
        : sanitizeSpreadPayload({
            id: generateContinuationSpreadId(current.id, curState.spreads),
            date: current.date,
            contextNote: '',
            leftBody: overflowLeftBody,
            rightBody: '',
            leftInk: '',
            rightInk: '',
            inkColor: current.inkColor,
            paperStyle: current.paperStyle,
            updatedAt: now,
          });

      dispatch({
        type: 'STAGE_CONTINUATION',
        afterSpreadId: current.id,
        rightBodyFit,
        continuationSpread,
        isNew: !reuseSameDateNext,
        updatedAt: now,
      });

      scheduleCloudWrite(updatedCurrent);
      scheduleCloudWrite(continuationSpread);
      return idx + 1;
    },
    [scheduleCloudWrite]
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
    stageContinuationSpread,
    deleteSpread,
  };
}
