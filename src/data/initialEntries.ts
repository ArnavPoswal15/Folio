import { JournalSpread, sanitizeSpreadPayload } from '../types/journal';

const STORAGE_KEY = 'folio_journal_spreads_v1';

export const DEFAULT_SPREADS: JournalSpread[] = [
  {
    id: 'spread-1',
    date: '2026-11-12',
    contextNote: 'Late afternoon rain · Window cracked open',
    inkColor: 'sepia',
    paperStyle: 'ruled',
    leftBody:
      'Picked up a fine nib on the walk back from the station and spent twenty quiet minutes watching rain collect along the sill.\n\nFunny how much slower thoughts move without a bright screen sitting beside the teacup. Half the things that felt urgent on Tuesday turned out to be noise once I wrote them in plain sentences.\n\nBefore Friday:\n- Walk before checking messages\n- Finish the essays on light and proportion\n- Call Sam before the weekend',
    rightBody:
      'Evening:\n\nRoasted squash with thyme and garlic while listening to old Bill Evans records. Kept only the corner lamp lit.\n\nNote for the studio work—let one physical object carry the room and leave the rest open.',
    updatedAt: 1794518400000,
  },
  {
    id: 'spread-2',
    date: '2026-11-13',
    contextNote: 'Cold morning · Cedar & black coffee',
    inkColor: 'midnight',
    paperStyle: 'ruled',
    leftBody:
      'Woke early before the street stirred. Crisp air through the hallway, pale silver sky behind the rooftops.\n\nSpent an hour sketching margins and proportions on scrap paper—a pencil still solves things faster than sliding boxes around with a trackpad.\n\nSimplicity is rarely what you remove first; it is what stays honest after the extra ornament drops away.',
    rightBody:
      'Afternoon walk across the park. The sycamore leaves are almost completely down now, leaving dark ink-like branches against the sky.\n\nTomorrow:\nKeep the morning unscheduled until ten-thirty so the day has somewhere quiet to start.',
    updatedAt: 1794604800000,
  },
  {
    id: 'spread-3',
    date: '2026-11-14',
    contextNote: 'Saturday · Clear light through the south window',
    inkColor: 'charcoal',
    paperStyle: 'ruled',
    leftBody:
      'Slow Saturday. Made pour-over at eleven and cleared off the desk so only the notebook and a pen were sitting out.\n\nBooks to look for next week:\n- The Poetics of Space\n- In Praise of Shadows\n\nWant to spend a few hours this afternoon sorting the autumn film rolls and writing down the ones worth printing.',
    rightBody:
      'Afternoon thoughts:\n\nNotice how quickly a week disappears when every hour gets booked back-to-back. Keeping one blank afternoon feels less like doing nothing and more like catching up with yourself.\n\nDinner plan: pasta with lemon, capers, and toasted breadcrumbs.',
    updatedAt: 1794691200000,
  },
  {
    id: 'spread-4',
    date: '2026-11-15',
    contextNote: 'Sunday morning',
    inkColor: 'charcoal',
    paperStyle: 'dotted',
    leftBody: '',
    rightBody: '',
    updatedAt: 1794691201000,
  },
];

export function sortSpreadsChronologically(spreads: JournalSpread[]): JournalSpread[] {
  return [...spreads].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
  );
}

export function isUntouchedDefaultSpread(spread: JournalSpread): boolean {
  const sample = DEFAULT_SPREADS.find((d) => d.id === spread.id);
  if (!sample) return false;
  return (
    sample.date === spread.date &&
    sample.contextNote === spread.contextNote &&
    sample.leftBody === spread.leftBody &&
    sample.rightBody === spread.rightBody &&
    sample.inkColor === spread.inkColor &&
    sample.paperStyle === spread.paperStyle
  );
}

export function loadJournalSpreads(): JournalSpread[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SPREADS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return sortSpreadsChronologically(parsed.map(sanitizeSpreadPayload));
    }
    return DEFAULT_SPREADS;
  } catch {
    return DEFAULT_SPREADS;
  }
}

export function saveJournalSpreads(spreads: JournalSpread[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(spreads));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function formatJournalDateParts(isoDate: string): {
  weekday: string;
  monthDay: string;
  year: string;
  full: string;
} {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return {
      weekday: 'Journal Entry',
      monthDay: isoDate,
      year: '',
      full: isoDate,
    };
  }
  const [year, month, day] = parts;
  const dateObj = new Date(year, month - 1, day);
  const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const monthDay = dateObj.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });
  return {
    weekday,
    monthDay,
    year: String(year),
    full: `${weekday}, ${monthDay}, ${year}`,
  };
}

export function formatMonthLabel(yearMonth: string): string {
  const parts = yearMonth.split('-').map(Number);
  if (parts.length !== 2 || parts.some(Number.isNaN)) return yearMonth;
  const [year, month] = parts;
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export function getNextIsoDate(lastIsoDate: string): string {
  const parts = lastIsoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return new Date().toISOString().slice(0, 10);
  }
  const [y, m, d] = parts;
  const next = new Date(y, m - 1, d + 1);
  const yy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, '0');
  const dd = String(next.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
