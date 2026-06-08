import { supabase } from '../lib/supabaseClient';

export const RECEIPTS_BUCKET = 'receipts';

/**
 * Extrae el path dentro del bucket a partir del valor almacenado en
 * transactions.receiptUrl. Soporta tanto los valores nuevos (solo el path,
 * ej. "{org}/{year}/archivo.jpg") como los antiguos (URL pública/firmada
 * completa de Supabase Storage). Devuelve null si no hay nada.
 */
export const extractReceiptPath = (stored?: string | null): string | null => {
  if (!stored) return null;
  const marker = '/receipts/';
  const idx = stored.indexOf(marker);
  let path = idx >= 0 ? stored.substring(idx + marker.length) : stored;
  // Quitar cualquier query string (ej. ?token=... de una signed URL previa).
  path = path.split('?')[0];
  return path || null;
};

/**
 * Genera una signed URL temporal para mostrar/descargar un recibo desde el
 * bucket privado. El miembro debe tener permiso de lectura (RLS) sobre el
 * objeto; la URL resultante caduca (por defecto 1 hora).
 */
export const getReceiptSignedUrl = async (
  stored?: string | null,
  expiresIn = 3600,
): Promise<string | null> => {
  const path = extractReceiptPath(stored);
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) {
    console.warn('No se pudo firmar el recibo:', error.message);
    return null;
  }
  return data?.signedUrl ?? null;
};
