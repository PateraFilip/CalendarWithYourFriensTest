import dayjs from 'dayjs';

export interface CalendarEvent {
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
    recurrence_rule?: any;
}

export function splitEventByDays(event: CalendarEvent): CalendarEvent[] {
    const start = dayjs(event.start);
    const end = dayjs(event.end);
    
    if (start.isSame(end, 'day')) {
        return [{ ...event }];
    }

    const parts: CalendarEvent[] = [];
    let currentStart = start;
    
    while (currentStart.isBefore(end)) {
        let currentEnd = currentStart.endOf('day');
        if (currentEnd.isAfter(end)) {
            currentEnd = end;
        }
        
        parts.push({
            ...event,
            start: currentStart.toDate(),
            end: currentEnd.toDate()
        });
        
        currentStart = currentStart.add(1, 'day').startOf('day');
        if (currentStart.isSame(end) && currentStart.valueOf() === end.valueOf()) {
            break;
        }
    }
    
    return parts;
}

export interface WeeklyEvent {
    id: number;
    title: string;
    cas_od: Date;
    cas_do: Date;
    user_id: number;
    den: string;
    recurrence_rule?: any;
}

export interface EventException {
    id: number;
    start: Date;
    end: Date;
    event_id: number;
    typ: string;
    puvodni_start: Date;
    puvodni_end: Date;
}

const DAYS_SHORT = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];

export function expandWeeklyForDate(
    weeklyEvents: WeeklyEvent[],
    date: Date,
    eventsException: EventException[],
): CalendarEvent[] {
    const result: CalendarEvent[] = [];
    const eventDay = DAYS_SHORT[date.getDay()];
    const eventDayPrev = DAYS_SHORT[(date.getDay() + 6) % 7];

    weeklyEvents.forEach(w => {
        // Pro pattern type ignorujeme den (je to placeholder)
        if (w.recurrence_rule && typeof w.recurrence_rule === 'object' && w.recurrence_rule.type === 'pattern') {
            // Vytvoříme event bez ohledu na den
        } else if (
            (w.den.trim().normalize() !== eventDay && w.den.trim().normalize() !== eventDayPrev) ||
            (w.den.trim().normalize() === eventDayPrev && w.cas_do > w.cas_od)
        ) {
            return;
        }

        let start = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            w.cas_od.getHours(),
            w.cas_od.getMinutes(),
        );
        let end = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            w.cas_do.getHours(),
            w.cas_do.getMinutes(),
        );

        if (end < start && w.den.trim().normalize() === eventDay) end.setDate(end.getDate() + 1);
        else if (end < start && w.den.trim().normalize() === eventDayPrev) start.setDate(start.getDate() - 1);

        const exceptionDelete = eventsException.some(
            ex =>
                ex.event_id === w.id &&
                new Date(ex.puvodni_start).getTime() === start.getTime() &&
                ex.typ === 'DELETE',
        );
        const exception = eventsException.find(
            ex =>
                ex.event_id === w.id &&
                new Date(ex.puvodni_start).getTime() === start.getTime(),
        );

        if (exception) {
            start = new Date(exception.start);
            end = new Date(exception.end);
            if (end < start && w.den.trim().normalize() === eventDay) end.setDate(end.getDate() + 1);
            else if (end < start && w.den.trim().normalize() === eventDayPrev) start.setDate(start.getDate() - 1);
        }

        if (exceptionDelete) return;

        result.push({
            id: w.id,
            title: w.title,
            start,
            end,
            user_id: w.user_id,
            pocet_lidi: 1,
            pravidelnost: true,
            is_group: false,
            recurrence_rule: w.recurrence_rule,
        });
    });

    return result;
}

export function getMyUpcomingEvents(
    events: CalendarEvent[],
    weeklyEvents: WeeklyEvent[],
    eventsException: EventException[],
    userIds: string[],
    joinedEventIds: number[],
    daysAhead = 30,
): CalendarEvent[] {
    const now = new Date();
    const endRange = dayjs(now).add(daysAhead, 'day').toDate();
    const result: CalendarEvent[] = [];

    events.forEach(e => {
        const isMine = userIds.includes(String(e.user_id));
        const isJoinedGroup = joinedEventIds.includes(e.id);
        if (!isMine && !isJoinedGroup) return;
        // Zobrazit i proběhlé události dneška
        const isToday = dayjs(e.start).isSame(now, 'day');
        if (!isToday && (e.end < now || e.start > endRange)) return;
        result.push(e);
    });

    for (let d = 0; d <= daysAhead; d++) {
        const date = dayjs(now).add(d, 'day').toDate();
        const expanded = expandWeeklyForDate(
            weeklyEvents.filter(w => userIds.includes(String(w.user_id))),
            date,
            eventsException,
        );
        expanded.forEach(e => {
            const isToday = dayjs(e.start).isSame(now, 'day');
            // Zobrazit i proběhlé události dneška
            if (isToday || e.end >= now) result.push(e);
        });
    }

    const unique = new Map<string, CalendarEvent>();
    const todayStart = dayjs().startOf('day').valueOf();
    
    result.forEach(e => {
        const parts = splitEventByDays(e);
        parts.forEach(part => {
            const partStartMs = part.start.getTime();
            const partEndMs = part.end.getTime();
            
            // Chceme zobrazit pouze ty části události, které:
            // 1) Jsou dnes nebo v budoucnu
            // NEBO
            // 2) Stále běží (partEndMs >= now)
            if (partStartMs >= todayStart || partEndMs >= now.getTime()) {
                const key = `${part.id}-${partStartMs}`;
                unique.set(key, part);
            }
        });
    });

    return Array.from(unique.values()).sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function formatPause(ms: number): string {
    if (ms <= 0) return '0 min';
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes} min`;
    if (minutes === 0) return `${hours} h`;
    return `${hours} h ${minutes} min`;
}
