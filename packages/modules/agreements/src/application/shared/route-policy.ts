import type {
  AgreementDetails,
  AgreementResolvedRouteDefaults,
} from "../contracts/dto";
import type { AgreementRoutePolicyInput } from "../contracts/commands";
import type { AgreementReferencesPort } from "../ports/references.port";
import {
  AgreementRouteTemplateDealTypeMismatchError,
  AgreementRouteTemplateUnavailableError,
} from "../../errors";

export async function assertAgreementRoutePolicyReferences(
  routePolicies: AgreementRoutePolicyInput[],
  references: AgreementReferencesPort,
) {
  await Promise.all(
    routePolicies.flatMap((policy) =>
      [
        policy.sourceCurrencyId,
        policy.targetCurrencyId,
        policy.defaultWireFeeCurrencyId,
        policy.defaultSubAgentCommissionCurrencyId,
        policy.approvalThresholdCurrencyId,
      ]
        .filter((currencyId): currencyId is string => Boolean(currencyId))
        .map((currencyId) => references.assertCurrencyExists(currencyId)),
    ),
  );

  const templateIds = Array.from(
    new Set(
      routePolicies.flatMap((policy) =>
        policy.templateLinks.map((link) => link.routeTemplateId),
      ),
    ),
  );
  const resolvedTemplates = await Promise.all(
    templateIds.map(async (templateId) => {
      const template = await references.findRouteTemplateById(templateId);
      return [templateId, template] as const;
    }),
  );
  const templates = new Map<string, Awaited<
    ReturnType<AgreementReferencesPort["findRouteTemplateById"]>
  >>(resolvedTemplates);

  for (const policy of routePolicies) {
    for (const link of policy.templateLinks) {
      const template = templates.get(link.routeTemplateId) ?? null;

      if (!template || template.status !== "published") {
        throw new AgreementRouteTemplateUnavailableError(link.routeTemplateId);
      }

      if (template.dealType !== policy.dealType) {
        throw new AgreementRouteTemplateDealTypeMismatchError(
          link.routeTemplateId,
          template.dealType,
          policy.dealType,
        );
      }
    }
  }
}

export function buildAgreementRoutePolicyRows(input: {
  agreementVersionId: string;
  generateUuid: () => string;
  routePolicies: AgreementRoutePolicyInput[];
}) {
  const policies = input.routePolicies.map((policy) => ({
    id: input.generateUuid(),
    agreementVersionId: input.agreementVersionId,
    sequence: policy.sequence,
    dealType: policy.dealType,
    sourceCurrencyId: policy.sourceCurrencyId,
    targetCurrencyId: policy.targetCurrencyId,
    defaultMarkupBps: policy.defaultMarkupBps,
    defaultWireFeeAmountMinor: policy.defaultWireFeeAmountMinor,
    defaultWireFeeCurrencyId: policy.defaultWireFeeCurrencyId,
    defaultSubAgentCommissionUnit: policy.defaultSubAgentCommissionUnit,
    defaultSubAgentCommissionBps: policy.defaultSubAgentCommissionBps,
    defaultSubAgentCommissionAmountMinor:
      policy.defaultSubAgentCommissionAmountMinor,
    defaultSubAgentCommissionCurrencyId:
      policy.defaultSubAgentCommissionCurrencyId,
    approvalThresholdAmountMinor: policy.approvalThresholdAmountMinor,
    approvalThresholdCurrencyId: policy.approvalThresholdCurrencyId,
    quoteValiditySeconds: policy.quoteValiditySeconds,
  }));
  const policyIdBySequence = new Map(
    policies.map((policy) => [policy.sequence, policy.id]),
  );
  const templateLinks = input.routePolicies.flatMap((policy) =>
    policy.templateLinks.map((link) => ({
      id: input.generateUuid(),
      agreementRoutePolicyId: policyIdBySequence.get(policy.sequence)!,
      routeTemplateId: link.routeTemplateId,
      sequence: link.sequence,
      isDefault: link.isDefault,
    })),
  );

  return { policies, templateLinks };
}

export function mapExistingRoutePolicies(
  current: AgreementDetails,
): AgreementRoutePolicyInput[] {
  return current.currentVersion.routePolicies.map((policy) => ({
    sequence: policy.sequence,
    dealType: policy.dealType,
    sourceCurrencyId: policy.sourceCurrencyId,
    targetCurrencyId: policy.targetCurrencyId,
    defaultMarkupBps: policy.defaultMarkupBps,
    defaultWireFeeAmountMinor: policy.defaultWireFeeAmountMinor,
    defaultWireFeeCurrencyId: policy.defaultWireFeeCurrencyId,
    defaultSubAgentCommissionUnit: policy.defaultSubAgentCommissionUnit,
    defaultSubAgentCommissionBps: policy.defaultSubAgentCommissionBps,
    defaultSubAgentCommissionAmountMinor:
      policy.defaultSubAgentCommissionAmountMinor,
    defaultSubAgentCommissionCurrencyId:
      policy.defaultSubAgentCommissionCurrencyId,
    approvalThresholdAmountMinor: policy.approvalThresholdAmountMinor,
    approvalThresholdCurrencyId: policy.approvalThresholdCurrencyId,
    quoteValiditySeconds: policy.quoteValiditySeconds,
    templateLinks: policy.templateLinks.map((link) => ({
      routeTemplateId: link.routeTemplateId,
      sequence: link.sequence,
      isDefault: link.isDefault,
    })),
  }));
}

function calculatePolicySpecificity(policy: AgreementDetails["currentVersion"]["routePolicies"][number]) {
  let score = 0;

  if (policy.sourceCurrencyId) {
    score += 1;
  }

  if (policy.targetCurrencyId) {
    score += 1;
  }

  return score;
}

export function resolveAgreementRouteDefaults(input: {
  agreement: AgreementDetails;
  dealType: AgreementDetails["currentVersion"]["routePolicies"][number]["dealType"];
  sourceCurrencyId: string | null;
  targetCurrencyId: string | null;
}): AgreementResolvedRouteDefaults {
  const matching = input.agreement.currentVersion.routePolicies
    .filter((policy) => policy.dealType === input.dealType)
    .filter(
      (policy) =>
        policy.sourceCurrencyId === null ||
        policy.sourceCurrencyId === input.sourceCurrencyId,
    )
    .filter(
      (policy) =>
        policy.targetCurrencyId === null ||
        policy.targetCurrencyId === input.targetCurrencyId,
    )
    .sort((left, right) => {
      const specificityDelta =
        calculatePolicySpecificity(right) - calculatePolicySpecificity(left);

      if (specificityDelta !== 0) {
        return specificityDelta;
      }

      return left.sequence - right.sequence;
    });

  return {
    agreementId: input.agreement.id,
    agreementVersionId: input.agreement.currentVersion.id,
    policy: matching[0] ?? null,
  };
}
