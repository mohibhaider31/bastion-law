import { File } from 'expo-file-system';
import { supabase } from './supabase';

export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
}

/**
 * Upload a picked file to the `documents` storage bucket and return its public URL.
 * Uses expo-file-system's File API (not fetch().blob(), which uploads 0-byte files
 * on React Native) to read real bytes into an ArrayBuffer.
 */
export async function uploadToBucket(file: PickedFile, path: string): Promise<{ url: string; sizeKb: number } | null> {
  try {
    const bytes = await new File(file.uri).arrayBuffer();
    const { error } = await supabase.storage
      .from('documents')
      .upload(path, bytes, { upsert: true, contentType: file.mimeType });
    if (error) return null;
    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path);
    return { url: publicUrl, sizeKb: Math.max(1, Math.round(bytes.byteLength / 1024)) };
  } catch {
    return null;
  }
}
