import dayjs from 'dayjs';
import 'dayjs/locale/cs';

const API_URL_CREATE =
    'https://tzbpcbmxwbsixrtorijk.supabase.co/functions/v1/add-weekly-exception'

const API_KEY =
    'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YnBjYm14d2JzaXhydG9yaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTIwMjEsImV4cCI6MjA3NTc2ODAyMX0.QTlHAHIPIJJ8FHDQowpZQIOckhHnAykn2CLbfJ2YbOw'

interface CreateExceptionInput {
    event_id: number
    start: Date
    end: Date | null
    typ: string
    puvodni_den: Date
    puvodni_cas_od: Date
    puvodni_cas_do: Date
}

export const createException = async (event: CreateExceptionInput) => {
    const response = await fetch(API_URL_CREATE, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: API_KEY,
        },
        body: JSON.stringify({
            event_id: event.event_id,
            den_od: dayjs(event.start).format('YYYY-MM-DD'),
            cas_od: dayjs(event.start).format('HH:mm'),
            den_do: event.end ? dayjs(event.end).format('YYYY-MM-DD') : null,
            cas_do: event.end ? dayjs(event.end).format('HH:mm') : null,
            typ: event.typ,
            puvodni_den: dayjs(event.puvodni_den).format('YYYY-MM-DD'),
            puvodni_cas_od: dayjs(event.puvodni_cas_od).format('HH:mm'),
            puvodni_cas_do: dayjs(event.puvodni_cas_do).format('HH:mm'),
        }),
    })

    if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData?.error || 'Failed to create event')
    }

    return await response.json()
}


