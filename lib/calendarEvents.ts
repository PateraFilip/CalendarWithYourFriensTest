/** Sdílená logika pro kalendář – deduplikace a klíče instancí */

export interface CalendarEventLike {
  id: number;
  title: string;
  start: Date;
  end: Date;
  user_id: number;
  pocet_lidi: number;
  pravidelnost: boolean;
  is_group: boolean;
  poloha?: string;
  latitude?: number | null;
  longitude?: number | null;
}

/** Unikátní klíč instance (stejné series id může mít více dní) */
export function eventInstanceKey(e: Pick<CalendarEventLike, 'id' | 'start'>): string {
  return `${e.id}-${e.start.getTime()}`;
}

/** Odstraní duplicity po migraci (API expand + weekly expand) */
export function dedupeCalendarEvents<T extends CalendarEventLike>(events: T[]): T[] {
  const map = new Map<string, T>();

  for (const e of events) {
    const key = eventInstanceKey(e);

    // Pokud už pod tímto klíčem událost máme, porovnáme jejich délku
    if (map.has(key)) {
      const existingEvent = map.get(key)!;
      const existingDuration = existingEvent.end.getTime() - existingEvent.start.getTime();
      const newDuration = e.end.getTime() - e.start.getTime();

      // Přepíšeme ji pouze tehdy, pokud je nový kousek delší (např. 24h blok přepíše 9h blok)
      if (newDuration > existingDuration) {
        map.set(key, e);
      }
    } else {
      map.set(key, e);
    }
  }

  return Array.from(map.values());
}

/** Sloučí události se stejným uživatelem a názvem pro měsíční kalendář */
export function mergeDuplicateEvents<T extends CalendarEventLike>(events: T[]): T[] {
  const map = new Map<string, T>();
  for (const e of events) {
    const key = `${e.user_id}-${e.title}`;
    if (!map.has(key)) {
      map.set(key, e);
    }
  }
  return Array.from(map.values());
}

/** Události překrývající daný den */
export function eventsOverlappingDay<T extends CalendarEventLike>(events: T[], day: Date): T[] {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);
  return events.filter((e) => e.end > dayStart && e.start < dayEnd);
}

/** Viditelný úsek události v rámci jednoho dne (pro denní/týdenní kalendář) */
export function visibleSegmentOnDay(
  e: CalendarEventLike,
  day: Date,
): { eventStart: Date; eventEnd: Date; startHourOffset: number; segmentHours: number } {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);

  const eventStart = e.start < dayStart ? dayStart : e.start;
  const eventEnd = e.end > dayEnd ? dayEnd : e.end;
  const startHourOffset = eventStart.getHours() + eventStart.getMinutes() / 60;
  // Konec dne = 24.0 (ne 23:59), ať přes půlnoc zabere zbytek mřížky
  const endHourOffset =
    eventEnd.getTime() >= dayEnd.getTime()
      ? 24
      : eventEnd.getHours() + eventEnd.getMinutes() / 60 + eventEnd.getSeconds() / 3600;
  const segmentHours = Math.max(endHourOffset - startHourOffset, 1 / 60);

  return { eventStart, eventEnd, startHourOffset, segmentHours };
}
