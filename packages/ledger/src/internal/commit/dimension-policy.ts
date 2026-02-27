import { and, eq } from "drizzle-orm";

import {
  ACCOUNT_NO,
  CLEARING_KIND_DIMENSION_RULES,
  DIM,
  KNOWN_DIMENSION_KEYS,
} from "@bedrock/accounting";
import type { Transaction } from "@bedrock/db";
import { schema } from "@bedrock/db/schema";

import {
  AccountPostingValidationError,
  DimensionPolicyViolationError,
} from "../../errors";
import { type Dimensions, type IntentLine } from "../../types";

type DimensionMode = "required" | "optional" | "forbidden";
type DimensionPolicyScope = "line" | "debit" | "credit";
type CreateIntentLine = Extract<IntentLine, { type: "create" }>;

interface AccountPolicy {
  postingAllowed: boolean;
  enabled: boolean;
  dimensionPolicies: Map<string, DimensionMode>;
}

interface PostingCodePolicy {
  entries: { dimensionKey: string; scope: DimensionPolicyScope }[];
}

async function ensureCorrespondenceRule(
  tx: Transaction,
  line: CreateIntentLine,
) {
  const [rule] = await tx
    .select({ id: schema.correspondenceRules.id })
    .from(schema.correspondenceRules)
    .where(
      and(
        eq(schema.correspondenceRules.postingCode, line.postingCode),
        eq(schema.correspondenceRules.debitAccountNo, line.debit.accountNo),
        eq(schema.correspondenceRules.creditAccountNo, line.credit.accountNo),
        eq(schema.correspondenceRules.enabled, true),
      ),
    )
    .limit(1);

  if (!rule) {
    const { CorrespondenceRuleNotFoundError } =
      await import("@bedrock/accounting");
    throw new CorrespondenceRuleNotFoundError(
      line.postingCode,
      line.debit.accountNo,
      line.credit.accountNo,
    );
  }
}

async function loadAccountPolicy(
  tx: Transaction,
  accountNo: string,
): Promise<AccountPolicy> {
  const [templateAccount, dimensionRows] = await Promise.all([
    tx
      .select({
        postingAllowed: schema.chartTemplateAccounts.postingAllowed,
        enabled: schema.chartTemplateAccounts.enabled,
      })
      .from(schema.chartTemplateAccounts)
      .where(eq(schema.chartTemplateAccounts.accountNo, accountNo))
      .limit(1),
    tx
      .select({
        dimensionKey: schema.chartAccountDimensionPolicy.dimensionKey,
        mode: schema.chartAccountDimensionPolicy.mode,
      })
      .from(schema.chartAccountDimensionPolicy)
      .where(eq(schema.chartAccountDimensionPolicy.accountNo, accountNo)),
  ]);

  const template = templateAccount[0];
  if (!template) {
    throw new AccountPostingValidationError(
      `Unknown chart account ${accountNo}`,
    );
  }

  const dimensionPolicies = new Map<string, DimensionMode>();
  for (const row of dimensionRows) {
    dimensionPolicies.set(row.dimensionKey, row.mode as DimensionMode);
  }

  return {
    postingAllowed: template.postingAllowed,
    enabled: template.enabled,
    dimensionPolicies,
  };
}

async function loadPostingCodePolicy(
  tx: Transaction,
  postingCode: string,
): Promise<PostingCodePolicy> {
  const rows = await tx
    .select({
      dimensionKey: schema.postingCodeDimensionPolicy.dimensionKey,
      required: schema.postingCodeDimensionPolicy.required,
      scope: schema.postingCodeDimensionPolicy.scope,
    })
    .from(schema.postingCodeDimensionPolicy)
    .where(
      and(
        eq(schema.postingCodeDimensionPolicy.postingCode, postingCode),
        eq(schema.postingCodeDimensionPolicy.required, true),
      ),
    );

  return {
    entries: rows.map((row) => ({
      dimensionKey: row.dimensionKey,
      scope: (row.scope ?? "line") as DimensionPolicyScope,
    })),
  };
}

function validateDimensionKeys(dimensions: Dimensions, label: string) {
  for (const key of Object.keys(dimensions)) {
    if (!KNOWN_DIMENSION_KEYS.has(key)) {
      throw new DimensionPolicyViolationError(
        label,
        key,
        "unknown dimension key (not in canonical DIM registry)",
      );
    }
  }
}

function validateClearingKindDimensions(dimensions: Dimensions) {
  const kind = dimensions[DIM.clearingKind];
  if (!kind) return;

  const rules = CLEARING_KIND_DIMENSION_RULES[kind];
  if (!rules) {
    throw new DimensionPolicyViolationError(
      ACCOUNT_NO.CLEARING,
      DIM.clearingKind,
      `unknown clearingKind value: ${kind}`,
    );
  }

  for (const rule of rules) {
    if (rule.mode === "required" && !(rule.dimensionKey in dimensions)) {
      throw new DimensionPolicyViolationError(
        `CLEARING[${kind}]`,
        rule.dimensionKey,
        `required for clearingKind=${kind}`,
      );
    }
    if (rule.mode === "forbidden" && rule.dimensionKey in dimensions) {
      throw new DimensionPolicyViolationError(
        `CLEARING[${kind}]`,
        rule.dimensionKey,
        `forbidden for clearingKind=${kind}`,
      );
    }
  }
}

function validateDimensions(
  accountPolicy: AccountPolicy,
  dimensions: Dimensions,
  accountNo: string,
) {
  if (!accountPolicy.postingAllowed) {
    throw new AccountPostingValidationError(
      `Account ${accountNo} is not postable`,
    );
  }
  if (!accountPolicy.enabled) {
    throw new AccountPostingValidationError(`Account ${accountNo} is disabled`);
  }

  validateDimensionKeys(dimensions, accountNo);

  for (const key of Object.keys(dimensions)) {
    const mode = accountPolicy.dimensionPolicies.get(key);
    if (!mode) {
      throw new DimensionPolicyViolationError(
        accountNo,
        key,
        "dimension not allowed for this account",
      );
    }
    if (mode === "forbidden") {
      throw new DimensionPolicyViolationError(
        accountNo,
        key,
        "forbidden dimension present",
      );
    }
  }

  for (const [key, mode] of accountPolicy.dimensionPolicies) {
    if (mode !== "required") continue;
    if (!(key in dimensions)) {
      throw new DimensionPolicyViolationError(
        accountNo,
        key,
        "required dimension missing",
      );
    }
  }

  if (accountNo === ACCOUNT_NO.CLEARING && DIM.clearingKind in dimensions) {
    validateClearingKindDimensions(dimensions);
  }
}

function validatePostingCodeDimensions(
  postingCodePolicy: PostingCodePolicy,
  debitDimensions: Dimensions,
  creditDimensions: Dimensions,
  postingCode: string,
) {
  for (const entry of postingCodePolicy.entries) {
    const { dimensionKey, scope } = entry;
    switch (scope) {
      case "debit":
        if (!(dimensionKey in debitDimensions)) {
          throw new DimensionPolicyViolationError(
            postingCode,
            dimensionKey,
            "required on debit side by posting code",
          );
        }
        break;
      case "credit":
        if (!(dimensionKey in creditDimensions)) {
          throw new DimensionPolicyViolationError(
            postingCode,
            dimensionKey,
            "required on credit side by posting code",
          );
        }
        break;
      case "line":
      default:
        if (
          !(dimensionKey in debitDimensions) &&
          !(dimensionKey in creditDimensions)
        ) {
          throw new DimensionPolicyViolationError(
            postingCode,
            dimensionKey,
            "required by posting code but not present in either debit or credit dimensions",
          );
        }
        break;
    }
  }
}

export function createDimensionPolicyValidator(tx: Transaction) {
  const accountPolicyCache = new Map<string, AccountPolicy>();
  const postingCodePolicyCache = new Map<string, PostingCodePolicy>();

  async function getAccountPolicy(accountNo: string): Promise<AccountPolicy> {
    let policy = accountPolicyCache.get(accountNo);
    if (!policy) {
      policy = await loadAccountPolicy(tx, accountNo);
      accountPolicyCache.set(accountNo, policy);
    }
    return policy;
  }

  async function getPostingCodePolicy(
    postingCode: string,
  ): Promise<PostingCodePolicy> {
    let policy = postingCodePolicyCache.get(postingCode);
    if (!policy) {
      policy = await loadPostingCodePolicy(tx, postingCode);
      postingCodePolicyCache.set(postingCode, policy);
    }
    return policy;
  }

  return async function validateCreateLine(line: CreateIntentLine) {
    await ensureCorrespondenceRule(tx, line);
    if (line.debit.currency !== line.credit.currency) {
      throw new AccountPostingValidationError(
        `Currency mismatch for postingCode=${line.postingCode}: debit=${line.debit.currency}, credit=${line.credit.currency}`,
      );
    }

    const [debitPolicy, creditPolicy, postingCodePolicy] = await Promise.all([
      getAccountPolicy(line.debit.accountNo),
      getAccountPolicy(line.credit.accountNo),
      getPostingCodePolicy(line.postingCode),
    ]);

    validateDimensions(
      debitPolicy,
      line.debit.dimensions,
      line.debit.accountNo,
    );
    validateDimensions(
      creditPolicy,
      line.credit.dimensions,
      line.credit.accountNo,
    );
    validatePostingCodeDimensions(
      postingCodePolicy,
      line.debit.dimensions,
      line.credit.dimensions,
      line.postingCode,
    );
  };
}
