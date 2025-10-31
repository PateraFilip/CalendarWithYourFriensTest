const API_URL =
    'https://tzbpcbmxwbsixrtorijk.supabase.co/functions/v1/get-event-exception'
const API_KEY =
    'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YnBjYm14d2JzaXhydG9yaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTIwMjEsImV4cCI6MjA3NTc2ODAyMX0.QTlHAHIPIJJ8FHDQowpZQIOckhHnAykn2CLbfJ2YbOw'


interface EventException {
    id: number;
    start: Date;
    end: Date;
    event_id: number;
    typ: string;
    puvodni_start: Date;
    puvodni_end: Date;
}
export const fetchEventsException = async (): Promise<EventException[]> => {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: API_KEY,
        },
    })

    if (!response.ok) {
        throw new Error('Failed to fetch events')
    }

    const data = await response.json()


    const events: EventException[] = data.map((e: any) => {
        const startTime = e.cas_od ?? '00:00'
        const endTime = e.cas_do ?? '23:59'

        const startTimeOriginal = e.puvodni_cas_od ?? '00:00'
        const endTimeOriginal = e.puvodni_cas_do ?? '23:59'

        return {
            id: e.id,
            start: new Date(`${e.den_od}T${startTime}`), // den_od + cas_od
            end: new Date(`${e.den_do ?? e.den_od}T${endTime}`), // den_do + cas_do
            event_id: e.event_id,
            typ: e.typ,
            puvodni_start: new Date(`${e.puvodni_den}T${startTimeOriginal}`),
            puvodni_end: new Date(`${e.puvodni_den}T${endTimeOriginal}`)

        }

    })

    return events
}
