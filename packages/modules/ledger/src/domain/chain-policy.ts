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
      if (positions[index]! !== positions[index - 1]! + 1) {
        throw new Error(
          `Non-contiguous chain block detected for chain="${chain}". ` +
            "Chain entries must be adjacent in lines[] to be safe with TB linked semantics.",
        );
      }
    }
  }
}
