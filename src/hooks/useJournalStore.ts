import { User } from 'firebase/auth';
import { useCallback, useMemo, useRef } from 'react';
import { JournalSpread } from '../types/journal';
import { formatLocalIsoDate, getNextIsoDate } from '../utils/date';
import {
  clampSpreadIndex,
  generateContinuationSpreadId,
  generateUniqueSpreadId,
  mergeOverflowText,
  sanitizeSpreadPayload,
} from '../utils/spread';
import { useJournalReducer } from './useJournalReducer';
import { useJournalSync } from './useJournalSync';

/**
 * Facade hook combining spread reducer state and Firestore synchronization into the unified journal store API.
 * @param user - Currently authenticated Firebase user or null for guest mode.
 * @param authReady - True after Firebase Auth initial state resolution.
 * @returns Spread state, derived current/upcoming spreads, sync status, and CRUD/navigation handlers.
 */
export function useJournalStore(user: User | null, authReady: boolean) {
  const [state, dispatch] = useJournalReducer();

  const stateRef = useRef(state);
  stateRef.current = state;

  const userRef = useRef<User | null>(user);
  userRef.current = user;

  const {
    syncStatus,
    syncError,
    retrySync,
    flushPendingSaves,
    scheduleCloudWrite,
    writeSpreadToCloud,
    cancelPendingWrite,
    deleteSpreadFromCloud,
  } = useJournalSync(user, authReady, state, stateRef, dispatch);

  const safeIndex = clampSpreadIndex(state.currentIndex, state.spreads.length);
  const currentSpread = state.spreads[safeIndex] ?? state.spreads[0];

  const upcomingBlankSpread = useMemo<JournalSpread>(() => {
    const last = state.spreads[state.spreads.length - 1];
    return {
      id: `spread-upcoming-${state.spreads.length + 1}`,
      date: getNextIsoDate(last?.date ?? formatLocalIsoDate()),
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
      const idx = clampSpreadIndex(index, stateRef.current.spreads.length);
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
    [dispatch, scheduleCloudWrite]
  );

  const goToSpread = useCallback(
    (index: number) => {
      void flushPendingSaves();
      dispatch({ type: 'GO_TO_SPREAD', index });
    },
    [dispatch, flushPendingSaves]
  );

  const turnPrev = useCallback(() => {
    void flushPendingSaves();
    dispatch({ type: 'TURN_PREV' });
  }, [dispatch, flushPendingSaves]);

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
  }, [dispatch, flushPendingSaves, upcomingBlankSpread, writeSpreadToCloud]);

  const createSpread = useCallback(() => {
    void flushPendingSaves();
    const curState = stateRef.current;
    const last = curState.spreads[curState.spreads.length - 1];
    const current =
      curState.spreads[clampSpreadIndex(curState.currentIndex, curState.spreads.length)];

    const created = sanitizeSpreadPayload({
      id: generateUniqueSpreadId(),
      date: getNextIsoDate(last?.date ?? formatLocalIsoDate()),
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
  }, [dispatch, flushPendingSaves, writeSpreadToCloud]);

  const deleteSpread = useCallback(
    (index: number) => {
      const curState = stateRef.current;
      if (curState.spreads.length <= 1) return;
      const target = curState.spreads[index];
      if (!target) return;

      cancelPendingWrite(target.id);
      dispatch({ type: 'DELETE_SPREAD', index });
      deleteSpreadFromCloud(target.id);
    },
    [cancelPendingWrite, deleteSpreadFromCloud, dispatch]
  );

  const stageContinuationSpread = useCallback(
    (index: number, rightBodyFit: string, overflowLeftBody: string): number => {
      const curState = stateRef.current;
      const idx = clampSpreadIndex(index, curState.spreads.length);
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
      const mergedNextLeft = reuseSameDateNext
        ? mergeOverflowText(overflowLeftBody, existingNextLeft)
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
    [dispatch, scheduleCloudWrite]
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
