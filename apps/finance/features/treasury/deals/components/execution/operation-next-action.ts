import type {
  TreasuryOperationKind,
  TreasuryOperationProjectedState,
} from "@bedrock/treasury/contracts";

export interface OperationNextActionConfig {
  docType: string;
  buttonLabel: string;
  description: string;
}

// Picks the next document the operator would post to advance this operation's
// projected state. Returns null when no further document action is expected.
export function resolveOperationNextAction(input: {
  kind: TreasuryOperationKind;
  projectedState: TreasuryOperationProjectedState | null;
}): OperationNextActionConfig | null {
  const state = input.projectedState ?? "planned";

  switch (input.kind) {
    case "payin":
      if (state === "planned") {
        return {
          docType: "invoice",
          buttonLabel: "Создать инвойс",
          description:
            "Запостите инвойс, чтобы зафиксировать ожидание средств по сделке.",
        };
      }
      return null;
    case "fx_conversion":
      if (state === "planned") {
        return {
          docType: "fx_execute",
          buttonLabel: "Оформить FX",
          description:
            "Создайте FX-документ и запостите его, чтобы провести конверсию.",
        };
      }
      if (state === "in_progress") {
        return {
          docType: "fx_resolution",
          buttonLabel: "Закрыть FX",
          description:
            "Создайте документ закрытия FX, чтобы завершить отложенную конверсию.",
        };
      }
      return null;
    case "intracompany_transfer":
      if (state === "planned") {
        return {
          docType: "transfer_intra",
          buttonLabel: "Оформить перевод",
          description:
            "Запостите внутренний перевод между реквизитами одной организации.",
        };
      }
      return null;
    case "intercompany_funding":
      if (state === "planned") {
        return {
          docType: "transfer_intercompany",
          buttonLabel: "Оформить фондирование",
          description:
            "Запостите межкомпанейский перевод между организациями группы.",
        };
      }
      return null;
    case "payout":
      // payout_initiate / payout_settle / payout_void doc modules are not
      // registered yet (requires payment_case integration). For payouts in
      // flight we fall back to transfer_resolution — when available — or to
      // the legacy /treasury/operations page.
      if (state === "in_progress") {
        return {
          docType: "transfer_resolution",
          buttonLabel: "Разрешить перевод",
          description:
            "Создайте документ разрешения, чтобы завершить отложенный перевод.",
        };
      }
      return null;
    default:
      return null;
  }
}
