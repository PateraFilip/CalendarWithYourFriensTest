const API_URL_CREATE =
  'https://tzbpcbmxwbsixrtorijk.supabase.co/functions/v1/clever-service'
const API_KEY =
  'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YnBjYm14d2JzaXhydG9yaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTIwMjEsImV4cCI6MjA3NTc2ODAyMX0.QTlHAHIPIJJ8FHDQowpZQIOckhHnAykn2CLbfJ2YbOw'

interface CreateEventInput {
  title: string
  user_id: number
  start: Date
  end: Date | null
  peopleCount?: number
  pravidelnost?: boolean
  is_group?: boolean
}

export const createEvent = async (event: CreateEventInput) => {
  const response = await fetch(API_URL_CREATE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: API_KEY,
    },
    body: JSON.stringify({
      nazev: event.title,
      zakladatel_id: event.user_id,
      den_od: event.start.toISOString().split('T')[0],
      cas_od: event.start.toISOString().split('T')[1].slice(0, 5),
      den_do: event.end ? event.end.toISOString().split('T')[0] : null,
      cas_do: event.end ? event.end.toISOString().split('T')[1].slice(0, 5) : null,
      pocet_lidi: event.peopleCount ?? 1,
      pravidelnost: event.pravidelnost ?? false,
      is_group: event.is_group ?? false,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData?.error || 'Failed to create event')
  }

  return await response.json()
}
