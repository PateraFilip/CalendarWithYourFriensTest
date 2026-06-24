// hooks/useNotificationHandler.web.ts

export async function requestUserPermission() {
  return 'denied';
}

export function useNotificationHandler() {
  // no-op on web
}

export async function useRealtimeNotifications(payload: { eventType?: string; new?: Record<string, unknown> }, user: { id: number } | null) {
  // no-op on web
}

export async function notifyChatMessage(eventTitle: string, eventId: number, senderName: string) {
  // no-op on web
}
