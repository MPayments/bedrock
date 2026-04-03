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

async function requireOrganizationRequisiteSubject(
  reads: RequisiteReads,
  requisiteId: string,
) {
  const subject = await reads.findSubjectById(requisiteId);

  if (!subject) {
    throw new RequisiteNotFoundError(requisiteId);
  }

  if (subject.ownerType !== "organization" || !subject.organizationId) {
    throw new RequisiteAccountingBindingOwnerTypeError(requisiteId);
  }

  return subject;
}

export class GetRequisiteBindingQuery {
  constructor(
    private readonly requisiteReads: RequisiteReads,
    private readonly bindingReads: RequisiteBindingReads,
  ) {}

  async execute(requisiteId: string) {
    const [subject, binding] = await Promise.all([
      requireOrganizationRequisiteSubject(this.requisiteReads, requisiteId),
      this.bindingReads.findByRequisiteId(requisiteId),
    ]);

    if (!binding) {
      throw new RequisiteAccountingBindingNotFoundError(requisiteId);
    }

    return toPublicBinding({ subject, binding });
  }
}
