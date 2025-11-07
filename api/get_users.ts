interface User {
    id: number;
    username: string;
    jmeno: string;
    prijmeni: string;
    email: string;
    datum_narozeni: string
}

const API_URL =
    'https://tzbpcbmxwbsixrtorijk.supabase.co/functions/v1/get-users'
const API_KEY =
    'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YnBjYm14d2JzaXhydG9yaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTIwMjEsImV4cCI6MjA3NTc2ODAyMX0.QTlHAHIPIJJ8FHDQowpZQIOckhHnAykn2CLbfJ2YbOw'

export const fetchUsers = async (): Promise<User[]> => {
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

    const users: User[] = data.map((u: any) => {

        return {
            id: u.id,
            username: u.username,
            jmeno: u.jmeno,
            prijmeni: u.prijmeni,
            email: u.email,
            datum_narozeni: u.datum_narozeni
        }
    })

    return users
}
