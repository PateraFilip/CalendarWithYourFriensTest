/** Decode standard base64 into ArrayBuffer (RN-friendly, no extra deps). */
export function decodeBase64(base64: string): ArrayBuffer {
  const cleaned = base64.replace(/[\r\n\s]/g, '');
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

  const len = cleaned.length;
  const padding =
    cleaned.endsWith('==') ? 2 : cleaned.endsWith('=') ? 1 : 0;
  const byteLength = ((len * 3) / 4) | 0;
  const bytes = new Uint8Array(byteLength - padding);

  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const a = lookup[cleaned.charCodeAt(i)];
    const b = lookup[cleaned.charCodeAt(i + 1)];
    const c = lookup[cleaned.charCodeAt(i + 2)];
    const d = lookup[cleaned.charCodeAt(i + 3)];

    bytes[p++] = (a << 2) | (b >> 4);
    if (p < bytes.length) bytes[p++] = ((b & 15) << 4) | (c >> 2);
    if (p < bytes.length) bytes[p++] = ((c & 3) << 6) | d;
  }

  return bytes.buffer;
}
