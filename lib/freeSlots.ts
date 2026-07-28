import dayjs from 'dayjs';
import { getSafeDates } from '@/lib/eventDates';

export type TimeInterval = { start: Date; end: Date };
export type FreeSlot = TimeInterval;

/** Opraví intervaly, kde end <= start (přes půlnoc). */
export function normalizeInterval(start: Date, end: Date): TimeInterval | null {
  let s = start.getTime();
  let e = end.getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return null;
  if (e <= s) {
    e += 24 * 60 * 60 * 1000;
  }
  if (e <= s) return null;
  return { start: new Date(s), end: new Date(e) };
}

export function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  );
  const out: TimeInterval[] = [
    { start: new Date(sorted[0].start), end: new Date(sorted[0].end) },
  ];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = out[out.length - 1];
    if (cur.start.getTime() <= last.end.getTime()) {
      if (cur.end.getTime() > last.end.getTime()) {
        last.end = new Date(cur.end);
      }
    } else {
      out.push({ start: new Date(cur.start), end: new Date(cur.end) });
    }
  }
  return out;
}

/** Volné úseky = okno minus sjednocené busy. */
export function freeWithinWindow(
  windowStart: Date,
  windowEnd: Date,
  busy: TimeInterval[]
): TimeInterval[] {
  const ws = windowStart.getTime();
  const we = windowEnd.getTime();
  if (we <= ws) return [];

  const clipped = busy
    .map((b) => {
      const start = Math.max(b.start.getTime(), ws);
      const end = Math.min(b.end.getTime(), we);
      if (end <= start) return null;
      return { start: new Date(start), end: new Date(end) };
    })
    .filter((b): b is TimeInterval => !!b);

  const merged = mergeIntervals(clipped);
  const free: TimeInterval[] = [];
  let cursor = ws;
  for (const b of merged) {
    if (b.start.getTime() > cursor) {
      free.push({ start: new Date(cursor), end: new Date(b.start.getTime()) });
    }
    cursor = Math.max(cursor, b.end.getTime());
  }
  if (cursor < we) {
    free.push({ start: new Date(cursor), end: new Date(we) });
  }
  return free;
}

type BusyEvent = {
  start?: Date | string;
  end?: Date | string;
  den_od?: string;
  den_do?: string;
  cas_od?: string;
  cas_do?: string;
  timezone?: string | null;
  [key: string]: unknown;
};

/**
 * Volno ve dnech = celý den (00:00–24:00) minus busy události.
 * Mezery začínají přesně na konci předchozí události (i dnes).
 * Předávej stejné události, jaké jsou ve filtru / ose.
 */
export function computeSharedFreeByDay(params: {
  events: BusyEvent[];
  daysAhead?: number;
  /** Kolik dní do minulosti počítat (osa historie). */
  daysBehind?: number;
  minMinutes?: number;
}): Map<string, FreeSlot[]> {
  const {
    events,
    daysAhead = 90,
    daysBehind = 0,
    minMinutes = 30,
  } = params;

  const result = new Map<string, FreeSlot[]>();
  const minMs = minMinutes * 60 * 1000;
  const today = dayjs().startOf('day');
  const behind = Math.max(0, daysBehind);

  const busyAll: TimeInterval[] = [];
  for (const e of events) {
    const { s, e: end } = getSafeDates(e);
    const norm = normalizeInterval(s, end);
    if (norm) busyAll.push(norm);
  }
  const busyMerged = mergeIntervals(busyAll);

  for (let d = -behind; d <= daysAhead; d++) {
    const day = today.add(d, 'day');
    const key = day.format('YYYY-MM-DD');
    const windowStart = day.startOf('day').toDate();
    const windowEnd = day.add(1, 'day').startOf('day').toDate();

    const slots = freeWithinWindow(windowStart, windowEnd, busyMerged).filter(
      (s) => s.end.getTime() - s.start.getTime() >= minMs
    );

    if (slots.length > 0) result.set(key, slots);
  }

  return result;
}
