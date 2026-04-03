import type { LedgerBookAccountStore } from "../../../book-accounts/application/ports/book-account.store";
import type { SettlementIdentityPolicy } from "../../../shared/application/settlement-identity";
import {
  OPERATION_TRANSFER_TYPE,
  type IntentLine,
} from "../../domain/operation-intent";
import type {
  LedgerPostingInsert,
  LedgerSettlementPlan,
} from "../ports/operations.repository";

export class BuildPlanRowsCommand {
  constructor(
    private readonly bookAccounts: LedgerBookAccountStore,
    private readonly settlementIdentity: SettlementIdentityPolicy,
  ) {}

  async execute(input: {
    operationId: string;
    lines: IntentLine[];
    linkedFlags: boolean[];
  }): Promise<{
    postingRows: LedgerPostingInsert[];
    settlementPlanRows: LedgerSettlementPlan[];
    pendingTransferIdsByRef: Map<string, bigint>;
  }> {
    const { operationId, lines, linkedFlags } = input;

    const pendingTransferIdsByRef = new Map<string, bigint>();
    const postingRows: LedgerPostingInsert[] = [];
    const settlementPlanRows: LedgerSettlementPlan[] = [];

    for (let index = 0; index < lines.length; index += 1) {
      const lineNo = index + 1;
      const line = lines[index]!;
      const settlementId = this.settlementIdentity.settlementIdForOperationLine(
        {
          operationId,
          lineNo,
          planRef: line.planRef,
        },
      );

      if (line.type === OPERATION_TRANSFER_TYPE.CREATE) {
        const [debitInstance, creditInstance] = await Promise.all([
          this.bookAccounts.ensureBookAccountInstance({
            bookId: line.bookId,
            accountNo: line.debit.accountNo,
            currency: line.debit.currency,
            dimensions: line.debit.dimensions,
          }),
          this.bookAccounts.ensureBookAccountInstance({
            bookId: line.bookId,
            accountNo: line.credit.accountNo,
            currency: line.credit.currency,
            dimensions: line.credit.dimensions,
          }),
        ]);

        postingRows.push({
          operationId,
          lineNo,
          bookId: line.bookId,
          debitInstanceId: debitInstance.id,
          creditInstanceId: creditInstance.id,
          postingCode: line.postingCode,
          currency: line.debit.currency,
          amountMinor: line.amountMinor,
          memo: line.memo ?? null,
          context: line.context ?? null,
        });

        if (line.pending) {
          pendingTransferIdsByRef.set(
            line.pending.ref ?? line.planRef,
            settlementId,
          );
        }

        settlementPlanRows.push({
          operationId,
          lineNo,
          type: OPERATION_TRANSFER_TYPE.CREATE,
          settlementId,
          debitAccountId: debitInstance.settlementAccountId,
          creditAccountId: creditInstance.settlementAccountId,
          settlementLedger: debitInstance.settlementLedger,
          amount: line.amountMinor,
          code: line.code ?? 1,
          pendingRef: line.pending?.ref ?? null,
          pendingId: null,
          isLinked: linkedFlags[index]!,
          isPending: Boolean(line.pending),
          timeoutSeconds: line.pending?.timeoutSeconds ?? 0,
          status: "pending",
        });
        continue;
      }

      if (line.type === OPERATION_TRANSFER_TYPE.POST_PENDING) {
        settlementPlanRows.push({
          operationId,
          lineNo,
          type: OPERATION_TRANSFER_TYPE.POST_PENDING,
          settlementId,
          debitAccountId: null,
          creditAccountId: null,
          settlementLedger: this.settlementIdentity.settlementLedgerForCurrency(
            { currency: line.currency },
          ),
          amount: line.amount ?? 0n,
          code: line.code ?? 0,
          pendingRef: null,
          pendingId: line.pendingId,
          isLinked: linkedFlags[index]!,
          isPending: false,
          timeoutSeconds: 0,
          status: "pending",
        });
        continue;
      }

      settlementPlanRows.push({
        operationId,
        lineNo,
        type: OPERATION_TRANSFER_TYPE.VOID_PENDING,
        settlementId,
        debitAccountId: null,
        creditAccountId: null,
        settlementLedger: this.settlementIdentity.settlementLedgerForCurrency({
          currency: line.currency,
        }),
        amount: 0n,
        code: line.code ?? 0,
        pendingRef: null,
        pendingId: line.pendingId,
        isLinked: linkedFlags[index]!,
        isPending: false,
        timeoutSeconds: 0,
        status: "pending",
      });
    }

    return {
      postingRows,
      settlementPlanRows,
      pendingTransferIdsByRef,
    };
  }
}
