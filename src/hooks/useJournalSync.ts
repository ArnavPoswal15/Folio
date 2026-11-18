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
  Unsubscribe,
  where,
  writeBatch,
} from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_SPREADS, JOURNAL_SYNC_CONFIG } from '../constants/journal';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  JournalAction,
  JournalSpread,
  JournalState,
  SyncStatus,
} from '../types/journal';
import {
  fromFirestoreSpreadDoc,
  summarizeSyncError,
  toFirestoreSpreadDoc,
} from '../utils/firestoreSpread';
import {
  clampSpreadIndex,
  createBlankTodaySpread,
  isUntouchedDefaultSpread,
  sanitizeSpreadPayload,
} from '../utils/spread';
import {
  loadJournalSpreads,
  loadUserCloudCache,
  saveJournalSpreads,
  saveUserCloudCache,
} from '../utils/storage';

/**
 * Synchronizes local guest/per-user caches, Firestore batch uploads, debounced spread writes, and real-time snapshots.
 * @param user - Currently authenticated Firebase user or null when browsing locally.
 * @param authReady - True once initial Firebase Auth resolution completes.
 * @param state - Current local JournalState snapshot.
 * @param stateRef - Live ref holding latest JournalState for snapshot race reconciliation.
 * @param dispatch - Journal reducer dispatch function.
 * @returns Cloud sync status/error indicators and save/delete/retry handlers.
 */
export function useJournalSync(
  user: User | null,
  authReady: boolean,
  state: JournalState,
  stateRef: React.RefObject<JournalState>,
  dispatch: React.Dispatch<JournalAction>
) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncTrigger, setSyncTrigger] = useState(0);

  const userRef = useRef<User | null>(user);
  userRef.current = user;

  const pendingWritesRef = useRef<
    Map<string, { timer: number; spread: JournalSpread }>
  >(new Map());
  const inFlightIdsRef = useRef<Set<string>>(new Set());
  const wasSignedInRef = useRef(false);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      saveJournalSpreads(state.spreads);
    } else {
      saveUserCloudCache(user.uid, state.spreads);
    }
  }, [authReady, state.spreads, user]);

  const writeSpreadToCloud = useCallback(
    async (uid: string, spread: JournalSpread): Promise<void> => {
      const clean = sanitizeSpreadPayload(spread);
      const path = `users/${uid}/spreads/${clean.id}`;
      inFlightIdsRef.current.add(clean.id);
      setSyncStatus('syncing');
      try {
        await setDoc(
          doc(db, 'users', uid, 'spreads', clean.id),
          toFirestoreSpreadDoc(clean, uid)
        );
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
      }, JOURNAL_SYNC_CONFIG.DEBOUNCE_WRITE_MS);

      pendingWritesRef.current.set(spread.id, { timer, spread });
    },
    [writeSpreadToCloud]
  );

  const cancelPendingWrite = useCallback((spreadId: string) => {
    const pending = pendingWritesRef.current.get(spreadId);
    if (pending) {
      window.clearTimeout(pending.timer);
      pendingWritesRef.current.delete(spreadId);
    }
  }, []);

  const deleteSpreadFromCloud = useCallback((spreadId: string) => {
    const activeUser = userRef.current;
    if (!activeUser) return;

    const path = `users/${activeUser.uid}/spreads/${spreadId}`;
    setSyncStatus('syncing');
    deleteDoc(doc(db, 'users', activeUser.uid, 'spreads', spreadId))
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
  }, []);

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

  useEffect(() => {
    if (!authReady) return;

    if (!user) {
      pendingWritesRef.current.forEach((entry) =>
        window.clearTimeout(entry.timer)
      );
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

    const cachedSignedInSpreads = loadUserCloudCache(uid);
    dispatch({
      type: 'PREPARE_SIGNED_IN',
      cachedSpreads: cachedSignedInSpreads,
    });

    const bootstrapAndListen = async () => {
      setSyncStatus('syncing');
      setSyncError(null);

      try {
        const userPath = `users/${uid}`;
        const userDocRef = doc(db, 'users', uid);
        const profilePayload = {
          uid,
          displayName: (user.displayName ?? '').slice(
            0,
            JOURNAL_SYNC_CONFIG.MAX_DISPLAY_NAME_LEN
          ),
          email: (user.email ?? 'journal@user.local').slice(
            0,
            JOURNAL_SYNC_CONFIG.MAX_EMAIL_LEN
          ),
          updatedAt: serverTimestamp(),
        };

        try {
          await setDoc(userDocRef, profilePayload);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, userPath);
        }

        if (cancelled) return;

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

          for (
            let i = 0;
            i < operations.length;
            i += JOURNAL_SYNC_CONFIG.BATCH_CHUNK_SIZE
          ) {
            const chunk = operations.slice(
              i,
              i + JOURNAL_SYNC_CONFIG.BATCH_CHUNK_SIZE
            );
            const batch = writeBatch(db);
            for (const op of chunk) {
              const ref = doc(
                db,
                'users',
                uid,
                'spreads',
                op.kind === 'set' ? op.spread.id : op.id
              );
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
          saveJournalSpreads(DEFAULT_SPREADS);
        }

        if (cancelled) return;

        unsubscribeSnapshot = onSnapshot(
          spreadsQuery,
          (snapshot) => {
            if (cancelled) return;
            const cloudList = snapshot.docs
              .map((d) =>
                fromFirestoreSpreadDoc(d.id, d.data() as Record<string, unknown>)
              )
              .filter((s) => !isUntouchedDefaultSpread(s));

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
                  clampSpreadIndex(
                    stateRef.current.currentIndex,
                    stateRef.current.spreads.length
                  )
                ]?.id;
              dispatch({
                type: 'APPLY_CLOUD_SPREADS',
                spreads: mergedList,
                preserveSpreadId: activeId,
              });
            }

            if (
              pendingWritesRef.current.size === 0 &&
              inFlightIdsRef.current.size === 0
            ) {
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
  }, [authReady, dispatch, stateRef, syncTrigger, user]);

  const retrySync = useCallback(() => {
    setSyncTrigger((n) => n + 1);
  }, []);

  return {
    syncStatus,
    syncError,
    retrySync,
    flushPendingSaves,
    scheduleCloudWrite,
    writeSpreadToCloud,
    cancelPendingWrite,
    deleteSpreadFromCloud,
  };
}
