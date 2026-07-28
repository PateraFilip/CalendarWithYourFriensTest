import type { CalendarViewMode } from '@/lib/calendarViewPrefs';

function startOfWeekMonday(date: Date): Date {
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Posun viditelného období podle aktuálního pohledu (Google-style). */
export function shiftVisibleDate(
  date: Date,
  viewMode: CalendarViewMode,
  direction: -1 | 1
): Date {
  if (viewMode === 'agenda') return date;

  if (viewMode === 'day') {
    const next = startOfDay(date);
    next.setDate(next.getDate() + direction);
    return next;
  }

  if (viewMode === 'threeDay') {
    const next = startOfDay(date);
    next.setDate(next.getDate() + direction * 3);
    return next;
  }

  if (viewMode === 'week') {
    const monday = startOfWeekMonday(date);
    monday.setDate(monday.getDate() + direction * 7);
    return monday;
  }

  // month
  return new Date(date.getFullYear(), date.getMonth() + direction, 1);
}

export function monthCacheKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}`;
}
