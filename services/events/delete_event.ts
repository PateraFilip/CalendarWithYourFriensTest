import { supabase } from '@/lib/supabaseClient';

export const deleteEvent = async (id: number): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('event_series')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ Error deleting event:', error.message);
      throw new Error('Failed to delete event');
    }

    console.log('✅ Event deleted:', id);
    return true;
  } catch (err) {
    console.error('🔥 Exception:', err);
    return false;
  }
};