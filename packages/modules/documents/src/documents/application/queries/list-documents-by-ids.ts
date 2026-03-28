import { buildDocumentWithOperationId } from "../../../lifecycle/application/shared/actions";
import type { DocumentRegistry } from "../../../plugins";
import type { DocumentWithOperationId } from "../contracts/dto";
import type { DocumentsQueryRepository } from "../ports";

export class ListDocumentsByIdsQuery {
  constructor(
    private readonly documentsQuery: DocumentsQueryRepository,
    private readonly registry: DocumentRegistry,
  ) {}

  async execute(documentIds: string[]): Promise<DocumentWithOperationId[]> {
    if (documentIds.length === 0) {
      return [];
    }

    const rows = await this.documentsQuery.listDocumentsByIds(documentIds);
    const documentIdSet = new Set(rows.map((document) => document.id));
    const resolved = await Promise.all(
      rows.map(async (document) => {
        const postingRow =
          await this.documentsQuery.findDocumentWithPostingOperation({
            documentId: document.id,
            docType: document.docType,
          });

        return buildDocumentWithOperationId({
          registry: this.registry,
          document,
          postingOperationId: postingRow?.postingOperationId ?? null,
        });
      }),
    );

    const resolvedById = new Map(
      resolved.map((document) => [document.document.id, document] as const),
    );

    return documentIds
      .filter((documentId) => documentIdSet.has(documentId))
      .map((documentId) => resolvedById.get(documentId))
      .filter((document): document is DocumentWithOperationId => document !== undefined);
  }
}
