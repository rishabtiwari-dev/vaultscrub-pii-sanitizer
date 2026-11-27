export type CardNetwork =
  | 'Visa'
  | 'Mastercard'
  | 'Amex'
  | 'RuPay'
  | 'Discover'
  | 'Unknown';

const PAN_HOLDER_TYPES: Record<string, string> = {
  P: 'Individual',
  C: 'Company',
  H: 'HUF',
  F: 'Firm',
  A: 'AOP',
  T: 'Trust',
  B: 'BOI',
  L: 'Local Authority',
  J: 'Artificial Juridical Person',
  G: 'Government',
};

const PAN_REGEX = /^[A-Z]{3}[ABCFGHJLPT][A-Z][0-9]{4}[A-Z]$/;
const PAN_STANDARD_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

// Full dihedral D5 multiplication table
const VERHOEFF_D: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

// Full dihedral D5 permutation table
const VERHOEFF_P: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

// Dihedral D5 inverse table
const VERHOEFF_INV: readonly number[] = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

function stripSeparators(value: string): string {
  return value.replace(/[\s-]/g, '');
}

/**
 * Validates a numeric string using the Luhn (mod 10) checksum algorithm.
 */
export function isValidLuhn(digits: string): boolean {
  const clean = stripSeparators(digits);
  if (!/^\d{2,}$/.test(clean)) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;

  for (let i = clean.length - 1; i >= 0; i--) {
    let digit = clean.charCodeAt(i) - 48;
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

/**
 * Identifies the payment card network from leading IIN/BIN digits.
 */
export function detectCardNetwork(digits: string): CardNetwork {
  const clean = stripSeparators(digits);
  if (!/^\d+$/.test(clean)) {
    return 'Unknown';
  }

  if (/^3[47]/.test(clean)) {
    return 'Amex';
  }
  if (/^4/.test(clean)) {
    return 'Visa';
  }
  if (/^(?:5[1-5]|2(?:22[1-9]|2[3-9]\d|[3-6]\d\d|7[01]\d|720))/.test(clean)) {
    return 'Mastercard';
  }
  if (/^(?:60(?!11)|652[12]|81|82|508[5-9]|353|356)/.test(clean)) {
    return 'RuPay';
  }
  if (
    /^(?:6011|64[4-9]|65(?!2[12])|622(?:12[6-9]|1[3-9]\d|[2-8]\d\d|9[01]\d|92[0-5]))/.test(
      clean
    )
  ) {
    return 'Discover';
  }

  return 'Unknown';
}

/**
 * Validates a digit sequence using the dihedral D5 Verhoeff checksum algorithm.
 */
export function isValidVerhoeff(digits: string): boolean {
  const clean = stripSeparators(digits);
  if (!/^\d+$/.test(clean)) {
    return false;
  }

  let checksum = 0;
  for (let i = 0; i < clean.length; i++) {
    const digit = clean.charCodeAt(clean.length - 1 - i) - 48;
    checksum = VERHOEFF_D[checksum][VERHOEFF_P[i % 8][digit]];
  }

  return checksum === 0;
}

/**
 * Checks whether a string conforms to the Indian PAN structure.
 * When `strict` is true (default), enforces the 10 official 4th-character holder codes.
 */
export function isValidPan(pan: string, strict = true): boolean {
  const normalized = pan.trim().toUpperCase();
  return strict ? PAN_REGEX.test(normalized) : PAN_STANDARD_REGEX.test(normalized);
}

/**
 * Decodes the 4th character of an Indian PAN into the holder entity type.
 */
export function decodePanHolderType(pan: string): string {
  const normalized = pan.trim().toUpperCase();
  if (!PAN_REGEX.test(normalized)) {
    return 'Unknown';
  }
  return PAN_HOLDER_TYPES[normalized[3]] ?? 'Unknown';
}

/**
 * Validates strict dotted-quad IPv4 addresses (0-255 per octet, no leading zeros).
 */
export function isValidIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    return false;
  }

  for (const part of parts) {
    if (!/^(?:0|[1-9]\d{0,2})$/.test(part)) {
      return false;
    }
    const num = Number(part);
    if (num < 0 || num > 255) {
      return false;
    }
  }

  return true;
}

/**
 * Validates standard, compressed (::), and IPv4-mapped IPv6 addresses.
 */
export function isValidIPv6(ip: string): boolean {
  if (!ip || /\s/.test(ip) || !ip.includes(':')) {
    return false;
  }
  if (ip.includes(':::')) {
    return false;
  }

  const compressionSplits = ip.split('::');
  if (compressionSplits.length > 2) {
    return false;
  }

  const hasCompression = compressionSplits.length === 2;

  const parseSegment = (
    segment: string,
    allowTrailingIPv4: boolean
  ): { count: number; valid: boolean } => {
    if (segment === '') {
      return { count: 0, valid: true };
    }
    const parts = segment.split(':');
    let count = 0;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part === '') {
        return { count: 0, valid: false };
      }
      if (allowTrailingIPv4 && i === parts.length - 1 && part.includes('.')) {
        if (!isValidIPv4(part)) {
          return { count: 0, valid: false };
        }
        count += 2;
      } else if (/^[0-9a-fA-F]{1,4}$/.test(part)) {
        count += 1;
      } else {
        return { count: 0, valid: false };
      }
    }

    return { count, valid: true };
  };

  if (hasCompression) {
    const left = parseSegment(compressionSplits[0], false);
    const right = parseSegment(compressionSplits[1], true);
    if (!left.valid || !right.valid) {
      return false;
    }
    const totalGroups = left.count + right.count;
    return totalGroups < 8;
  }

  const full = parseSegment(ip, true);
  return full.valid && full.count === 8;
}

/**
 * Deterministically generates a Luhn-valid number of the requested length
 * starting with the supplied digit prefix.
 */
export function generateValidLuhn(prefix: string, length: number): string {
  const cleanPrefix = stripSeparators(prefix);
  if (!/^\d+$/.test(cleanPrefix)) {
    throw new Error('Prefix must contain only digits.');
  }
  if (length < cleanPrefix.length + 1) {
    throw new Error(
      `Target length (${length}) must exceed prefix length (${cleanPrefix.length}) by at least 1.`
    );
  }

  const payloadLength = length - 1;
  let payload = cleanPrefix;
  let fillIndex = 0;
  while (payload.length < payloadLength) {
    payload += String((fillIndex * 3 + 7) % 10);
    fillIndex++;
  }

  let sum = 0;
  let shouldDouble = true;
  for (let i = payload.length - 1; i >= 0; i--) {
    let digit = payload.charCodeAt(i) - 48;
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return `${payload}${checkDigit}`;
}

/**
 * Computes the Verhoeff check digit for an 11-digit base and returns a valid 12-digit ID.
 */
export function generateValidVerhoeff12(first11Digits: string): string {
  const clean = stripSeparators(first11Digits);
  if (!/^\d{11}$/.test(clean)) {
    throw new Error('first11Digits must contain exactly 11 digits.');
  }

  let checksum = 0;
  for (let i = 0; i < clean.length; i++) {
    const digit = clean.charCodeAt(clean.length - 1 - i) - 48;
    checksum = VERHOEFF_D[checksum][VERHOEFF_P[(i + 1) % 8][digit]];
  }

  const checkDigit = VERHOEFF_INV[checksum];
  return `${clean}${checkDigit}`;
}
