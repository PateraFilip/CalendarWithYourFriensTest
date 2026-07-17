import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { fetchEvents } from '@/services/events/get_events';
import { fetchEventsException } from '@/services/events/get_event_exceptions';
import { useRealtimeNotifications } from '@/hooks/useNotificationHandler';

interface Event { id: number; title: string; start: Date; end: Date; user_id: number; pocet_lidi: number; pravidelnost: boolean; is_group: boolean; original_start?: Date; original_end?: Date; }
interface EventException { id: number; start: Date; end: Date; event_id: number; typ: string; puvodni_start: Date; puvodni_end: Date; }

export function useCalendarEvents(user: any, selectedDate: Date | null) {
    const [events, setEvents] = useState<Event[]>([]);
    const [eventException, setEventException] = useState<EventException[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const selectedDateRef = useRef(selectedDate);
    useEffect(() => {
        selectedDateRef.current = selectedDate;
    }, [selectedDate]);

    const loadEvents = async () => {
        try {
            const d = selectedDateRef.current ?? new Date();
            if (!user?.id) return;
            const data = await fetchEvents(user.id, d, d);
            setEvents(data);
            const seriesIds = [...new Set(data.map((e) => e.id))];
            try {
                const exceptions = await fetchEventsException(seriesIds);
                setEventException(exceptions);
            } catch (err) {
                console.error(err);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetching dat, když se změní měsíc/rok
    useEffect(() => {
        let mounted = true;
        if (mounted) {
            loadEvents();
        }
        return () => { mounted = false; };
    }, [user, selectedDate?.getMonth(), selectedDate?.getFullYear()]);

    // WebSocket subscription pouze jednou na začátku
    useEffect(() => {
        let mounted = true;

        const channelEvents = supabase.channel('realtime:public:event_series')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'event_series' }, (payload) => {
                if (mounted) {
                    useRealtimeNotifications(payload, user);
                    loadEvents();
                }
            }).subscribe();

        const channelExceptions = supabase.channel('realtime:public:event_exceptions')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'series_exceptions' }, () => {
                if (mounted) loadEvents();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
                if (mounted) loadEvents();
            })
            .subscribe();

        return () => {
            mounted = false;
            supabase.removeChannel(channelEvents);
            supabase.removeChannel(channelExceptions);
        };
    }, [user]);

    return { events, eventException, isLoading, loadEvents };
}
