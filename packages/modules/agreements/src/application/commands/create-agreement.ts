import { z } from "zod";

import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { ModuleRuntime } from "@bedrock/shared/core";
import {
  NotFoundError,
  ValidationError,
} from "@bedrock/shared/core/errors";

import { AGREEMENTS_CREATE_IDEMPOTENCY_SCOPE } from "../../domain/constants";
import {
  AgreementNotFoundError,
  AgreementRequisiteBindingMissingError,
  AgreementRequisiteOwnershipError,
} from "../../errors";
import {
  CreateAgreementInputSchema,
  type CreateAgreementInput,
} from "../contracts/commands";
import type { AgreementDetails } from "../contracts/dto";
import type { AgreementsCommandUnitOfWork } from "../ports/agreements.uow";
import type { AgreementReferencesPort } from "../ports/references.port";
import {
  assertAgreementRoutePolicyReferences,
  buildAgreementRoutePolicyRows,
} from "../shared/route-policy";

const CreateAgreementCommandInputSchema = CreateAgreementInputSchema.extend({
  actorUserId: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1).max(255),
});

type CreateAgreementCommandInput = CreateAgreementInput & {
  actorUserId: string;
  idempotencyKey: string;
};

async function validateAgreementReferences(
  input: CreateAgreementCommandInput,
  references: AgreementReferencesPort,
) {
  const [customer, organization, subject, binding] = await Promise.all([
    references.findCustomerById(input.customerId),
    references.findOrganizationById(input.organizationId),
    references.findRequisiteSubjectById(input.organizationRequisiteId),
    references.findOrganizationRequisiteBindingByRequisiteId(
      input.organizationRequisiteId,
    ),
  ]);

  if (!customer) {
    throw new NotFoundError("Customer", input.customerId);
  }

  if (!organization) {
    throw new NotFoundError("Organization", input.organizationId);
  }

  if (!subject) {
    throw new NotFoundError("Requisite", input.organizationRequisiteId);
  }

  if (
    subject.ownerType !== "organization" ||
    subject.organizationId !== input.organizationId
  ) {
    throw new AgreementRequisiteOwnershipError(
      input.organizationRequisiteId,
      input.organizationId,
    );
  }

  if (!binding) {
    throw new AgreementRequisiteBindingMissingError(input.organizationRequisiteId);
  }

  await Promise.all(
    input.feeRules
      .filter((rule) => rule.currencyId)
      .map((rule) => references.assertCurrencyExists(rule.currencyId!)),
  );

  await assertAgreementRoutePolicyReferences(input.routePolicies, references);
}

function assertValidNumericRuleValue(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ValidationError(`Invalid fee rule value: ${value}`);
  }
}

export class CreateAgreementCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: AgreementsCommandUnitOfWork,
    private readonly idempotency: IdempotencyPort,
    private readonly references: AgreementReferencesPort,
  ) {}

  async execute(raw: CreateAgreementCommandInput): Promise<AgreementDetails> {
    const validated = CreateAgreementCommandInputSchema.parse(raw);

    validated.feeRules.forEach((rule) => assertValidNumericRuleValue(rule.value));
    await validateAgreementReferences(validated, this.references);

    return this.commandUow.run((tx) =>
      this.idempotency.withIdempotencyTx({
        tx: tx.transaction,
        scope: AGREEMENTS_CREATE_IDEMPOTENCY_SCOPE,
        idempotencyKey: validated.idempotencyKey,
        request: {
          customerId: validated.customerId,
          organizationId: validated.organizationId,
          organizationRequisiteId: validated.organizationRequisiteId,
          contractNumber: validated.contractNumber,
          contractDate: validated.contractDate?.toISOString() ?? null,
          feeRules: validated.feeRules,
          routePolicies: validated.routePolicies,
        },
        actorId: validated.actorUserId,
        serializeResult: (result) => ({ agreementId: result.id }),
        loadReplayResult: async ({ storedResult }) => {
          const agreementId = String(storedResult?.agreementId ?? "");
          const replayed = await tx.agreementReads.findById(agreementId);

          if (!replayed) {
            throw new AgreementNotFoundError(agreementId);
          }

          return replayed;
        },
        handler: async () => {
          const agreementId = this.runtime.generateUuid();
          const versionId = this.runtime.generateUuid();

          await tx.agreementStore.createAgreementRoot({
            id: agreementId,
            customerId: validated.customerId,
            organizationId: validated.organizationId,
            organizationRequisiteId: validated.organizationRequisiteId,
          });

          await tx.agreementStore.createAgreementVersion({
            id: versionId,
            agreementId,
            versionNumber: 1,
            contractNumber: validated.contractNumber,
            contractDate: validated.contractDate ?? null,
          });

          await tx.agreementStore.createAgreementParties([
            {
              id: this.runtime.generateUuid(),
              agreementVersionId: versionId,
              partyRole: "customer",
              customerId: validated.customerId,
              organizationId: null,
            },
            {
              id: this.runtime.generateUuid(),
              agreementVersionId: versionId,
              partyRole: "organization",
              customerId: null,
              organizationId: validated.organizationId,
            },
          ]);

          await tx.agreementStore.createAgreementFeeRules(
            validated.feeRules.map((rule) => ({
              id: this.runtime.generateUuid(),
              agreementVersionId: versionId,
              kind: rule.kind,
              unit: rule.unit,
              valueNumeric: rule.value,
              currencyId: rule.currencyId ?? null,
            })),
          );

          const routePolicyRows = buildAgreementRoutePolicyRows({
            agreementVersionId: versionId,
            generateUuid: () => this.runtime.generateUuid(),
            routePolicies: validated.routePolicies,
          });

          await tx.agreementStore.createAgreementRoutePolicies(
            routePolicyRows.policies,
          );
          await tx.agreementStore.createAgreementRouteTemplateLinks(
            routePolicyRows.templateLinks,
          );

          await tx.agreementStore.setCurrentVersion({
            agreementId,
            currentVersionId: versionId,
          });

          const created = await tx.agreementReads.findById(agreementId);

          if (!created) {
            throw new AgreementNotFoundError(agreementId);
          }

          this.runtime.log.info("Agreement created", {
            agreementId,
            customerId: validated.customerId,
            organizationId: validated.organizationId,
          });

          return created;
        },
      }),
    );
  }
}
