import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Wall-clock čas v timezone události → Date v lokálním JS čase (pro kalendář). */
export function wallTimeToLocalDate(
  dateStr: string,
  timeStr: string | undefined | null,
  eventTimezone?: string | null
): Date {
  const day = String(dateStr || '').slice(0, 10);
  const time = String(timeStr || '00:00').slice(0, 5);
  const zone = eventTimezone || getDeviceTimezone();
  try {
    return dayjs.tz(`${day}T${time}`, zone).toDate();
  } catch {
    return dayjs(`${day}T${time}`).toDate();
  }
}

/** Bezpečné start/end z event objektu (respektuje event.timezone). */
export function getSafeDates(ev: any): { s: Date; e: Date } {
  if (!ev) return { s: new Date(), e: new Date(Date.now() + 3600000) };

  const tz = ev.timezone as string | undefined;
  const denOd =
    ev.den_od ||
    ev.instance_date ||
    (ev.start ? dayjs(ev.start).format('YYYY-MM-DD') : null);
  const denDo =
    ev.den_do ||
    denOd ||
    (ev.end ? dayjs(ev.end).format('YYYY-MM-DD') : null);

  let s: Date;
  let e: Date;

  if (denOd && (ev.cas_od || tz)) {
    s = wallTimeToLocalDate(denOd, ev.cas_od || dayjs(ev.start).format('HH:mm'), tz);
  } else if (ev.start) {
    s = new Date(ev.start);
  } else if (ev.startTime) {
    s = new Date(ev.startTime);
  } else {
    s = new Date();
  }

  if (denDo && (ev.cas_do || tz)) {
    e = wallTimeToLocalDate(denDo, ev.cas_do || dayjs(ev.end).format('HH:mm'), tz);
  } else if (ev.end) {
    e = new Date(ev.end);
  } else if (ev.endTime) {
    e = new Date(ev.endTime);
  } else {
    e = new Date(s.getTime() + 3600000);
  }

  // Legacy: pokud start existuje ale bez den_od, aplikuj cas_od lokálně
  if (!denOd && ev.cas_od && !tz) {
    const parts = String(ev.cas_od).split(':');
    if (parts.length >= 2) s.setHours(Number(parts[0]), Number(parts[1]), 0, 0);
  }
  if (!denDo && ev.cas_do && !tz) {
    const parts = String(ev.cas_do).split(':');
    if (parts.length >= 2) e.setHours(Number(parts[0]), Number(parts[1]), 0, 0);
  }

  if (isNaN(s.getTime())) s = new Date();
  if (isNaN(e.getTime())) e = new Date(s.getTime() + 3600000);

  return { s, e };
}

export function formatInstanceDate(value: Date | string | undefined | null): string {
  return dayjs(value || undefined).format('YYYY-MM-DD');
}
