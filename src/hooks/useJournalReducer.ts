import { useReducer } from 'react';
import { DEFAULT_SPREADS, JOURNAL_SYNC_CONFIG } from '../constants/journal';
import { JournalAction, JournalState } from '../types/journal';
import {
  clampSpreadIndex,
  createBlankTodaySpread,
  isUntouchedDefaultSpread,
  sanitizeSpreadPayload,
  sortSpreadsChronologically,
} from '../utils/spread';
import { loadJournalSpreads } from '../utils/storage';

/**
 * Pure reducer handling spread updates, chronological ordering, navigation, continuation staging, and cloud resets.
 * @param state - Current journal spreads and active index state.
 * @param action - Dispatched JournalAction payload.
 * @returns Next immutable JournalState.
 */
export function journalReducer(
  state: JournalState,
  action: JournalAction
): JournalState {
  switch (action.type) {
    case 'UPDATE_SPREAD': {
      const idx = clampSpreadIndex(action.index, state.spreads.length);
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
        currentIndex: clampSpreadIndex(action.index, state.spreads.length),
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
            : clampSpreadIndex(state.currentIndex, nextSpreads.length),
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
        currentIndex: clampSpreadIndex(nextIndex, safeSpreads.length),
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
        currentIndex: clampSpreadIndex(nextIndex, sorted.length),
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
      const todayIdx = sorted.findIndex(
        (s) => s.date === JOURNAL_SYNC_CONFIG.INITIAL_FOCUS_DATE
      );
      return {
        spreads: sorted,
        currentIndex:
          todayIdx !== -1 ? todayIdx : Math.max(0, sorted.length - 1),
      };
    }

    default:
      return state;
  }
}

/**
 * Builds the initial JournalState from localStorage, focusing the default Saturday spread or latest entry.
 * @returns Initialized JournalState.
 */
export function createInitialJournalState(): JournalState {
  const safeSpreads = loadJournalSpreads();
  const todayIdx = safeSpreads.findIndex(
    (s) => s.date === JOURNAL_SYNC_CONFIG.INITIAL_FOCUS_DATE
  );
  const currentIndex =
    todayIdx !== -1 ? todayIdx : Math.max(0, safeSpreads.length - 1);
  return {
    spreads: safeSpreads,
    currentIndex,
  };
}

/**
 * Wraps the pure journal reducer with initial state lazy loading.
 * @returns Current JournalState and React dispatch function.
 */
export function useJournalReducer() {
  return useReducer(journalReducer, undefined, createInitialJournalState);
}
