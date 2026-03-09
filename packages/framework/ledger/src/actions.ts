export interface PendingTransferBookRouteInput {
  sourceBookId: string;
  destinationBookId: string;
  pendingRef?: string | null;
  buildAmbiguousPendingRefMessage?: (pendingRef: string | null | undefined) => string;
}

export function resolvePendingTransferBookId(
  input: PendingTransferBookRouteInput,
) {
  if (input.sourceBookId === input.destinationBookId) {
    return input.sourceBookId;
  }

  if (input.pendingRef?.endsWith(":source")) {
    return input.sourceBookId;
  }

  if (input.pendingRef?.endsWith(":destination")) {
    return input.destinationBookId;
  }

  throw new Error(
    input.buildAmbiguousPendingRefMessage
      ? input.buildAmbiguousPendingRefMessage(input.pendingRef)
      : `Pending transfer reference is ambiguous: ${input.pendingRef ?? "n/a"}`,
  );
}
