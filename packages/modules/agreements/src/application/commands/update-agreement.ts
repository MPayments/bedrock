import { z } from "zod";

import type { ModuleRuntime } from "@bedrock/shared/core";
import { ValidationError } from "@bedrock/shared/core/errors";

import { AGREEMENTS_UPDATE_IDEMPOTENCY_SCOPE } from "../../domain/constants";
import { AgreementNotFoundError } from "../../errors";
import {
  CreateAgreementFeeRuleInputSchema,
  UpdateAgreementInputSchema,
  type CreateAgreementFeeRuleInput,
  type UpdateAgreementInput,
} from "../contracts/commands";
import type { AgreementDetails } from "../contracts/dto";
import type { AgreementsCommandUnitOfWork } from "../ports/agreements.uow";
import type { AgreementReferencesPort } from "../ports/references.port";

const UpdateAgreementCommandInputSchema = UpdateAgreementInputSchema.extend({
  actorUserId: z.string().trim().min(1),
  id: z.uuid(),
  idempotencyKey: z.string().trim().min(1).max(255),
});

type UpdateAgreementCommandInput = UpdateAgreementInput & {
  actorUserId: string;
  id: string;
  idempotencyKey: string;
};

function assertValidNumericRuleValue(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ValidationError(`Invalid fee rule value: ${value}`);
  }
}

function buildPartyRows(input: {
  agreementVersionId: string;
  customerId: string;
  generateUuid: () => string;
  organizationId: string;
}) {
  return [
    {
      id: input.generateUuid(),
      agreementVersionId: input.agreementVersionId,
      partyRole: "customer" as const,
      customerId: input.customerId,
      organizationId: null,
    },
    {
      id: input.generateUuid(),
      agreementVersionId: input.agreementVersionId,
      partyRole: "organization" as const,
      customerId: null,
      organizationId: input.organizationId,
    },
  ];
}

function mapExistingFeeRules(current: AgreementDetails): CreateAgreementFeeRuleInput[] {
  return current.currentVersion.feeRules.map((rule) =>
    CreateAgreementFeeRuleInputSchema.parse({
      kind: rule.kind,
      unit: rule.unit,
      value: rule.value,
      ...(rule.currencyId ? { currencyId: rule.currencyId } : {}),
    }),
  );
}

async function assertCurrenciesExist(
  feeRules: CreateAgreementFeeRuleInput[],
  references: AgreementReferencesPort,
) {
  await Promise.all(
    feeRules
      .filter((rule) => Boolean(rule.currencyId))
      .map((rule) => references.assertCurrencyExists(rule.currencyId!)),
  );
}

export class UpdateAgreementCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: AgreementsCommandUnitOfWork,
    private readonly references: AgreementReferencesPort,
  ) {}

  async execute(raw: UpdateAgreementCommandInput): Promise<AgreementDetails> {
    const validated = UpdateAgreementCommandInputSchema.parse(raw);

    return this.commandUow.run((tx) =>
      tx.idempotency.withIdempotency({
        scope: AGREEMENTS_UPDATE_IDEMPOTENCY_SCOPE,
        idempotencyKey: validated.idempotencyKey,
        request: {
          agreementId: validated.id,
          contractNumber: validated.contractNumber ?? "__keep__",
          contractDate:
            validated.contractDate === undefined
              ? "__keep__"
              : validated.contractDate?.toISOString() ?? null,
          feeRules: validated.feeRules ?? "__keep__",
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
          const current = await tx.agreementReads.findById(validated.id);

          if (!current) {
            throw new AgreementNotFoundError(validated.id);
          }

          const feeRules = validated.feeRules ?? mapExistingFeeRules(current);
          feeRules.forEach((rule) => assertValidNumericRuleValue(rule.value));
          await assertCurrenciesExist(feeRules, this.references);

          const versionId = this.runtime.generateUuid();
          const nextVersionNumber = current.currentVersion.versionNumber + 1;

          await tx.agreementStore.createAgreementVersion({
            id: versionId,
            agreementId: current.id,
            versionNumber: nextVersionNumber,
            contractNumber:
              validated.contractNumber === undefined
                ? current.currentVersion.contractNumber
                : validated.contractNumber,
            contractDate:
              validated.contractDate === undefined
                ? current.currentVersion.contractDate
                : validated.contractDate,
          });

          await tx.agreementStore.createAgreementParties(
            buildPartyRows({
              agreementVersionId: versionId,
              customerId: current.customerId,
              generateUuid: () => this.runtime.generateUuid(),
              organizationId: current.organizationId,
            }),
          );

          await tx.agreementStore.createAgreementFeeRules(
            feeRules.map((rule) => ({
              id: this.runtime.generateUuid(),
              agreementVersionId: versionId,
              kind: rule.kind,
              unit: rule.unit,
              valueNumeric: rule.value,
              currencyId: rule.currencyId ?? null,
            })),
          );

          await tx.agreementStore.setCurrentVersion({
            agreementId: current.id,
            currentVersionId: versionId,
          });

          const updated = await tx.agreementReads.findById(current.id);

          if (!updated) {
            throw new AgreementNotFoundError(current.id);
          }

          this.runtime.log.info("Agreement updated", {
            agreementId: current.id,
            versionId,
            versionNumber: nextVersionNumber,
          });

          return updated;
        },
      }),
    );
  }
}
