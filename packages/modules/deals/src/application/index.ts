import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { ModuleRuntime } from "@bedrock/shared/core";

import { AcceptDealQuoteCommand } from "./commands/accept-deal-quote";
import { AppendDealTimelineEventCommand } from "./commands/append-deal-timeline-event";
import { AssignDealAgentCommand } from "./commands/assign-deal-agent";
import { ClaimDealAttachmentIngestionsCommand } from "./commands/claim-deal-attachment-ingestions";
import { CompleteDealAttachmentIngestionCommand } from "./commands/complete-deal-attachment-ingestion";
import { CreateDealCommand } from "./commands/create-deal";
import { CreateDealDraftCommand } from "./commands/create-deal-draft";
import { EnqueueDealAttachmentIngestionCommand } from "./commands/enqueue-deal-attachment-ingestion";
import { FailDealAttachmentIngestionCommand } from "./commands/fail-deal-attachment-ingestion";
import { LinkCalculationFromAcceptedQuoteCommand } from "./commands/link-calculation-from-accepted-quote";
import { ReplaceDealIntakeCommand } from "./commands/replace-deal-intake";
import { TransitionDealStatusCommand } from "./commands/transition-deal-status";
import { UpdateDealAgreementCommand } from "./commands/update-deal-agreement";
import { UpdateDealIntakeCommand } from "./commands/update-deal-intake";
import { UpdateDealLegStateCommand } from "./commands/update-deal-leg-state";
import { UpsertDealCapabilityStateCommand } from "./commands/upsert-deal-capability-state";
import type { DealReads } from "./ports/deal.reads";
import type { DealsCommandUnitOfWork } from "./ports/deals.uow";
import type { DealReferencesPort } from "./ports/references.port";
import { FindDealAttachmentIngestionByFileAssetIdQuery } from "./queries/find-deal-attachment-ingestion-by-file-asset-id";
import { FindDealByIdQuery } from "./queries/find-deal-by-id";
import { FindDealTraceByIdQuery } from "./queries/find-deal-trace-by-id";
import { FindDealWorkflowByIdQuery } from "./queries/find-deal-workflow-by-id";
import { FindDealWorkflowsByIdsQuery } from "./queries/find-deal-workflows-by-ids";
import { FindPortalDealByIdQuery } from "./queries/find-portal-deal-by-id";
import { ListDealAttachmentIngestionsQuery } from "./queries/list-deal-attachment-ingestions";
import { ListDealCalculationHistoryQuery } from "./queries/list-deal-calculation-history";
import { ListDealCapabilityStatesQuery } from "./queries/list-deal-capability-states";
import { ListDealsQuery } from "./queries/list-deals";
import { ListPortalDealsQuery } from "./queries/list-portal-deals";

export interface DealsServiceDeps {
  commandUow: DealsCommandUnitOfWork;
  idempotency: IdempotencyPort;
  reads: DealReads;
  references: DealReferencesPort;
  runtime: ModuleRuntime;
}

export function createDealsService(deps: DealsServiceDeps) {
  const createDealDraft = new CreateDealDraftCommand(
    deps.runtime,
    deps.commandUow,
    deps.idempotency,
    deps.references,
  );
  const enqueueAttachmentIngestion = new EnqueueDealAttachmentIngestionCommand(
    deps.runtime,
    deps.commandUow,
  );
  const claimAttachmentIngestions = new ClaimDealAttachmentIngestionsCommand(
    deps.runtime,
    deps.commandUow,
  );
  const completeAttachmentIngestion = new CompleteDealAttachmentIngestionCommand(
    deps.runtime,
    deps.commandUow,
  );
  const failAttachmentIngestion = new FailDealAttachmentIngestionCommand(
    deps.runtime,
    deps.commandUow,
  );
  const createDeal = new CreateDealCommand(
    deps.runtime,
    deps.commandUow,
    deps.idempotency,
    deps.references,
  );
  const replaceDealIntake = new ReplaceDealIntakeCommand(
    deps.runtime,
    deps.commandUow,
    deps.references,
  );
  const updateDealIntake = new UpdateDealIntakeCommand(
    deps.runtime,
    deps.commandUow,
    deps.references,
  );
  const linkCalculationFromAcceptedQuote =
    new LinkCalculationFromAcceptedQuoteCommand(
      deps.runtime,
      deps.commandUow,
      deps.references,
    );
  const transitionDealStatus = new TransitionDealStatusCommand(
    deps.runtime,
    deps.commandUow,
  );
  const acceptDealQuote = new AcceptDealQuoteCommand(
    deps.runtime,
    deps.commandUow,
    deps.references,
  );
  const updateDealLegState = new UpdateDealLegStateCommand(
    deps.runtime,
    deps.commandUow,
  );
  const upsertDealCapabilityState = new UpsertDealCapabilityStateCommand(
    deps.runtime,
    deps.commandUow,
  );
  const appendTimelineEvent = new AppendDealTimelineEventCommand(
    deps.runtime,
    deps.commandUow,
  );
  const assignDealAgent = new AssignDealAgentCommand(
    deps.runtime,
    deps.commandUow,
  );
  const updateDealAgreement = new UpdateDealAgreementCommand(
    deps.runtime,
    deps.commandUow,
    deps.references,
  );
  const findDealById = new FindDealByIdQuery(deps.reads);
  const findAttachmentIngestionByFileAssetId =
    new FindDealAttachmentIngestionByFileAssetIdQuery(deps.reads);
  const findDealWorkflowById = new FindDealWorkflowByIdQuery(deps.reads);
  const findDealWorkflowsByIds = new FindDealWorkflowsByIdsQuery(deps.reads);
  const findPortalDealById = new FindPortalDealByIdQuery(deps.reads);
  const findDealTraceById = new FindDealTraceByIdQuery(deps.reads);
  const listCapabilityStates = new ListDealCapabilityStatesQuery(deps.reads);
  const listAttachmentIngestions = new ListDealAttachmentIngestionsQuery(
    deps.reads,
  );
  const listCalculationHistory = new ListDealCalculationHistoryQuery(deps.reads);
  const listDeals = new ListDealsQuery(deps.reads);
  const listPortalDeals = new ListPortalDealsQuery(deps.reads);

  return {
    commands: {
      acceptQuote: acceptDealQuote.execute.bind(acceptDealQuote),
      assignAgent: assignDealAgent.execute.bind(assignDealAgent),
      appendTimelineEvent: appendTimelineEvent.execute.bind(appendTimelineEvent),
      claimAttachmentIngestions:
        claimAttachmentIngestions.execute.bind(claimAttachmentIngestions),
      completeAttachmentIngestion:
        completeAttachmentIngestion.execute.bind(completeAttachmentIngestion),
      create: createDeal.execute.bind(createDeal),
      createDraft: createDealDraft.execute.bind(createDealDraft),
      enqueueAttachmentIngestion:
        enqueueAttachmentIngestion.execute.bind(enqueueAttachmentIngestion),
      failAttachmentIngestion:
        failAttachmentIngestion.execute.bind(failAttachmentIngestion),
      linkCalculationFromAcceptedQuote:
        linkCalculationFromAcceptedQuote.execute.bind(
          linkCalculationFromAcceptedQuote,
        ),
      replaceIntake: replaceDealIntake.execute.bind(replaceDealIntake),
      transitionStatus: transitionDealStatus.execute.bind(transitionDealStatus),
      updateAgreement: updateDealAgreement.execute.bind(updateDealAgreement),
      upsertCapabilityState: upsertDealCapabilityState.execute.bind(
        upsertDealCapabilityState,
      ),
      updateLegState: updateDealLegState.execute.bind(updateDealLegState),
      updateIntake: updateDealIntake.execute.bind(updateDealIntake),
    },
    queries: {
      findAttachmentIngestionByFileAssetId:
        findAttachmentIngestionByFileAssetId.execute.bind(
          findAttachmentIngestionByFileAssetId,
        ),
      findById: findDealById.execute.bind(findDealById),
      findPortalById: findPortalDealById.execute.bind(findPortalDealById),
      findTraceById: findDealTraceById.execute.bind(findDealTraceById),
      findWorkflowById: findDealWorkflowById.execute.bind(findDealWorkflowById),
      findWorkflowsByIds:
        findDealWorkflowsByIds.execute.bind(findDealWorkflowsByIds),
      listAttachmentIngestions:
        listAttachmentIngestions.execute.bind(listAttachmentIngestions),
      listCapabilityStates: listCapabilityStates.execute.bind(
        listCapabilityStates,
      ),
      listCalculationHistory: listCalculationHistory.execute.bind(
        listCalculationHistory,
      ),
      list: listDeals.execute.bind(listDeals),
      listPortalDeals: listPortalDeals.execute.bind(listPortalDeals),
    },
  };
}

export type DealsService = ReturnType<typeof createDealsService>;
