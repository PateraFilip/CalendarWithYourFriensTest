// lib/push-notifications.d.ts
export declare function registerAndSavePushToken(
  userId: string,
  opts?: { skipPermissionRequest?: boolean }
): Promise<string | null>;
