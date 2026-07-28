import { loadStorage, saveStorage } from '@/lib/storage';

export type CalendarViewMode = 'day' | 'threeDay' | 'week' | 'month' | 'agenda';

const STORAGE_KEY = 'calendarViewMode';

export const DEFAULT_CALENDAR_VIEW: CalendarViewMode = 'week';

export const CALENDAR_VIEW_OPTIONS: { value: CalendarViewMode; label: string }[] = [
  { value: 'day', label: 'Den' },
  { value: 'threeDay', label: '3 dny' },
  { value: 'week', label: 'Týden' },
  { value: 'month', label: 'Měsíc' },
  { value: 'agenda', label: 'Osa' },
];

export function isCalendarViewMode(value: unknown): value is CalendarViewMode {
  return (
    value === 'day' ||
    value === 'threeDay' ||
    value === 'week' ||
    value === 'month' ||
    value === 'agenda'
  );
}

/** Map legacy selectedIndex / deep-link calendar param. */
export function calendarViewFromLegacyIndex(index: number): CalendarViewMode {
  if (index === 0) return 'day';
  if (index === 2) return 'month';
  return 'week';
}

export async function loadCalendarViewMode(): Promise<CalendarViewMode> {
  try {
    const stored = await loadStorage(STORAGE_KEY);
    if (isCalendarViewMode(stored)) return stored;
    return DEFAULT_CALENDAR_VIEW;
  } catch {
    return DEFAULT_CALENDAR_VIEW;
  }
}

export async function saveCalendarViewMode(mode: CalendarViewMode): Promise<void> {
  await saveStorage(STORAGE_KEY, mode);
}
