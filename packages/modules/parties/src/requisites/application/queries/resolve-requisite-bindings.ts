import type { Logger } from "@bedrock/platform/observability/logger";

import type { RequisiteAccountingBinding } from "../contracts/requisites";
import {
  RequisiteAccountingBindingNotFoundError,
  RequisiteAccountingBindingOwnerTypeError,
  RequisiteNotFoundError,
} from "../errors";
import type { RequisiteBindingReads } from "../ports/requisite-binding.reads";
import type {
  RequisiteReads,
  RequisiteSubjectRecord,
} from "../ports/requisite.reads";

function toPublicBinding(input: {
  subject: RequisiteSubjectRecord;
  binding: {
    requisiteId: string;
    bookId: string;
    bookAccountInstanceId: string;
    postingAccountNo: string;
    createdAt: Date;
    updatedAt: Date;
  };
}): RequisiteAccountingBinding {
  return {
    requisiteId: input.binding.requisiteId,
    organizationId: input.subject.organizationId!,
    currencyCode: input.subject.currencyCode,
    bookId: input.binding.bookId,
    bookAccountInstanceId: input.binding.bookAccountInstanceId,
    postingAccountNo: input.binding.postingAccountNo,
    createdAt: input.binding.createdAt,
    updatedAt: input.binding.updatedAt,
  };
}

export class ResolveRequisiteBindingsQuery {
  constructor(
    private readonly requisiteReads: RequisiteReads,
    private readonly bindingReads: RequisiteBindingReads,
    private readonly log: Logger,
  ) {}

  async execute(input: { requisiteIds: string[] }) {
    const uniqueIds = [...new Set(input.requisiteIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
      return [];
    }

    const [subjects, bindings] = await Promise.all([
      this.requisiteReads.listSubjectsById(uniqueIds),
      this.bindingReads.listByRequisiteId(uniqueIds),
    ]);
    const subjectById = new Map(
      subjects.map((subject) => [subject.requisiteId, subject]),
    );
    const bindingById = new Map(
      bindings.map((binding) => [binding.requisiteId, binding]),
    );

    for (const requisiteId of uniqueIds) {
      const subject = subjectById.get(requisiteId);
      if (!subject) {
        throw new RequisiteNotFoundError(requisiteId);
      }

      if (subject.ownerType !== "organization" || !subject.organizationId) {
        throw new RequisiteAccountingBindingOwnerTypeError(requisiteId);
      }

      if (!bindingById.has(requisiteId)) {
        throw new RequisiteAccountingBindingNotFoundError(requisiteId);
      }
    }

    this.log.debug("Resolved requisite accounting bindings", {
      requested: input.requisiteIds.length,
      unique: uniqueIds.length,
    });

    return input.requisiteIds.map((id) =>
      toPublicBinding({
        subject: subjectById.get(id)!,
        binding: bindingById.get(id)!,
      }),
    );
  }
}
