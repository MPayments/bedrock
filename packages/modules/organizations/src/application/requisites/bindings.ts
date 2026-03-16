import {
  UpsertOrganizationRequisiteAccountingBindingInputSchema,
  type OrganizationRequisiteAccountingBinding,
  type UpsertOrganizationRequisiteAccountingBindingInput,
} from "../../contracts";
import {
  OrganizationRequisiteBindingNotFoundError,
  OrganizationRequisiteBindingOwnerTypeError,
  OrganizationRequisiteNotFoundError,
} from "../../errors";
import type { OrganizationsServiceContext } from "../shared/context";
import type { OrganizationsTransactionContext } from "../shared/external-ports";

const DEFAULT_REQUISITE_POSTING_ACCOUNT_NO = "1110";

async function requireOrganizationRequisiteSubject(
  context: OrganizationsServiceContext,
  requisiteId: string,
  tx?: OrganizationsTransactionContext["tx"],
) {
  const subject = await context.requisiteSubjects.findRequisiteSubjectById(
    requisiteId,
    tx,
  );

  if (!subject) {
    throw new OrganizationRequisiteNotFoundError(requisiteId);
  }

  if (subject.ownerType !== "organization" || !subject.organizationId) {
    throw new OrganizationRequisiteBindingOwnerTypeError(requisiteId);
  }

  return subject;
}

export async function syncOrganizationRequisiteAccountingBinding(
  context: OrganizationsServiceContext,
  transaction: OrganizationsTransactionContext,
  input: {
    requisiteId: string;
    organizationId: string;
    currencyCode: string;
    postingAccountNo?: string;
  },
) {
  const postingAccountNo =
    input.postingAccountNo ?? DEFAULT_REQUISITE_POSTING_ACCOUNT_NO;
  const postingTarget =
    await transaction.ledgerBindings.ensureOrganizationPostingTarget({
      organizationId: input.organizationId,
      currencyCode: input.currencyCode,
      postingAccountNo,
    });

  const binding = await transaction.requisiteBindings.upsertBinding({
    requisiteId: input.requisiteId,
    bookId: postingTarget.bookId,
    bookAccountInstanceId: postingTarget.bookAccountInstanceId,
    postingAccountNo,
  });

  if (!binding) {
    throw new OrganizationRequisiteBindingNotFoundError(input.requisiteId);
  }

  return toPublicBinding({
    subject: {
      requisiteId: input.requisiteId,
      ownerType: "organization",
      ownerId: input.organizationId,
      organizationId: input.organizationId,
      currencyId: "",
      currencyCode: input.currencyCode,
    },
    binding,
  });
}

function toPublicBinding(input: {
  subject: Awaited<ReturnType<typeof requireOrganizationRequisiteSubject>>;
  binding: {
    requisiteId: string;
    bookId: string;
    bookAccountInstanceId: string;
    postingAccountNo: string;
    createdAt: Date;
    updatedAt: Date;
  };
}): OrganizationRequisiteAccountingBinding {
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

export function createGetOrganizationRequisiteAccountingBindingHandler(
  context: OrganizationsServiceContext,
) {
  const { requisiteBindingQueries } = context;

  return async function getOrganizationRequisiteAccountingBinding(
    requisiteId: string,
  ) {
    const [subject, binding] = await Promise.all([
      requireOrganizationRequisiteSubject(context, requisiteId),
      requisiteBindingQueries.findBindingByRequisiteId(requisiteId),
    ]);

    if (!binding) {
      throw new OrganizationRequisiteBindingNotFoundError(requisiteId);
    }

    return toPublicBinding({ subject, binding });
  };
}

export function createResolveOrganizationRequisiteBindingsHandler(
  context: OrganizationsServiceContext,
) {
  const { log, requisiteBindingQueries, requisiteSubjects } = context;

  return async function resolveOrganizationRequisiteBindings(input: {
    requisiteIds: string[];
  }) {
    const uniqueIds = [...new Set(input.requisiteIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
      return [];
    }

    const [subjects, bindings] = await Promise.all([
      requisiteSubjects.listRequisiteSubjectsById(uniqueIds),
      requisiteBindingQueries.listBindingsByRequisiteId(uniqueIds),
    ]);
    const subjectById = new Map(subjects.map((subject) => [subject.requisiteId, subject]));
    const bindingById = new Map(bindings.map((binding) => [binding.requisiteId, binding]));

    for (const requisiteId of uniqueIds) {
      const subject = subjectById.get(requisiteId);
      if (!subject) {
        throw new OrganizationRequisiteNotFoundError(requisiteId);
      }
      if (subject.ownerType !== "organization" || !subject.organizationId) {
        throw new OrganizationRequisiteBindingOwnerTypeError(requisiteId);
      }
      if (!bindingById.has(requisiteId)) {
        throw new OrganizationRequisiteBindingNotFoundError(requisiteId);
      }
    }

    log.debug("Resolved organization requisite bindings", {
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

export function createUpsertOrganizationRequisiteAccountingBindingHandler(
  context: OrganizationsServiceContext,
) {
  const { log, transactions } = context;

  return async function upsertOrganizationRequisiteAccountingBinding(
    requisiteId: string,
    input: UpsertOrganizationRequisiteAccountingBindingInput,
  ) {
    const validated =
      UpsertOrganizationRequisiteAccountingBindingInputSchema.parse(input);

    const binding = await transactions.withTransaction(async (transaction) => {
      const subject = await requireOrganizationRequisiteSubject(
        context,
        requisiteId,
        transaction.tx,
      );

      return syncOrganizationRequisiteAccountingBinding(context, transaction, {
        requisiteId,
        organizationId: subject.organizationId!,
        currencyCode: subject.currencyCode,
        postingAccountNo: validated.postingAccountNo,
      });
    });

    log.info("Organization requisite accounting binding updated", { requisiteId });
    return binding;
  };
}
