import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  userAc,
} from "better-auth/plugins/admin/access";

function permissions<const T extends string[]>(...values: T): T {
  return values;
}

const CRUD_PERMISSIONS = permissions("create", "list", "update", "delete");
const USER_WRITE_PERMISSIONS = permissions("create", "list", "update");
const DOCUMENT_ADMIN_PERMISSIONS = permissions(
  "create",
  "list",
  "get",
  "update",
  "submit",
  "approve",
  "reject",
  "post",
  "cancel",
);
const DOCUMENT_USER_PERMISSIONS = permissions(
  "create",
  "list",
  "get",
  "update",
  "submit",
);
const RECONCILIATION_PERMISSIONS = permissions(
  "list",
  "run",
  "resolve",
  "ignore",
);
const REQUISITE_ADMIN_PERMISSIONS = permissions(
  "create",
  "list",
  "update",
  "delete",
  "configure_binding",
  "providers_list",
  "providers_create",
  "providers_update",
  "providers_delete",
);
const REQUISITE_READ_PERMISSIONS = permissions("list", "providers_list");

const adminResourcePermissions = {
  customers: CRUD_PERMISSIONS,
  agreements: CRUD_PERMISSIONS,
  calculations: CRUD_PERMISSIONS,
  counterparties: CRUD_PERMISSIONS,
  currencies: CRUD_PERMISSIONS,
  deals: CRUD_PERMISSIONS,
  payment_routes: permissions("create", "list", "update", "archive"),
  treasury_rates: permissions("list", "sync"),
  organizations: CRUD_PERMISSIONS,
  reconciliation: RECONCILIATION_PERMISSIONS,
  documents: DOCUMENT_ADMIN_PERMISSIONS,
  accounting: permissions("list", "manage_accounts", "manage_correspondence"),
  balances: permissions("get", "reserve", "release", "consume"),
  users: CRUD_PERMISSIONS,
  requisites: REQUISITE_ADMIN_PERMISSIONS,
} as const;

const userResourcePermissions = {
  customers: USER_WRITE_PERMISSIONS,
  agreements: CRUD_PERMISSIONS,
  calculations: CRUD_PERMISSIONS,
  counterparties: USER_WRITE_PERMISSIONS,
  currencies: permissions("list"),
  deals: CRUD_PERMISSIONS,
  payment_routes: permissions("list"),
  treasury_rates: permissions("list"),
  organizations: permissions("list"),
  documents: DOCUMENT_USER_PERMISSIONS,
  accounting: permissions("list"),
  balances: permissions("get"),
  requisites: REQUISITE_READ_PERMISSIONS,
} as const;

const financeResourcePermissions = {
  ...userResourcePermissions,
  payment_routes: permissions("list", "create", "update", "archive"),
  reconciliation: RECONCILIATION_PERMISSIONS,
  documents: permissions(
    "create",
    "list",
    "get",
    "update",
    "submit",
    "post",
    "cancel",
  ),
} as const;

const statements = {
  ...defaultStatements,
  ...adminResourcePermissions,
} as const;

export type ResourcePermissions = {
  [Resource in keyof typeof statements]?: (typeof statements)[Resource][number][];
};

export const ac = createAccessControl(statements);

export const admin = ac.newRole({
  ...adminAc.statements,
  ...adminResourcePermissions,
});

export const user = ac.newRole({
  ...userAc.statements,
  ...userResourcePermissions,
});

export const finance = ac.newRole({
  ...userAc.statements,
  ...financeResourcePermissions,
});

// Agent role: same as user on the final canonical API surface
export const agent = ac.newRole({
  ...userAc.statements,
  ...userResourcePermissions,
});

// Customer role: portal-oriented access; endpoint-level ownership checks apply
export const customer = ac.newRole({
  ...userAc.statements,
});
