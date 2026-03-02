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
  counterparty_accounts: ["create", "list", "update", "delete"],
  currencies: ["create", "list", "update", "delete"],
  fx_rates: ["list", "sync"],
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
  connectors: ["list", "manage"],
  orchestration: ["list", "manage", "simulate"],
  accounting: ["list", "manage_accounts", "manage_correspondence"],
  balances: ["get", "reserve", "release", "consume"],
  reconciliation: ["ingest", "run", "list", "explain", "adjust"],
  system_components: ["list", "manage"],
} as const;

export type ResourcePermissions = {
  [Resource in keyof typeof statements]?: (typeof statements)[Resource][number][];
};

export const ac = createAccessControl(statements);

export const admin = ac.newRole({
  ...adminAc.statements,
  customers: ["create", "list", "update", "delete"],
  counterparties: ["create", "list", "update", "delete"],
  counterparty_accounts: ["create", "list", "update", "delete"],
  currencies: ["create", "list", "update", "delete"],
  fx_rates: ["list", "sync"],
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
  connectors: ["list", "manage"],
  orchestration: ["list", "manage", "simulate"],
  accounting: ["list", "manage_accounts", "manage_correspondence"],
  balances: ["get", "reserve", "release", "consume"],
  reconciliation: ["ingest", "run", "list", "explain", "adjust"],
  system_components: ["list", "manage"],
});

export const user = ac.newRole({
  ...userAc.statements,
  customers: ["create", "list", "update"],
  counterparties: ["create", "list", "update"],
  counterparty_accounts: ["list"],
  currencies: ["list"],
  fx_rates: ["list"],
  documents: ["create", "list", "get", "update", "submit"],
  payments: ["create", "list", "get", "submit"],
  connectors: ["list"],
  orchestration: ["list"],
  accounting: ["list"],
  balances: ["get"],
  reconciliation: ["list", "explain"],
  system_components: ["list"],
});
