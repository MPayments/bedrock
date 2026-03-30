import { createAccessControl } from "better-auth/plugins/access";
import {
  defaultStatements,
  adminAc,
  userAc,
} from "better-auth/plugins/admin/access";

const statements = {
  ...defaultStatements,
  customers: ["create", "list", "update", "delete"],
  agreements: ["create", "list", "update", "delete"],
  counterparties: ["create", "list", "update", "delete"],
  currencies: ["create", "list", "update", "delete"],
  treasury_rates: ["list", "sync"],
  organizations: ["create", "list", "update", "delete"],
  documents: [
    "create",
    "list",
    "get",
    "update",
    "submit",
    "approve",
    "reject",
    "post",
    "cancel",
  ],
  accounting: ["list", "manage_accounts", "manage_correspondence"],
  balances: ["get", "reserve", "release", "consume"],
  users: ["create", "list", "update", "delete"],
  requisites: [
    "create",
    "list",
    "update",
    "delete",
    "configure_binding",
    "providers_list",
    "providers_create",
    "providers_update",
    "providers_delete",
  ],
  operations: [
    "manage_applications",
    "manage_deals",
    "manage_clients",
    "manage_calculations",
    "manage_contracts",
    "manage_organizations",
    "manage_todos",
    "view_activity_log",
    "customer_portal",
  ],
} as const;

export type ResourcePermissions = {
  [Resource in keyof typeof statements]?: (typeof statements)[Resource][number][];
};

export const ac = createAccessControl(statements);

export const admin = ac.newRole({
  ...adminAc.statements,
  customers: ["create", "list", "update", "delete"],
  agreements: ["create", "list", "update", "delete"],
  counterparties: ["create", "list", "update", "delete"],
  currencies: ["create", "list", "update", "delete"],
  treasury_rates: ["list", "sync"],
  organizations: ["create", "list", "update", "delete"],
  documents: [
    "create",
    "list",
    "get",
    "update",
    "submit",
    "approve",
    "reject",
    "post",
    "cancel",
  ],
  accounting: ["list", "manage_accounts", "manage_correspondence"],
  balances: ["get", "reserve", "release", "consume"],
  users: ["create", "list", "update", "delete"],
  requisites: [
    "create",
    "list",
    "update",
    "delete",
    "configure_binding",
    "providers_list",
    "providers_create",
    "providers_update",
    "providers_delete",
  ],
  operations: [
    "manage_applications",
    "manage_deals",
    "manage_clients",
    "manage_calculations",
    "manage_contracts",
    "manage_organizations",
    "manage_todos",
    "view_activity_log",
    "customer_portal",
  ],
});

export const user = ac.newRole({
  ...userAc.statements,
  customers: ["create", "list", "update"],
  agreements: ["create", "list", "update", "delete"],
  counterparties: ["create", "list", "update"],
  currencies: ["list"],
  treasury_rates: ["list"],
  organizations: ["list"],
  documents: ["create", "list", "get", "update", "submit"],
  accounting: ["list"],
  balances: ["get"],
  requisites: ["list", "providers_list"],
  operations: [
    "manage_applications",
    "manage_deals",
    "manage_clients",
    "manage_calculations",
    "manage_contracts",
    "manage_organizations",
    "manage_todos",
    "view_activity_log",
  ],
});

// Agent role: same as user + full operations access
export const agent = ac.newRole({
  ...userAc.statements,
  customers: ["create", "list", "update"],
  agreements: ["create", "list", "update", "delete"],
  counterparties: ["create", "list", "update"],
  currencies: ["list"],
  treasury_rates: ["list"],
  organizations: ["list"],
  documents: ["create", "list", "get", "update", "submit"],
  accounting: ["list"],
  balances: ["get"],
  requisites: ["list", "providers_list"],
  operations: [
    "manage_applications",
    "manage_deals",
    "manage_clients",
    "manage_calculations",
    "manage_contracts",
    "manage_todos",
    "view_activity_log",
  ],
});

// Customer role: limited operations access (own data only)
export const customer = ac.newRole({
  ...userAc.statements,
  operations: ["customer_portal"],
});
