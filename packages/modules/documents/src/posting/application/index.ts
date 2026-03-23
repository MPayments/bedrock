import {
  FinalizeDocumentPostingFailureCommand,
} from "./commands/finalize-document-posting-failure";
import {
  FinalizeDocumentPostingSuccessCommand,
} from "./commands/finalize-document-posting-success";
import { PrepareDocumentPostCommand } from "./commands/prepare-document-post";
import { PrepareDocumentRepostCommand } from "./commands/prepare-document-repost";
import {
  ResolveDocumentPostingIdempotencyKeyCommand,
} from "./commands/resolve-document-posting-idempotency-key";
import { ValidateAccountingSourceCoverageCommand } from "./commands/validate-accounting-source-coverage";
import type { PostingServiceDeps } from "./service-deps";

export function createPostingService(deps: PostingServiceDeps) {
  const finalizeFailure = new FinalizeDocumentPostingFailureCommand(
    deps.runtime,
    deps.commandUow,
    deps.registry,
  );
  const finalizeSuccess = new FinalizeDocumentPostingSuccessCommand(
    deps.commandUow,
    deps.registry,
  );
  const preparePost = new PrepareDocumentPostCommand(
    deps.runtime,
    deps.commandUow,
    deps.accounting,
    deps.accountingPeriods,
    deps.registry,
    deps.policy,
  );
  const prepareRepost = new PrepareDocumentRepostCommand(
    deps.runtime,
    deps.commandUow,
    deps.accountingPeriods,
  );
  const resolveIdempotencyKey =
    new ResolveDocumentPostingIdempotencyKeyCommand(
      deps.commandUow,
      deps.registry,
    );
  const validateAccountingSourceCoverage =
    new ValidateAccountingSourceCoverageCommand(deps.accounting, deps.registry);

  return {
    commands: {
      finalizeFailure: finalizeFailure.execute.bind(finalizeFailure),
      finalizeSuccess: finalizeSuccess.execute.bind(finalizeSuccess),
      preparePost: preparePost.execute.bind(preparePost),
      prepareRepost: prepareRepost.execute.bind(prepareRepost),
      resolveIdempotencyKey:
        resolveIdempotencyKey.execute.bind(resolveIdempotencyKey),
      validateAccountingSourceCoverage:
        validateAccountingSourceCoverage.execute.bind(
          validateAccountingSourceCoverage,
        ),
    },
  };
}
