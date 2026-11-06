// the first bytes of a file say what it really is, whatever name or Content-Type it was sent with
const SIGNATURES: Record<string, (bytes: Uint8Array) => boolean> = {
  'image/png': (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/jpeg': (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  // RIFF....WEBP
  'image/webp': (b) => startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8),
};

export const SIGNATURE_BYTES = 12;

export function matchesImageSignature(contentType: string, bytes: Uint8Array): boolean {
  const check = SIGNATURES[contentType];
  return !!check && check(bytes);
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((value, i) => bytes[offset + i] === value);
}
