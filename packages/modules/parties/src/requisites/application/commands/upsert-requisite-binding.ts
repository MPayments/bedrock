import type { ModuleRuntime } from "@bedrock/shared/core";
import { InvalidStateError } from "@bedrock/shared/core/errors";

import {
  RequisiteAccountingBindingNotFoundError,
  RequisiteAccountingBindingOwnerTypeError,
  RequisiteNotFoundError,
} from "../errors";
import type { RequisitesCurrenciesPort } from "../ports/currencies.port";
import type { RequisitesCommandUnitOfWork } from "../ports/requisites.uow";

export class UpsertRequisiteBindingCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly currencies: RequisitesCurrenciesPort,
    private readonly uow: RequisitesCommandUnitOfWork,
  ) {}

  async execute(input: {
    requisiteId: string;
    bookId: string;
    bookAccountInstanceId: string;
    postingAccountNo: string;
  }) {
    return this.uow.run(async (tx) => {
      const requisite = await tx.requisites.findById(input.requisiteId);
      if (!requisite) {
        throw new RequisiteNotFoundError(input.requisiteId);
      }

      const snapshot = requisite.toSnapshot();
      if (snapshot.ownerType !== "organization") {
        throw new RequisiteAccountingBindingOwnerTypeError(input.requisiteId);
      }

      const binding = await tx.requisiteBindingStore.upsert(input);
      if (!binding) {
        throw new RequisiteAccountingBindingNotFoundError(input.requisiteId);
      }

      const codes = await this.currencies.listCodesById([snapshot.currencyId]);
      const currencyCode = codes.get(snapshot.currencyId);
      if (!currencyCode) {
        throw new InvalidStateError(
          `Missing currency code for ${snapshot.currencyId}`,
        );
      }

      this.runtime.log.info("Requisite binding upserted", {
        requisiteId: input.requisiteId,
        organizationId: snapshot.ownerId,
      });

      return {
        requisiteId: binding.requisiteId,
        organizationId: snapshot.ownerId,
        currencyCode,
        bookId: binding.bookId,
        bookAccountInstanceId: binding.bookAccountInstanceId,
        postingAccountNo: binding.postingAccountNo,
        createdAt: binding.createdAt,
        updatedAt: binding.updatedAt,
      };
    });
  }
}
