import type { CounterpartyGroupOption } from "./queries";

const GROUP_PRESENTATION_BY_KEY = {
  customer: {
    label: "Клиенты",
    icon: "users",
  },
  custom: {
    label: "Пользовательская группа",
  },
} as const;

type CounterpartyGroupIcon = "users" | "vault";

export function getCounterpartyGroupPresentation(value: string): {
  label: string;
  icon?: CounterpartyGroupIcon;
} {
  const normalized = value.trim().toLowerCase();
  const known =
    GROUP_PRESENTATION_BY_KEY[
      normalized as keyof typeof GROUP_PRESENTATION_BY_KEY
    ];

  if (!known) {
    return {
      label: value,
    };
  }

  return known;
}

function localizeCounterpartyGroupLabel(value: string) {
  return getCounterpartyGroupPresentation(value).label;
}

export function getCounterpartyGroupDisplayLabel(
  group: Pick<CounterpartyGroupOption, "name" | "customerId" | "customerLabel">,
) {
  const label = localizeCounterpartyGroupLabel(group.name);
  const customerLabel = group.customerLabel?.trim();

  if (
    !group.customerId ||
    !customerLabel ||
    customerLabel.length === 0 ||
    customerLabel === label
  ) {
    return label;
  }

  return `${label} · ${customerLabel}`;
}
