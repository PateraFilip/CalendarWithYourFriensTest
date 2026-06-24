import { supabase } from '@/lib/supabaseClient';

interface User {
    id: number;
    username: string;
    jmeno: string;
    prijmeni: string;
    email: string;
    datum_narozeni: string
}

export const fetchUsers = async (): Promise<User[]> => {
    const { data, error } = await supabase
        .from('users')
        .select('id, username, jmeno, prijmeni, email, datum_narozeni');

    if (error) {
        throw new Error(error.message || 'Failed to fetch users');
    }

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
