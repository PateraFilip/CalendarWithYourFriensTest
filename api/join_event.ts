import 'dayjs/locale/cs';

const API_URL_JOIN =
  'https://tzbpcbmxwbsixrtorijk.supabase.co/functions/v1/join-event'

const API_KEY =
  'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YnBjYm14d2JzaXhydG9yaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTIwMjEsImV4cCI6MjA3NTc2ODAyMX0.QTlHAHIPIJJ8FHDQowpZQIOckhHnAykn2CLbfJ2YbOw'

interface JoinEvent {
  user_id: number
  event_id: number
}


export const joinEvent = async (event: JoinEvent) => {
  const response = await fetch(API_URL_JOIN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: API_KEY,
    },
    body: JSON.stringify({
      event_id: event.event_id,
      user_id: event.user_id,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData?.error || 'Failed to join event')
  }

  return await response.json()
}
