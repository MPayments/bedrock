import { invariant } from "@bedrock/shared/core/domain";

import type { IntentLine } from "./operation-intent";

export function validateChainBlocks(lines: IntentLine[]): void {
  const positionsByChain = new Map<string, number[]>();

  for (let index = 0; index < lines.length; index += 1) {
    const chain = lines[index]!.chain;
    if (!chain) {
      continue;
    }

    const positions = positionsByChain.get(chain) ?? [];
    positions.push(index);
    positionsByChain.set(chain, positions);
  }

  for (const [chain, positions] of positionsByChain) {
    for (let index = 1; index < positions.length; index += 1) {
      const currentPosition = positions[index];
      const previousPosition = positions[index - 1];

      invariant(
        currentPosition !== undefined && previousPosition !== undefined,
        `Missing chain position detected for chain="${chain}".`,
      );

      invariant(
        currentPosition === previousPosition + 1,
        `Non-contiguous chain block detected for chain="${chain}". Chain entries must be adjacent in lines[] to be safe with TB linked semantics.`,
      );
    }
  }
}
