import { removeStorage, saveStorage, loadStorage } from '@/lib/storage';

export const WEB_PUSH_DISMISS_KEY = 'webPushPromptDismissed_v2';

export async function clearWebPushPromptDismiss() {
  await removeStorage(WEB_PUSH_DISMISS_KEY);
}

export async function dismissWebPushPrompt() {
  await saveStorage(WEB_PUSH_DISMISS_KEY, 'true');
}

export async function isWebPushPromptDismissed() {
  return (await loadStorage(WEB_PUSH_DISMISS_KEY)) === 'true';
}

export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}
