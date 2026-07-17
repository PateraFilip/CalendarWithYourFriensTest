import dayjs from 'dayjs';
import type { UserEvent } from '@/services/events/getUserEvents';

/** Účastníci skupinové instance — stejná logika jako detail / Moje události. */
export function getEventParticipants(
  userEvents: UserEvent[],
  event: { id: number | string; start: Date | string; pravidelnost?: boolean }
): UserEvent[] {
  const eventId = String(event.id);
  const itemInstanceDate = dayjs(event.start).format('YYYY-MM-DD');

  const forSeries = userEvents.filter(
    (u) =>
      String(u.event_id) === eventId &&
      !(typeof u.instance_date === 'string' && u.instance_date.startsWith('CLEARED-'))
  );

  const clearedMarker = forSeries.find(
    (u) => u.instance_date === `CLEARED-${itemInstanceDate}`
  );
  if (clearedMarker) return [];

  const instanceSpecific = forSeries.filter((u) => u.instance_date === itemInstanceDate);
  if (instanceSpecific.length > 0) return instanceSpecific;

  // Série / jednorázová: řádky bez data (+ případně omylem s datem instance)
  const seriesLevel = forSeries.filter((u) => !u.instance_date);
  if (seriesLevel.length > 0) return seriesLevel;

  // Fallback: někdy se u „once“ uloží instance_date = den události
  return forSeries.filter(
    (u) => !u.instance_date || u.instance_date === itemInstanceDate
  );
}
