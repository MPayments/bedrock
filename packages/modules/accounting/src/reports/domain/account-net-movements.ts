import type { ScopedPosting } from "./scoped-posting";

export interface AccountNetMovement {
  accountNo: string;
  currency: string;
  netMinor: bigint;
}

export function computeAccountNetMovements(
  postings: ScopedPosting[],
): AccountNetMovement[] {
  const movements = new Map<string, AccountNetMovement>();

  for (const posting of postings) {
    const debitKey = toAccountCurrencyKey(
      posting.debitAccountNo,
      posting.currency,
    );
    const debit = movements.get(debitKey) ?? {
      accountNo: posting.debitAccountNo,
      currency: posting.currency,
      netMinor: 0n,
    };
    debit.netMinor += posting.amountMinor;
    movements.set(debitKey, debit);

    const creditKey = toAccountCurrencyKey(
      posting.creditAccountNo,
      posting.currency,
    );
    const credit = movements.get(creditKey) ?? {
      accountNo: posting.creditAccountNo,
      currency: posting.currency,
      netMinor: 0n,
    };
    credit.netMinor -= posting.amountMinor;
    movements.set(creditKey, credit);
  }

  return Array.from(movements.values());
}

function toAccountCurrencyKey(accountNo: string, currency: string): string {
  return `${accountNo}::${currency}`;
}
