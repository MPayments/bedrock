export function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function hasOnlyAsciiDigits(value: string): boolean {
  if (value.length === 0) {
    return false;
  }

  for (const char of value) {
    if (char < "0" || char > "9") {
      return false;
    }
  }

  return true;
}

export function isDecimalString(value: string): boolean {
  const separatorIndex = value.indexOf(".");

  if (separatorIndex === -1) {
    return value === "0" || (value[0] !== "0" && hasOnlyAsciiDigits(value));
  }

  if (
    separatorIndex === 0 ||
    separatorIndex === value.length - 1 ||
    separatorIndex !== value.lastIndexOf(".")
  ) {
    return false;
  }

  const whole = value.slice(0, separatorIndex);
  const fraction = value.slice(separatorIndex + 1);

  if (!hasOnlyAsciiDigits(fraction)) {
    return false;
  }

  return whole === "0" || (whole[0] !== "0" && hasOnlyAsciiDigits(whole));
}
