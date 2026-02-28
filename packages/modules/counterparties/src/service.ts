import { createCreateCounterpartyGroupHandler } from "./commands/create-counterparty-group";
import { createCreateCounterpartyHandler } from "./commands/create-counterparty";
import { createFindCounterpartyByIdHandler } from "./commands/find-counterparty-by-id";
import { createListCounterpartyGroupsHandler } from "./commands/list-counterparty-groups";
import { createListCounterpartiesHandler } from "./commands/list-counterparties";
import { createRemoveCounterpartyGroupHandler } from "./commands/remove-counterparty-group";
import { createRemoveCounterpartyHandler } from "./commands/remove-counterparty";
import { createUpdateCounterpartyGroupHandler } from "./commands/update-counterparty-group";
import { createUpdateCounterpartyHandler } from "./commands/update-counterparty";
import {
    createCounterpartiesServiceContext,
    type CounterpartiesServiceDeps,
} from "./internal/context";

export type CounterpartiesService = ReturnType<typeof createCounterpartiesService>;

export function createCounterpartiesService(deps: CounterpartiesServiceDeps) {
    const context = createCounterpartiesServiceContext(deps);

    const list = createListCounterpartiesHandler(context);
    const findById = createFindCounterpartyByIdHandler(context);
    const create = createCreateCounterpartyHandler(context);
    const update = createUpdateCounterpartyHandler(context);
    const remove = createRemoveCounterpartyHandler(context);

    const listGroups = createListCounterpartyGroupsHandler(context);
    const createGroup = createCreateCounterpartyGroupHandler(context);
    const updateGroup = createUpdateCounterpartyGroupHandler(context);
    const removeGroup = createRemoveCounterpartyGroupHandler(context);

    return {
        list,
        findById,
        create,
        update,
        remove,
        listGroups,
        createGroup,
        updateGroup,
        removeGroup,
    };
}
