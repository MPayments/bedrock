const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  submitted: "Отправлен",
};

const APPROVAL_STATUS_LABELS: Record<string, string> = {
  not_required: "Не требуется",
  pending: "Ожидает",
  approved: "Согласован",
  rejected: "Отклонен",
};

const POSTING_STATUS_LABELS: Record<string, string> = {
  not_required: "Не требуется",
  unposted: "Не проведен",
  posting: "В обработке",
  posted: "Проведен",
  failed: "Ошибка",
};

const LIFECYCLE_STATUS_LABELS: Record<string, string> = {
  active: "Активен",
  cancelled: "Отменен",
};

export function getSubmissionStatusLabel(status: string): string {
  return SUBMISSION_STATUS_LABELS[status] ?? status;
}

export function getApprovalStatusLabel(status: string): string {
  return APPROVAL_STATUS_LABELS[status] ?? status;
}

export function getPostingStatusLabel(status: string): string {
  return POSTING_STATUS_LABELS[status] ?? status;
}

export function getLifecycleStatusLabel(status: string): string {
  return LIFECYCLE_STATUS_LABELS[status] ?? status;
}
