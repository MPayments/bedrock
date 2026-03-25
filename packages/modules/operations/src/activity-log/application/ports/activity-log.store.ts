import type { LogActivityInput } from "../contracts/commands";

export interface ActivityLogStore {
  insert(input: LogActivityInput): Promise<void>;
}
