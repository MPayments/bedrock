import { eq } from "drizzle-orm";

import { schema } from "@bedrock/accounting/schema";

import {
  createAccountingServiceContext,
  type AccountingServiceDeps,
} from "./internal/context";
import { createAccountingRuntime } from "./runtime";
import {
  replaceCorrespondenceRulesSchema,
  type ReplaceCorrespondenceRulesInput,
} from "./validation";

export type AccountingService = ReturnType<typeof createAccountingService>;

export function createAccountingService(deps: AccountingServiceDeps) {
  const context = createAccountingServiceContext(deps);
  const { db } = context;
  const runtime = createAccountingRuntime(deps);

  async function listTemplateAccounts() {
    return db
      .select()
      .from(schema.chartTemplateAccounts)
      .orderBy(schema.chartTemplateAccounts.accountNo);
  }

  async function listCorrespondenceRules() {
    return db
      .select()
      .from(schema.correspondenceRules)
      .orderBy(
        schema.correspondenceRules.postingCode,
        schema.correspondenceRules.debitAccountNo,
        schema.correspondenceRules.creditAccountNo,
      );
  }

  async function replaceCorrespondenceRules(
    input: ReplaceCorrespondenceRulesInput,
  ) {
    const validated = replaceCorrespondenceRulesSchema.parse(input);

    return db.transaction(async (tx) => {
      await tx.delete(schema.correspondenceRules);

      if (validated.rules.length === 0) {
        return [];
      }

      return tx
        .insert(schema.correspondenceRules)
        .values(
          validated.rules.map((rule) => ({
            postingCode: rule.postingCode,
            debitAccountNo: rule.debitAccountNo,
            creditAccountNo: rule.creditAccountNo,
            enabled: rule.enabled,
          })),
        )
        .returning();
    });
  }

  async function validatePostingMatrix() {
    const [rules, accounts, accountDimPolicies, postingCodeDimPolicies] =
      await Promise.all([
        db
          .select()
          .from(schema.correspondenceRules)
          .where(eq(schema.correspondenceRules.enabled, true)),
        db.select().from(schema.chartTemplateAccounts),
        db.select().from(schema.chartAccountDimensionPolicy),
        db
          .select()
          .from(schema.postingCodeDimensionPolicy)
          .where(eq(schema.postingCodeDimensionPolicy.required, true)),
      ]);

    const errors: {
      code: string;
      message: string;
      postingCode?: string;
      accountNo?: string;
    }[] = [];

    const activeAccounts = new Map(
      accounts.map((account) => [account.accountNo, account]),
    );
    const requiredAccountDimsByNo = new Map<string, Set<string>>();

    for (const row of accountDimPolicies) {
      if (row.mode !== "required") continue;
      const existing = requiredAccountDimsByNo.get(row.accountNo);
      if (existing) {
        existing.add(row.dimensionKey);
      } else {
        requiredAccountDimsByNo.set(row.accountNo, new Set([row.dimensionKey]));
      }
    }

    interface ScopedDim {
      dimensionKey: string;
      scope: string;
    }
    const requiredPostingCodeDims = new Map<string, ScopedDim[]>();
    for (const row of postingCodeDimPolicies) {
      const existing = requiredPostingCodeDims.get(row.postingCode);
      const entry = {
        dimensionKey: row.dimensionKey,
        scope: (row as { scope?: string }).scope ?? "line",
      };
      if (existing) {
        existing.push(entry);
      } else {
        requiredPostingCodeDims.set(row.postingCode, [entry]);
      }
    }

    const duplicateRuleCounts = new Map<string, number>();

    for (const rule of rules) {
      const key = [
        rule.postingCode,
        rule.debitAccountNo,
        rule.creditAccountNo,
      ].join("|");
      duplicateRuleCounts.set(key, (duplicateRuleCounts.get(key) ?? 0) + 1);

      for (const accountNo of [rule.debitAccountNo, rule.creditAccountNo]) {
        const account = activeAccounts.get(accountNo);
        if (!account) {
          errors.push({
            code: "ACCOUNT_NOT_FOUND",
            message: `Rule references unknown account ${accountNo}`,
            postingCode: rule.postingCode,
            accountNo,
          });
          continue;
        }

        if (!account.postingAllowed) {
          errors.push({
            code: "ACCOUNT_NOT_POSTABLE",
            message: `Rule references non-postable account ${accountNo}`,
            postingCode: rule.postingCode,
            accountNo,
          });
        }

        if (!account.enabled) {
          errors.push({
            code: "ACCOUNT_DISABLED",
            message: `Rule references disabled account ${accountNo}`,
            postingCode: rule.postingCode,
            accountNo,
          });
        }

        const accountRequired =
          requiredAccountDimsByNo.get(accountNo) ?? new Set<string>();
        const postingEntries =
          requiredPostingCodeDims.get(rule.postingCode) ?? [];
        const isDebitSide = accountNo === rule.debitAccountNo;
        const postingDimKeys = new Set(
          postingEntries
            .filter((entry) => {
              if (entry.scope === "line") return true;
              if (entry.scope === "debit" && isDebitSide) return true;
              if (entry.scope === "credit" && !isDebitSide) return true;
              return false;
            })
            .map((entry) => entry.dimensionKey),
        );

        for (const dimKey of accountRequired) {
          if (!postingDimKeys.has(dimKey)) {
            errors.push({
              code: "ACCOUNT_DIMENSION_UNSATISFIED",
              message: `Posting code ${rule.postingCode} does not declare required dimension ${dimKey} for account ${accountNo} (${isDebitSide ? "debit" : "credit"} side)`,
              postingCode: rule.postingCode,
              accountNo,
            });
          }
        }
      }

      const postingEntries = requiredPostingCodeDims.get(rule.postingCode);
      if (!postingEntries || postingEntries.length === 0) {
        errors.push({
          code: "POSTING_CODE_DIMENSIONS_UNDECLARED",
          message: `Posting code ${rule.postingCode} has no declared dimension policies`,
          postingCode: rule.postingCode,
        });
      }
    }

    for (const [key, count] of duplicateRuleCounts) {
      if (count > 1) {
        const [postingCode, debitAccountNo, creditAccountNo] = key.split("|");
        errors.push({
          code: "DUPLICATE_ACTIVE_RULE",
          message: `Duplicate active rule for postingCode=${postingCode}, debit=${debitAccountNo}, credit=${creditAccountNo}`,
          postingCode,
        });
      }
    }

    return {
      ok: errors.length === 0,
      errors,
    };
  }

  return {
    ...runtime,
    listTemplateAccounts,
    listCorrespondenceRules,
    replaceCorrespondenceRules,
    validatePostingMatrix,
  };
}
