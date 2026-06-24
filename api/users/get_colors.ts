import { supabase } from '@/lib/supabaseClient';

interface Color {
    id: number;
    name: string;
    background_color: string;
    text_color: string;
    user_id: string | null;
    username?: string | null;
}

export const fetchColors = async (): Promise<Color[]> => {
    const { data, error } = await supabase
        .from('colors')
        .select(`
            *,
            users (
                username
            )
        `);

    if (error) {
        throw new Error(error.message || 'Failed to fetch colors');
    }

    const colors: Color[] = data.map((c: any) => {
        return {
            id: c.id,
            name: c.name,
            background_color: c.background_color,
            text_color: c.text_color,
            user_id: c.user_id,
            username: c.users?.username
        }
    })

    return colors
}
