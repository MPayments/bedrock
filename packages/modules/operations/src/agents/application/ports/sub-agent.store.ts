import type {
  CreateSubAgentInput,
  UpdateSubAgentInput,
} from "../contracts/sub-agent-commands";
import type { SubAgent } from "../contracts/sub-agent-dto";

export interface SubAgentStore {
  findById(id: number): Promise<SubAgent | null>;
  create(input: CreateSubAgentInput): Promise<SubAgent>;
  update(input: UpdateSubAgentInput): Promise<SubAgent | null>;
  remove(id: number): Promise<boolean>;
}
