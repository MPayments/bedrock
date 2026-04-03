import { stableStringify } from "@bedrock/shared/core/canon";
import { sha256Hex } from "@bedrock/shared/core/crypto";

import type { Dimensions } from "./dimensions";

export function computeDimensionsHash(dimensions: Dimensions): string {
  const sorted = Object.keys(dimensions)
    .sort()
    .reduce<Record<string, string>>((acc, key) => {
      acc[key] = dimensions[key]!;
      return acc;
    }, {});

  return sha256Hex(stableStringify(sorted));
}
