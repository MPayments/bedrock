import { createCreateOperationalAccountHandler } from "./commands/create-account";
import { createCreateProviderHandler } from "./commands/create-provider";
import { createDeleteOperationalAccountHandler } from "./commands/delete-account";
import { createDeleteProviderHandler } from "./commands/delete-provider";
import { createGetOperationalAccountHandler } from "./commands/get-account";
import { createGetProviderHandler } from "./commands/get-provider";
import { createListOperationalAccountsHandler } from "./commands/list-accounts";
import { createListProvidersHandler } from "./commands/list-providers";
import { createResolveOperationalTransferBindingsHandler } from "./commands/resolve-transfer-bindings";
import { createUpdateOperationalAccountHandler } from "./commands/update-account";
import { createUpdateProviderHandler } from "./commands/update-provider";
import {
  createOperationalAccountsServiceContext,
  type OperationalAccountsServiceDeps,
} from "./internal/context";

export type OperationalAccountsService = ReturnType<
  typeof createOperationalAccountsService
>;

export function createOperationalAccountsService(
  deps: OperationalAccountsServiceDeps,
) {
  const context = createOperationalAccountsServiceContext(deps);

  const createProvider = createCreateProviderHandler(context);
  const getProvider = createGetProviderHandler(context);
  const updateProvider = createUpdateProviderHandler(context);
  const deleteProvider = createDeleteProviderHandler(context);
  const listProviders = createListProvidersHandler(context);

  const createAccount = createCreateOperationalAccountHandler(context);
  const getAccount = createGetOperationalAccountHandler(context);
  const updateAccount = createUpdateOperationalAccountHandler(context);
  const deleteAccount = createDeleteOperationalAccountHandler(context);
  const listAccounts = createListOperationalAccountsHandler(context);
  const resolveTransferBindings =
    createResolveOperationalTransferBindingsHandler(context);

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
    resolveTransferBindings,
  };
}
