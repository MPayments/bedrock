import { ValidationError } from "@bedrock/shared/core/errors";

export function assertUniqueLegalIdentifierSchemes<
  T extends { scheme: string },
>(items: readonly T[]) {
  const counts = new Map<string, number>();

  for (const item of items) {
    counts.set(item.scheme, (counts.get(item.scheme) ?? 0) + 1);
  }

  for (const [scheme, count] of counts) {
    if (count > 1) {
      throw new ValidationError(`Only one identifier is allowed for ${scheme}`);
    }
  }
}
