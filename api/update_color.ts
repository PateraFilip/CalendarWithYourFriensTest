import 'dayjs/locale/cs';

const API_URL_UPDATE =
    'https://tzbpcbmxwbsixrtorijk.supabase.co/functions/v1/update-color'

const API_KEY =
    'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YnBjYm14d2JzaXhydG9yaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTIwMjEsImV4cCI6MjA3NTc2ODAyMX0.QTlHAHIPIJJ8FHDQowpZQIOckhHnAykn2CLbfJ2YbOw'


export const updateColor = async (color_id: number, user_id: number) => {
    const response = await fetch(API_URL_UPDATE, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: API_KEY,
        },
        body: JSON.stringify({
            id: color_id,
            user_id: user_id
        }),
    })

    if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData?.error || 'Failed to update event')
    }

    return await response.json()
}

