import { Alert, Platform } from 'react-native';

/** Jednoduchá hláška — na webu window.alert (RN Alert.alert tam často nic neudělá). */
export function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.alert(message ? `${title}\n\n${message}` : title);
    }
    return;
  }
  Alert.alert(title, message);
}

/** Hláška a pak callback (např. router.back po uložení). */
export function showAlertThen(
  title: string,
  message: string,
  onOk: () => void
) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.alert(message ? `${title}\n\n${message}` : title);
    }
    onOk();
    return;
  }
  Alert.alert(title, message, [{ text: 'OK', onPress: onOk }]);
}

/** Potvrzení — na webu window.confirm. */
export function showConfirm(
  title: string,
  message: string,
  onConfirm: () => void | Promise<void>,
  opts?: { confirmLabel?: string; destructive?: boolean }
) {
  const confirmLabel = opts?.confirmLabel ?? 'OK';

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) {
      void onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: 'Zrušit', style: 'cancel' },
    {
      text: confirmLabel,
      style: opts?.destructive ? 'destructive' : 'default',
      onPress: () => {
        void onConfirm();
      },
    },
  ]);
}
