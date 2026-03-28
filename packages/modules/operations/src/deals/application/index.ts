import type { ModuleRuntime } from "@bedrock/shared/core";

import type { ObjectStoragePort } from "../../shared/application/ports/object-storage.port";
import { CreateDealCommand } from "./commands/create-deal";
import { SetAgentBonusCommand } from "./commands/set-agent-bonus";
import { UpdateDealDetailsCommand } from "./commands/update-deal-details";
import { UpdateDealStatusCommand } from "./commands/update-deal-status";
import type { DealReads } from "./ports/deal.reads";
import type { DealDocumentStore } from "./ports/deal-document.store";
import type { DealsCommandUnitOfWork } from "./ports/deals.uow";
import { FindDealByIdQuery } from "./queries/find-deal-by-id";
import { ListDealsQuery } from "./queries/list-deals";

export interface DealsServiceDeps {
  runtime: ModuleRuntime;
  commandUow: DealsCommandUnitOfWork;
  reads: DealReads;
  dealDocumentStore?: DealDocumentStore;
  objectStorage?: ObjectStoragePort;
}

export function createDealsService(deps: DealsServiceDeps) {
  const createDeal = new CreateDealCommand(deps.runtime, deps.commandUow);
  const updateStatus = new UpdateDealStatusCommand(
    deps.runtime,
    deps.commandUow,
  );
  const updateDetails = new UpdateDealDetailsCommand(
    deps.runtime,
    deps.commandUow,
  );
  const setAgentBonus = new SetAgentBonusCommand(
    deps.runtime,
    deps.commandUow,
  );
  const findById = new FindDealByIdQuery(deps.reads);
  const listDeals = new ListDealsQuery(deps.reads);

  const documents =
    deps.dealDocumentStore && deps.objectStorage
      ? createDealDocumentsSubservice(
          deps.reads,
          deps.dealDocumentStore,
          deps.objectStorage,
        )
      : undefined;

  return {
    commands: {
      create: createDeal.execute.bind(createDeal),
      updateStatus: updateStatus.execute.bind(updateStatus),
      updateDetails: updateDetails.execute.bind(updateDetails),
      setAgentBonus: setAgentBonus.execute.bind(setAgentBonus),
    },
    queries: {
      findById: findById.execute.bind(findById),
      findByIdWithDetails: deps.reads.findByIdWithDetails.bind(deps.reads),
      list: listDeals.execute.bind(listDeals),
      listDocuments: deps.reads.listDocuments.bind(deps.reads),
      getLatestBonusForDeal: deps.reads.getLatestBonusForDeal.bind(deps.reads),
      getStatistics: deps.reads.getStatistics.bind(deps.reads),
      getByDay: deps.reads.getByDay.bind(deps.reads),
      getByStatus: deps.reads.getByStatus.bind(deps.reads),
      listGroupedByStatus: deps.reads.listGroupedByStatus.bind(deps.reads),
    },
    documents,
  };
}

export type DealsService = ReturnType<typeof createDealsService>;

function createDealDocumentsSubservice(
  reads: DealReads,
  store: DealDocumentStore,
  objectStorage: ObjectStoragePort,
) {
  return {
    queries: {
      listByDealId: reads.listDocuments.bind(reads),
    },
    commands: {
      async upload(input: {
        dealId: number;
        fileName: string;
        fileSize: number;
        mimeType: string;
        buffer: Buffer;
        uploadedBy: string | null;
        description?: string | null;
      }) {
        const s3Key = `deals/${input.dealId}/${Date.now()}-${input.fileName}`;
        await objectStorage.upload(s3Key, input.buffer, input.mimeType);
        return store.create({
          dealId: input.dealId,
          fileName: input.fileName,
          fileSize: input.fileSize,
          mimeType: input.mimeType,
          s3Key,
          uploadedBy: input.uploadedBy,
          description: input.description ?? null,
        });
      },
      async delete(id: number) {
        await store.delete(id);
      },
    },
    async getSignedUrl(s3Key: string) {
      return objectStorage.getSignedUrl(s3Key);
    },
  };
}
