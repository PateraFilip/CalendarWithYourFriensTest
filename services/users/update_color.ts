import { supabase } from '@/lib/supabaseClient';

export const updateColor = async (color_id: number, user_id: number | string) => {
    // Nejprve odebereme uživateli jeho stávající barvu
    await supabase
        .from('colors')
        .update({ user_id: null })
        .eq('user_id', user_id);

    // Přiřadíme novou barvu
    const { data, error } = await supabase
        .from('colors')
        .update({ user_id: user_id })
        .eq('id', color_id)
        .select()
        .single();

    if (error) {
        throw new Error(error.message || 'Failed to update color');
    }

    return data;
}

