const API_URL =
  'https://tzbpcbmxwbsixrtorijk.supabase.co/functions/v1/delete-event';

const API_URL_WEEKLY =
  'https://tzbpcbmxwbsixrtorijk.supabase.co/functions/v1/delete-weekly-event';

const API_KEY =
  'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YnBjYm14d2JzaXhydG9yaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTIwMjEsImV4cCI6MjA3NTc2ODAyMX0.QTlHAHIPIJJ8FHDQowpZQIOckhHnAykn2CLbfJ2YbOw';

export const deleteEvent = async (id: number): Promise<boolean> => {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: API_KEY,
      },
      body: JSON.stringify({ id }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('❌ Error deleting event:', errText);
      throw new Error('Failed to delete event');
    }

    const data = await response.json();
    console.log('✅ Event deleted:', data);

    return true;
  } catch (err) {
    console.error('🔥 Exception:', err);
    return false;
  }
};

export const deleteWeeklyEvent = async (id: number): Promise<boolean> => {
  try {
    const response = await fetch(API_URL_WEEKLY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: API_KEY,
      },
      body: JSON.stringify({ id }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('❌ Error deleting event:', errText);
      throw new Error('Failed to delete event');
    }

    const data = await response.json();
    console.log('✅ Event deleted:', data);

    return true;
  } catch (err) {
    console.error('🔥 Exception:', err);
    return false;
  }
};