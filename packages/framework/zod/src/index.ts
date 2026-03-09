import { z } from "zod";

function withPrefix(prefix: string) {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}[:_\\-a-zA-Z0-9]+$`);
}

export function id(prefix: string) {
  return z.string().min(1).regex(withPrefix(prefix));
}

export function email() {
  return z.email();
}

export function countryCode() {
  return z.string().length(2).regex(/^[A-Z]{2}$/);
}

export function assetCode() {
  return z.string().min(3).max(12).regex(/^[A-Z0-9]+$/);
}

export function minor() {
  return z.bigint();
}

export function money() {
  return z.object({
    amountMinor: z.bigint(),
    asset: assetCode(),
  });
}

export const fz = {
  id,
  email,
  countryCode,
  assetCode,
  money,
  minor,
};

export { z };
