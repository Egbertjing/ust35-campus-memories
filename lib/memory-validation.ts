/** Shared client validation, matching server restrictions. */
export function validatePhoto(file: Pick<File, 'type' | 'size'>): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Choose a JPG, PNG or WebP image.';
  if (file.size <= 0 || file.size > 8 * 1024 * 1024) return 'Choose an image between 1 byte and 8 MB.';
  return null;
}
export function validMemoryDate(value: string): boolean {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y,m,d]=value.split('-').map(Number);
  if(y<1||y>9999||m<1||m>12||d<1)return false;
  const leap=y%4===0&&(y%100!==0||y%400===0);
  return d <= [31,leap?29:28,31,30,31,30,31,31,30,31,30,31][m-1];
}
