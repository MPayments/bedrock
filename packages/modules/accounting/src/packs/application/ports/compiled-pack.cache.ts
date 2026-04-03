import type { CompiledPack } from "../../domain";

export interface CompiledPackCache {
  read(key: string): CompiledPack | null | undefined;
  write(key: string, value: CompiledPack | null): void;
}
