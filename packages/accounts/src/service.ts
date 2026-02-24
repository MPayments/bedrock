import { createCreateAccountHandler } from "./commands/create-account";
import { createCreateProviderHandler } from "./commands/create-provider";
import { createDeleteAccountHandler } from "./commands/delete-account";
import { createDeleteProviderHandler } from "./commands/delete-provider";
import { createGetAccountHandler } from "./commands/get-account";
import { createGetProviderHandler } from "./commands/get-provider";
import { createListAccountsHandler } from "./commands/list-accounts";
import { createListProvidersHandler } from "./commands/list-providers";
import { createUpdateAccountHandler } from "./commands/update-account";
import { createUpdateProviderHandler } from "./commands/update-provider";
import {
    createAccountServiceContext,
    type AccountServiceDeps,
} from "./internal/context";

export type AccountService = ReturnType<typeof createAccountService>;

export function createAccountService(deps: AccountServiceDeps) {
    const context = createAccountServiceContext(deps);

    const createProvider = createCreateProviderHandler(context);
    const getProvider = createGetProviderHandler(context);
    const updateProvider = createUpdateProviderHandler(context);
    const deleteProvider = createDeleteProviderHandler(context);
    const listProviders = createListProvidersHandler(context);

    const createAccount = createCreateAccountHandler(context);
    const getAccount = createGetAccountHandler(context);
    const updateAccount = createUpdateAccountHandler(context);
    const deleteAccount = createDeleteAccountHandler(context);
    const listAccounts = createListAccountsHandler(context);

    return {
        createProvider,
        getProvider,
        updateProvider,
        deleteProvider,
        listProviders,

        createAccount,
        getAccount,
        updateAccount,
        deleteAccount,
        listAccounts,
    };
}
