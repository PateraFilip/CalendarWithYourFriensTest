import { User } from '@/types/user'

const API_URL =
    'https://tzbpcbmxwbsixrtorijk.supabase.co/functions/v1/smart-processor'
const API_KEY =
    'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YnBjYm14d2JzaXhydG9yaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTIwMjEsImV4cCI6MjA3NTc2ODAyMX0.QTlHAHIPIJJ8FHDQowpZQIOckhHnAykn2CLbfJ2YbOw'

export const authenticate = async (
    username: string,
    password: string
): Promise<User> => {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: API_KEY,
        },
        body: JSON.stringify({ username, password, action: 'login' }),
    })

    const data = await response.json()

    if (!response.ok) {
        throw new Error(data.error || 'Přihlášení selhalo')
    }

    return data.user as User
}
