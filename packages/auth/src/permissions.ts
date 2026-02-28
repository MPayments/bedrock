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
    accounts: ["create", "list", "update", "delete"],
    currencies: ["create", "list", "update", "delete"],
    fx_rates: ["list", "sync"],
    documents: ["create", "list", "get", "update", "submit", "approve", "reject", "post", "cancel"],
    transfers: ["create", "list", "approve", "reject", "settle", "void"],
    accounting: ["list", "manage_accounts", "manage_correspondence"],
} as const;

export type ResourcePermissions = {
    [Resource in keyof typeof statements]?: (typeof statements)[Resource][number][];
};

export const ac = createAccessControl(statements);

export const admin = ac.newRole({
    ...adminAc.statements,
    customers: ["create", "list", "update", "delete"],
    counterparties: ["create", "list", "update", "delete"],
    accounts: ["create", "list", "update", "delete"],
    currencies: ["create", "list", "update", "delete"],
    fx_rates: ["list", "sync"],
    documents: ["create", "list", "get", "update", "submit", "approve", "reject", "post", "cancel"],
    transfers: ["create", "list", "approve", "reject", "settle", "void"],
    accounting: ["list", "manage_accounts", "manage_correspondence"],
});

export const user = ac.newRole({
    ...userAc.statements,
    customers: ["create", "list", "update", "delete"],
    counterparties: ["create", "list", "update", "delete"],
    accounts: ["create", "list", "update", "delete"],
    currencies: ["list"],
    fx_rates: ["list"],
    documents: ["create", "list", "get", "update", "submit", "approve", "reject", "post", "cancel"],
    transfers: ["create", "list", "approve", "reject", "settle", "void"],
    accounting: ["list"],
});
