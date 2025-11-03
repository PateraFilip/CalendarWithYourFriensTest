import { User } from '@/types/user'

const API_URL =
    'https://tzbpcbmxwbsixrtorijk.supabase.co/functions/v1/register'
const API_KEY =
    'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YnBjYm14d2JzaXhydG9yaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTIwMjEsImV4cCI6MjA3NTc2ODAyMX0.QTlHAHIPIJJ8FHDQowpZQIOckhHnAykn2CLbfJ2YbOw'

export const register = async (
    username: string,
    password: string,
    email: string,
    firstname: string,
    lastname: string,
    birthDate: string,
    colorId: number
): Promise<User> => {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: API_KEY,
        },
        body: JSON.stringify({ username, password, email, firstname, lastname, birthDate, colorId }),
    })

    const data = await response.json()

    if (!response.ok) {
        throw new Error(data.error || 'Registrace selhala!')
    }

    return data.user as User
}
