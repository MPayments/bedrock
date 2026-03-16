import type { z } from "zod";

import { DocumentValidationError } from "./errors";

export function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown,
  context?: string,
): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path?.join(".");
    const prefix = context ? `${context}: ` : "";
    throw new DocumentValidationError(
      path
        ? `${prefix}${path}: ${issue?.message ?? result.error.message}`
        : `${prefix}${issue?.message ?? result.error.message}`,
    );
  }

  return result.data;
}
