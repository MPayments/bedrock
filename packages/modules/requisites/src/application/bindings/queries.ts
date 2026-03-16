import type { RequisiteAccountingBinding } from "../../contracts";
import {
  RequisiteAccountingBindingNotFoundError,
  RequisiteAccountingBindingOwnerTypeError,
  RequisiteNotFoundError,
} from "../../errors";
import type { RequisitesServiceContext } from "../shared/context";

function toPublicBinding(input: {
  subject: NonNullable<
    Awaited<ReturnType<RequisitesServiceContext["requisiteQueries"]["findSubjectById"]>>
  >;
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
  context: RequisitesServiceContext,
  requisiteId: string,
) {
  const subject = await context.requisiteQueries.findSubjectById(requisiteId);

  if (!subject) {
    throw new RequisiteNotFoundError(requisiteId);
  }

  if (subject.ownerType !== "organization" || !subject.organizationId) {
    throw new RequisiteAccountingBindingOwnerTypeError(requisiteId);
  }

  return subject;
}

export function createGetRequisiteAccountingBindingHandler(
  context: RequisitesServiceContext,
) {
  const { bindingQueries } = context;

  return async function getRequisiteAccountingBinding(requisiteId: string) {
    const [subject, binding] = await Promise.all([
      requireOrganizationRequisiteSubject(context, requisiteId),
      bindingQueries.findBindingByRequisiteId(requisiteId),
    ]);

    if (!binding) {
      throw new RequisiteAccountingBindingNotFoundError(requisiteId);
    }

    return toPublicBinding({ subject, binding });
  };
}

export function createResolveRequisiteAccountingBindingsHandler(
  context: RequisitesServiceContext,
) {
  const { bindingQueries, log, requisiteQueries } = context;

  return async function resolveRequisiteAccountingBindings(input: {
    requisiteIds: string[];
  }) {
    const uniqueIds = [...new Set(input.requisiteIds.filter(Boolean))];

    if (uniqueIds.length === 0) {
      return [];
    }

    const [subjects, bindings] = await Promise.all([
      requisiteQueries.listSubjectsById(uniqueIds),
      bindingQueries.listBindingsByRequisiteId(uniqueIds),
    ]);
    const subjectById = new Map(subjects.map((subject) => [subject.requisiteId, subject]));
    const bindingById = new Map(bindings.map((binding) => [binding.requisiteId, binding]));

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

    log.debug("Resolved requisite accounting bindings", {
      requested: input.requisiteIds.length,
      unique: uniqueIds.length,
    });

    return input.requisiteIds.map((id) =>
      toPublicBinding({
        subject: subjectById.get(id)!,
        binding: bindingById.get(id)!,
      }),
    );
  };
}
