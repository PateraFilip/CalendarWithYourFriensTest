const API_URL =
    'https://tzbpcbmxwbsixrtorijk.supabase.co/functions/v1/get-user-events'
const API_KEY =
    'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YnBjYm14d2JzaXhydG9yaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTIwMjEsImV4cCI6MjA3NTc2ODAyMX0.QTlHAHIPIJJ8FHDQowpZQIOckhHnAykn2CLbfJ2YbOw'


    interface UserEvent {
    event_id: number;
  user_id: number;
}
export const fetchUserEvents = async (): Promise<UserEvent[]> => {
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

    const events: UserEvent[] = data.map((e: any) => {


  return {
    event_id: e.event_id,
    user_id: e.user_id
  }
})


    return events
}
