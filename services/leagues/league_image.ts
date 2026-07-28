import { supabase } from '@/lib/supabaseClient';
import { decodeBase64 } from '@/lib/base64';
import { Platform } from 'react-native';

export type PickedLeagueImage = {
  uri: string;
  mimeType: string;
  /** Preferováno na native — Blob upload na Androidu padá. */
  base64?: string;
};

/**
 * Native expo-image-picker musí být v dev clientu (npx expo run:android).
 * Dokud native modul chybí, na webu fallback na input file;
 * na Androidu ukážeme jasnou hlášku místo pádu celé appky.
 */
async function pickWithExpoImagePicker(): Promise<PickedLeagueImage | null> {
  // Lazy require — nesmí být top-level, jinak spadne celá route bez native buildu.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');

  if (Platform.OS !== 'web') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      alert('Bez přístupu k fotkám nejde obrázek nahrát.');
      return null;
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
    base64: Platform.OS !== 'web',
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    mimeType: asset.mimeType || 'image/jpeg',
    base64: asset.base64 ?? undefined,
  };
}

function pickWithHtmlInput(): Promise<PickedLeagueImage | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const uri = URL.createObjectURL(file);
      resolve({ uri, mimeType: file.type || 'image/jpeg' });
    };
    input.click();
  });
}

/** Otevře galerii a vrátí lokální URI (čtvercový crop). */
export async function pickLeagueImage(): Promise<PickedLeagueImage | null> {
  if (Platform.OS === 'web') {
    try {
      return await pickWithExpoImagePicker();
    } catch {
      return pickWithHtmlInput();
    }
  }

  try {
    return await pickWithExpoImagePicker();
  } catch (e: any) {
    const msg = String(e?.message || e || '');
    console.error(e);
    if (
      msg.includes('ExponentImagePicker') ||
      msg.includes('native module') ||
      msg.includes('Cannot find native module')
    ) {
      alert(
        'Výběr fotky vyžaduje nový native build.\n\nSpusť v projektu:\nnpx expo run:android'
      );
      return null;
    }
    alert('Nepodařilo se otevřít výběr fotky.');
    return null;
  }
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('gif')) return 'gif';
  return 'jpg';
}

async function bodyForUpload(image: PickedLeagueImage): Promise<ArrayBuffer | Blob> {
  // React Native / Android: Blob/FormData často končí "Network request failed".
  // Oficiální doporučení Supabase = ArrayBuffer z base64.
  if (image.base64) {
    return decodeBase64(image.base64);
  }

  if (Platform.OS !== 'web') {
    throw new Error(
      'Chybí base64 data obrázku. Zkus fotku vybrat znovu.'
    );
  }

  const response = await fetch(image.uri);
  return await response.blob();
}

/** Nahraje cover do Storage a vrátí public URL. */
export async function uploadLeagueCover(
  userId: string,
  leagueId: number,
  image: PickedLeagueImage
): Promise<string> {
  const mime = image.mimeType || 'image/jpeg';
  const ext = extensionForMime(mime);
  const path = `${userId}/${leagueId}-${Date.now()}.${ext}`;

  const body = await bodyForUpload(image);

  const { error } = await supabase.storage.from('league-covers').upload(path, body, {
    contentType: mime,
    upsert: true,
  });

  if (error) throw error;

  const { data } = supabase.storage.from('league-covers').getPublicUrl(path);
  return data.publicUrl;
}

export async function updateLeagueImageUrl(
  leagueId: number,
  imageUrl: string | null
): Promise<void> {
  const { error } = await supabase
    .from('leagues')
    .update({
      image_url: imageUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leagueId);

  if (error) throw error;
}
