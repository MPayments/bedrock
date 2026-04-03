import type { PaginatedList } from "@bedrock/shared/core/pagination";

import {
  ListUsersQuerySchema,
  type ListUsersQuery as ListUsersQueryInput,
  type User,
} from "../../contracts";
import { toUser } from "../mappers";
import type { IamUsersReads } from "../users/ports";

export class ListUsersQuery {
  constructor(private readonly reads: IamUsersReads) {}

  async execute(input?: ListUsersQueryInput): Promise<PaginatedList<User>> {
    const query = ListUsersQuerySchema.parse(input ?? {});
    const result = await this.reads.listUsers({
      limit: query.limit,
      offset: query.offset,
      ...(query.sortBy !== undefined && { sortBy: query.sortBy }),
      ...(query.sortOrder !== undefined && { sortOrder: query.sortOrder }),
      ...(query.name !== undefined && { name: query.name }),
      ...(query.email !== undefined && { email: query.email }),
      ...(query.role !== undefined && { roles: query.role }),
      ...(query.banned !== undefined && { banned: query.banned }),
    });

    return {
      ...result,
      data: result.data.map(toUser),
    };
  }
}
