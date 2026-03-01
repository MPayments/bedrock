import type {
  ConnectorIntentStatus,
  PaymentAttemptStatus,
} from "@bedrock/db/schema";

export function isTerminalAttemptStatus(status: PaymentAttemptStatus): boolean {
  return (
    status === "succeeded" ||
    status === "failed_terminal" ||
    status === "cancelled"
  );
}

export function intentStatusFromAttemptStatus(
  status: PaymentAttemptStatus,
): ConnectorIntentStatus {
  if (status === "succeeded") {
    return "succeeded";
  }
  if (status === "failed_terminal") {
    return "failed";
  }
  if (status === "cancelled") {
    return "cancelled";
  }
  return "in_progress";
}

export function isTerminalIntentStatus(status: ConnectorIntentStatus): boolean {
  return (
    status === "succeeded" || status === "failed" || status === "cancelled"
  );
}
