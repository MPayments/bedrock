import { createAccessControl } from "better-auth/plugins/access";
import {
    defaultStatements,
    adminAc,
    userAc,
} from "better-auth/plugins/admin/access";

const statements = {
    ...defaultStatements,
    customers: ["create", "list", "update", "delete"],
    organizations: ["create", "list", "update", "delete"],
    accounts: ["create", "list", "update", "delete"],
    currencies: ["create", "list", "update"],
    fx_rates: ["list", "sync"],
} as const;

export const ac = createAccessControl(statements);

export const admin = ac.newRole({
    ...adminAc.statements,
    customers: ["create", "list", "update", "delete"],
    organizations: ["create", "list", "update", "delete"],
    accounts: ["create", "list", "update", "delete"],
    currencies: ["create", "list", "update"],
    fx_rates: ["list", "sync"],
});

export const user = ac.newRole({
    ...userAc.statements,
    customers: ["create", "list", "update", "delete"],
    organizations: ["create", "list", "update", "delete"],
    accounts: ["create", "list", "update", "delete"],
    currencies: ["list"],
    fx_rates: ["list"],
});
