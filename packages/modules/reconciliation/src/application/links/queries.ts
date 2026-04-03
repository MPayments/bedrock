import {
  ListReconciliationOperationLinksInputSchema,
  type ReconciliationOperationLinkDto,
} from "../../contracts";
import { extractCandidateReferences } from "../../domain/candidate-references";
import type { ReconciliationServiceContext } from "../shared/context";

function updateLastActivityAt(
  current: Date | null,
  candidate: Date | null | undefined,
) {
  if (!candidate) {
    return current;
  }

  if (!current || candidate.getTime() > current.getTime()) {
    return candidate;
  }

  return current;
}

export function createListOperationLinksHandler(
  context: ReconciliationServiceContext,
) {
  const { exceptions, matches } = context;

  return async function listOperationLinks(input: {
    operationIds: string[];
  }): Promise<ReconciliationOperationLinkDto[]> {
    const validated = ListReconciliationOperationLinksInputSchema.parse(input);

    if (validated.operationIds.length === 0) {
      return [];
    }

    const operationIds = Array.from(new Set(validated.operationIds));
    const operationIdSet = new Set(operationIds);
    const linksByOperationId = new Map(
      operationIds.map((operationId) => [
        operationId,
        {
          exceptions: [] as ReconciliationOperationLinkDto["exceptions"],
          lastActivityAt: null as Date | null,
          matchCount: 0,
          operationId,
        },
      ]),
    );
    const exceptionIdsByOperationId = new Map(
      operationIds.map((operationId) => [operationId, new Set<string>()] as const),
    );

    const [matchedRows, exceptionRows] = await Promise.all([
      matches.listByMatchedOperationIds(operationIds),
      exceptions.listLinkedToOperationIds(operationIds),
    ]);

    for (const match of matchedRows) {
      if (!match.matchedOperationId) {
        continue;
      }

      const link = linksByOperationId.get(match.matchedOperationId);
      if (!link) {
        continue;
      }

      link.matchCount += 1;
      link.lastActivityAt = updateLastActivityAt(link.lastActivityAt, match.createdAt);
    }

    for (const row of exceptionRows) {
      const references = extractCandidateReferences(
        row.externalRecord.normalizedPayload,
      );
      const linkedOperationIds =
        references.operationId && operationIdSet.has(references.operationId)
          ? [references.operationId]
          : references.candidateOperationIds.filter((operationId) =>
              operationIdSet.has(operationId),
            );

      for (const operationId of linkedOperationIds) {
        const link = linksByOperationId.get(operationId);
        const seenExceptionIds = exceptionIdsByOperationId.get(operationId);

        if (!link || !seenExceptionIds || seenExceptionIds.has(row.exception.id)) {
          continue;
        }

        seenExceptionIds.add(row.exception.id);
        link.exceptions.push({
          createdAt: row.exception.createdAt,
          externalRecordId: row.externalRecord.id,
          id: row.exception.id,
          operationId,
          reasonCode: row.exception.reasonCode,
          resolvedAt: row.exception.resolvedAt,
          source: row.run.source,
          state: row.exception.state,
        });
        link.lastActivityAt = updateLastActivityAt(
          link.lastActivityAt,
          row.exception.resolvedAt ?? row.exception.createdAt,
        );
      }
    }

    return operationIds.map((operationId) => {
      const link = linksByOperationId.get(operationId)!;

      return {
        ...link,
        exceptions: [...link.exceptions].sort(
          (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
        ),
      };
    });
  };
}
