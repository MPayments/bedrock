import type { PartyProfileBundleInput } from "./contracts";

export type PartyProfileValidationErrors = Record<string, string>;

const REQUIRED_MESSAGE = "Заполните поле";

function pushIfEmpty(
  errors: PartyProfileValidationErrors,
  path: string,
  value: string | null | undefined,
  message: string = REQUIRED_MESSAGE,
) {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors[path] = message;
  }
}

/**
 * Mirrors the server-side `PartyProfileBundleInputSchema` for the subset of
 * required fields that otherwise surface as a 400 from the API. Keep in sync
 * with `packages/modules/parties/.../contracts.ts`.
 */
export function validatePartyProfileBundle(
  bundle: PartyProfileBundleInput | null | undefined,
): PartyProfileValidationErrors {
  const errors: PartyProfileValidationErrors = {};

  if (!bundle) {
    return errors;
  }

  bundle.identifiers.forEach((identifier, index) => {
    pushIfEmpty(errors, `identifiers.${index}.value`, identifier.value);
  });

  bundle.contacts.forEach((contact, index) => {
    pushIfEmpty(errors, `contacts.${index}.value`, contact.value);
  });

  bundle.representatives.forEach((representative, index) => {
    pushIfEmpty(
      errors,
      `representatives.${index}.fullName`,
      representative.fullName,
    );
  });

  bundle.licenses.forEach((license, index) => {
    pushIfEmpty(errors, `licenses.${index}.licenseNumber`, license.licenseNumber);
  });

  return errors;
}

export function hasPartyProfileValidationErrors(
  errors: PartyProfileValidationErrors,
): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Parses a Zod error string (as returned by the API) into a
 * `PartyProfileValidationErrors` map keyed by `partyProfile.<path>`-style paths.
 * Paths not rooted under `partyProfile.<subpath>` are ignored; subpath is
 * returned as-is (dot-joined).
 */
export function parsePartyProfileZodErrorMessage(
  message: unknown,
): PartyProfileValidationErrors {
  if (typeof message !== "string" || message.trim().length === 0) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(message);
  } catch {
    return {};
  }

  if (!Array.isArray(parsed)) {
    return {};
  }

  const errors: PartyProfileValidationErrors = {};
  for (const issue of parsed) {
    if (
      !issue ||
      typeof issue !== "object" ||
      !("path" in issue) ||
      !Array.isArray(issue.path) ||
      !("message" in issue) ||
      typeof issue.message !== "string"
    ) {
      continue;
    }

    const path = issue.path.map((segment: unknown) => String(segment));
    const root = path[0];
    if (root !== "partyProfile" || path.length < 2) {
      continue;
    }

    const key = path.slice(1).join(".");
    if (!(key in errors)) {
      errors[key] = issue.message;
    }
  }

  return errors;
}
