export function buildInstructionPrepareSourceRef(operationId: string) {
  return `operation:${operationId}:instruction:1`;
}

export function buildInstructionRetrySourceRef(
  operationId: string,
  attempt: number,
) {
  return `operation:${operationId}:instruction:${attempt}`;
}
