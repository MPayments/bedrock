const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghjkmnpqrstuvwxyz";
const DIGITS = "23456789";
const SPECIAL = "!@#$%&*?";
const ALL = UPPER + LOWER + DIGITS + SPECIAL;

function randomIndex(max: number): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0]! % max;
}

function pickRandom(charset: string): string {
  return charset[randomIndex(charset.length)]!;
}

export function generatePassword(length = 20): string {
  const safeLength = Math.max(length, 4);
  const required = [
    pickRandom(UPPER),
    pickRandom(LOWER),
    pickRandom(DIGITS),
    pickRandom(SPECIAL),
  ];

  const rest = Array.from({ length: safeLength - required.length }, () =>
    pickRandom(ALL),
  );

  const chars = [...required, ...rest];

  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }

  return chars.join("");
}
