interface Color {
    id: number;
    name: string;
    background_color: string;
    text_color: string;
    user_id: number;
}

const API_URL =
    'https://tzbpcbmxwbsixrtorijk.supabase.co/functions/v1/get-colors'
const API_KEY =
    'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YnBjYm14d2JzaXhydG9yaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTIwMjEsImV4cCI6MjA3NTc2ODAyMX0.QTlHAHIPIJJ8FHDQowpZQIOckhHnAykn2CLbfJ2YbOw'

export const fetchColors = async (): Promise<Color[]> => {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: API_KEY,
        },
    })

    if (!response.ok) {
        throw new Error('Failed to fetch colors')
    }

    const data = await response.json()

    const colors: Color[] = data.map((c: any) => {

        return {
            id: c.id,
            name: c.name,
            background_color: c.background_color,
            text_color: c.text_color,
            user_id: c.user_id
        }
    })

    return colors
}
