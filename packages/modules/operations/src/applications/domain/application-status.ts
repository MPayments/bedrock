export const APPLICATION_STATUS_VALUES = [
  "forming",
  "created",
  "rejected",
  "finished",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUS_VALUES)[number];

const VALID_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  forming: ["created", "rejected"],
  created: ["rejected", "finished"],
  rejected: [],
  finished: [],
};

export function canTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}
