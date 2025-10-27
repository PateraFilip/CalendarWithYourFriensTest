

const API_URL =
    'https://tzbpcbmxwbsixrtorijk.supabase.co/functions/v1/get_all_events'
const API_KEY =
    'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YnBjYm14d2JzaXhydG9yaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTIwMjEsImV4cCI6MjA3NTc2ODAyMX0.QTlHAHIPIJJ8FHDQowpZQIOckhHnAykn2CLbfJ2YbOw'

export const fetchEvents = async (): Promise<Event[]> => {
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

    const events: Event[] = data.map((e: any) => {
  // pokud cas_od nebo cas_do není, použij výchozí hodnoty
  const startTime = e.cas_od ?? '00:00'
  const endTime = e.cas_do ?? '23:59'

  return {
    id: e.id,
    title: e.nazev,
    user_id: e.zakladatel_id,
    pocet_lidi: e.pocet_lidi ?? 0,
    start: new Date(`${e.den_od}T${startTime}`), // den_od + cas_od
    end: new Date(`${e.den_do ?? e.den_od}T${endTime}`), // den_do + cas_do
    pravidelnost: !!e.pravidelnost,
    is_group: !!e.is_group,
  }
})

    return events
}
