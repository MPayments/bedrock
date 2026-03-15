import type { RequisiteFieldsInput } from "./requisite-fields";
import { resolveRequisiteIdentity } from "./requisite-fields";

export function buildRequisiteOptionLabel(input: {
  label: string;
  currencyCode?: string | null;
} & RequisiteFieldsInput): string {
  const identity = resolveRequisiteIdentity(input);
  const parts = [input.label.trim()];

  if (identity) {
    parts.push(identity);
  }

  if (input.currencyCode && input.currencyCode.trim().length > 0) {
    parts.push(input.currencyCode.trim().toUpperCase());
  }

  return parts.join(" · ");
}
