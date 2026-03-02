import type {
  ConnectorIntentStatus,
  PaymentAttemptStatus,
} from "@bedrock/core/connectors/schema";

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

export function canTransitionAttemptStatus(
  current: PaymentAttemptStatus,
  next: PaymentAttemptStatus,
): boolean {
  if (current === next) {
    return true;
  }
  if (isTerminalAttemptStatus(current)) {
    return false;
  }
  if (isTerminalAttemptStatus(next)) {
    return true;
  }

  if (current === "queued") {
    return next === "dispatching" || next === "submitted" || next === "pending";
  }
  if (current === "dispatching") {
    return (
      next === "queued" ||
      next === "submitted" ||
      next === "pending" ||
      next === "failed_retryable"
    );
  }
  if (current === "submitted") {
    return next === "pending" || next === "failed_retryable";
  }
  if (current === "pending") {
    return next === "submitted" || next === "failed_retryable";
  }
  if (current === "failed_retryable") {
    return (
      next === "queued" ||
      next === "dispatching" ||
      next === "submitted" ||
      next === "pending"
    );
  }

  return false;
}

function intentStatusRank(status: ConnectorIntentStatus): number {
  if (status === "in_progress" || status === "planned") {
    return 0;
  }
  if (status === "cancelled") {
    return 1;
  }
  if (status === "failed") {
    return 2;
  }
  return 3;
}

export function canUpgradeIntentStatus(
  current: ConnectorIntentStatus,
  next: ConnectorIntentStatus,
): boolean {
  return intentStatusRank(next) >= intentStatusRank(current);
}
