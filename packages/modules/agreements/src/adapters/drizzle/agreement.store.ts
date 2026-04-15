import { eq, sql } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import {
  agreementFeeRules,
  agreementParties,
  agreementRoutePolicies,
  agreementRouteTemplateLinks,
  agreements,
  agreementVersions,
} from "./schema";
import type {
  AgreementStore,
  CreateAgreementFeeRuleStoredInput,
  CreateAgreementPartyStoredInput,
  CreateAgreementRootInput,
  CreateAgreementRoutePolicyStoredInput,
  CreateAgreementRouteTemplateLinkStoredInput,
  CreateAgreementVersionInput,
  StoredAgreementFeeRule,
  StoredAgreementParty,
  StoredAgreementRoot,
  StoredAgreementRoutePolicy,
  StoredAgreementRouteTemplateLink,
  StoredAgreementVersion,
} from "../../application/ports/agreement.store";

export class DrizzleAgreementStore implements AgreementStore {
  constructor(private readonly db: Queryable) {}

  async createAgreementRoot(
    input: CreateAgreementRootInput,
  ): Promise<StoredAgreementRoot> {
    const [created] = await this.db
      .insert(agreements)
      .values({
        id: input.id,
        customerId: input.customerId,
        organizationId: input.organizationId,
        organizationRequisiteId: input.organizationRequisiteId,
        isActive: input.isActive ?? true,
        currentVersionId: null,
      })
      .returning();

    return created!;
  }

  async createAgreementVersion(
    input: CreateAgreementVersionInput,
  ): Promise<StoredAgreementVersion> {
    const [created] = await this.db
      .insert(agreementVersions)
      .values({
        id: input.id,
        agreementId: input.agreementId,
        versionNumber: input.versionNumber,
        contractNumber: input.contractNumber,
        contractDate: input.contractDate,
      })
      .returning();

    return created!;
  }

  async createAgreementFeeRules(
    input: CreateAgreementFeeRuleStoredInput[],
  ): Promise<StoredAgreementFeeRule[]> {
    if (input.length === 0) {
      return [];
    }

    return this.db
      .insert(agreementFeeRules)
      .values(
        input.map((row) => ({
          id: row.id,
          agreementVersionId: row.agreementVersionId,
          kind: row.kind,
          unit: row.unit,
          valueNumeric: row.valueNumeric,
          currencyId: row.currencyId,
        })),
      )
      .returning();
  }

  async createAgreementParties(
    input: CreateAgreementPartyStoredInput[],
  ): Promise<StoredAgreementParty[]> {
    if (input.length === 0) {
      return [];
    }

    return this.db
      .insert(agreementParties)
      .values(
        input.map((row) => ({
          id: row.id,
          agreementVersionId: row.agreementVersionId,
          partyRole: row.partyRole,
          customerId: row.customerId,
          organizationId: row.organizationId,
        })),
      )
      .returning();
  }

  async createAgreementRoutePolicies(
    input: CreateAgreementRoutePolicyStoredInput[],
  ): Promise<StoredAgreementRoutePolicy[]> {
    if (input.length === 0) {
      return [];
    }

    return this.db
      .insert(agreementRoutePolicies)
      .values(
        input.map((row) => ({
          id: row.id,
          agreementVersionId: row.agreementVersionId,
          sequence: row.sequence,
          dealType: row.dealType,
          sourceCurrencyId: row.sourceCurrencyId,
          targetCurrencyId: row.targetCurrencyId,
          defaultMarkupBps: row.defaultMarkupBps,
          defaultWireFeeAmountMinor:
            row.defaultWireFeeAmountMinor === null
              ? null
              : BigInt(row.defaultWireFeeAmountMinor),
          defaultWireFeeCurrencyId: row.defaultWireFeeCurrencyId,
          defaultSubAgentCommissionUnit: row.defaultSubAgentCommissionUnit,
          defaultSubAgentCommissionBps: row.defaultSubAgentCommissionBps,
          defaultSubAgentCommissionAmountMinor:
            row.defaultSubAgentCommissionAmountMinor === null
              ? null
              : BigInt(row.defaultSubAgentCommissionAmountMinor),
          defaultSubAgentCommissionCurrencyId:
            row.defaultSubAgentCommissionCurrencyId,
          approvalThresholdAmountMinor:
            row.approvalThresholdAmountMinor === null
              ? null
              : BigInt(row.approvalThresholdAmountMinor),
          approvalThresholdCurrencyId: row.approvalThresholdCurrencyId,
          quoteValiditySeconds: row.quoteValiditySeconds,
        })),
      )
      .returning();
  }

  async createAgreementRouteTemplateLinks(
    input: CreateAgreementRouteTemplateLinkStoredInput[],
  ): Promise<StoredAgreementRouteTemplateLink[]> {
    if (input.length === 0) {
      return [];
    }

    return this.db
      .insert(agreementRouteTemplateLinks)
      .values(
        input.map((row) => ({
          id: row.id,
          agreementRoutePolicyId: row.agreementRoutePolicyId,
          routeTemplateId: row.routeTemplateId,
          sequence: row.sequence,
          isDefault: row.isDefault,
        })),
      )
      .returning();
  }

  async setCurrentVersion(input: {
    agreementId: string;
    currentVersionId: string;
  }): Promise<void> {
    await this.db
      .update(agreements)
      .set({
        currentVersionId: input.currentVersionId,
        updatedAt: sql`now()`,
      })
      .where(eq(agreements.id, input.agreementId));
  }

  async setActive(input: {
    agreementId: string;
    isActive: boolean;
  }): Promise<void> {
    await this.db
      .update(agreements)
      .set({
        isActive: input.isActive,
        updatedAt: sql`now()`,
      })
      .where(eq(agreements.id, input.agreementId));
  }
}
