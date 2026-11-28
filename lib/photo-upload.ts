/** Re-encode every upload: caps the long side at 2048px, keeps photos small for the gallery, and strips EXIF (incl. GPS). */
const MAX_SIDE = 2048;
export async function preparePhoto(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.86));
    return blob && blob.type === 'image/jpeg' ? blob : file;
  } catch {
    return file;
  }
}
/** POST JSON fields plus the photo as raw bytes (multipart), so the server never decodes base64. */
export async function postWithPhoto(path: string, data: object, photo: Blob, key?: string) {
  const form = new FormData();
  form.append('data', JSON.stringify(data));
  form.append('photo', photo, 'photo');
  const r = await fetch(path, { method: 'POST', body: form, headers: key ? { Authorization: 'Bearer ' + key } : {} });
  const d = (await r.json().catch(() => null)) as { error?: string } | null;
  if (!r.ok) throw Error(d?.error || 'Upload failed. Your draft is kept; please retry.');
  return d as Record<string, unknown>;
}
