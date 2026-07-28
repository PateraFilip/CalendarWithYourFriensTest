import { Platform } from 'react-native';
import type { Href } from 'expo-router';

type BackRouter = {
  back: () => void;
  canGoBack: () => boolean;
  replace: (href: Href) => void;
};

/** Předchozí položka historie je ze stejného originu (Navigation API). */
function canGoBackSameOrigin(): boolean | null {
  if (typeof window === 'undefined') return null;
  const nav = (window as Window & { navigation?: any }).navigation;
  if (!nav?.entries || !nav.currentEntry) return null;

  try {
    const entries = nav.entries();
    const idx = nav.currentEntry.index;
    if (idx <= 0) return false;
    const prev = new URL(entries[idx - 1].url);
    return prev.origin === window.location.origin;
  } catch {
    return null;
  }
}

/**
 * Spolehlivý návrat — na webu `router.back()` po refreshi / deep linku často nic neudělá.
 * Pořadí: same-origin browser history → Expo stack → konkrétní fallback route.
 */
export function safeGoBack(
  router: BackRouter,
  fallbackHref: Href = '/(tabs)'
) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const sameOrigin = canGoBackSameOrigin();
    if (sameOrigin === true) {
      window.history.back();
      return;
    }
    if (sameOrigin === false) {
      router.replace(fallbackHref);
      return;
    }
    // Navigation API není k dispozici — zkus Expo stack
  }

  try {
    if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back();
      return;
    }
  } catch {
    // ignore
  }

  router.replace(fallbackHref);
}
