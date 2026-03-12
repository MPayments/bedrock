import { createAccessControl } from "better-auth/plugins/access";
import {
  defaultStatements,
  adminAc,
  userAc,
} from "better-auth/plugins/admin/access";

const statements = {
  ...defaultStatements,
  customers: ["create", "list", "update", "delete"],
  counterparties: ["create", "list", "update", "delete"],
  currencies: ["create", "list", "update", "delete"],
  fx_rates: ["list", "sync"],
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
  payments: [
    "create",
    "list",
    "get",
    "submit",
    "approve",
    "reject",
    "post",
    "cancel",
  ],
  accounting: ["list", "manage_accounts", "manage_correspondence"],
  balances: ["get", "reserve", "release", "consume"],
  users: ["create", "list", "update", "delete"],
  system_modules: ["list", "manage"],
  requisite_providers: ["create", "list", "update", "delete"],
  requisites: ["create", "list", "update", "delete", "configure_binding"],
} as const;

export type ResourcePermissions = {
  [Resource in keyof typeof statements]?: (typeof statements)[Resource][number][];
};

export const ac = createAccessControl(statements);

export const admin = ac.newRole({
  ...adminAc.statements,
  customers: ["create", "list", "update", "delete"],
  counterparties: ["create", "list", "update", "delete"],
  currencies: ["create", "list", "update", "delete"],
  fx_rates: ["list", "sync"],
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
  payments: [
    "create",
    "list",
    "get",
    "submit",
    "approve",
    "reject",
    "post",
    "cancel",
  ],
  accounting: ["list", "manage_accounts", "manage_correspondence"],
  balances: ["get", "reserve", "release", "consume"],
  users: ["create", "list", "update", "delete"],
  system_modules: ["list", "manage"],
  requisite_providers: ["create", "list", "update", "delete"],
  requisites: ["create", "list", "update", "delete", "configure_binding"],
});

export const user = ac.newRole({
  ...userAc.statements,
  customers: ["create", "list", "update"],
  counterparties: ["create", "list", "update"],
  currencies: ["list"],
  fx_rates: ["list"],
  organizations: ["list"],
  documents: ["create", "list", "get", "update", "submit"],
  payments: ["create", "list", "get", "submit"],
  accounting: ["list"],
  balances: ["get"],
  requisite_providers: ["list"],
  requisites: ["list"],
  system_modules: ["list"],
});
