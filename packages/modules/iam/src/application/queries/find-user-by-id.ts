import type { UserWithLastSession } from "../../contracts";
import { UserNotFoundError } from "../../errors";
import { toUserWithLastSession } from "../mappers";
import type { IamUsersReads } from "../users/ports";

export class FindUserByIdQuery {
  constructor(private readonly reads: IamUsersReads) {}

  async execute(id: string): Promise<UserWithLastSession> {
    const row = await this.reads.getUserWithLastSession(id);

    if (!row) {
      throw new UserNotFoundError(id);
    }

    return toUserWithLastSession(row);
  }
}
