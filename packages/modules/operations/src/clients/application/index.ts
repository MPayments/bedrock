import type { ModuleRuntime } from "@bedrock/shared/core";

import type { ObjectStoragePort } from "../../shared/application/ports/object-storage.port";
import { CreateClientCommand } from "./commands/create-client";
import { SoftDeleteClientCommand } from "./commands/soft-delete-client";
import { UpdateClientCommand } from "./commands/update-client";
import type { ClientDocumentReads } from "./ports/client-document.reads";
import type { ClientDocumentStore } from "./ports/client-document.store";
import type { ClientReads } from "./ports/client.reads";
import type { ClientsCommandUnitOfWork } from "./ports/clients.uow";
import type { CompanyLookupPort } from "./ports/company-lookup.port";
import type { CounterpartiesPort } from "./ports/counterparties.port";
import { FindActiveClientByCustomerIdQuery } from "./queries/find-active-client-by-customer-id";
import { FindClientByIdQuery } from "./queries/find-client-by-id";
import { ListClientsQuery } from "./queries/list-clients";
import { ListActiveClientsByCustomerIdsQuery } from "./queries/list-active-clients-by-customer-ids";
import { SearchCompanyQuery } from "./queries/search-company";

export interface ClientsServiceDeps {
  runtime: ModuleRuntime;
  commandUow: ClientsCommandUnitOfWork;
  reads: ClientReads;
  counterparties?: CounterpartiesPort;
  companyLookup?: CompanyLookupPort;
  clientDocumentReads?: ClientDocumentReads;
  clientDocumentStore?: ClientDocumentStore;
  objectStorage?: ObjectStoragePort;
}

export function createClientsService(deps: ClientsServiceDeps) {
  const createClient = new CreateClientCommand(
    deps.runtime,
    deps.commandUow,
    deps.counterparties,
  );
  const updateClient = new UpdateClientCommand(deps.runtime, deps.commandUow);
  const softDeleteClient = new SoftDeleteClientCommand(
    deps.runtime,
    deps.commandUow,
  );
  const findById = new FindClientByIdQuery(deps.reads);
  const findActiveByCustomerId = new FindActiveClientByCustomerIdQuery(
    deps.reads,
  );
  const listClients = new ListClientsQuery(deps.reads);
  const listActiveClientsByCustomerIds = new ListActiveClientsByCustomerIdsQuery(
    deps.reads,
  );

  const searchCompany = deps.companyLookup
    ? new SearchCompanyQuery(deps.companyLookup)
    : null;

  const documents =
    deps.clientDocumentReads && deps.clientDocumentStore && deps.objectStorage
      ? createClientDocumentsSubservice(
          deps.clientDocumentReads,
          deps.clientDocumentStore,
          deps.objectStorage,
        )
      : undefined;

  return {
    commands: {
      create: createClient.execute.bind(createClient),
      update: updateClient.execute.bind(updateClient),
      softDelete: softDeleteClient.execute.bind(softDeleteClient),
    },
    queries: {
      findActiveByCustomerId:
        findActiveByCustomerId.execute.bind(findActiveByCustomerId),
      findById: findById.execute.bind(findById),
      list: listClients.execute.bind(listClients),
      listActiveByCustomerIds: listActiveClientsByCustomerIds.execute.bind(
        listActiveClientsByCustomerIds,
      ),
      ...(searchCompany && {
        searchCompany: searchCompany.execute.bind(searchCompany),
      }),
    },
    documents,
  };
}

export type ClientsService = ReturnType<typeof createClientsService>;

function createClientDocumentsSubservice(
  reads: ClientDocumentReads,
  store: ClientDocumentStore,
  objectStorage: ObjectStoragePort,
) {
  return {
    queries: {
      listByClientId: reads.listByClientId.bind(reads),
      findById: reads.findById.bind(reads),
    },
    commands: {
      async upload(input: {
        clientId: number;
        fileName: string;
        fileSize: number;
        mimeType: string;
        buffer: Buffer;
        uploadedBy: string | null;
        description?: string | null;
      }) {
        const s3Key = `clients/${input.clientId}/${Date.now()}-${input.fileName}`;
        await objectStorage.upload(s3Key, input.buffer, input.mimeType);
        return store.create({
          clientId: input.clientId,
          fileName: input.fileName,
          fileSize: input.fileSize,
          mimeType: input.mimeType,
          s3Key,
          uploadedBy: input.uploadedBy,
          description: input.description ?? null,
        });
      },
      async delete(id: number) {
        const doc = await reads.findById(id);
        if (doc) {
          await objectStorage.queueForDeletion(doc.s3Key);
          await store.delete(id);
        }
      },
    },
    async getSignedUrl(id: number) {
      const doc = await reads.findById(id);
      if (!doc) return null;
      return objectStorage.getSignedUrl(doc.s3Key);
    },
  };
}
