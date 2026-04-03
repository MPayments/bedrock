import type { PackRepository } from "./pack.repository";
import type { UnitOfWork } from "../../../shared/application/unit-of-work";

export interface PacksCommandTx {
  packs: PackRepository;
}

export type PacksCommandUnitOfWork = UnitOfWork<PacksCommandTx>;
