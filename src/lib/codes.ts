// Public product codes: short uppercase letter/digit ids like "7K2Q" used in
// product URLs instead of names or colors. Shared by the admin API, the
// seed and migration scripts, so it avoids server-only imports.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const MIN_CODE_LENGTH = 4;
export const CODE_PATTERN = /^[A-Z0-9]{4,12}$/;

function randomCode(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  // 256 isn't a multiple of 36; the tiny bias is irrelevant for ids.
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/**
 * Returns `count` new codes that aren't in `taken` (and adds them to it).
 * Starts at 4 characters and only grows if 4-character space is nearly
 * exhausted (repeated collisions), so codes stay as short as possible.
 */
export function generateCodes(count: number, taken: Set<string>): string[] {
  const out: string[] = [];
  let length = MIN_CODE_LENGTH;
  let misses = 0;
  while (out.length < count) {
    const code = randomCode(length);
    if (taken.has(code)) {
      if (++misses > 50) {
        length++;
        misses = 0;
      }
      continue;
    }
    taken.add(code);
    out.push(code);
  }
  return out;
}
