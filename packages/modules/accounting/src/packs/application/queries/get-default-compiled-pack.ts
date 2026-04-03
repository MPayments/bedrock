import type { CompiledPack } from "../../domain";

export class GetDefaultCompiledPackQuery {
  constructor(private readonly defaultCompiledPack: CompiledPack) {}

  execute() {
    return this.defaultCompiledPack;
  }
}
