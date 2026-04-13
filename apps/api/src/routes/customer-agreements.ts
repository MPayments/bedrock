import { z } from "@hono/zod-openapi";

import {
  AgreementActiveCustomerInvariantError,
  AgreementRootLinksImmutableError,
} from "@bedrock/agreements";
import type { AgreementDetails } from "@bedrock/agreements/contracts";
import type { Counterparty } from "@bedrock/parties/contracts";
import {
  InvalidStateError,
  NotFoundError,
  ValidationError,
} from "@bedrock/shared/core/errors";
import { getUuidPrefix } from "@bedrock/shared/core/uuid";

import type { AppContext } from "../context";

function isPositiveDecimalString(value: string): boolean {
  const [whole, fraction, ...rest] = value.split(".");

  if (rest.length > 0 || !whole || !/^[0-9]+$/u.test(whole)) {
    return false;
  }

  if (fraction === undefined) {
    return true;
  }

  return fraction.length > 0 && /^[0-9]+$/u.test(fraction);
}

const AgreementDecimalStringSchema = z
  .string()
  .trim()
  .refine(isPositiveDecimalString, "Must be a positive decimal string");

function trimToNull(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildDefaultCustomerAgreementContractNumber(
  customerId: string,
): string {
  return `contract#${getUuidPrefix(customerId).toUpperCase()}`;
}

function trimLeadingZeros(value: string): string {
  const trimmed = value.replace(/^0+(?=\d)/, "");
  return trimmed.length > 0 ? trimmed : "0";
}

function normalizeDecimalString(value: string): string {
  const [wholeRaw = "0", fractionRaw = ""] = value.split(".");
  const whole = trimLeadingZeros(wholeRaw);
  const fraction = fractionRaw.replace(/0+$/, "");

  return fraction.length > 0 ? `${whole}.${fraction}` : whole;
}

function shiftPositiveDecimalString(value: string, decimalPlaces: number): string {
  const normalized = AgreementDecimalStringSchema.parse(value);
  const [wholeRaw, fractionRaw = ""] = normalized.split(".");
  const digits = `${wholeRaw}${fractionRaw}`.replace(/^0+(?=\d)/, "") || "0";
  const nextScale = fractionRaw.length - decimalPlaces;

  if (digits === "0") {
    return "0";
  }

  if (nextScale <= 0) {
    return normalizeDecimalString(`${digits}${"0".repeat(-nextScale)}`);
  }

  if (nextScale >= digits.length) {
    return normalizeDecimalString(
      `0.${"0".repeat(nextScale - digits.length)}${digits}`,
    );
  }

  const integerPart = digits.slice(0, digits.length - nextScale);
  const fractionPart = digits.slice(digits.length - nextScale);

  return normalizeDecimalString(`${integerPart}.${fractionPart}`);
}

function formatContractDate(value: Date | null): string | null {
  if (!value) {
    return null;
  }

  return value.toISOString().slice(0, 10);
}

function parseCompatibilityDate(
  value: string | null | undefined,
): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = trimToNull(value);
  if (!normalized) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new ValidationError("contractDate must be a YYYY-MM-DD date");
  }

  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== normalized
  ) {
    throw new ValidationError("contractDate must be a valid YYYY-MM-DD date");
  }

  return parsed;
}

function serializeAgreementFees(agreement: AgreementDetails) {
  let agentFee: string | null = null;
  let fixedFee: string | null = null;

  for (const rule of agreement.currentVersion.feeRules) {
    if (rule.kind === "agent_fee") {
      agentFee = shiftPositiveDecimalString(rule.value, -2);
      continue;
    }

    if (rule.kind === "fixed_fee") {
      fixedFee = normalizeDecimalString(rule.value);
    }
  }

  return { agentFee, fixedFee };
}

async function buildAgreementFeeRules(input: {
  agentFee?: string | null;
  ctx: AppContext;
  fixedFee?: string | null;
}) {
  const feeRules: {
    currencyId?: string;
    kind: "agent_fee" | "fixed_fee";
    unit: "bps" | "money";
    value: string;
  }[] = [];

  const agentFee = trimToNull(input.agentFee);
  if (agentFee) {
    feeRules.push({
      kind: "agent_fee",
      unit: "bps",
      value: shiftPositiveDecimalString(agentFee, 2),
    });
  }

  const fixedFee = trimToNull(input.fixedFee);
  if (fixedFee) {
    const usd = await input.ctx.currenciesService.findByCode("USD");
    feeRules.push({
      currencyId: usd.id,
      kind: "fixed_fee",
      unit: "money",
      value: normalizeDecimalString(
        AgreementDecimalStringSchema.parse(fixedFee),
      ),
    });
  }

  return feeRules;
}

export const CustomerAgreementSchema = z.object({
  id: z.string().uuid(),
  contractNumber: z.string().nullable(),
  contractDate: z.string().nullable(),
  agentFee: z.string().nullable(),
  fixedFee: z.string().nullable(),
  organizationId: z.string().uuid(),
  organizationRequisiteId: z.string().uuid(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CustomerAgreementUpdateContractInputSchema = z
  .object({
    organizationId: z.string().uuid().optional(),
    organizationRequisiteId: z.string().uuid().optional(),
    contractDate: z.string().nullable().optional(),
    contractNumber: z.string().nullable().optional(),
    agentFee: z.string().nullable().optional(),
    fixedFee: z.string().nullable().optional(),
  })
  .strict();

export type CustomerAgreement = z.infer<typeof CustomerAgreementSchema>;
export type CustomerAgreementUpdateInput = z.infer<
  typeof CustomerAgreementUpdateContractInputSchema
>;

export function serializeCustomerAgreement(
  agreement: AgreementDetails,
): CustomerAgreement {
  const fees = serializeAgreementFees(agreement);

  return {
    id: agreement.id,
    contractNumber: agreement.currentVersion.contractNumber,
    contractDate: formatContractDate(agreement.currentVersion.contractDate),
    agentFee: fees.agentFee,
    fixedFee: fees.fixedFee,
    organizationId: agreement.organizationId,
    organizationRequisiteId: agreement.organizationRequisiteId,
    isActive: agreement.isActive,
    createdAt: agreement.createdAt.toISOString(),
    updatedAt: agreement.updatedAt.toISOString(),
  };
}

async function listAgreementDetails(
  ctx: AppContext,
  input: {
    customerId?: string;
    isActive?: boolean;
    limit: number;
    offset: number;
    sortBy: "createdAt" | "contractNumber";
    sortOrder: "asc" | "desc";
  },
) {
  const summaries = await ctx.agreementsModule.agreements.queries.list({
    customerId: input.customerId,
    isActive: input.isActive,
    limit: input.limit,
    offset: input.offset,
    sortBy: input.sortBy,
    sortOrder: input.sortOrder,
  });

  const agreements = await Promise.all(
    summaries.data.map((summary) =>
      ctx.agreementsModule.agreements.queries.findById(summary.id),
    ),
  );

  return {
    ...summaries,
    data: agreements,
  };
}

export async function resolveEffectiveAgreementByCustomerId(
  ctx: AppContext,
  customerId: string,
): Promise<AgreementDetails | null> {
  const result = await listAgreementDetails(ctx, {
    customerId,
    isActive: true,
    limit: 2,
    offset: 0,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  if (result.data.length > 1) {
    throw new AgreementActiveCustomerInvariantError(customerId);
  }

  return result.data[0] ?? null;
}

export async function resolveEffectiveCustomerAgreementByCustomerId(
  ctx: AppContext,
  customerId: string,
): Promise<CustomerAgreement | null> {
  const agreement = await resolveEffectiveAgreementByCustomerId(ctx, customerId);
  return agreement ? serializeCustomerAgreement(agreement) : null;
}

export async function assertCustomerOwnsCounterparty(
  ctx: AppContext,
  input: {
    counterpartyId: string;
    customerId: string;
  },
): Promise<Counterparty> {
  const counterparty = await ctx.partiesModule.counterparties.queries.findById(
    input.counterpartyId,
  );

  if (
    !counterparty ||
    counterparty.customerId !== input.customerId ||
    counterparty.relationshipKind !== "customer_owned"
  ) {
    throw new NotFoundError("Customer counterparty", input.counterpartyId);
  }

  return counterparty;
}

export async function createCustomerAgreementForCustomer(
  ctx: AppContext,
  input: {
    agentFee?: string | null;
    contractDate?: string | null;
    contractNumber?: string | null;
    customerId: string;
    fixedFee?: string | null;
    organizationId: string;
    organizationRequisiteId: string;
  },
  actorUserId: string,
  idempotencyKey: string,
): Promise<CustomerAgreement> {
  const existing = await resolveEffectiveAgreementByCustomerId(
    ctx,
    input.customerId,
  );
  if (existing) {
    throw new InvalidStateError(
      `Active agreement already exists for customer ${input.customerId}`,
    );
  }

  const agreement = await ctx.agreementsModule.agreements.commands.create({
    actorUserId,
    customerId: input.customerId,
    idempotencyKey,
    organizationId: input.organizationId,
    organizationRequisiteId: input.organizationRequisiteId,
    contractDate: parseCompatibilityDate(input.contractDate) ?? undefined,
    contractNumber:
      trimToNull(input.contractNumber) ??
      buildDefaultCustomerAgreementContractNumber(input.customerId),
    feeRules: await buildAgreementFeeRules({
      agentFee: input.agentFee,
      ctx,
      fixedFee: input.fixedFee,
    }),
  });

  return serializeCustomerAgreement(agreement);
}

export async function updateCustomerAgreement(
  ctx: AppContext,
  input: CustomerAgreementUpdateInput,
  agreementId: string,
  actorUserId: string,
  idempotencyKey: string,
): Promise<CustomerAgreement> {
  const current = await ctx.agreementsModule.agreements.queries.findById(
    agreementId,
  );
  if (!current) {
    throw new NotFoundError("Agreement", agreementId);
  }

  if (
    input.organizationId !== undefined &&
    input.organizationId !== current.organizationId
  ) {
    throw new AgreementRootLinksImmutableError();
  }

  if (
    input.organizationRequisiteId !== undefined &&
    input.organizationRequisiteId !== current.organizationRequisiteId
  ) {
    throw new AgreementRootLinksImmutableError();
  }

  const updated = await ctx.agreementsModule.agreements.commands.update({
    actorUserId,
    id: agreementId,
    idempotencyKey,
    contractDate: parseCompatibilityDate(input.contractDate) ?? undefined,
    contractNumber:
      input.contractNumber === undefined
        ? undefined
        : (trimToNull(input.contractNumber) ??
          buildDefaultCustomerAgreementContractNumber(current.customerId)),
    feeRules:
      input.agentFee === undefined && input.fixedFee === undefined
        ? undefined
        : await buildAgreementFeeRules({
            agentFee: input.agentFee,
            ctx,
            fixedFee: input.fixedFee,
          }),
  });

  return serializeCustomerAgreement(updated);
}
