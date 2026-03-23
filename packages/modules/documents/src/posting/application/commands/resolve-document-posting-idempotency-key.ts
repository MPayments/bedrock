import type { ResolveDocumentPostingIdempotencyKeyInput } from "./types";
import type { DocumentTransitionAction } from "../../../lifecycle/application/contracts/commands";
import { loadDocumentOrThrow } from "../../../lifecycle/application/shared/actions";
import type { DocumentRegistry } from "../../../plugins";
import { buildDocumentActionIdempotencyKey } from "../../../shared/application/action-runtime";
import { resolveModuleForDocument } from "../../../shared/application/module-resolution";
import type { PostingCommandUnitOfWork } from "../ports";

function buildActionIdempotencyKey(
  action: DocumentTransitionAction,
  input: {
    docType: string;
    documentId: string;
    actorUserId: string;
  },
) {
  return buildDocumentActionIdempotencyKey(action, input);
}

export class ResolveDocumentPostingIdempotencyKeyCommand {
  constructor(
    private readonly commandUow: PostingCommandUnitOfWork,
    private readonly registry: DocumentRegistry,
  ) {}

  async execute(
    input: ResolveDocumentPostingIdempotencyKeyInput,
  ): Promise<string> {
    if (input.idempotencyKey) {
      return input.idempotencyKey;
    }

    if (input.action === "repost") {
      return buildActionIdempotencyKey("repost", input);
    }

    return this.commandUow.run(
      async ({ documentsCommand }) => {
        const document = await loadDocumentOrThrow(documentsCommand, {
          documentId: input.documentId,
          docType: input.docType,
          forUpdate: true,
        });
        const module = resolveModuleForDocument(this.registry, document);

        return (
          module.buildPostIdempotencyKey?.(document) ??
          buildActionIdempotencyKey("post", input)
        );
      },
    );
  }
}
