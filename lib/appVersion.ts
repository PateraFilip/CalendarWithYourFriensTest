import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const WEB_APP_URL = 'https://share-calendar-with-your-friends.vercel.app/';
export const VERSION_CHECK_URL = `${WEB_APP_URL}version.json`;

/** APK hostuj na GitHub Releases (ne v gitu — limit 100 MB). */
export const DEFAULT_APK_URL =
  'https://github.com/PateraFilip/CalendarWithYourFriensTest/releases/download/v1.0.0/CalendarWithFriends.apk';

export type RemoteVersionInfo = {
  latestVersion: string;
  minVersion?: string;
  updateUrl?: string;
  apkUrl?: string;
  message?: string;
};

export type VersionCheckResult = {
  currentVersion: string;
  latestVersion: string;
  updateRequired: boolean;
  forceUpdate: boolean;
  updateUrl: string;
  apkUrl: string;
  message: string;
};

export function getCurrentAppVersion(): string {
  return (
    Constants.expoConfig?.version ||
    Constants.nativeAppVersion ||
    '0.0.0'
  );
}

/** Porovná semver a/b (1.2.3). Záporné = a < b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da < db) return -1;
    if (da > db) return 1;
  }
  return 0;
}

export async function checkForAppUpdate(): Promise<VersionCheckResult | null> {
  if (Platform.OS === 'web') return null;

  try {
    const res = await fetch(VERSION_CHECK_URL, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as RemoteVersionInfo;
    if (!data?.latestVersion) return null;

    const currentVersion = getCurrentAppVersion();
    const latestVersion = String(data.latestVersion);
    const minVersion = String(data.minVersion || data.latestVersion);
    const outdated = compareVersions(currentVersion, latestVersion) < 0;
    const belowMin = compareVersions(currentVersion, minVersion) < 0;

    if (!outdated && !belowMin) return null;

    return {
      currentVersion,
      latestVersion,
      updateRequired: true,
      forceUpdate: belowMin,
      updateUrl: data.updateUrl || WEB_APP_URL,
      apkUrl: data.apkUrl || DEFAULT_APK_URL,
      message:
        data.message ||
        'Je dostupná nová verze aplikace. Stáhni ji z webu.',
    };
  } catch (e) {
    console.warn('[version] check failed:', e);
    return null;
  }
}
