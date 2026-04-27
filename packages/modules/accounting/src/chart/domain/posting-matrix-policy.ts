export interface PostingMatrixRule {
  postingCode: string;
  debitAccountNo: string;
  creditAccountNo: string;
}

export interface PostingMatrixAccount {
  accountNo: string;
  postingAllowed: boolean;
  enabled: boolean;
}

export interface PostingMatrixAccountDimensionPolicy {
  accountNo: string;
  dimensionKey: string;
  mode: string;
}

export interface PostingMatrixPostingCodeDimensionPolicy {
  postingCode: string;
  dimensionKey: string;
  required: boolean;
  scope?: string;
}

export interface PostingMatrixValidationInput {
  rules: (PostingMatrixRule & { enabled?: boolean })[];
  accounts: PostingMatrixAccount[];
  accountDimPolicies: PostingMatrixAccountDimensionPolicy[];
  postingCodeDimPolicies: PostingMatrixPostingCodeDimensionPolicy[];
}

export interface PostingMatrixValidationError {
  code: string;
  message: string;
  postingCode?: string;
  accountNo?: string;
}

export class PostingMatrix {
  constructor(
    private readonly input: PostingMatrixValidationInput,
  ) {}

  validate(): {
    ok: boolean;
    errors: PostingMatrixValidationError[];
  } {
    const errors: PostingMatrixValidationError[] = [];

    const activeAccounts = new Map(
      this.input.accounts.map((account) => [account.accountNo, account]),
    );
    const requiredAccountDimsByNo = new Map<string, Set<string>>();

    for (const row of this.input.accountDimPolicies) {
      if (row.mode !== "required") {
        continue;
      }

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
    for (const row of this.input.postingCodeDimPolicies) {
      if (!row.required) {
        continue;
      }

      const existing = requiredPostingCodeDims.get(row.postingCode);
      const entry = {
        dimensionKey: row.dimensionKey,
        scope: row.scope ?? "line",
      };
      if (existing) {
        existing.push(entry);
      } else {
        requiredPostingCodeDims.set(row.postingCode, [entry]);
      }
    }

    const duplicateRuleCounts = new Map<string, number>();

    for (const rule of this.input.rules.filter((row) => row.enabled ?? true)) {
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
        const postingEntries = requiredPostingCodeDims.get(rule.postingCode) ?? [];
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
      if (count <= 1) {
        continue;
      }

      const [postingCode, debitAccountNo, creditAccountNo] = key.split("|");
      errors.push({
        code: "DUPLICATE_ACTIVE_RULE",
        message: `Duplicate active rule for postingCode=${postingCode}, debit=${debitAccountNo}, credit=${creditAccountNo}`,
        postingCode,
      });
    }

    return {
      ok: errors.length === 0,
      errors,
    };
  }
}
