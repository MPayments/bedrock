import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type {
  OrganizationsService,
} from "@bedrock/organizations";
import type {
  PartiesService,
} from "@bedrock/parties";
import { ServiceError } from "@bedrock/shared/core/errors";

import {
  ListRequisiteOptionsQuerySchema,
  ListRequisitesQuerySchema,
} from "../routes/contracts/requisites";
import type {
  CreateRequisiteInput,
  ListRequisiteOptionsQuery,
  ListRequisitesQuery,
  Requisite,
  RequisiteAccountingBinding,
  RequisiteOption,
  UpdateRequisiteInput,
  UpsertRequisiteAccountingBindingInput,
} from "../routes/contracts/requisites";
import type { ApiRequisitesReadModel } from "./requisites-read-model";

export class RequisiteNotFoundError extends ServiceError {
  name = "RequisiteNotFoundError";

  constructor(id: string) {
    super(`Requisite not found: ${id}`);
  }
}

export class RequisiteBindingOwnerTypeError extends ServiceError {
  name = "RequisiteBindingOwnerTypeError";

  constructor(id: string) {
    super(`Only organization requisites can have accounting binding: ${id}`);
  }
}

export interface ApiRequisitesFacadeService {
  list: (input?: ListRequisitesQuery) => Promise<PaginatedList<Requisite>>;
  listOptions: (input?: ListRequisiteOptionsQuery) => Promise<RequisiteOption[]>;
  create: (input: CreateRequisiteInput) => Promise<Requisite>;
  findById: (id: string) => Promise<Requisite>;
  update: (id: string, input: UpdateRequisiteInput) => Promise<Requisite>;
  remove: (id: string) => Promise<{ ok: true }>;
  getBinding: (id: string) => Promise<RequisiteAccountingBinding>;
  upsertBinding: (
    id: string,
    input: UpsertRequisiteAccountingBindingInput,
  ) => Promise<RequisiteAccountingBinding>;
  resolveBindings: (
    input: { requisiteIds: string[] },
  ) => ReturnType<OrganizationsService["requisites"]["resolveBindings"]>;
}

export function createRequisitesFacadeService(input: {
  readModel: ApiRequisitesReadModel;
  organizationsService: OrganizationsService;
  partiesService: PartiesService;
}): ApiRequisitesFacadeService {
  const { organizationsService, partiesService, readModel } = input;

  async function requireRequisite(id: string) {
    const requisite = await readModel.findById(id);

    if (!requisite) {
      throw new RequisiteNotFoundError(id);
    }

    return requisite;
  }

  return {
    list(inputQuery) {
      return readModel.list(ListRequisitesQuerySchema.parse(inputQuery ?? {}));
    },
    listOptions(inputQuery) {
      return readModel.listOptions(
        ListRequisiteOptionsQuerySchema.parse(inputQuery ?? {}),
      );
    },
    async create(inputCreate) {
      if (inputCreate.ownerType === "organization") {
        return organizationsService.requisites.create({
          organizationId: inputCreate.ownerId,
          providerId: inputCreate.providerId,
          currencyId: inputCreate.currencyId,
          kind: inputCreate.kind,
          label: inputCreate.label,
          description: inputCreate.description,
          beneficiaryName: inputCreate.beneficiaryName,
          institutionName: inputCreate.institutionName,
          institutionCountry: inputCreate.institutionCountry,
          accountNo: inputCreate.accountNo,
          corrAccount: inputCreate.corrAccount,
          iban: inputCreate.iban,
          bic: inputCreate.bic,
          swift: inputCreate.swift,
          bankAddress: inputCreate.bankAddress,
          network: inputCreate.network,
          assetCode: inputCreate.assetCode,
          address: inputCreate.address,
          memoTag: inputCreate.memoTag,
          accountRef: inputCreate.accountRef,
          subaccountRef: inputCreate.subaccountRef,
          contact: inputCreate.contact,
          notes: inputCreate.notes,
          isDefault: inputCreate.isDefault,
        });
      }

      return partiesService.requisites.create({
        counterpartyId: inputCreate.ownerId,
        providerId: inputCreate.providerId,
        currencyId: inputCreate.currencyId,
        kind: inputCreate.kind,
        label: inputCreate.label,
        description: inputCreate.description,
        beneficiaryName: inputCreate.beneficiaryName,
        institutionName: inputCreate.institutionName,
        institutionCountry: inputCreate.institutionCountry,
        accountNo: inputCreate.accountNo,
        corrAccount: inputCreate.corrAccount,
        iban: inputCreate.iban,
        bic: inputCreate.bic,
        swift: inputCreate.swift,
        bankAddress: inputCreate.bankAddress,
        network: inputCreate.network,
        assetCode: inputCreate.assetCode,
        address: inputCreate.address,
        memoTag: inputCreate.memoTag,
        accountRef: inputCreate.accountRef,
        subaccountRef: inputCreate.subaccountRef,
        contact: inputCreate.contact,
        notes: inputCreate.notes,
        isDefault: inputCreate.isDefault,
      });
    },
    async findById(id) {
      return requireRequisite(id);
    },
    async update(id, inputUpdate) {
      const requisite = await requireRequisite(id);

      if (requisite.ownerType === "organization") {
        return organizationsService.requisites.update(id, inputUpdate);
      }

      return partiesService.requisites.update(id, inputUpdate);
    },
    async remove(id) {
      const requisite = await requireRequisite(id);

      if (requisite.ownerType === "organization") {
        return organizationsService.requisites.remove(id);
      }

      return partiesService.requisites.remove(id);
    },
    async getBinding(id) {
      const requisite = await requireRequisite(id);

      if (requisite.ownerType !== "organization") {
        throw new RequisiteBindingOwnerTypeError(id);
      }

      return organizationsService.requisites.getBinding(id);
    },
    async upsertBinding(id, inputBinding) {
      const requisite = await requireRequisite(id);

      if (requisite.ownerType !== "organization") {
        throw new RequisiteBindingOwnerTypeError(id);
      }

      return organizationsService.requisites.upsertBinding(id, inputBinding);
    },
    resolveBindings(inputResolve) {
      return organizationsService.requisites.resolveBindings(inputResolve);
    },
  };
}
