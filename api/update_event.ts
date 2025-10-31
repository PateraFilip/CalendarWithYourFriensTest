import dayjs from 'dayjs';
import 'dayjs/locale/cs';

const API_URL_UPDATE =
  'https://tzbpcbmxwbsixrtorijk.supabase.co/functions/v1/update-event'

const API_URL_UPDATE_WEEKLY =
  'https://tzbpcbmxwbsixrtorijk.supabase.co/functions/v1/update-weekly-events'

const API_KEY =
  'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YnBjYm14d2JzaXhydG9yaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTIwMjEsImV4cCI6MjA3NTc2ODAyMX0.QTlHAHIPIJJ8FHDQowpZQIOckhHnAykn2CLbfJ2YbOw'

interface UpdateEventInput {
  id: number
  title: string
  start: Date
  end: Date | null
  peopleCount?: number
  pravidelnost?: boolean
  is_group?: boolean
}

interface UpdateWeeklyEventInput {
  title: string
  id: number
  start: Date
  end: Date | null
}

export const updateEvent = async (event: UpdateEventInput) => {
  const response = await fetch(API_URL_UPDATE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: API_KEY,
    },
    body: JSON.stringify({
      id: event.id,
      nazev: event.title,
      den_od: dayjs(event.start).format('YYYY-MM-DD'),
      cas_od: dayjs(event.start).format('HH:mm'),
      den_do: event.end ? dayjs(event.end).format('YYYY-MM-DD') : null,
      cas_do: event.end ? dayjs(event.end).format('HH:mm') : null,
      pocet_lidi: event.peopleCount ?? 1,
      pravidelnost: event.pravidelnost ?? false,
      is_group: event.is_group ?? false
    }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData?.error || 'Failed to update event')
  }

  return await response.json()
}

export const updateWeeklyEvent = async (event: UpdateWeeklyEventInput) => {
  const response = await fetch(API_URL_UPDATE_WEEKLY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: API_KEY,
    },
    body: JSON.stringify({
      id: event.id,
      nazev: event.title,
      cas_od: dayjs(event.start).format('HH:mm'),
      cas_do: event.end ? dayjs(event.end).format('HH:mm') : null,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData?.error || 'Failed to create event')
  }

  return await response.json()
}
