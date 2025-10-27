const API_URL =
    'https://tzbpcbmxwbsixrtorijk.supabase.co/functions/v1/get-weekly-events'
const API_KEY =
    'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YnBjYm14d2JzaXhydG9yaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTIwMjEsImV4cCI6MjA3NTc2ODAyMX0.QTlHAHIPIJJ8FHDQowpZQIOckhHnAykn2CLbfJ2YbOw'


interface WeeklyEvent {
  title: string;
  cas_od: Date;
  cas_do: Date;
  user_id: number;
  den: string;
}
export const fetchWeeklyEvents = async (): Promise<WeeklyEvent[]> => {
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
    console.log(data)

    const events: WeeklyEvent[] = data.map((e: any) => {

  return {
    title: e.nazev,
    user_id: e.zakladatel_id,
    den: e.den,
    cas_od: new Date(1970, 0, 1, parseInt(e.cas_od.split(':')[0]), parseInt(e.cas_od.split(':')[1])),
    cas_do: new Date(1970, 0, 1, parseInt(e.cas_do.split(':')[0]), parseInt(e.cas_do.split(':')[1])), // den_od + cas_od
  }
})

console.log(events)
    return events
}
