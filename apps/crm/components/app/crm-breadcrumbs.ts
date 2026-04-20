export type BreadcrumbOverride = {
  href: string;
  label: string;
};

export type BreadcrumbOverrideState = Record<string, BreadcrumbOverride[]>;

export type CrmBreadcrumbItem = {
  href: string | null;
  label: string;
};

type CounterpartyBreadcrumbCandidate = {
  fullName?: string | null;
  orgName?: string | null;
  shortName?: string | null;
};

const HOME_BREADCRUMB: CrmBreadcrumbItem = {
  href: "/",
  label: "Главная",
};

function normalizeBreadcrumbLabel(label: string) {
  return label.trim();
}

function stripPathDecorators(pathname: string) {
  return pathname.split("#", 1)[0]!.split("?", 1)[0]!;
}

export function normalizeCrmPathname(pathname: string) {
  const sanitizedPathname = stripPathDecorators(pathname).trim();

  if (sanitizedPathname.length === 0 || sanitizedPathname === "/") {
    return "/";
  }

  const normalizedPathname = sanitizedPathname.replace(/\/+$/u, "");
  return normalizedPathname.startsWith("/")
    ? normalizedPathname
    : `/${normalizedPathname}`;
}

export function normalizeBreadcrumbOverrides(
  overrides: BreadcrumbOverride[],
): BreadcrumbOverride[] {
  return overrides.reduce<BreadcrumbOverride[]>((result, override) => {
    const label = normalizeBreadcrumbLabel(override.label);
    if (!label) {
      return result;
    }

    result.push({
      href: normalizeCrmPathname(override.href),
      label,
    });

    return result;
  }, []);
}

export function upsertBreadcrumbOverrides(
  state: BreadcrumbOverrideState,
  registrationId: string,
  overrides: BreadcrumbOverride[],
) {
  const normalizedOverrides = normalizeBreadcrumbOverrides(overrides);

  if (normalizedOverrides.length === 0) {
    return removeBreadcrumbOverrides(state, registrationId);
  }

  return {
    ...state,
    [registrationId]: normalizedOverrides,
  };
}

export function removeBreadcrumbOverrides(
  state: BreadcrumbOverrideState,
  registrationId: string,
) {
  if (!(registrationId in state)) {
    return state;
  }

  const nextState = { ...state };
  delete nextState[registrationId];
  return nextState;
}

export function buildBreadcrumbOverrideLookup(
  state: BreadcrumbOverrideState,
) {
  const lookup: Record<string, string> = {};

  for (const overrides of Object.values(state)) {
    for (const override of overrides) {
      lookup[override.href] = override.label;
    }
  }

  return lookup;
}

export function formatDealBreadcrumbLabel(input: {
  applicantDisplayName: string | null;
  dealTypeLabel: string;
}) {
  const applicantDisplayName = normalizeBreadcrumbLabel(
    input.applicantDisplayName ?? "",
  );

  return applicantDisplayName.length > 0
    ? `${input.dealTypeLabel}: ${applicantDisplayName}`
    : input.dealTypeLabel;
}

export function resolveCounterpartyBreadcrumbLabel(
  candidate: CounterpartyBreadcrumbCandidate | null | undefined,
) {
  const options = [
    candidate?.orgName,
    candidate?.shortName,
    candidate?.fullName,
  ];

  for (const option of options) {
    const normalized = normalizeBreadcrumbLabel(option ?? "");
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return null;
}

function resolveOverrideLabel(
  lookup: Record<string, string>,
  href: string,
  fallbackLabel: string,
) {
  return lookup[normalizeCrmPathname(href)] ?? fallbackLabel;
}

export function buildCrmBreadcrumbs(
  pathname: string,
  overrideLookup: Record<string, string> = {},
): CrmBreadcrumbItem[] {
  const normalizedPathname = normalizeCrmPathname(pathname);
  const pathSegments = normalizedPathname.split("/").filter(Boolean);
  const breadcrumbs: CrmBreadcrumbItem[] = [HOME_BREADCRUMB];

  if (normalizedPathname === "/") {
    return breadcrumbs;
  }

  switch (pathSegments[0]) {
    case "calendar":
      return [...breadcrumbs, { href: "/calendar", label: "Календарь" }];
    case "deals": {
      const dealListHref = "/deals";
      breadcrumbs.push({ href: dealListHref, label: "Сделки" });

      if (pathSegments[1]) {
        const dealHref = `${dealListHref}/${pathSegments[1]}`;
        breadcrumbs.push({
          href: dealHref,
          label: resolveOverrideLabel(overrideLookup, dealHref, "Сделка"),
        });
      }

      return breadcrumbs;
    }
    case "documents":
      return [...breadcrumbs, { href: "/documents", label: "Документы" }];
    case "customers": {
      const customersHref = "/customers";
      breadcrumbs.push({ href: customersHref, label: "Клиенты" });

      if (!pathSegments[1]) {
        return breadcrumbs;
      }

      if (pathSegments[1] === "new") {
        return [
          ...breadcrumbs,
          { href: "/customers/new", label: "Новый клиент" },
        ];
      }

      const customerHref = `${customersHref}/${pathSegments[1]}`;
      breadcrumbs.push({
        href: customerHref,
        label: resolveOverrideLabel(overrideLookup, customerHref, "Клиент"),
      });

      if (pathSegments[2] !== "counterparties") {
        return breadcrumbs;
      }

      const counterpartiesHref = `${customerHref}/counterparties`;
      breadcrumbs.push({
        href: counterpartiesHref,
        label: "Субъекты сделки",
      });

      if (!pathSegments[3]) {
        return breadcrumbs;
      }

      if (pathSegments[3] === "new") {
        return [
          ...breadcrumbs,
          {
            href: `${counterpartiesHref}/new`,
            label: "Новый контрагент",
          },
        ];
      }

      const counterpartyHref = `${counterpartiesHref}/${pathSegments[3]}`;
      return [
        ...breadcrumbs,
        {
          href: counterpartyHref,
          label: resolveOverrideLabel(
            overrideLookup,
            counterpartyHref,
            "Контрагент",
          ),
        },
      ];
    }
    case "reports": {
      breadcrumbs.push({ href: null, label: "Отчёты" });

      if (pathSegments[1] === "deals") {
        return [
          ...breadcrumbs,
          { href: "/reports/deals", label: "По сделкам" },
        ];
      }

      if (pathSegments[1] === "customers") {
        return [
          ...breadcrumbs,
          { href: "/reports/customers", label: "По клиентам" },
        ];
      }

      return breadcrumbs;
    }
    case "admin": {
      if (pathSegments[1] === "users") {
        const usersHref = "/admin/users";
        breadcrumbs.push({ href: usersHref, label: "Пользователи" });

        if (!pathSegments[2]) {
          return breadcrumbs;
        }

        if (pathSegments[2] === "new") {
          return [
            ...breadcrumbs,
            { href: `${usersHref}/new`, label: "Новый пользователь" },
          ];
        }

        const userHref = `${usersHref}/${pathSegments[2]}`;
        return [
          ...breadcrumbs,
          {
            href: userHref,
            label: resolveOverrideLabel(
              overrideLookup,
              userHref,
              "Пользователь",
            ),
          },
        ];
      }

      if (pathSegments[1] === "organizations") {
        const organizationsHref = "/admin/organizations";
        breadcrumbs.push({ href: organizationsHref, label: "Юрлица" });

        if (!pathSegments[2]) {
          return breadcrumbs;
        }

        if (pathSegments[2] === "new") {
          return [
            ...breadcrumbs,
            { href: `${organizationsHref}/new`, label: "Новая организация" },
          ];
        }

        const organizationHref = `${organizationsHref}/${pathSegments[2]}`;
        return [
          ...breadcrumbs,
          {
            href: organizationHref,
            label: resolveOverrideLabel(
              overrideLookup,
              organizationHref,
              "Юрлицо",
            ),
          },
        ];
      }

      return breadcrumbs;
    }
    default:
      return breadcrumbs;
  }
}
