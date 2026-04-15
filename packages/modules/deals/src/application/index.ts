import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { ModuleRuntime } from "@bedrock/shared/core";

import { AcceptDealCalculationCommand } from "./commands/accept-deal-calculation";
import { ApplyDealRouteTemplateCommand } from "./commands/apply-deal-route-template";
import { ApproveDealCommand } from "./commands/approve-deal";
import { ArchiveDealRouteTemplateCommand } from "./commands/archive-deal-route-template";
import { AppendDealTimelineEventCommand } from "./commands/append-deal-timeline-event";
import { AssignDealAgentCommand } from "./commands/assign-deal-agent";
import { ClaimDealAttachmentIngestionsCommand } from "./commands/claim-deal-attachment-ingestions";
import { CompleteDealAttachmentIngestionCommand } from "./commands/complete-deal-attachment-ingestion";
import { CreateDealDraftCommand } from "./commands/create-deal-draft";
import { CreateDealRouteDraftCommand } from "./commands/create-deal-route-draft";
import { CreateDealRouteTemplateCommand } from "./commands/create-deal-route-template";
import { EnqueueDealAttachmentIngestionCommand } from "./commands/enqueue-deal-attachment-ingestion";
import { FailDealAttachmentIngestionCommand } from "./commands/fail-deal-attachment-ingestion";
import { LinkCalculationCommand } from "./commands/link-calculation";
import { PublishDealRouteTemplateCommand } from "./commands/publish-deal-route-template";
import { RejectDealCommand } from "./commands/reject-deal";
import { ReplaceDealRouteVersionCommand } from "./commands/replace-deal-route-version";
import { SupersedeDealCalculationCommand } from "./commands/supersede-deal-calculation";
import { TransitionDealStatusCommand } from "./commands/transition-deal-status";
import { UpdateDealHeaderCommand } from "./commands/update-deal-header";
import { UpdateDealRouteTemplateCommand } from "./commands/update-deal-route-template";
import { UpdateDealAgreementCommand } from "./commands/update-deal-agreement";
import { UpdateDealCommentCommand } from "./commands/update-deal-comment";
import { UpdateDealLegStateCommand } from "./commands/update-deal-leg-state";
import type { DealReads } from "./ports/deal.reads";
import type { DealsCommandUnitOfWork } from "./ports/deals.uow";
import type { DealReferencesPort } from "./ports/references.port";
import { FindDealAttachmentIngestionByFileAssetIdQuery } from "./queries/find-deal-attachment-ingestion-by-file-asset-id";
import { FindDealByIdQuery } from "./queries/find-deal-by-id";
import { FindCurrentDealRouteByIdQuery } from "./queries/find-current-deal-route-by-id";
import { FindDealRouteTemplateByIdQuery } from "./queries/find-deal-route-template-by-id";
import { FindDealTraceByIdQuery } from "./queries/find-deal-trace-by-id";
import { FindDealWorkflowByIdQuery } from "./queries/find-deal-workflow-by-id";
import { FindDealWorkflowsByIdsQuery } from "./queries/find-deal-workflows-by-ids";
import { FindPortalDealByIdQuery } from "./queries/find-portal-deal-by-id";
import { ListDealAttachmentIngestionsQuery } from "./queries/list-deal-attachment-ingestions";
import { ListDealCalculationHistoryQuery } from "./queries/list-deal-calculation-history";
import { ListDealRouteTemplatesQuery } from "./queries/list-deal-route-templates";
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
  const createDealRouteTemplate = new CreateDealRouteTemplateCommand(
    deps.runtime,
    deps.commandUow,
    deps.references,
  );
  const enqueueAttachmentIngestion = new EnqueueDealAttachmentIngestionCommand(
    deps.runtime,
    deps.commandUow,
  );
  const createDealRouteDraft = new CreateDealRouteDraftCommand(
    deps.runtime,
    deps.commandUow,
  );
  const acceptDealCalculation = new AcceptDealCalculationCommand(
    deps.runtime,
    deps.commandUow,
    deps.references,
  );
  const applyDealRouteTemplate = new ApplyDealRouteTemplateCommand(
    deps.runtime,
    deps.commandUow,
    deps.references,
  );
  const approveDeal = new ApproveDealCommand(
    deps.runtime,
    deps.commandUow,
    deps.references,
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
  const updateDealHeader = new UpdateDealHeaderCommand(
    deps.runtime,
    deps.commandUow,
    deps.references,
  );
  const replaceDealRouteVersion = new ReplaceDealRouteVersionCommand(
    deps.runtime,
    deps.commandUow,
    deps.references,
  );
  const updateDealRouteTemplate = new UpdateDealRouteTemplateCommand(
    deps.runtime,
    deps.commandUow,
    deps.references,
  );
  const publishDealRouteTemplate = new PublishDealRouteTemplateCommand(
    deps.commandUow,
  );
  const archiveDealRouteTemplate = new ArchiveDealRouteTemplateCommand(
    deps.commandUow,
  );
  const updateDealComment = new UpdateDealCommentCommand(deps.commandUow);
  const linkCalculation = new LinkCalculationCommand(
    deps.runtime,
    deps.commandUow,
    deps.references,
  );
  const transitionDealStatus = new TransitionDealStatusCommand(
    deps.runtime,
    deps.commandUow,
  );
  const rejectDeal = new RejectDealCommand(
    deps.runtime,
    deps.commandUow,
  );
  const supersedeDealCalculation = new SupersedeDealCalculationCommand(
    deps.runtime,
    deps.commandUow,
    deps.references,
  );
  const updateDealLegState = new UpdateDealLegStateCommand(
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
  const findCurrentDealRouteById = new FindCurrentDealRouteByIdQuery(deps.reads);
  const findDealRouteTemplateById = new FindDealRouteTemplateByIdQuery(
    deps.reads,
  );
  const findDealWorkflowById = new FindDealWorkflowByIdQuery(deps.reads);
  const findDealWorkflowsByIds = new FindDealWorkflowsByIdsQuery(deps.reads);
  const findPortalDealById = new FindPortalDealByIdQuery(deps.reads);
  const findDealTraceById = new FindDealTraceByIdQuery(deps.reads);
  const listAttachmentIngestions = new ListDealAttachmentIngestionsQuery(
    deps.reads,
  );
  const listCalculationHistory = new ListDealCalculationHistoryQuery(deps.reads);
  const listDealRouteTemplates = new ListDealRouteTemplatesQuery(deps.reads);
  const listDeals = new ListDealsQuery(deps.reads);
  const listPortalDeals = new ListPortalDealsQuery(deps.reads);

  return {
    commands: {
      acceptCalculation:
        acceptDealCalculation.execute.bind(acceptDealCalculation),
      applyRouteTemplate:
        applyDealRouteTemplate.execute.bind(applyDealRouteTemplate),
      approve: approveDeal.execute.bind(approveDeal),
      archiveRouteTemplate:
        archiveDealRouteTemplate.execute.bind(archiveDealRouteTemplate),
      assignAgent: assignDealAgent.execute.bind(assignDealAgent),
      appendTimelineEvent: appendTimelineEvent.execute.bind(appendTimelineEvent),
      claimAttachmentIngestions:
        claimAttachmentIngestions.execute.bind(claimAttachmentIngestions),
      completeAttachmentIngestion:
        completeAttachmentIngestion.execute.bind(completeAttachmentIngestion),
      createDraft: createDealDraft.execute.bind(createDealDraft),
      createRouteDraft: createDealRouteDraft.execute.bind(createDealRouteDraft),
      createRouteTemplate:
        createDealRouteTemplate.execute.bind(createDealRouteTemplate),
      enqueueAttachmentIngestion:
        enqueueAttachmentIngestion.execute.bind(enqueueAttachmentIngestion),
      failAttachmentIngestion:
        failAttachmentIngestion.execute.bind(failAttachmentIngestion),
      linkCalculation: linkCalculation.execute.bind(linkCalculation),
      publishRouteTemplate:
        publishDealRouteTemplate.execute.bind(publishDealRouteTemplate),
      reject: rejectDeal.execute.bind(rejectDeal),
      replaceRouteVersion:
        replaceDealRouteVersion.execute.bind(replaceDealRouteVersion),
      supersedeCalculation:
        supersedeDealCalculation.execute.bind(supersedeDealCalculation),
      transitionStatus: transitionDealStatus.execute.bind(transitionDealStatus),
      updateAgreement: updateDealAgreement.execute.bind(updateDealAgreement),
      updateComment: updateDealComment.execute.bind(updateDealComment),
      updateHeader: updateDealHeader.execute.bind(updateDealHeader),
      updateLegState: updateDealLegState.execute.bind(updateDealLegState),
      updateRouteTemplate:
        updateDealRouteTemplate.execute.bind(updateDealRouteTemplate),
    },
    queries: {
      findAttachmentIngestionByFileAssetId:
        findAttachmentIngestionByFileAssetId.execute.bind(
          findAttachmentIngestionByFileAssetId,
        ),
      findById: findDealById.execute.bind(findDealById),
      findCurrentRouteByDealId:
        findCurrentDealRouteById.execute.bind(findCurrentDealRouteById),
      findRouteTemplateById:
        findDealRouteTemplateById.execute.bind(findDealRouteTemplateById),
      findPortalById: findPortalDealById.execute.bind(findPortalDealById),
      findTraceById: findDealTraceById.execute.bind(findDealTraceById),
      findWorkflowById: findDealWorkflowById.execute.bind(findDealWorkflowById),
      findWorkflowsByIds:
        findDealWorkflowsByIds.execute.bind(findDealWorkflowsByIds),
      listAttachmentIngestions:
        listAttachmentIngestions.execute.bind(listAttachmentIngestions),
      listCalculationHistory: listCalculationHistory.execute.bind(
        listCalculationHistory,
      ),
      list: listDeals.execute.bind(listDeals),
      listRouteTemplates:
        listDealRouteTemplates.execute.bind(listDealRouteTemplates),
      listPortalDeals: listPortalDeals.execute.bind(listPortalDeals),
    },
  };
}

export type DealsService = ReturnType<typeof createDealsService>;
