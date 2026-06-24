import { loadStorage, saveStorage } from '@/lib/storage';

export interface NotificationSettings {
    enabled: boolean;
    eventChanges: boolean;
    chatMessages: boolean;
    groupEvents: boolean;
}

const STORAGE_KEY = 'notificationSettings';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
    enabled: true,
    eventChanges: true,
    chatMessages: true,
    groupEvents: true,
};

export async function loadNotificationSettings(): Promise<NotificationSettings> {
    try {
        const stored = await loadStorage(STORAGE_KEY);
        if (!stored) return { ...DEFAULT_NOTIFICATION_SETTINGS };
        return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(stored) };
    } catch {
        return { ...DEFAULT_NOTIFICATION_SETTINGS };
    }
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
    await saveStorage(STORAGE_KEY, JSON.stringify(settings));
}
