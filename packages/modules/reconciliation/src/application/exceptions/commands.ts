import { ReconciliationException } from "../../domain/reconciliation-exception";
import { ReconciliationExceptionNotFoundError } from "../../errors";
import type { ReconciliationServiceContext } from "../shared/context";

export function createGetAdjustmentResolutionHandler(
  context: ReconciliationServiceContext,
) {
  return async function getAdjustmentResolution(exceptionId: string) {
    return context.transactions.withTransaction(async ({ exceptions }) => {
      const exception = await exceptions.findByIdForUpdate(exceptionId);
      if (!exception) {
        throw new ReconciliationExceptionNotFoundError(exceptionId);
      }

      const resolution = ReconciliationException.fromSnapshot(
        exception,
      ).resolveWithAdjustment({
        adjustmentDocumentId: exception.adjustmentDocumentId ?? "",
        resolvedAt: new Date(),
      });

      return {
        exceptionId: resolution.exceptionId,
        documentId: resolution.documentId,
        alreadyResolved: resolution.alreadyResolved,
      };
    });
  };
}

export function createResolveAdjustmentHandler(
  context: ReconciliationServiceContext,
) {
  return async function resolveAdjustment(input: {
    exceptionId: string;
    adjustmentDocumentId: string;
  }) {
    return context.transactions.withTransaction(async ({ exceptions }) => {
      const exception = await exceptions.findByIdForUpdate(input.exceptionId);
      if (!exception) {
        throw new ReconciliationExceptionNotFoundError(input.exceptionId);
      }

      const resolution = ReconciliationException.fromSnapshot(
        exception,
      ).resolveWithAdjustment({
        adjustmentDocumentId: input.adjustmentDocumentId,
        resolvedAt: new Date(),
      });

      if (resolution.alreadyResolved) {
        return {
          exceptionId: resolution.exceptionId,
          documentId: resolution.documentId,
          alreadyResolved: true,
        };
      }

      await exceptions.markResolved(resolution.update!);

      return {
        exceptionId: resolution.exceptionId,
        documentId: resolution.documentId,
        alreadyResolved: false,
      };
    });
  };
}

export function createIgnoreExceptionHandler(
  context: ReconciliationServiceContext,
) {
  return async function ignoreException(exceptionId: string) {
    return context.transactions.withTransaction(async ({ exceptions }) => {
      const exception = await exceptions.findByIdForUpdate(exceptionId);
      if (!exception) {
        throw new ReconciliationExceptionNotFoundError(exceptionId);
      }

      const resolution = ReconciliationException.fromSnapshot(exception).ignore({
        ignoredAt: new Date(),
      });

      if (resolution.alreadyIgnored || resolution.ignoredBlockedByResolution) {
        return {
          alreadyIgnored: resolution.alreadyIgnored,
          exceptionId: resolution.exceptionId,
          state: exception.state,
        };
      }

      await exceptions.markIgnored(resolution.update!);

      return {
        alreadyIgnored: false,
        exceptionId: resolution.exceptionId,
        state: "ignored" as const,
      };
    });
  };
}
